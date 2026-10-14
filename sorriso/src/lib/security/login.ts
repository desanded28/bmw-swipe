import { and, count, desc, eq, gt, ne } from "drizzle-orm";
import { db } from "@/db";
import { loginAttempts, sessions, users, type User } from "@/db/schema";
import { audit } from "../audit";
import { absoluteUrl } from "../config";
import { hmac } from "../crypto";
import { newId } from "../ids";
import { verifyAgainstDummy, verifyPassword } from "../password";
import { clientNetworkHash } from "../rate-limit";
import { defaultOrgFor } from "../auth";
import { emailWhen, sendAuthEmail, staffEmailLocale } from "./emails";
import { describeUserAgent } from "./user-agent";

/**
 * Password sign-in with brute-force protection (login_attempts):
 *
 * - After 5 failures for one email, or 20 from one network (an IPv6 /64 counts as one), within
 *   15 minutes, every attempt is refused with the same generic answer, the correct password
 *   included, until the window has passed. Failures before the email's last successful sign-in
 *   don't count against it.
 * - An attempt is counted before its password is checked (a row written as a failure, turned into
 *   a success afterwards), so a burst of parallel requests can't all read "0 failures" first:
 *   every request counts the rows written before it, and at most 5 per email (20 per network)
 *   ever reach the password check in a window.
 * - Unknown emails cost the same scrypt round as wrong passwords (verifyAgainstDummy) and get
 *   the same answer, so neither the response nor its timing tells whether an account exists.
 * - The account owner is emailed when the email limit is reached, and on a sign-in from a device
 *   we haven't seen.
 * Only HMACs of the email and network are stored, never the address or the IP.
 */

export const LOGIN_WINDOW_MS = 15 * 60_000;
export const MAX_EMAIL_FAILURES = 5;
export const MAX_NETWORK_FAILURES = 20;
/** A device counts as known if it signed in within this period. */
const KNOWN_DEVICE_MS = 90 * 86_400_000;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function loginEmailHash(email: string): string {
  return hmac(`login:${normalizeEmail(email)}`, "contact");
}

export type Throttle = { blocked: boolean; emailFailures: number; networkFailures: number };

/**
 * Failures in the window for this email and network. `blocked` once either has reached its limit,
 * i.e. the next attempt would be one too many. authenticate() calls it after writing its own
 * attempt (as a failure) and passes that row's id as `except`, so the attempt isn't held against
 * itself; rows still in flight from parallel requests do count.
 */
export async function loginThrottle(emailHash: string, networkHash: string, now: Date = new Date(), except?: string): Promise<Throttle> {
  const since = new Date(now.getTime() - LOGIN_WINDOW_MS);
  const [lastSuccess] = await db
    .select({ at: loginAttempts.createdAt })
    .from(loginAttempts)
    .where(and(eq(loginAttempts.emailHash, emailHash), eq(loginAttempts.success, true)))
    .orderBy(desc(loginAttempts.createdAt))
    .limit(1);
  const emailSince = lastSuccess && lastSuccess.at > since ? lastSuccess.at : since;
  const others = except ? ne(loginAttempts.id, except) : undefined;
  const [[byEmail], [byNetwork]] = await Promise.all([
    db
      .select({ n: count() })
      .from(loginAttempts)
      .where(and(eq(loginAttempts.emailHash, emailHash), eq(loginAttempts.success, false), gt(loginAttempts.createdAt, emailSince), others)),
    db
      .select({ n: count() })
      .from(loginAttempts)
      .where(and(eq(loginAttempts.ipHash, networkHash), eq(loginAttempts.success, false), gt(loginAttempts.createdAt, since), others)),
  ]);
  const emailFailures = byEmail?.n ?? 0;
  const networkFailures = byNetwork?.n ?? 0;
  return { blocked: emailFailures >= MAX_EMAIL_FAILURES || networkFailures >= MAX_NETWORK_FAILURES, emailFailures, networkFailures };
}

export async function recordLoginAttempt(i: { emailHash: string; networkHash: string; success: boolean; now?: Date }): Promise<string> {
  const id = newId();
  await db.insert(loginAttempts).values({
    id,
    emailHash: i.emailHash,
    ipHash: i.networkHash,
    success: i.success,
    createdAt: i.now ?? new Date(),
  });
  return id;
}

/**
 * Has this user signed in from this device before? Known: a successful sign-in from the same
 * network in the last 90 days, or a current session with the same browser. The first sign-in of
 * an account is never "new" (nothing to compare with).
 */
export async function isKnownDevice(i: { userId: string; emailHash: string; networkHash: string; userAgent: string | null; now?: Date }) {
  const since = new Date((i.now ?? new Date()).getTime() - KNOWN_DEVICE_MS);
  const [any] = await db
    .select({ id: loginAttempts.id })
    .from(loginAttempts)
    .where(and(eq(loginAttempts.emailHash, i.emailHash), eq(loginAttempts.success, true)))
    .limit(1);
  if (!any) return true;
  const [sameNetwork] = await db
    .select({ id: loginAttempts.id })
    .from(loginAttempts)
    .where(
      and(
        eq(loginAttempts.emailHash, i.emailHash),
        eq(loginAttempts.ipHash, i.networkHash),
        eq(loginAttempts.success, true),
        gt(loginAttempts.createdAt, since),
      ),
    )
    .limit(1);
  if (sameNetwork) return true;
  if (!i.userAgent) return false;
  const [sameBrowser] = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(and(eq(sessions.userId, i.userId), eq(sessions.userAgent, i.userAgent.slice(0, 300)), gt(sessions.createdAt, since)))
    .limit(1);
  return Boolean(sameBrowser);
}

export type AuthenticateResult = { ok: true; user: User } | { ok: false; reason: "invalid" | "throttled" };

/**
 * Check an email and password. Records the attempt, audits it (auth.login.success /
 * auth.login.fail) and sends the "repeated failures" and "new device" emails. Opening the
 * session is the caller's job.
 */
export async function authenticate(i: { email: string; password: string; headers: Headers; now?: Date }): Promise<AuthenticateResult> {
  const now = i.now ?? new Date();
  const email = normalizeEmail(i.email);
  const emailHash = loginEmailHash(email);
  const networkHash = clientNetworkHash(i.headers);
  // Count first, check second: this attempt is on record as a failure before any password is
  // tried, and the throttle reads it together with every attempt written before it. Of N parallel
  // requests, the k-th to be written sees at least k rows, so only the first 5 (20 per network)
  // can pass, however many arrive at once.
  const attemptId = await recordLoginAttempt({ emailHash, networkHash, success: false, now });
  const throttle = await loginThrottle(emailHash, networkHash, now, attemptId);
  const [user] = email ? await db.select().from(users).where(eq(users.email, email)) : [];
  const org = user ? await defaultOrgFor(user.id) : null;
  const actor = { type: "user" as const, id: user?.id ?? null };

  if (throttle.blocked) {
    // A refused attempt isn't a failure: it doesn't extend the lock, which ends when the window has passed.
    await db.delete(loginAttempts).where(eq(loginAttempts.id, attemptId));
    await audit({ orgId: org?.id ?? null, actor, action: "auth.login.fail", metadata: { reason: "throttled" }, headers: i.headers, at: now });
    return { ok: false, reason: "throttled" };
  }

  const ok = user ? await verifyPassword(i.password, user.passwordHash) : await verifyAgainstDummy(i.password);
  if (!ok || !user) {
    // The row written above stays as the failure.
    await audit({
      orgId: org?.id ?? null,
      actor,
      action: "auth.login.fail",
      metadata: { reason: user ? "password" : "unknown_account" },
      headers: i.headers,
      at: now,
    });
    if (user && throttle.emailFailures + 1 === MAX_EMAIL_FAILURES) {
      await sendAuthEmail({
        to: user.email,
        name: user.name,
        locale: staffEmailLocale(user, org),
        kind: "failedLogins",
        vars: { count: MAX_EMAIL_FAILURES },
        url: absoluteUrl("/dashboard/account/security"),
      });
    }
    return { ok: false, reason: "invalid" };
  }

  const userAgent = i.headers.get("user-agent");
  const known = await isKnownDevice({ userId: user.id, emailHash, networkHash, userAgent, now });
  await db.update(loginAttempts).set({ success: true }).where(eq(loginAttempts.id, attemptId));
  await audit({ orgId: org?.id ?? null, actor, action: "auth.login.success", headers: i.headers, at: now, metadata: { newDevice: !known } });
  if (!known) {
    const locale = staffEmailLocale(user, org);
    await sendAuthEmail({
      to: user.email,
      name: user.name,
      locale,
      kind: "newDevice",
      vars: { device: describeUserAgent(userAgent, locale), when: emailWhen(now, locale, org?.timezone) },
      url: absoluteUrl("/dashboard/account/security"),
    });
  }
  return { ok: true, user };
}

/** Record a sign-in that didn't go through authenticate() (signup, accepted invitation), so the device is known. */
export async function recordTrustedSignIn(email: string, h: Headers, now: Date = new Date()): Promise<void> {
  await recordLoginAttempt({ emailHash: loginEmailHash(email), networkHash: clientNetworkHash(h), success: true, now });
}
