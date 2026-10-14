import { eq } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { users, type User } from "@/db/schema";
import { APP_NAME } from "../config";
import { hmac } from "../crypto";
import { rateLimit } from "../rate-limit";
import {
  generateRecoveryCodes,
  generateTotpSecret,
  looksLikeRecoveryCode,
  normalizeRecoveryCode,
  otpauthUri,
  verifyTotp,
} from "../totp";

/**
 * Two-step verification state of a user: users.totpSecretEnc (encrypted, AAD-bound), totpEnabledAt
 * (null while enrolment is unconfirmed) and recoveryCodeHashes (HMACs, each removed once used).
 */

export function hashRecoveryCode(code: string): string {
  return hmac(`recovery:${normalizeRecoveryCode(code)}`, "token");
}

/** Start (or restart) enrolment: a new secret, stored encrypted, not active until confirmed. */
export async function beginMfaEnrolment(user: Pick<User, "id" | "email" | "totpEnabledAt">): Promise<{ secret: string; uri: string } | null> {
  if (user.totpEnabledAt) return null;
  const secret = generateTotpSecret();
  await db.update(users).set({ totpSecretEnc: secret, totpEnabledAt: null }).where(eq(users.id, user.id));
  return { secret, uri: otpauthUri({ secret, account: user.email, issuer: APP_NAME }) };
}

/**
 * A TOTP code can be used once: the step it matched is recorded (rate_limits row, 2 minutes,
 * longer than the ±30 s window), so a code read over someone's shoulder can't be replayed.
 */
async function claimStep(userId: string, step: number, now: Date): Promise<boolean> {
  const res = await rateLimit(`totp-step:${hmac(userId, "token").slice(0, 24)}:${step}`, 1, 120_000, now);
  return res.ok;
}

/** Confirm enrolment with a first code: turns MFA on and returns 10 fresh recovery codes (shown once). */
export async function confirmMfaEnrolment(userId: string, code: string, now: Date = new Date()): Promise<{ codes: string[] } | null> {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user?.totpSecretEnc || user.totpEnabledAt) return null;
  const step = verifyTotp(user.totpSecretEnc, code, now.getTime());
  if (step === null || !(await claimStep(userId, step, now))) return null;
  const codes = generateRecoveryCodes();
  await db
    .update(users)
    .set({ totpEnabledAt: now, recoveryCodeHashes: codes.map(hashRecoveryCode) })
    .where(eq(users.id, userId));
  return { codes };
}

export type MfaCheck = { ok: true; method: "totp" | "recovery"; recoveryLeft: number } | { ok: false };

/**
 * Check a second-step code for a user with MFA on: a TOTP code (once per step) or a recovery
 * code (consumed). Callers rate-limit the attempts. Writes through the root db: never call it
 * inside db.transaction().
 */
export async function verifyMfaCode(userId: string, code: string, now: Date = new Date()): Promise<MfaCheck> {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user?.totpEnabledAt || !user.totpSecretEnc) return { ok: false };
  if (looksLikeRecoveryCode(code)) {
    const hash = hashRecoveryCode(code);
    if (!user.recoveryCodeHashes.includes(hash)) return { ok: false };
    const left = user.recoveryCodeHashes.filter((h) => h !== hash);
    await db.update(users).set({ recoveryCodeHashes: left }).where(eq(users.id, userId));
    return { ok: true, method: "recovery", recoveryLeft: left.length };
  }
  const step = verifyTotp(user.totpSecretEnc, code, now.getTime());
  if (step === null || !(await claimStep(userId, step, now))) return { ok: false };
  return { ok: true, method: "totp", recoveryLeft: user.recoveryCodeHashes.length };
}

/** Replace the recovery codes (the old ones stop working). */
export async function regenerateRecoveryCodes(userId: string): Promise<string[]> {
  const codes = generateRecoveryCodes();
  await db.update(users).set({ recoveryCodeHashes: codes.map(hashRecoveryCode) }).where(eq(users.id, userId));
  return codes;
}

/** Remove the authenticator and recovery codes (self-service turn-off, or a manager's reset). */
export async function clearMfa(userId: string, t: Tx = db): Promise<void> {
  await t.update(users).set({ totpSecretEnc: null, totpEnabledAt: null, recoveryCodeHashes: [] }).where(eq(users.id, userId));
}
