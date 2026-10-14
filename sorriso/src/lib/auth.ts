import "server-only";
import { and, desc, eq, gt, ne } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db, type Tx } from "@/db";
import { memberships, organizations, sessions, users, type Organization } from "@/db/schema";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, LOCALES, type Locale } from "@/i18n/config";
import { negotiate } from "@/i18n/negotiate";
import { getT } from "@/i18n/t";
import { audit } from "./audit";
import { APP_URL } from "./config";
import { isDemoMode } from "./demo";
import { newToken, sha256 } from "./ids";
import { getPrivacy, SESSION_HOURS_LIMITS } from "./privacy/settings";
import { clientIpHash } from "./rate-limit";
import { StepUpRequiredError } from "./security/errors";

/**
 * Staff sessions (GDPR Art. 32; Garante guidance on health-data access):
 *
 * - The cookie holds a random 256-bit token; the database stores only its sha256 (sessions.id).
 *   The cookie is __Host-sorriso_session when APP_URL is https (Secure, Path=/, no Domain, so a
 *   sibling subdomain can't set or read it), sorriso_session on plain-http development.
 * - Absolute lifetime: the practice's privacy.sessionHours (default 12) from sign-in, whatever
 *   the activity; switching practice never extends it.
 * - Idle timeout: 30 minutes. lastSeenAt slides at most once a minute, so a page view is not a
 *   database write each time.
 * - The id rotates on sign-in, after the second step and on switching practice, and every
 *   session of a user is deleted on a password change or reset and an MFA reset. Removal from a
 *   practice deletes the sessions open in that practice (all of them when it was their only one).
 * - Two-step verification: a user with TOTP enabled gets a "pending" session after the password
 *   (10 minutes to enter the code, not usable for anything else); sessions.mfaVerifiedAt marks
 *   the second step, and also the last re-authentication for requireStepUp().
 */

export type Role = (typeof memberships.$inferSelect)["role"];

export const IDLE_TIMEOUT_MS = 30 * 60_000;
/** lastSeenAt is refreshed at most this often. */
export const SESSION_TOUCH_MS = 60_000;
/** Time to enter the second-step code after the password. */
export const MFA_PENDING_MS = 10 * 60_000;

const SECURE_COOKIE = "__Host-sorriso_session";
const PLAIN_COOKIE = "sorriso_session";

/** The session cookie's name: the __Host- prefix needs https. */
export function sessionCookieName(appUrl: string = APP_URL): string {
  return appUrl.startsWith("https://") ? SECURE_COOKIE : PLAIN_COOKIE;
}

/** Both names, for the third-party/cookie check and for clearing a stale cookie. */
export const SESSION_COOKIE_NAMES = [SECURE_COOKIE, PLAIN_COOKIE] as const;

function cookieSecure(): boolean {
  return APP_URL.startsWith("https://") || process.env.NODE_ENV === "production";
}

/** Absolute session length for a practice (privacy.sessionHours), in ms. */
export function sessionLifetimeMs(org: Pick<Organization, "settings"> | null | undefined): number {
  const hours = org ? getPrivacy(org).sessionHours : SESSION_HOURS_LIMITS.default;
  return hours * 3_600_000;
}

export type MembershipWithOrg = { org: Organization; role: Role };

async function loadMemberships(userId: string, t: Tx = db): Promise<MembershipWithOrg[]> {
  return t
    .select({ org: organizations, role: memberships.role })
    .from(memberships)
    .innerJoin(organizations, eq(organizations.id, memberships.orgId))
    .where(eq(memberships.userId, userId));
}

/** The practice a session lands in: the one it was opened for, else an owned one, else the first. */
function pickActive(orgs: MembershipWithOrg[], orgId: string | null): MembershipWithOrg | null {
  return orgs.find((o) => o.org.id === orgId) ?? orgs.find((o) => o.role === "owner") ?? orgs[0] ?? null;
}

/** The practice to use for a user without a session yet (sign-in): owned first. */
export async function defaultOrgFor(userId: string, t: Tx = db): Promise<Organization | null> {
  return pickActive(await loadMemberships(userId, t), null)?.org ?? null;
}

/** Security state of a session, alongside the identity. */
export type SessionAuth = {
  /** Password checked, second step still to do: not a usable session. */
  pending: boolean;
  mfaEnabled: boolean;
  /** Last second-step verification or re-authentication (null: never in this session). */
  mfaVerifiedAt: Date | null;
  createdAt: Date;
  expiresAt: Date;
  emailVerified: boolean;
};

export type SessionInfo = {
  sessionId: string;
  user: { id: string; name: string; email: string; isPlatformAdmin: boolean; locale: Locale | null };
  org: Organization | null;
  role: Role | null;
  orgs: MembershipWithOrg[];
  /** Absent only on sessions built by hand in tests; requireStepUp() then reads the row. */
  auth?: SessionAuth;
};

/**
 * Load and validate the session for a cookie token, enforcing the absolute lifetime, the idle
 * timeout and the pending-MFA window (an invalid session's row is deleted). Returns pending
 * sessions too (auth.pending); getSession() filters them out.
 */
export async function resolveSession(token: string, now: Date = new Date()): Promise<SessionInfo | null> {
  const id = sha256(token);
  const [row] = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.id, id));
  if (!row) return null;
  const { session: s, user } = row;
  const orgs = await loadMemberships(user.id);
  const active = pickActive(orgs, s.orgId);

  const t = now.getTime();
  const created = s.createdAt.getTime();
  const lastSeen = (s.lastSeenAt ?? s.createdAt).getTime();
  const end = Math.min(s.expiresAt.getTime(), created + sessionLifetimeMs(active?.org));
  const pending = Boolean(user.totpEnabledAt) && !s.mfaVerifiedAt;
  const invalid =
    t >= end ||
    t - lastSeen > IDLE_TIMEOUT_MS ||
    (pending && t - created > MFA_PENDING_MS) ||
    // A password change after this session started (sessions are also deleted then: belt and braces).
    (user.passwordChangedAt !== null && user.passwordChangedAt.getTime() > created);
  if (invalid) {
    await db.delete(sessions).where(eq(sessions.id, id));
    return null;
  }
  if (t - lastSeen >= SESSION_TOUCH_MS) {
    await db.update(sessions).set({ lastSeenAt: now }).where(eq(sessions.id, id));
  }
  return {
    sessionId: id,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      isPlatformAdmin: user.isPlatformAdmin,
      // Their own dashboard language (null = not chosen), read by getStaffLocale().
      locale: user.locale,
    },
    org: active?.org ?? null,
    role: active?.role ?? null,
    orgs,
    auth: {
      pending,
      mfaEnabled: Boolean(user.totpEnabledAt),
      mfaVerifiedAt: s.mfaVerifiedAt,
      createdAt: s.createdAt,
      expiresAt: new Date(end),
      emailVerified: Boolean(user.emailVerifiedAt),
    },
  };
}

async function cookieToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(sessionCookieName())?.value ?? null;
}

// Once per request (pages, layouts and getStaffLocale all ask).
const readSession = cache(async (): Promise<SessionInfo | null> => {
  const token = await cookieToken();
  return token ? resolveSession(token) : null;
});

/** The signed-in staff member and their active practice, or null (also null while the second step is pending). */
export const getSession = cache(async (): Promise<SessionInfo | null> => {
  const s = await readSession();
  return s && !s.auth?.pending ? s : null;
});

/** A session waiting for its second-step code (the /login/mfa page and action), or null. */
export async function getPendingMfaSession(): Promise<SessionInfo | null> {
  const s = await readSession();
  return s?.auth?.pending ? s : null;
}

/** Set the session cookie (server actions and route handlers only). */
async function setSessionCookie(token: string, expiresAt: Date) {
  const jar = await cookies();
  jar.set(sessionCookieName(), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure(),
    path: "/",
    expires: expiresAt,
  });
}

export type CreateSessionOptions = {
  /** Set when the second step is done (or for users without MFA, never: they re-authenticate by password). */
  mfaVerifiedAt?: Date | null;
  /** Keep the original sign-in time (practice switch), so the absolute lifetime doesn't restart. */
  createdAt?: Date;
  /** Upper bound for the expiry (the previous session's, on a practice switch). */
  notAfter?: Date;
  /** Request headers: ipHash and the user agent are stored for the "signed-in devices" list. */
  headers?: Headers;
  now?: Date;
};

/**
 * Open a new session (a fresh id: rotation) and set its cookie. The browser's previous session,
 * if any, is deleted. Returns the new session id (sha256 of the token).
 */
export async function createSession(userId: string, orgId: string | null, opts: CreateSessionOptions = {}): Promise<string> {
  const now = opts.now ?? new Date();
  const createdAt = opts.createdAt ?? now;
  let org: Organization | null = null;
  if (orgId) [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
  let expiresAt = new Date(createdAt.getTime() + sessionLifetimeMs(org));
  if (opts.notAfter && opts.notAfter < expiresAt) expiresAt = opts.notAfter;

  const previous = await cookieToken();
  const token = newToken();
  const id = sha256(token);
  const ua = opts.headers?.get("user-agent")?.slice(0, 300) ?? null;
  await db.insert(sessions).values({
    id,
    userId,
    orgId,
    expiresAt,
    createdAt,
    lastSeenAt: now,
    mfaVerifiedAt: opts.mfaVerifiedAt ?? null,
    ipHash: clientIpHash(opts.headers),
    userAgent: ua,
  });
  if (previous && sha256(previous) !== id) await db.delete(sessions).where(eq(sessions.id, sha256(previous)));
  await setSessionCookie(token, expiresAt);
  return id;
}

/** Sign out this browser: delete its session and the cookie. */
export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(sessionCookieName())?.value;
  if (token) await db.delete(sessions).where(eq(sessions.id, sha256(token)));
  jar.delete(sessionCookieName());
}

/**
 * Move the session to another of the user's practices with a fresh session id (the old row is
 * deleted). Sign-in time, expiry ceiling and second-step state carry over. Returns false when
 * the user isn't a member of `orgId`. Server actions only (sets the cookie).
 */
export async function switchSessionOrg(s: Pick<SessionInfo, "sessionId" | "user" | "orgs">, orgId: string, h?: Headers): Promise<boolean> {
  if (!s.orgs.some((o) => o.org.id === orgId)) return false;
  const [old] = await db.select().from(sessions).where(and(eq(sessions.id, s.sessionId), eq(sessions.userId, s.user.id)));
  if (!old) return false;
  await createSession(s.user.id, orgId, {
    createdAt: old.createdAt,
    notAfter: old.expiresAt,
    mfaVerifiedAt: old.mfaVerifiedAt,
    headers: h,
  });
  await db.delete(sessions).where(eq(sessions.id, old.id));
  return true;
}

/**
 * Delete every session of a user (password change or reset, MFA reset, removal), except `except`.
 * With `orgId`, only the sessions open in that practice (removal from one practice must not sign
 * the person out of the others they work for).
 */
export async function revokeUserSessions(userId: string, opts: { except?: string; orgId?: string } = {}, t: Tx = db): Promise<number> {
  const res = await t
    .delete(sessions)
    .where(
      and(
        eq(sessions.userId, userId),
        opts.except ? ne(sessions.id, opts.except) : undefined,
        opts.orgId ? eq(sessions.orgId, opts.orgId) : undefined,
      ),
    );
  return res.rowsAffected;
}

/** The user's live sessions, newest activity first (the "signed-in devices" list). */
export async function listUserSessions(userId: string, now: Date = new Date()) {
  const rows = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.userId, userId), gt(sessions.expiresAt, now)))
    .orderBy(desc(sessions.lastSeenAt));
  return rows.filter((r) => now.getTime() - (r.lastSeenAt ?? r.createdAt).getTime() <= IDLE_TIMEOUT_MS);
}

/** Mark the session's second step / re-authentication as done now. */
export async function markSessionVerified(sessionId: string, now: Date = new Date(), t: Tx = db): Promise<void> {
  await t.update(sessions).set({ mfaVerifiedAt: now, lastSeenAt: now }).where(eq(sessions.id, sessionId));
}

// ---------------------------------------------------------------- redirects

const LOCALE_PREFIX = new RegExp(`^/(${LOCALES.join("|")})/(invite|verify-email)/[A-Za-z0-9_-]+$`);

/**
 * Where a "next" parameter may send someone after signing in: the dashboard, or an invitation or
 * email confirmation page. Anything else (other sites, "//evil", "/\evil") gives the dashboard.
 */
export function safeNext(next: string | null | undefined): string {
  if (typeof next !== "string" || next.length > 300) return "/dashboard";
  if (/^\/dashboard(\/[A-Za-z0-9/_\-.]*)?(\?[A-Za-z0-9=&_\-.%]*)?$/.test(next) && !next.includes("//")) return next;
  if (LOCALE_PREFIX.test(next)) return next;
  return "/dashboard";
}

/** The visitor's public language without the URL (cookie, then Accept-Language), for redirects to /{locale}/login. */
async function visitorLocale(): Promise<Locale> {
  try {
    const value = (await cookies()).get(LOCALE_COOKIE)?.value;
    if (isLocale(value)) return value;
    return negotiate((await headers()).get("accept-language")) ?? DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

async function currentPath(): Promise<string | null> {
  try {
    return (await headers()).get("x-pathname");
  } catch {
    return null;
  }
}

/** /{locale}/login, with ?next= back to the dashboard page being opened. */
export async function loginUrl(extra?: Record<string, string>): Promise<string> {
  const locale = await visitorLocale();
  const params = new URLSearchParams(extra);
  const path = await currentPath();
  if (path?.startsWith("/dashboard") && path !== "/dashboard" && !params.has("next")) params.set("next", path);
  const qs = params.toString();
  return `/${locale}/login${qs ? `?${qs}` : ""}`;
}

// ---------------------------------------------------------------- guards

export const MANAGERS: Role[] = ["owner", "admin"];

/** Path prefix of the page where people set up two-step verification (never redirected away from). */
export const SECURITY_PAGE = "/dashboard/account/security";

/**
 * Pages someone who still has to enrol may open: the security page itself, and the legal page
 * (WP5's gate may send them there first; neither shows patient data), so the two can't loop.
 */
const ENROLMENT_EXEMPT = [SECURITY_PAGE, "/dashboard/legal"];

function isEnrolmentExempt(path: string): boolean {
  return ENROLMENT_EXEMPT.some((p) => path === p || path.startsWith(`${p}/`));
}

/**
 * Does this role at this practice require two-step verification? Always for owners, admins and
 * platform admins; for every role when the practice's privacy.requireMfa is on. Demo practices in
 * demo mode are exempt (the demo login must work out of the box).
 */
export function mfaRequired(s: { org: Organization | null; role: Role | null; user: Pick<SessionInfo["user"], "isPlatformAdmin"> }): boolean {
  if (!s.org || !s.role) return false;
  if (isDemoMode() && s.org.isDemo) return false;
  return MANAGERS.includes(s.role) || s.user.isPlatformAdmin || getPrivacy(s.org).requireMfa;
}

/** Required in any of the user's practices (turning MFA off must not break another practice's rule). */
export function mfaRequiredAnywhere(s: Pick<SessionInfo, "orgs" | "user">): boolean {
  return s.orgs.some((o) => mfaRequired({ org: o.org, role: o.role, user: s.user }));
}

/** Must this signed-in user set up two-step verification before using the dashboard? */
export function mfaEnrolmentRequired(s: Pick<SessionInfo, "auth" | "org" | "role" | "user">): boolean {
  return Boolean(s.auth) && !s.auth!.mfaEnabled && mfaRequired(s);
}

/**
 * For dashboard pages and actions: require a signed-in member of a practice. Sends people who
 * still have to enrol in two-step verification to /dashboard/account/security first.
 */
export async function requireStaff(roles?: Role[]) {
  const session = await getSession();
  if (!session) {
    if (await getPendingMfaSession()) redirect(`/${await visitorLocale()}/login/mfa`);
    redirect(await loginUrl());
  }
  if (!session.org || !session.role) redirect(await loginUrl({ notice: "noPractice" }));
  if (mfaEnrolmentRequired(session) && !isEnrolmentExempt((await currentPath()) ?? "")) redirect(`${SECURITY_PAGE}?setup=mfa`);
  if (roles && !roles.includes(session.role)) redirect("/dashboard?denied=1");
  return { ...session, org: session.org, role: session.role };
}

/** A signed-in staff member with an active practice (org and role are non-null). */
export type StaffSession = Awaited<ReturnType<typeof requireStaff>>;

/** Was the session's last second-step verification / re-authentication within `maxAgeMinutes`? */
export function isStepUpFresh(verifiedAt: Date | null | undefined, maxAgeMinutes = 10, now: Date = new Date()): boolean {
  return Boolean(verifiedAt) && now.getTime() - verifiedAt!.getTime() <= maxAgeMinutes * 60_000;
}

async function isServerActionRequest(): Promise<boolean> {
  try {
    return (await headers()).has("next-action");
  } catch {
    return true; // outside a request (tests, scripts): behave like an action and throw
  }
}

/**
 * Re-authentication for sensitive operations (exports, erasure, privacy settings, API keys, team
 * and MFA changes): the session must have passed its second step or re-entered the password in
 * the last `maxAgeMinutes`. Otherwise a page redirects to /dashboard/account/security/verify
 * (which comes back afterwards), and a server action throws StepUpRequiredError, which guard()
 * answers as { ok: false, code: "step_up_required" }.
 *
 * Pass the session when you have it (actions get it from guard()); without it, requireStaff() runs.
 */
export async function requireStepUp(maxAgeMinutes = 10, s?: Pick<SessionInfo, "sessionId" | "auth" | "user" | "org">): Promise<void> {
  const session = s ?? (await requireStaff());
  let verifiedAt = session.auth?.mfaVerifiedAt ?? null;
  if (!session.auth) {
    const [row] = await db.select({ at: sessions.mfaVerifiedAt }).from(sessions).where(eq(sessions.id, session.sessionId));
    verifiedAt = row?.at ?? null;
  }
  if (isStepUpFresh(verifiedAt, maxAgeMinutes)) return;
  if (await isServerActionRequest()) {
    const locale = session.user.locale ?? session.org?.defaultLocale ?? DEFAULT_LOCALE;
    throw new StepUpRequiredError(getT(isLocale(locale) ? locale : DEFAULT_LOCALE, "security")("stepUp.required"));
  }
  const back = (await currentPath()) ?? "/dashboard";
  redirect(`${SECURITY_PAGE}/verify?next=${encodeURIComponent(safeNext(back))}`);
}

// Once per request: a layout and its page may both call requirePlatformAdmin().
const auditPlatformAccess = cache((userId: string) =>
  audit({ orgId: null, actor: { type: "platform_admin", id: userId }, action: "platform.access" }),
);

/** For /dashboard/platform/**: Sorriso staff only (users.isPlatformAdmin). Every access is audited. */
export async function requirePlatformAdmin(): Promise<StaffSession> {
  const s = await requireStaff();
  if (!s.user.isPlatformAdmin) redirect("/dashboard?denied=1");
  await auditPlatformAccess(s.user.id);
  return s;
}
