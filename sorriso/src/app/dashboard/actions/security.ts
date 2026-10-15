"use server";

import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { audit } from "@/lib/audit";
import { createSession, markSessionVerified, mfaRequiredAnywhere, requireStepUp, revokeUserSessions, type StaffSession } from "@/lib/auth";
import { absoluteUrl } from "@/lib/config";
import { checkPasswordPolicy, hashPassword, verifyPassword } from "@/lib/password";
import { rateLimit } from "@/lib/rate-limit";
import { emailWhen, sendAuthEmail, staffEmailLocale } from "@/lib/security/emails";
import { checkStepUp } from "@/lib/security/login";
import { beginMfaEnrolment, clearMfa, confirmMfaEnrolment, regenerateRecoveryCodes } from "@/lib/security/mfa";
import { invalidateUserTokens, issueAuthToken } from "@/lib/security/tokens";
import { formatSecret } from "@/lib/totp";
import { securityTexts } from "@/lib/security/staff-locale";
import { fail, guard, ok, type ActionResult } from "./_shared";

/**
 * The signed-in user's own security: password, two-step verification, sessions, re-authentication
 * (step-up) and email confirmation. Every member manages their own account; nothing here reaches
 * another user's data. Auth events are audited on the active practice's chain.
 */


async function requestHeaders(): Promise<Headers> {
  return new Headers(await headers());
}

async function loadUser(id: string) {
  const [u] = await db.select().from(users).where(eq(users.id, id));
  return u ?? null;
}

const actor = (s: StaffSession) => ({ orgId: s.org.id, actor: { type: "user" as const, id: s.user.id } });

// ---------------------------------------------------------------- password

export async function changePassword(input: { current: string; next: string; confirm: string }): Promise<ActionResult> {
  return guard(async (s) => {
    const t = await securityTexts(s);
    const limit = await rateLimit(`password-change:${s.user.id}`, 5, 15 * 60_000);
    if (!limit.ok) return fail(t("errors.rateLimited"), "rate_limited");
    const user = await loadUser(s.user.id);
    if (!user || !(await verifyPassword(String(input.current ?? ""), user.passwordHash))) return fail(t("password.wrongCurrent"), "wrong_password");
    const next = String(input.next ?? "");
    if (next !== String(input.confirm ?? "")) return fail(t("password.mismatch"), "mismatch");
    const problem = checkPasswordPolicy(next, { email: user.email, name: user.name });
    if (problem) return fail(t(`password.problems.${problem}`), problem);

    const now = new Date();
    const h = await requestHeaders();
    await db.update(users).set({ passwordHash: await hashPassword(next), passwordChangedAt: now }).where(eq(users.id, user.id));
    // A reset link requested earlier (perhaps by whoever made them change it) must not set yet another password.
    await invalidateUserTokens(user.id, "password_reset", now);
    // Every session ends, this one included; this device gets a fresh one (rotation) right after.
    await revokeUserSessions(user.id);
    await createSession(user.id, s.org.id, { headers: h, mfaVerifiedAt: now, now: new Date(now.getTime() + 1) });
    await audit({ ...actor(s), action: "auth.password.change", entity: { type: "user", id: user.id }, headers: h });
    const locale = staffEmailLocale(user, s.org);
    await sendAuthEmail({
      to: user.email,
      name: user.name,
      locale,
      kind: "passwordChanged",
      vars: { when: emailWhen(now, locale, s.org.timezone) },
      url: absoluteUrl(`/${locale}/reset-password`),
    });
    return ok(t("password.changed"));
  });
}

// ---------------------------------------------------------------- sessions

/** Sign out one of your own sessions (never another user's: the delete is scoped by user). */
export async function revokeSession(sessionId: string): Promise<ActionResult> {
  return guard(async (s) => {
    const t = await securityTexts(s);
    if (sessionId === s.sessionId) return fail(t("errors.notFound"), "not_found");
    const res = await db.delete(sessions).where(and(eq(sessions.id, sessionId), eq(sessions.userId, s.user.id)));
    if (!res.rowsAffected) return fail(t("errors.notFound"), "not_found");
    await audit({ ...actor(s), action: "session.revoke", entity: { type: "user", id: s.user.id }, metadata: { count: 1 }, headers: await requestHeaders() });
    return ok(t("sessions.revoked"));
  });
}

export async function revokeOtherSessions(): Promise<ActionResult> {
  return guard(async (s) => {
    const t = await securityTexts(s);
    const count = await revokeUserSessions(s.user.id, { except: s.sessionId });
    if (count) {
      await audit({ ...actor(s), action: "session.revoke", entity: { type: "user", id: s.user.id }, metadata: { count }, headers: await requestHeaders() });
    }
    return ok(count ? t("sessions.revokedOthers", { count }) : t("sessions.revokedNone"));
  });
}

// ---------------------------------------------------------------- two-step verification

/**
 * Step 1: a new secret (encrypted at rest), returned once with its otpauth:// URI.
 * Both steps need a recent verification: someone holding only a stolen session cookie must not be
 * able to put their own authenticator on the account (step 2 also signs every other session out).
 * Right after signing in that is already the case (the password counts), so the enrolment the
 * dashboard forces after login goes straight through.
 */
export async function startMfaEnrolment(): Promise<ActionResult> {
  return guard(async (s) => {
    const t = await securityTexts(s);
    await requireStepUp(10, s);
    const user = await loadUser(s.user.id);
    if (!user) return fail(t("errors.notFound"), "not_found");
    const started = await beginMfaEnrolment(user);
    if (!started) return fail(t("mfa.alreadyEnabled"), "already_enabled");
    return ok(undefined, { secret: started.secret, formatted: formatSecret(started.secret), uri: started.uri });
  });
}

/** Step 2: the first code turns MFA on; returns the 10 recovery codes (once). Other sessions end. */
export async function confirmMfaEnrolmentAction(code: string): Promise<ActionResult> {
  return guard(async (s) => {
    const t = await securityTexts(s);
    await requireStepUp(10, s);
    const limit = await rateLimit(`mfa-enrol:${s.user.id}`, 10, 15 * 60_000);
    if (!limit.ok) return fail(t("errors.rateLimited"), "rate_limited");
    const done = await confirmMfaEnrolment(s.user.id, String(code ?? ""));
    if (!done) return fail(t("mfa.invalidCode"), "invalid_code");
    // Sessions opened with the password alone predate the second factor.
    await revokeUserSessions(s.user.id, { except: s.sessionId });
    await markSessionVerified(s.sessionId);
    await audit({ ...actor(s), action: "auth.mfa.enable", entity: { type: "user", id: s.user.id }, headers: await requestHeaders() });
    return ok(t("mfa.enabled"), { codes: done.codes });
  });
}

export async function regenerateRecoveryCodesAction(): Promise<ActionResult> {
  return guard(async (s) => {
    const t = await securityTexts(s);
    await requireStepUp(10, s);
    const user = await loadUser(s.user.id);
    if (!user?.totpEnabledAt) return fail(t("errors.notFound"), "not_found");
    const codes = await regenerateRecoveryCodes(s.user.id);
    await audit({
      ...actor(s),
      action: "auth.mfa.enable",
      entity: { type: "user", id: s.user.id },
      metadata: { change: "recovery_codes_regenerated" },
      headers: await requestHeaders(),
    });
    return ok(t("mfa.regenerated"), { codes });
  });
}

/**
 * Remove the authenticator: to move to a new phone (`replace`, always allowed: enrolment starts
 * again right after) or to turn MFA off (only when the role and the practice don't require it).
 */
export async function removeMfa(mode: "replace" | "disable"): Promise<ActionResult> {
  return guard(async (s) => {
    const t = await securityTexts(s);
    await requireStepUp(10, s);
    const user = await loadUser(s.user.id);
    if (!user?.totpEnabledAt) return fail(t("errors.notFound"), "not_found");
    if (mode === "disable" && mfaRequiredAnywhere(s)) return fail(t("mfa.cannotDisable"), "mfa_required");
    await clearMfa(s.user.id);
    await audit({
      ...actor(s),
      action: "auth.mfa.disable",
      entity: { type: "user", id: s.user.id },
      metadata: { change: mode === "replace" ? "removed_for_replacement" : "disabled" },
      headers: await requestHeaders(),
    });
    return ok(t(mode === "replace" ? "mfa.replaced" : "mfa.disabled"));
  });
}

// ---------------------------------------------------------------- step-up

/**
 * Re-authenticate for sensitive actions: a TOTP or recovery code when MFA is on, the password
 * otherwise. 5 tries per 15 minutes per session, and the account-wide limits of signing in
 * (checkStepUp: login_attempts for the password, the per-account code bucket for MFA), which
 * a new session id (switching practice) doesn't reset.
 */
export async function verifyStepUp(input: { code?: string; password?: string }): Promise<ActionResult> {
  return guard(async (s) => {
    const t = await securityTexts(s);
    const limit = await rateLimit(`step-up:${s.sessionId.slice(0, 32)}`, 5, 15 * 60_000);
    if (!limit.ok) return fail(t("errors.rateLimited"), "rate_limited");
    const user = await loadUser(s.user.id);
    if (!user) return fail(t("errors.notFound"), "not_found");
    const h = await requestHeaders();
    const check = await checkStepUp({ user, code: input.code, password: input.password, headers: h });
    if (check === "throttled") {
      await audit({ ...actor(s), action: user.totpEnabledAt ? "auth.mfa.fail" : "auth.login.fail", metadata: { step: "step_up", reason: "throttled" }, headers: h });
      return fail(t("errors.rateLimited"), "rate_limited");
    }
    const passed = check === "ok";
    if (!passed) {
      await audit({ ...actor(s), action: user.totpEnabledAt ? "auth.mfa.fail" : "auth.login.fail", metadata: { step: "step_up" }, headers: h });
      return fail(t("stepUp.invalid"), "invalid_code");
    }
    await markSessionVerified(s.sessionId);
    await audit({ ...actor(s), action: "auth.login.success", metadata: { step: "step_up" }, headers: h });
    return ok(t("stepUp.done"));
  });
}

// ---------------------------------------------------------------- email confirmation

export async function resendVerificationEmail(): Promise<ActionResult> {
  return guard(async (s) => {
    const t = await securityTexts(s);
    const limit = await rateLimit(`verify-resend:${s.user.id}`, 3, 60 * 60_000);
    if (!limit.ok) return fail(t("errors.rateLimited"), "rate_limited");
    const user = await loadUser(s.user.id);
    if (!user || user.emailVerifiedAt) return ok(t("email.resent"));
    const owned = s.orgs.find((o) => o.role === "owner" && o.org.email?.toLowerCase() === user.email.toLowerCase());
    const { token, id } = await issueAuthToken({ kind: "email_verify", userId: user.id, email: user.email, orgId: owned?.org.id ?? null });
    await audit({
      ...actor(s),
      action: "auth.email.resend",
      entity: { type: "user", id: user.id },
      metadata: { tokenId: id.slice(0, 16) },
      headers: await requestHeaders(),
    });
    const locale = staffEmailLocale(user, s.org);
    await sendAuthEmail({
      to: user.email,
      name: user.name,
      locale,
      kind: "verifyEmailAgain",
      vars: {},
      url: absoluteUrl(`/${locale}/verify-email/${token}`),
    });
    return ok(t("email.resent"));
  });
}
