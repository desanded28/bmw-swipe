import { randomInt, timingSafeEqual } from "node:crypto";
import { and, count, eq, gt, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { verificationCodes, type Locale, type OtpPurpose } from "@/db/schema";
import { getT } from "@/i18n/t";
import { contactHash, normalizeContact } from "./contact";
import { hmac } from "./crypto";
import { newId } from "./ids";
import { deliver } from "./messaging";
import { clientNetworkHash } from "./rate-limit";

/**
 * One-time codes sent by SMS or email: privacy-center sign-in, contact changes, form
 * signatures, link re-issue, other-adult confirmation.
 *
 * - 6 digits, valid 5 minutes, 5 attempts per code.
 * - Only an HMAC of the code (bound to its challenge id) is stored, and the message log keeps
 *   a redacted body: neither the database nor a log export can replay a code.
 * - Per contact: at most 3 codes per 15 minutes and 10 per day, and after 10 wrong codes in a
 *   day the contact is locked (no new codes, no checks, not even of a right code) until those
 *   failures are a day old. Without the lock, fresh codes would allow ~1,400 guesses a day
 *   against one phone. The price: someone who knows a contact can block its sign-in for a day.
 * - Per network (an IPv4 address or an IPv6 /64): 10 codes per hour. Requests without a usable
 *   address share one bucket, so a caller that loses the headers fails closed.
 * - Every limit is counted from the verification_codes table itself, so it holds across
 *   serverless instances.
 *
 * Both functions write through the root db: don't call them inside db.transaction().
 */

export const OTP_TTL_MS = 5 * 60_000;
export const OTP_MAX_ATTEMPTS = 5;
/** Wrong codes per contact per day before the contact is locked. */
export const OTP_MAX_FAILURES = 10;
const DAY_MS = 24 * 60 * 60_000;
const TARGET_LIMIT = { max: 3, windowMs: 15 * 60_000 };
const TARGET_DAILY_LIMIT = 10;
const IP_LIMIT = { max: 10, windowMs: 60 * 60_000 };
const MASK = "••••••";

export type OtpChannel = "sms" | "email";

export type SendOtpInput = {
  purpose: OtpPurpose;
  channel: OtpChannel;
  /** Phone (any format normalizePhone accepts) or email. */
  to: string;
  locale: Locale;
  /** The practice the code is sent for (message log); null for platform codes. */
  orgId?: string | null;
  /** Email sender name, e.g. the practice. */
  fromName?: string;
  /** The visitor's request headers: required, the per-network limit is keyed on them. */
  headers: Headers;
  now?: Date;
};

const codeHash = (challengeId: string, code: string) => hmac(`${challengeId}:${code}`, "otp");

function texts(locale: Locale, code: string) {
  const t = getT(locale, "common");
  return {
    sms: t("otp.sms", { code }),
    subject: t("otp.emailSubject"),
    email: [t("otp.emailIntro"), code, t("otp.emailBody"), t("otp.emailIgnore")].join("\n\n"),
  };
}

/**
 * Wrong guesses on a contact's codes created after `since`: every check counts an attempt and a
 * consumed code had exactly one right one. A subquery, so it sits inside the UPDATE that counts
 * an attempt and the lock holds against parallel guesses.
 */
const failuresSince = (targetHash: string, since: number) =>
  sql<number>`(SELECT COALESCE(SUM(vc.attempts), 0) - COUNT(vc.consumed_at) FROM verification_codes vc WHERE vc.target_hash = ${targetHash} AND vc.created_at > ${since})`;

export async function sendOtp(i: SendOtpInput): Promise<{ ok: true; challengeId: string } | { ok: false; reason: "rate_limited" }> {
  const now = i.now ?? new Date();
  const kind = i.channel === "email" ? "email" : "phone";
  const to = normalizeContact(kind, i.to);
  if (!to) throw new TypeError(`sendOtp: invalid ${kind}`);
  const targetHash = contactHash(kind, to)!;
  const ipHash = clientNetworkHash(i.headers);
  const challengeId = newId(16);
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");

  const allowed = await db.transaction(async (tx) => {
    const ago = (ms: number) => now.getTime() - ms;
    const [target] = await tx
      .select({
        today: count(),
        recent: sql<number>`COUNT(CASE WHEN ${verificationCodes.createdAt} > ${ago(TARGET_LIMIT.windowMs)} THEN 1 END)`,
        failures: sql<number>`COALESCE(SUM(${verificationCodes.attempts}), 0) - COUNT(${verificationCodes.consumedAt})`,
      })
      .from(verificationCodes)
      .where(and(eq(verificationCodes.targetHash, targetHash), gt(verificationCodes.createdAt, new Date(ago(DAY_MS)))));
    if (target.recent >= TARGET_LIMIT.max || target.today >= TARGET_DAILY_LIMIT || target.failures >= OTP_MAX_FAILURES) return false;
    const [perIp] = await tx
      .select({ n: count() })
      .from(verificationCodes)
      .where(and(eq(verificationCodes.ipHash, ipHash), gt(verificationCodes.createdAt, new Date(ago(IP_LIMIT.windowMs)))));
    if (perIp.n >= IP_LIMIT.max) return false;
    await tx.insert(verificationCodes).values({
      id: challengeId,
      purpose: i.purpose,
      channel: i.channel,
      targetHash,
      codeHash: codeHash(challengeId, code),
      expiresAt: new Date(now.getTime() + OTP_TTL_MS),
      ipHash,
      createdAt: now,
    });
    return true;
  });
  if (!allowed) return { ok: false, reason: "rate_limited" };

  const real = texts(i.locale, code);
  const redacted = texts(i.locale, MASK);
  await deliver(
    i.channel === "email"
      ? { orgId: i.orgId ?? null, channel: "email", to, subject: real.subject, text: real.email, logBody: redacted.email, fromName: i.fromName }
      : { orgId: i.orgId ?? null, channel: "sms", to, text: real.sms, logBody: redacted.sms },
  );
  return { ok: true, challengeId };
}

export type VerifyOtpResult =
  | { ok: true; targetHash: string; purpose: OtpPurpose; channel: OtpChannel }
  | { ok: false; reason: "invalid" | "expired" | "too_many_attempts" };

/**
 * Check a code. Every check counts as an attempt (the counter is incremented atomically
 * before comparing, in the same statement that checks the contact's daily failures), so
 * parallel guesses can't exceed either limit. A correct code is consumed. A locked contact gets
 * too_many_attempts even for the right code. Pass `purpose` so a code issued for one flow can't
 * open another.
 */
export async function verifyOtp(i: { challengeId: string; code: string; purpose?: OtpPurpose; now?: Date }): Promise<VerifyOtpResult> {
  const now = i.now ?? new Date();
  const [row] = await db.select().from(verificationCodes).where(eq(verificationCodes.id, i.challengeId));
  if (!row || row.consumedAt || (i.purpose && row.purpose !== i.purpose)) return { ok: false, reason: "invalid" };
  if (row.attempts >= OTP_MAX_ATTEMPTS) return { ok: false, reason: "too_many_attempts" };
  if (now.getTime() >= row.expiresAt.getTime()) return { ok: false, reason: "expired" };

  const [counted] = await db
    .update(verificationCodes)
    .set({ attempts: sql`${verificationCodes.attempts} + 1` })
    .where(
      and(
        eq(verificationCodes.id, row.id),
        lt(verificationCodes.attempts, OTP_MAX_ATTEMPTS),
        isNull(verificationCodes.consumedAt),
        sql`${failuresSince(row.targetHash, now.getTime() - DAY_MS)} < ${OTP_MAX_FAILURES}`,
      ),
    )
    .returning({ attempts: verificationCodes.attempts });
  if (!counted) return { ok: false, reason: "too_many_attempts" };

  const code = i.code.replace(/\s+/g, "");
  const expected = Buffer.from(row.codeHash);
  const given = Buffer.from(codeHash(row.id, code));
  if (!/^\d{6}$/.test(code) || given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return { ok: false, reason: "invalid" };
  }

  const [consumed] = await db
    .update(verificationCodes)
    .set({ consumedAt: now })
    .where(and(eq(verificationCodes.id, row.id), isNull(verificationCodes.consumedAt)))
    .returning({ id: verificationCodes.id });
  if (!consumed) return { ok: false, reason: "invalid" };
  return { ok: true, targetHash: row.targetHash, purpose: row.purpose, channel: row.channel };
}
