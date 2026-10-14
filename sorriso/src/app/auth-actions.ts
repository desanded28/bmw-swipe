"use server";

import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import {
  locations,
  memberships,
  organizations,
  practitionerServices,
  practitioners,
  rooms,
  schedules,
  services,
  users,
} from "@/db/schema";
import { toLocale, type Locale } from "@/i18n/config";
import { getT } from "@/i18n/t";
import { zodErrorMap } from "@/i18n/zod";
import { audit } from "@/lib/audit";
import {
  createSession,
  defaultOrgFor,
  destroySession,
  getPendingMfaSession,
  getSession,
  revokeUserSessions,
  safeNext,
} from "@/lib/auth";
import { absoluteUrl } from "@/lib/config";
import { newId, slugify } from "@/lib/ids";
import { checkPasswordPolicy, hashPassword, verifyAgainstDummy } from "@/lib/password";
import { recordLegalAcceptance } from "@/lib/privacy/legal";
import { rateLimit, rateLimitByIp } from "@/lib/rate-limit";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import { emailWhen, sendAuthEmail, staffEmailLocale } from "@/lib/security/emails";
import { authenticate, loginEmailHash, normalizeEmail, recordTrustedSignIn } from "@/lib/security/login";
import { verifyMfaCode } from "@/lib/security/mfa";
import { consumeAuthToken, findAuthToken, invalidateUserTokens, issueAuthToken } from "@/lib/security/tokens";

/**
 * Public account actions: sign-in (with the second step), sign-out, practice signup, password
 * reset, email confirmation and accepting a team invitation. Every answer is localised from the
 * auth namespace (the form posts its locale), and answers that could reveal whether an email has
 * an account are identical for both cases.
 */

export type FormState = {
  error?: string;
  /** Field name -> message. */
  fieldErrors?: Record<string, string>;
  /** The request went through (neutral "check your inbox" screens). */
  done?: boolean;
  email?: string;
  /** What the user typed (never passwords), to refill the form after an error. */
  values?: Record<string, string>;
} | null;

const field = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const localeOf = (fd: FormData): Locale => toLocale(fd.get("locale"));

async function requestHeaders(): Promise<Headers> {
  return new Headers(await headers());
}

// ---------------------------------------------------------------- sign-in

export async function login(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = localeOf(fd);
  const t = getT(locale, "auth");
  const h = await requestHeaders();
  const email = normalizeEmail(field(fd, "email"));
  const res = await authenticate({ email, password: String(fd.get("password") ?? ""), headers: h });
  // One answer for a wrong password and for an unknown email.
  if (!res.ok) return { error: t(res.reason === "throttled" ? "errors.throttled" : "errors.invalidCredentials"), values: { email } };

  const user = res.user;
  const org = await defaultOrgFor(user.id);
  const next = safeNext(field(fd, "next"));
  if (user.totpEnabledAt) {
    // Password only: a pending session, usable for nothing but the second step.
    await createSession(user.id, org?.id ?? null, { headers: h });
    redirect(`/${locale}/login/mfa${next !== "/dashboard" ? `?next=${encodeURIComponent(next)}` : ""}`);
  }
  // Without MFA, the password is the most recent authentication (requireStepUp counts from it).
  await createSession(user.id, org?.id ?? null, { headers: h, mfaVerifiedAt: new Date() });
  redirect(next);
}

/** Second step: a TOTP code or a recovery code, at most 5 tries per sign-in and 10 per 15 minutes per user. */
export async function verifyMfaLogin(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = localeOf(fd);
  const t = getT(locale, "auth");
  const pending = await getPendingMfaSession();
  if (!pending) return { error: t("errors.mfaExpired") };
  const h = await requestHeaders();
  const [perSession, perUser] = await Promise.all([
    rateLimit(`mfa-login:${pending.sessionId.slice(0, 32)}`, 5, 10 * 60_000),
    rateLimit(`mfa-user:${loginEmailHash(pending.user.email).slice(0, 32)}`, 10, 15 * 60_000),
  ]);
  if (!perSession.ok || !perUser.ok) {
    await destroySession();
    return { error: t("errors.throttled") };
  }
  const check = await verifyMfaCode(pending.user.id, field(fd, "code"));
  const orgId = pending.org?.id ?? null;
  if (!check.ok) {
    await audit({ orgId, actor: { type: "user", id: pending.user.id }, action: "auth.mfa.fail", headers: h });
    return { error: t("errors.invalidCode") };
  }
  await audit({
    orgId,
    actor: { type: "user", id: pending.user.id },
    action: "auth.login.success",
    metadata: { step: "mfa", method: check.method, recoveryLeft: check.recoveryLeft },
    headers: h,
  });
  // A fresh session id for the fully authenticated session (the pending one is deleted).
  await createSession(pending.user.id, orgId, { headers: h, mfaVerifiedAt: new Date() });
  redirect(safeNext(field(fd, "next")));
}

/** Back from the second step to the login form. */
export async function cancelMfaLogin(fd: FormData): Promise<void> {
  await destroySession();
  redirect(`/${localeOf(fd)}/login`);
}

export async function logout() {
  const s = await getSession();
  if (s) {
    await audit({ orgId: s.org?.id ?? null, actor: { type: "user", id: s.user.id }, action: "auth.logout", headers: await requestHeaders() });
  }
  await destroySession();
  redirect("/");
}

export async function redirectIfLoggedIn() {
  const session = await getSession();
  if (session?.org) redirect("/dashboard");
}

// ---------------------------------------------------------------- signup

function signupSchema(t: ReturnType<typeof getT<"auth">>) {
  return z.object({
    name: z.string().trim().min(2).max(120),
    email: z.email().max(254).transform((e) => e.toLowerCase()),
    password: z.string(),
    practiceName: z.string().trim().min(2).max(120),
    address: z.string().trim().min(3).max(200),
    city: z.string().trim().min(2).max(80),
    phone: z.string().trim().max(40).optional(),
    isDentist: z.boolean(),
    acceptTerms: z.literal(true, { error: t("errors.termsRequired") }),
    acceptDpa: z.literal(true, { error: t("errors.termsRequired") }),
  });
}

function fieldErrorsOf(issues: readonly { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const key = String(i.path[0] ?? "form");
    out[key] ??= i.message;
  }
  return out;
}

/**
 * Create a practice with one office, two chairs, starter services and (optionally) the owner as
 * dentist; accept the terms, the DPA and the sub-processor list; send the email confirmation.
 * The answer is the same "check your inbox" whether or not the email already had an account
 * (that address gets a different email instead), so the form can't be used to find accounts.
 */
export async function signup(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = localeOf(fd);
  const t = getT(locale, "auth");
  const h = await requestHeaders();
  const values = Object.fromEntries(
    ["name", "email", "practiceName", "address", "city", "phone"].map((k) => [k, field(fd, k)]),
  );
  const limited = await rateLimitByIp(h, "signup", 5, 60 * 60_000);
  if (!limited.ok) return { error: t("errors.rateLimited"), values };

  const parsed = signupSchema(t).safeParse(
    {
      name: fd.get("name"),
      email: field(fd, "email"),
      password: String(fd.get("password") ?? ""),
      practiceName: fd.get("practiceName"),
      address: fd.get("address"),
      city: fd.get("city"),
      phone: field(fd, "phone") || undefined,
      isDentist: fd.get("isDentist") === "on",
      acceptTerms: fd.get("acceptTerms") === "on",
      acceptDpa: fd.get("acceptDpa") === "on",
    },
    { error: zodErrorMap(locale) },
  );
  // The password rules run whatever else is wrong, so every problem shows at once.
  const problem = checkPasswordPolicy(String(fd.get("password") ?? ""), { email: values.email, name: values.name });
  if (!parsed.success || problem) {
    const fieldErrors = parsed.success ? {} : fieldErrorsOf(parsed.error.issues);
    if (problem) fieldErrors.password = t(`password.${problem}`);
    return { error: t("errors.invalidForm"), fieldErrors, values };
  }
  const input = parsed.data;
  const done: FormState = { done: true, email: input.email };

  const [existing] = await db.select().from(users).where(eq(users.email, input.email));
  if (existing) {
    // Same cost as creating an account (scrypt), and a heads-up to the real owner of the address.
    await verifyAgainstDummy(input.password);
    await sendAuthEmail({
      to: existing.email,
      name: existing.name,
      locale: staffEmailLocale(existing),
      kind: "signupExisting",
      vars: {},
      url: absoluteUrl(`/${staffEmailLocale(existing)}/login`),
    });
    return done;
  }

  let slug = slugify(input.practiceName) || "practice";
  const [taken] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.slug, slug));
  if (taken) slug = `${slug}-${newId(4).toLowerCase()}`;

  const passwordHash = await hashPassword(input.password);
  const userId = newId();
  const orgId = newId();
  const locationId = newId();
  const verify = await db.transaction(async (tx) => {
    // users.locale stays null (automatic): the practice's default language below is the signup page's.
    await tx.insert(users).values({ id: userId, email: input.email, name: input.name, passwordHash });
    await tx.insert(organizations).values({
      id: orgId,
      slug,
      name: input.practiceName,
      phone: input.phone ?? null,
      email: input.email,
      settings: DEFAULT_SETTINGS,
      defaultLocale: locale,
    });
    await tx.insert(memberships).values({ userId, orgId, role: "owner", createdAt: new Date() });
    await tx.insert(locations).values({ id: locationId, orgId, name: input.city, address: input.address, city: input.city, phone: input.phone ?? null });
    // Starter content in the practice's language; the practice renames it as it likes.
    await tx.insert(rooms).values([
      { id: newId(), locationId, name: t("starter.room", { n: 1 }) },
      { id: newId(), locationId, name: t("starter.room", { n: 2 }) },
    ]);
    const starter = [
      { name: t("starter.firstVisit"), category: "checkup" as const, durationMinutes: 30, priceCents: 5000 },
      { name: t("starter.cleaning"), category: "hygiene" as const, durationMinutes: 45, bufferMinutes: 10, priceCents: 9000 },
      { name: t("starter.emergency"), category: "emergency" as const, durationMinutes: 30, priceCents: 8000 },
    ].map((s, i) => ({ id: newId(), orgId, sortOrder: i, ...s }));
    await tx.insert(services).values(starter);
    if (input.isDentist) {
      const practitionerId = newId();
      await tx.insert(practitioners).values({
        id: practitionerId,
        orgId,
        userId,
        slug: slugify(input.name),
        title: t("starter.title"),
        name: input.name,
        specialty: t("starter.specialty"),
        // Non-secret placeholder: feeds are issued by rotateIcsToken, which stores only the hash.
        icsToken: `h:${practitionerId}`,
      });
      await tx.insert(practitionerServices).values(starter.map((s) => ({ practitionerId, serviceId: s.id })));
      await tx.insert(schedules).values(
        [1, 2, 3, 4, 5].flatMap((weekday) => [
          { id: newId(), practitionerId, locationId, weekday, startMinute: 9 * 60, endMinute: 13 * 60 },
          { id: newId(), practitionerId, locationId, weekday, startMinute: 14 * 60, endMinute: 18 * 60 },
        ]),
      );
    }
    // The two unticked boxes on the form: the terms, and the DPA with its sub-processor list.
    for (const doc of ["terms", "dpa", "subprocessors"] as const) {
      await recordLegalAcceptance(tx, { orgId, userId, doc, locale, headers: h });
    }
    await audit(
      {
        orgId,
        actor: { type: "user", id: userId },
        action: "auth.signup",
        entity: { type: "org", id: orgId },
        metadata: { practitioner: input.isDentist },
        headers: h,
      },
      tx,
    );
    return issueAuthToken({ kind: "email_verify", userId, email: input.email, orgId }, tx);
  });

  await recordTrustedSignIn(input.email, h);
  await sendAuthEmail({
    to: input.email,
    name: input.name,
    locale,
    kind: "verifyEmail",
    vars: { practice: input.practiceName },
    url: absoluteUrl(`/${locale}/verify-email/${verify.token}`),
  });
  return done;
}

// ---------------------------------------------------------------- email confirmation

/**
 * What an email_verify link confirms. One token kind serves two addresses, and the token's own
 * address decides which:
 * - the user's sign-in address (signup, "send the link again"): users.emailVerifiedAt;
 * - the practice's email (signup, where it is the owner's address, or a practice email changed in
 *   the settings: sendPracticeEmailVerification): organizations.emailVerifiedAt, when the token
 *   was issued for that practice by one of its owners and the address is still the practice's.
 * So a link sent to the practice's mailbox never confirms the owner's own address, and a link
 * whose address is neither any more (changed since it was sent) confirms nothing.
 */
async function verificationTargets(row: { userId: string; email: string | null; orgId: string | null }) {
  const [user] = await db.select({ email: users.email }).from(users).where(eq(users.id, row.userId));
  if (!user) return { own: false, practice: false };
  const address = (row.email ?? user.email).toLowerCase();
  let practice = false;
  if (row.orgId) {
    const [owner] = await db
      .select({ role: memberships.role })
      .from(memberships)
      .where(and(eq(memberships.orgId, row.orgId), eq(memberships.userId, row.userId)));
    const [org] = await db.select({ email: organizations.email }).from(organizations).where(eq(organizations.id, row.orgId));
    practice = owner?.role === "owner" && org?.email?.toLowerCase() === address;
  }
  return { own: user.email.toLowerCase() === address, practice };
}

export async function verifyEmail(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = localeOf(fd);
  const t = getT(locale, "auth");
  const row = await findAuthToken(field(fd, "token"), "email_verify");
  if (!row?.userId) return { error: t("verify.invalid") };
  const userId = row.userId;
  const target = await verificationTargets({ userId, email: row.email, orgId: row.orgId });
  if ((!target.own && !target.practice) || !(await consumeAuthToken(row.id))) return { error: t("verify.invalid") };
  const now = new Date();
  const h = await requestHeaders();
  const actor = { type: "user" as const, id: userId };
  const tokenId = row.id.slice(0, 16);
  if (target.own) {
    await db.update(users).set({ emailVerifiedAt: now }).where(eq(users.id, userId));
    // In the chain of the practice the link was issued for, else the user's own.
    const auditOrg = row.orgId ?? (await defaultOrgFor(userId))?.id ?? null;
    await audit({ orgId: auditOrg, actor, action: "auth.email.verify", entity: { type: "user", id: userId }, metadata: { tokenId }, headers: h, at: now });
  }
  if (target.practice && row.orgId) {
    await db.update(organizations).set({ emailVerifiedAt: now }).where(eq(organizations.id, row.orgId));
    await audit({ orgId: row.orgId, actor, action: "auth.email.verify", entity: { type: "org", id: row.orgId }, metadata: { tokenId }, headers: h, at: now });
  }
  const session = await getSession();
  if (!session) redirect(`/${locale}/login?notice=verified`);
  redirect(target.own ? "/dashboard/account/security?verified=1" : "/dashboard/settings?emailVerified=1");
}

// ---------------------------------------------------------------- password reset

/** Always the same answer; the email goes out only when the account exists. */
export async function requestPasswordReset(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = localeOf(fd);
  const t = getT(locale, "auth");
  const h = await requestHeaders();
  const email = normalizeEmail(field(fd, "email"));
  if (!z.email().safeParse(email).success) return { fieldErrors: { email: t("errors.invalidForm") }, values: { email } };
  const [byNetwork, byEmail] = await Promise.all([
    rateLimitByIp(h, "password-reset", 5, 15 * 60_000),
    rateLimit(`password-reset:${loginEmailHash(email).slice(0, 32)}`, 3, 60 * 60_000),
  ]);
  if (!byNetwork.ok) return { error: t("errors.rateLimited"), values: { email } };
  const done: FormState = { done: true, email };
  // Over the per-email limit: answer as usual, send nothing more.
  if (!byEmail.ok) return done;

  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user) return done;
  const org = await defaultOrgFor(user.id);
  const userLocale = staffEmailLocale(user, org);
  await invalidateUserTokens(user.id, "password_reset");
  const { token } = await issueAuthToken({ kind: "password_reset", userId: user.id, email: user.email });
  await audit({ orgId: org?.id ?? null, actor: { type: "user", id: user.id }, action: "auth.password.reset", metadata: { step: "requested" }, headers: h });
  await sendAuthEmail({
    to: user.email,
    name: user.name,
    locale: userLocale,
    kind: "passwordReset",
    vars: {},
    url: absoluteUrl(`/${userLocale}/reset-password/${token}`),
  });
  return done;
}

export async function resetPassword(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = localeOf(fd);
  const t = getT(locale, "auth");
  const h = await requestHeaders();
  const row = await findAuthToken(field(fd, "token"), "password_reset");
  if (!row?.userId) return { error: t("reset.invalid") };
  const [user] = await db.select().from(users).where(eq(users.id, row.userId));
  if (!user) return { error: t("reset.invalid") };
  const password = String(fd.get("password") ?? "");
  if (password !== String(fd.get("confirm") ?? "")) return { fieldErrors: { confirm: t("password.mismatch") } };
  const problem = checkPasswordPolicy(password, { email: user.email, name: user.name });
  if (problem) return { fieldErrors: { password: t(`password.${problem}`) } };
  if (!(await consumeAuthToken(row.id))) return { error: t("reset.invalid") };

  const now = new Date();
  await db.update(users).set({ passwordHash: await hashPassword(password), passwordChangedAt: now }).where(eq(users.id, user.id));
  await revokeUserSessions(user.id);
  await invalidateUserTokens(user.id, "password_reset", now);
  const org = await defaultOrgFor(user.id);
  await audit({ orgId: org?.id ?? null, actor: { type: "user", id: user.id }, action: "auth.password.reset", metadata: { step: "completed" }, headers: h });
  const userLocale = staffEmailLocale(user, org);
  await sendAuthEmail({
    to: user.email,
    name: user.name,
    locale: userLocale,
    kind: "passwordChanged",
    vars: { when: emailWhen(now, userLocale, org?.timezone) },
    url: absoluteUrl(`/${userLocale}/reset-password`),
  });
  redirect(`/${locale}/login?notice=passwordChanged`);
}

// ---------------------------------------------------------------- invitations

/**
 * Accept a team invitation: the invitee accepts the staff instructions (recorded with
 * recordLegalAcceptance('staff_instructions'), which also stamps memberships.instructionsVersion),
 * then either joins with the account they're signed in with (same email as the invitation) or
 * creates one. The token is consumed inside the same transaction, so it works once.
 */
export async function acceptInvite(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = localeOf(fd);
  const t = getT(locale, "auth");
  const h = await requestHeaders();
  const row = await findAuthToken(field(fd, "token"), "invite");
  if (!row?.orgId || !row.role || !row.email) return { error: t("invite.invalid") };
  const values = { name: field(fd, "name") };
  if (fd.get("acceptInstructions") !== "on") return { fieldErrors: { acceptInstructions: t("invite.instructionsRequired") }, values };

  const session = await getSession();
  const [existing] = await db.select().from(users).where(eq(users.email, row.email));
  if (existing && session?.user.id !== existing.id) return { error: t(session ? "invite.wrongAccount" : "invite.existingAccount") };
  if (!existing && session) return { error: t("invite.wrongAccount") };

  let userId = existing?.id ?? null;
  let passwordHash: string | null = null;
  if (!existing) {
    const name = values.name;
    if (name.length < 2 || name.length > 120) return { fieldErrors: { name: t("errors.invalidForm") }, values };
    const password = String(fd.get("password") ?? "");
    const problem = checkPasswordPolicy(password, { email: row.email, name });
    if (problem) return { fieldErrors: { password: t(`password.${problem}`) }, values };
    passwordHash = await hashPassword(password);
  }

  const orgId = row.orgId;
  const role = row.role;
  const joined = await db.transaction(async (tx) => {
    if (!(await consumeAuthToken(row.id, new Date(), tx))) return false;
    if (!userId) {
      userId = newId();
      // The invitation link proved the mailbox.
      await tx.insert(users).values({ id: userId, email: row.email!, name: values.name, passwordHash: passwordHash!, emailVerifiedAt: new Date() });
    }
    await tx
      .insert(memberships)
      .values({ userId, orgId, role, invitedByUserId: row.createdByUserId, createdAt: new Date() })
      .onConflictDoNothing();
    await recordLegalAcceptance(tx, { orgId, userId, doc: "staff_instructions", locale, headers: h });
    await audit(
      {
        orgId,
        actor: { type: "user", id: userId },
        action: "member.invite",
        entity: { type: "membership", id: userId },
        metadata: { accepted: true, role, newAccount: !existing },
        headers: h,
      },
      tx,
    );
    return true;
  });
  if (!joined || !userId) return { error: t("invite.invalid") };

  if (!existing) await recordTrustedSignIn(row.email, h);
  // A fresh session in the practice just joined (rotation). An existing session's sign-in time,
  // expiry and second step carry over; a new account has just authenticated with its password.
  await createSession(
    userId,
    orgId,
    existing && session?.auth
      ? { headers: h, mfaVerifiedAt: session.auth.mfaVerifiedAt, createdAt: session.auth.createdAt, notAfter: session.auth.expiresAt }
      : { headers: h, mfaVerifiedAt: new Date() },
  );
  redirect("/dashboard");
}
