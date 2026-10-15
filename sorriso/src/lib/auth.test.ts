import { and, desc, eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import {
  apiKeys,
  auditLog,
  authTokens,
  legalAcceptances,
  loginAttempts,
  memberships,
  messages,
  organizations,
  practitioners,
  sessions,
  users,
  type MembershipRole,
} from "@/db/schema";
import { newId } from "@/lib/ids";
import { createPractice } from "@/test/fixtures";
import { totp } from "./totp";

/**
 * Sessions, two-step verification, step-up and the account flows, against a real test database.
 * next/headers is replaced by an in-memory cookie jar and a mutable set of request headers.
 */

const req = vi.hoisted(() => {
  const store = new Map<string, string>();
  return {
    store,
    headers: new Headers(),
    jar: {
      get: (name: string) => (store.has(name) ? { name, value: store.get(name)! } : undefined),
      set: (name: string, value: string) => void store.set(name, value),
      delete: (name: string) => void store.delete(name),
    },
  };
});
vi.mock("next/headers", () => ({ cookies: async () => req.jar, headers: async () => req.headers }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

// Counts the password checks login makes (scrypt rounds against a real or the dummy hash).
const passwordChecks = vi.hoisted(() => ({ n: 0 }));
vi.mock("./password", async (importOriginal) => {
  const original = await importOriginal<typeof import("./password")>();
  return {
    ...original,
    verifyPassword: (...args: Parameters<typeof original.verifyPassword>) => {
      passwordChecks.n++;
      return original.verifyPassword(...args);
    },
    verifyAgainstDummy: (...args: Parameters<typeof original.verifyAgainstDummy>) => {
      passwordChecks.n++;
      return original.verifyAgainstDummy(...args);
    },
  };
});

const staffState = vi.hoisted(() => ({ session: null as unknown }));
vi.mock("@/lib/auth", async (importOriginal) => {
  const original = await importOriginal<typeof import("./auth")>();
  return {
    ...original,
    // Actions run as a session built by the test when one is set; otherwise the real requireStaff().
    requireStaff: async (...args: Parameters<typeof original.requireStaff>) =>
      (staffState.session as Awaited<ReturnType<typeof original.requireStaff>>) ?? original.requireStaff(...args),
  };
});

const auth = await import("./auth");
const { hashPassword } = await import("./password");
const actions = await import("@/app/auth-actions");
const team = await import("@/app/dashboard/actions/team");
const { guard, ok } = await import("@/app/dashboard/actions/_shared");
const { STEP_UP_REQUIRED, StepUpRequiredError } = await import("./security/errors");
const { beginMfaEnrolment, confirmMfaEnrolment } = await import("./security/mfa");

const MIN = 60_000;
const PASSWORD = "correct horse battery staple";
let ipSeq = 1;

/** Request headers for one client: its own address, so per-network limits stay out of the way. */
function asClient(extra: Record<string, string> = {}) {
  req.headers = new Headers({ "x-forwarded-for": `203.0.113.${ipSeq++ % 250}`, "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X) Chrome/130", ...extra });
}

const cookieToken = () => req.store.get(auth.sessionCookieName()) ?? null;

async function makeUser(o: { email?: string; password?: string; orgId?: string; role?: MembershipRole; mfaSecret?: string } = {}) {
  const id = newId();
  const email = o.email ?? `user-${id.toLowerCase()}@example.com`;
  await db.insert(users).values({
    id,
    email,
    name: "Anna Verdi",
    passwordHash: await hashPassword(o.password ?? PASSWORD),
    totpSecretEnc: o.mfaSecret ?? null,
    totpEnabledAt: o.mfaSecret ? new Date() : null,
  });
  if (o.orgId) await db.insert(memberships).values({ userId: id, orgId: o.orgId, role: o.role ?? "owner" });
  return { id, email };
}

function form(values: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

/** Run a server action that ends in redirect(); returns the target. */
async function redirectOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (err) {
    const digest = String((err as { digest?: string }).digest ?? "");
    if (digest.startsWith("NEXT_REDIRECT")) return digest.split(";")[2];
    throw err;
  }
  throw new Error("expected a redirect");
}

let orgA: string;
let orgB: string;

beforeAll(async () => {
  ({ orgId: orgA } = await createPractice());
  ({ orgId: orgB } = await createPractice());
});

beforeEach(() => {
  req.store.clear();
  staffState.session = null;
  asClient();
});

describe("session cookie", () => {
  it("is __Host- prefixed on https, plain on http", () => {
    expect(auth.sessionCookieName("https://sorriso.it")).toBe("__Host-sorriso_session");
    expect(auth.sessionCookieName("http://localhost:3010")).toBe("sorriso_session");
  });
});

describe("session lifetime", () => {
  it("ends after 30 idle minutes and deletes the row", async () => {
    const u = await makeUser({ orgId: orgA });
    const t0 = new Date();
    const id = await auth.createSession(u.id, orgA, { now: t0, headers: req.headers });
    const token = cookieToken()!;
    expect(await auth.resolveSession(token, new Date(t0.getTime() + 29 * MIN))).not.toBeNull();
    // That read slid lastSeenAt to t0 + 29 min: 31 idle minutes counts from there.
    expect(await auth.resolveSession(token, new Date(t0.getTime() + 60 * MIN + 1))).toBeNull();
    expect(await db.select().from(sessions).where(eq(sessions.id, id))).toEqual([]);
  });

  it("a session idle for 31 minutes returns null", async () => {
    const u = await makeUser({ orgId: orgA });
    const t0 = new Date();
    await auth.createSession(u.id, orgA, { now: t0 });
    expect(await auth.resolveSession(cookieToken()!, new Date(t0.getTime() + 31 * MIN))).toBeNull();
  });

  it("slides lastSeenAt at most once a minute", async () => {
    const u = await makeUser({ orgId: orgA });
    const t0 = new Date();
    const id = await auth.createSession(u.id, orgA, { now: t0 });
    const seen = async () => (await db.select().from(sessions).where(eq(sessions.id, id)))[0].lastSeenAt!.getTime();
    await auth.resolveSession(cookieToken()!, new Date(t0.getTime() + 30_000));
    expect(await seen()).toBe(t0.getTime());
    await auth.resolveSession(cookieToken()!, new Date(t0.getTime() + 61_000));
    expect(await seen()).toBe(t0.getTime() + 61_000);
  });

  it("a session 13 hours old returns null even while active (privacy.sessionHours, default 12)", async () => {
    const u = await makeUser({ orgId: orgA });
    const t0 = new Date();
    const id = await auth.createSession(u.id, orgA, { now: t0 });
    const at = (h: number) => new Date(t0.getTime() + h * 3_600_000);
    // Active all along: lastSeenAt just before each check.
    await db.update(sessions).set({ lastSeenAt: at(11.9) }).where(eq(sessions.id, id));
    expect(await auth.resolveSession(cookieToken()!, at(11.95))).not.toBeNull();
    await db.update(sessions).set({ lastSeenAt: at(12.9) }).where(eq(sessions.id, id));
    expect(await auth.resolveSession(cookieToken()!, at(13))).toBeNull();
  });

  it("follows a shorter sessionHours set by the practice after sign-in", async () => {
    const { orgId } = await createPractice();
    const u = await makeUser({ orgId });
    const t0 = new Date();
    const id = await auth.createSession(u.id, orgId, { now: t0 });
    const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
    await db
      .update(organizations)
      .set({ settings: { ...org.settings, privacy: { ...org.settings.privacy, sessionHours: 2 } } })
      .where(eq(organizations.id, orgId));
    await db.update(sessions).set({ lastSeenAt: new Date(t0.getTime() + 125 * MIN) }).where(eq(sessions.id, id));
    expect(await auth.resolveSession(cookieToken()!, new Date(t0.getTime() + 130 * MIN))).toBeNull();
  });

  it("stores the user agent and an HMAC of the IP, never the address", async () => {
    const u = await makeUser({ orgId: orgA });
    asClient({ "x-forwarded-for": "198.51.100.77" });
    const id = await auth.createSession(u.id, orgA, { headers: req.headers });
    const [row] = await db.select().from(sessions).where(eq(sessions.id, id));
    expect(row.userAgent).toContain("Chrome");
    expect(row.ipHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(row)).not.toContain("198.51.100.77");
  });
});

describe("session rotation and revocation", () => {
  it("switchOrg issues a new session id, keeping the sign-in time", async () => {
    const u = await makeUser({ orgId: orgA });
    await db.insert(memberships).values({ userId: u.id, orgId: orgB, role: "reception" });
    const oldId = await auth.createSession(u.id, orgA);
    const s = (await auth.resolveSession(cookieToken()!))!;
    expect(s.org?.id).toBe(orgA);
    expect(await auth.switchSessionOrg(s, orgB)).toBe(true);
    const switched = (await auth.resolveSession(cookieToken()!))!;
    expect(switched.sessionId).not.toBe(oldId);
    expect(switched.org?.id).toBe(orgB);
    expect(switched.auth?.createdAt.getTime()).toBe(s.auth?.createdAt.getTime());
    expect(await db.select().from(sessions).where(eq(sessions.id, oldId))).toEqual([]);
    // Not a member: refused.
    expect(await auth.switchSessionOrg(switched, newId())).toBe(false);
  });

  // The real practice-switch action (WP2's actions/session.ts), which goes through switchSessionOrg().
  it("the switchOrg action itself issues a new session id", async () => {
    const u = await makeUser({ orgId: orgA, role: "reception", mfaSecret: "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP" });
    await db.insert(memberships).values({ userId: u.id, orgId: orgB, role: "reception" });
    const oldId = await auth.createSession(u.id, orgA, { mfaVerifiedAt: new Date() });
    asClient({ "x-pathname": "/dashboard", "next-action": "abc" });
    const { switchOrg } = await import("@/app/dashboard/actions/session");
    expect(await redirectOf(switchOrg(orgB))).toBe("/dashboard");
    const switched = (await auth.resolveSession(cookieToken()!))!;
    expect(switched.org?.id).toBe(orgB);
    expect(switched.sessionId).not.toBe(oldId);
  });

  it("signing in rotates: the browser's previous session is deleted", async () => {
    const u = await makeUser({ orgId: orgA });
    const first = await auth.createSession(u.id, orgA);
    const second = await auth.createSession(u.id, orgA);
    expect(second).not.toBe(first);
    expect(await db.select().from(sessions).where(eq(sessions.id, first))).toEqual([]);
  });

  it("removing a member deletes their sessions", async () => {
    const owner = await makeUser({ orgId: orgA, role: "owner" });
    const member = await makeUser({ orgId: orgA, role: "reception" });
    // Two devices (two cookie jars).
    await auth.createSession(member.id, orgA);
    req.store.clear();
    await auth.createSession(member.id, orgA);
    req.store.clear();
    // The owner, recently verified (step-up satisfied).
    await auth.createSession(owner.id, orgA, { mfaVerifiedAt: new Date() });
    staffState.session = { ...(await auth.resolveSession(cookieToken()!))!, role: "owner" };
    expect((await db.select().from(sessions).where(eq(sessions.userId, member.id))).length).toBe(2);
    const res = await team.removeMember(member.id);
    expect(res).toMatchObject({ ok: true });
    expect(await db.select().from(sessions).where(eq(sessions.userId, member.id))).toEqual([]);
    expect(await db.select().from(memberships).where(and(eq(memberships.userId, member.id), eq(memberships.orgId, orgA)))).toEqual([]);
  });

  it("a password change elsewhere invalidates older sessions", async () => {
    const u = await makeUser({ orgId: orgA });
    const t0 = new Date();
    await auth.createSession(u.id, orgA, { now: t0 });
    await db.update(users).set({ passwordChangedAt: new Date(t0.getTime() + 1000) }).where(eq(users.id, u.id));
    expect(await auth.resolveSession(cookieToken()!, new Date(t0.getTime() + 2000))).toBeNull();
  });
});

describe("two-step verification enforcement", () => {
  it("redirects an owner without MFA to enrolment, but not on the security page", async () => {
    const u = await makeUser({ orgId: orgA, role: "owner" });
    await auth.createSession(u.id, orgA);
    asClient({ "x-pathname": "/dashboard/patients" });
    expect(await redirectOf(auth.requireStaff())).toBe("/dashboard/account/security?setup=mfa");
    asClient({ "x-pathname": "/dashboard/account/security" });
    await expect(auth.requireStaff()).resolves.toMatchObject({ user: { id: u.id }, role: "owner" });
  });

  it("lets reception in without MFA unless the practice requires it for everyone", async () => {
    const { orgId } = await createPractice();
    const u = await makeUser({ orgId, role: "reception" });
    // requireStaff() also applies the compliance gates on dashboard pages (src/lib/dashboard-gates.test.ts):
    // this member has accepted the staff instructions, so only the MFA rule decides here.
    const { LEGAL_VERSIONS } = await import("./privacy/versions");
    await db.update(memberships).set({ instructionsVersion: LEGAL_VERSIONS.staff_instructions }).where(eq(memberships.userId, u.id));
    const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
    const setRequire = (requireMfa: boolean) =>
      db
        .update(organizations)
        .set({ settings: { ...org.settings, privacy: { ...org.settings.privacy, requireMfa } } })
        .where(eq(organizations.id, orgId));
    await setRequire(false);
    await auth.createSession(u.id, orgId);
    asClient({ "x-pathname": "/dashboard" });
    await expect(auth.requireStaff()).resolves.toMatchObject({ role: "reception" });
    await setRequire(true);
    expect(await redirectOf(auth.requireStaff())).toBe("/dashboard/account/security?setup=mfa");
  });

  it("keeps a password-only session pending until the second step, then rotates it", async () => {
    const secret = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP";
    const u = await makeUser({ orgId: orgA, mfaSecret: secret });
    const target = await redirectOf(actions.login(null, form({ email: u.email, password: PASSWORD, locale: "it" })));
    expect(target).toBe("/it/login/mfa");
    const pendingId = (await auth.getPendingMfaSession())!.sessionId;
    expect(await auth.getSession()).toBeNull();
    expect(await redirectOf(auth.requireStaff())).toBe("/it/login/mfa");

    expect(await actions.verifyMfaLogin(null, form({ code: "000000", locale: "it" }))).toMatchObject({ error: expect.any(String) });
    expect(await redirectOf(actions.verifyMfaLogin(null, form({ code: totp(secret), locale: "it" })))).toBe("/dashboard");
    const full = (await auth.getSession())!;
    expect(full.sessionId).not.toBe(pendingId);
    expect(full.auth?.mfaVerifiedAt).toBeInstanceOf(Date);
    // The same code can't be used twice.
    expect(await (await import("./security/mfa")).verifyMfaCode(u.id, totp(secret))).toEqual({ ok: false });
  });

  it("enrols with a first code and hands out 10 hashed recovery codes, each usable once", async () => {
    const u = await makeUser({ orgId: orgA });
    const [row] = await db.select().from(users).where(eq(users.id, u.id));
    const started = (await beginMfaEnrolment(row))!;
    expect(started.uri).toMatch(/^otpauth:\/\/totp\/Sorriso:/);
    expect(await confirmMfaEnrolment(u.id, "123456")).toBeNull();
    const done = (await confirmMfaEnrolment(u.id, totp(started.secret)))!;
    expect(done.codes).toHaveLength(10);
    const [stored] = await db.select().from(users).where(eq(users.id, u.id));
    expect(stored.totpEnabledAt).toBeInstanceOf(Date);
    expect(stored.recoveryCodeHashes).toHaveLength(10);
    expect(stored.recoveryCodeHashes).not.toContain(done.codes[0]);
    const { verifyMfaCode } = await import("./security/mfa");
    expect(await verifyMfaCode(u.id, done.codes[0].toLowerCase())).toMatchObject({ ok: true, method: "recovery", recoveryLeft: 9 });
    expect(await verifyMfaCode(u.id, done.codes[0])).toEqual({ ok: false });
  });
});

describe("requireStepUp", () => {
  async function signedIn(verifiedMinutesAgo: number | null) {
    const u = await makeUser({ orgId: orgA });
    await auth.createSession(u.id, orgA, { mfaVerifiedAt: verifiedMinutesAgo === null ? null : new Date(Date.now() - verifiedMinutesAgo * MIN) });
    return (await auth.resolveSession(cookieToken()!))!;
  }

  it("passes within 10 minutes of the last verification", async () => {
    const s = await signedIn(9);
    asClient({ "next-action": "abc" });
    await expect(auth.requireStepUp(10, s)).resolves.toBeUndefined();
  });

  it("with mfaVerifiedAt older than 10 minutes, actions get step_up_required", async () => {
    const s = await signedIn(11);
    asClient({ "next-action": "abc" });
    await expect(auth.requireStepUp(10, s)).rejects.toBeInstanceOf(StepUpRequiredError);
    staffState.session = { ...s, org: s.org!, role: s.role! };
    const res = await guard(async (x) => {
      await auth.requireStepUp(10, x);
      return ok("ran");
    });
    expect(res).toMatchObject({ ok: false, code: STEP_UP_REQUIRED });
  });

  it("pages are redirected to re-authenticate, and come back", async () => {
    const s = await signedIn(null);
    asClient({ "x-pathname": "/dashboard/settings/privacy" });
    expect(await redirectOf(auth.requireStepUp(10, s))).toBe(
      `/dashboard/account/security/verify?next=${encodeURIComponent("/dashboard/settings/privacy")}`,
    );
  });

  it("reads the session row when the session was built by hand", async () => {
    const s = await signedIn(1);
    asClient({ "next-action": "abc" });
    const { auth: _omit, ...bare } = s;
    void _omit;
    await expect(auth.requireStepUp(10, bare)).resolves.toBeUndefined();
    await expect(auth.requireStepUp(10, { ...bare, sessionId: "missing" })).rejects.toBeInstanceOf(StepUpRequiredError);
  });
});

describe("step-up throttle (re-authentication)", () => {
  async function signedInTwice() {
    const u = await makeUser({ orgId: orgA });
    await db.insert(memberships).values({ userId: u.id, orgId: orgB, role: "owner" });
    await auth.createSession(u.id, orgA, { mfaVerifiedAt: null });
    const s = (await auth.resolveSession(cookieToken()!))!;
    staffState.session = { ...s, org: s.org!, role: s.role! };
    /** Switch practice: a new session id, as the real switchOrg issues. */
    const switchTo = async (orgId: string) => {
      const cur = (await auth.resolveSession(cookieToken()!))!;
      expect(await auth.switchSessionOrg(cur, orgId)).toBe(true);
      const next = (await auth.resolveSession(cookieToken()!))!;
      expect(next.sessionId).not.toBe(cur.sessionId);
      staffState.session = { ...next, org: next.org!, role: next.role! };
    };
    return { u, switchTo };
  }

  it("password: switching practice doesn't reset the limit, which is the account's sign-in limit", async () => {
    const { verifyStepUp } = await import("@/app/dashboard/actions/security");
    const { u, switchTo } = await signedInTwice();
    asClient({ "next-action": "abc" });
    for (let i = 0; i < 5; i++) expect(await verifyStepUp({ password: `wrong password ${i}` })).toMatchObject({ ok: false, code: "invalid_code" });
    await switchTo(orgB);
    // A fresh session id, but five failures stand against the account: even the right password is refused.
    expect(await verifyStepUp({ password: PASSWORD })).toMatchObject({ ok: false, code: "rate_limited" });
    await switchTo(orgA);
    expect(await verifyStepUp({ password: PASSWORD })).toMatchObject({ ok: false, code: "rate_limited" });
    // The same counter as /login.
    asClient();
    expect((await actions.login(null, form({ email: u.email, password: PASSWORD, locale: "en" })))?.error).toBe("Too many attempts. Please wait 15 minutes and try again.");
  });

  it("password: the right one passes and clears the count, as at sign-in", async () => {
    const { verifyStepUp } = await import("@/app/dashboard/actions/security");
    await signedInTwice();
    asClient({ "next-action": "abc" });
    expect(await verifyStepUp({ password: "wrong password" })).toMatchObject({ ok: false, code: "invalid_code" });
    expect(await verifyStepUp({ password: PASSWORD })).toMatchObject({ ok: true });
  });

  it("two-step codes: the sign-in's per-account bucket, across new session ids", async () => {
    const { verifyStepUp } = await import("@/app/dashboard/actions/security");
    const u = await makeUser({ orgId: orgA, mfaSecret: "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP" });
    await db.insert(memberships).values({ userId: u.id, orgId: orgB, role: "owner" });
    await auth.createSession(u.id, orgA, { mfaVerifiedAt: null });
    const first = (await auth.resolveSession(cookieToken()!))!;
    staffState.session = { ...first, org: first.org!, role: first.role! };
    asClient({ "next-action": "abc" });
    const rotate = async (orgId: string) => {
      const cur = (await auth.resolveSession(cookieToken()!))!;
      expect(await auth.switchSessionOrg(cur, orgId)).toBe(true);
      const next = (await auth.resolveSession(cookieToken()!))!;
      staffState.session = { ...next, org: next.org!, role: next.role! };
    };
    for (const orgId of [orgB, orgA]) {
      for (let i = 0; i < 5; i++) expect(await verifyStepUp({ code: "000000" })).toMatchObject({ ok: false, code: "invalid_code" });
      await rotate(orgId);
    }
    // Ten codes tried across two sessions: the third session is refused at once.
    expect(await verifyStepUp({ code: "000000" })).toMatchObject({ ok: false, code: "rate_limited" });
  });
});

describe("login protection", () => {
  it("the 6th failed login for one email within 15 minutes is rejected even with the correct password", async () => {
    const u = await makeUser({ orgId: orgA });
    const wrong = await actions.login(null, form({ email: u.email, password: "wrong password 1", locale: "en" }));
    expect(wrong).toEqual({ error: "Wrong email or password.", values: { email: u.email } });
    for (let i = 0; i < 4; i++) {
      asClient(); // a different network each time: the per-email limit is what stops it
      await actions.login(null, form({ email: u.email, password: `wrong password ${i}`, locale: "en" }));
    }
    asClient();
    const sixth = await actions.login(null, form({ email: u.email, password: PASSWORD, locale: "en" }));
    expect(sixth).toEqual({ error: "Too many attempts. Please wait 15 minutes and try again.", values: { email: u.email } });
    expect(await auth.getSession()).toBeNull();
    // The owner was told once, with a redacted log body.
    const sent = await db.select().from(messages).where(eq(messages.to, u.email));
    expect(sent.map((m) => m.body)).toContain("[account email: failedLogins]");
  });

  it("answers an unknown email exactly like a wrong password", async () => {
    const u = await makeUser({ orgId: orgA });
    const unknown = await actions.login(null, form({ email: "nobody-here@example.com", password: "x".repeat(12), locale: "it" }));
    asClient();
    const wrong = await actions.login(null, form({ email: u.email, password: "x".repeat(12), locale: "it" }));
    expect({ ...unknown, values: undefined }).toEqual({ ...wrong, values: undefined });
    expect(unknown?.error).toBe(wrong?.error);
  });

  it("blocks a network after 20 failures across emails", async () => {
    asClient({ "x-forwarded-for": "192.0.2.200" });
    for (let i = 0; i < 20; i++) await actions.login(null, form({ email: `probe${i}@example.com`, password: "nope nope nope", locale: "en" }));
    const u = await makeUser({ orgId: orgA });
    const res = await actions.login(null, form({ email: u.email, password: PASSWORD, locale: "en" }));
    expect(res?.error).toBe("Too many attempts. Please wait 15 minutes and try again.");
  });

  it("counts parallel attempts before checking: 10 at once for one email reach at most 5 password checks", async () => {
    const u = await makeUser({ orgId: orgA });
    const { authenticate } = await import("./security/login");
    passwordChecks.n = 0;
    // Each from its own network, so only the per-email limit applies.
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        authenticate({ email: u.email, password: `wrong password ${i}`, headers: new Headers({ "x-forwarded-for": `198.18.0.${i + 1}` }) }),
      ),
    );
    expect(passwordChecks.n).toBeLessThanOrEqual(5);
    expect(results.filter((r) => !r.ok && r.reason === "throttled").length).toBeGreaterThanOrEqual(5);
    // Refused attempts aren't recorded as failures (they don't extend the lock); checked ones are.
    const failures = await db
      .select()
      .from(loginAttempts)
      .where(and(eq(loginAttempts.emailHash, (await import("./security/login")).loginEmailHash(u.email)), eq(loginAttempts.success, false)));
    expect(failures.length).toBe(passwordChecks.n);
    // The checked ones count toward the same window: topped up to 5, even the correct password is refused.
    for (let i = passwordChecks.n; i < 5; i++) {
      expect(await authenticate({ email: u.email, password: "still wrong", headers: new Headers({ "x-forwarded-for": `198.18.0.${50 + i}` }) })).toEqual({
        ok: false,
        reason: "invalid",
      });
    }
    expect(await authenticate({ email: u.email, password: PASSWORD, headers: new Headers({ "x-forwarded-for": "198.18.0.99" }) })).toEqual({
      ok: false,
      reason: "throttled",
    });
  });

  it("counts parallel attempts per network too: 30 at once from one address reach at most 20 checks", async () => {
    const { authenticate } = await import("./security/login");
    passwordChecks.n = 0;
    const h = new Headers({ "x-forwarded-for": "198.18.1.7" });
    await Promise.all(
      Array.from({ length: 30 }, (_, i) => authenticate({ email: `burst${i}-${newId(4).toLowerCase()}@example.com`, password: "nope nope nope", headers: h })),
    );
    expect(passwordChecks.n).toBeLessThanOrEqual(20);
    expect(passwordChecks.n).toBeGreaterThan(0);
  });

  it("records attempts with HMACs only, and signs in with the right password", async () => {
    const u = await makeUser({ orgId: orgA });
    expect(await redirectOf(actions.login(null, form({ email: u.email.toUpperCase(), password: PASSWORD, locale: "en" })))).toBe("/dashboard");
    const s = (await auth.getSession())!;
    expect(s.user.id).toBe(u.id);
    expect(s.auth?.mfaVerifiedAt).toBeInstanceOf(Date);
    const rows = await db.select().from(loginAttempts).orderBy(desc(loginAttempts.createdAt)).limit(5);
    expect(JSON.stringify(rows)).not.toContain(u.email);
  });

  it("keeps ?next inside the dashboard", () => {
    expect(auth.safeNext("/dashboard/patients/x")).toBe("/dashboard/patients/x");
    expect(auth.safeNext("/it/invite/abcDEF_123-x")).toBe("/it/invite/abcDEF_123-x");
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil", "/dashboard//evil.example", "/xx/invite/a", null]) {
      expect(auth.safeNext(bad)).toBe("/dashboard");
    }
  });
});

describe("signup, email confirmation and password reset", () => {
  const signupForm = (email: string, extra: Record<string, string> = {}) =>
    form({
      locale: "it",
      name: "Laura Bassi",
      email,
      password: PASSWORD,
      practiceName: `Studio ${newId(5)}`,
      address: "Via Po 1",
      city: "Torino",
      acceptTerms: "on",
      acceptDpa: "on",
      ...extra,
    });

  it("requires both unticked boxes and a strong password", async () => {
    const res = await actions.signup(null, form({ locale: "en", name: "Laura", email: "a@example.com", password: "password1234", practiceName: "Studio", address: "Via Po 1", city: "Torino" }));
    expect(res?.fieldErrors).toMatchObject({
      password: "This password is too common. Choose something harder to guess.",
      acceptTerms: expect.any(String),
      acceptDpa: expect.any(String),
    });
  });

  it("creates the practice with the legal acceptances, sends a confirmation, and answers the same for a taken email", async () => {
    const email = `owner-${newId(6).toLowerCase()}@example.com`;
    const first = await actions.signup(null, signupForm(email));
    expect(first).toEqual({ done: true, email });
    const [user] = await db.select().from(users).where(eq(users.email, email));
    const [m] = await db.select().from(memberships).where(eq(memberships.userId, user.id));
    expect(m.role).toBe("owner");
    const docs = await db.select().from(legalAcceptances).where(eq(legalAcceptances.orgId, m.orgId));
    expect(docs.map((d) => d.documentType).sort()).toEqual(["dpa", "subprocessors", "terms"]);
    const [created] = await db.select().from(auditLog).where(and(eq(auditLog.orgId, m.orgId), eq(auditLog.action, "auth.signup")));
    expect(created).toMatchObject({ actorId: user.id, entityType: "org", entityId: m.orgId });
    const [token] = await db.select().from(authTokens).where(and(eq(authTokens.userId, user.id), eq(authTokens.kind, "email_verify")));
    expect(token.expiresAt.getTime() - token.createdAt.getTime()).toBe(24 * 3_600_000);
    // No session: the user confirms and logs in.
    expect(cookieToken()).toBeNull();

    asClient();
    const again = await actions.signup(null, signupForm(email));
    expect(again).toEqual(first);
    expect((await db.select().from(users).where(eq(users.email, email))).length).toBe(1);
  });

  it("confirms the email of the user and of the practice they own", async () => {
    const email = `confirm-${newId(6).toLowerCase()}@example.com`;
    await actions.signup(null, signupForm(email));
    const [user] = await db.select().from(users).where(eq(users.email, email));
    const [m] = await db.select().from(memberships).where(eq(memberships.userId, user.id));
    const { issueAuthToken } = await import("./security/tokens");
    const { token } = await issueAuthToken({ kind: "email_verify", userId: user.id, email, orgId: m.orgId });
    expect(await redirectOf(actions.verifyEmail(null, form({ token, locale: "it" })))).toBe("/it/login?notice=verified");
    const [u2] = await db.select().from(users).where(eq(users.id, user.id));
    const [org] = await db.select().from(organizations).where(eq(organizations.id, m.orgId));
    expect(u2.emailVerifiedAt).toBeInstanceOf(Date);
    expect(org.emailVerifiedAt).toBeInstanceOf(Date);
    const logged = await db.select().from(auditLog).where(and(eq(auditLog.orgId, m.orgId), eq(auditLog.action, "auth.email.verify")));
    expect(logged.map((r) => r.entityType).sort()).toEqual(["org", "user"]);
    // Single use.
    expect(await actions.verifyEmail(null, form({ token, locale: "en" }))).toMatchObject({ error: expect.any(String) });
  });

  it("resets a password with a 30-minute single-use link and ends every session", async () => {
    const u = await makeUser({ orgId: orgA });
    await auth.createSession(u.id, orgA);
    expect(await actions.requestPasswordReset(null, form({ email: u.email, locale: "en" }))).toEqual({ done: true, email: u.email });
    expect(await actions.requestPasswordReset(null, form({ email: "ghost@example.com", locale: "en" }))).toEqual({ done: true, email: "ghost@example.com" });
    const [row] = await db.select().from(authTokens).where(and(eq(authTokens.userId, u.id), eq(authTokens.kind, "password_reset")));
    expect(row.expiresAt.getTime() - row.createdAt.getTime()).toBe(30 * MIN);
    // The link in the log is redacted: only the hash exists anywhere.
    const [mail] = await db.select().from(messages).where(eq(messages.to, u.email)).orderBy(desc(messages.createdAt)).limit(1);
    expect(mail.body).toBe("[account email: passwordReset]");

    const { issueAuthToken } = await import("./security/tokens");
    const { token } = await issueAuthToken({ kind: "password_reset", userId: u.id, email: u.email });
    const weak = await actions.resetPassword(null, form({ token, password: "short", confirm: "short", locale: "en" }));
    // Every refusal carries the summary error, which the form announces (role="alert"); a field message alone is silent.
    expect(weak).toEqual({ error: "Please check the highlighted fields.", fieldErrors: { password: "Use at least 12 characters." } });
    const mismatch = await actions.resetPassword(null, form({ token, password: "a brand new long passphrase", confirm: "another long passphrase", locale: "en" }));
    expect(mismatch).toEqual({ error: "Please check the highlighted fields.", fieldErrors: { confirm: "The two passwords don't match." } });
    expect(await actions.requestPasswordReset(null, form({ email: "not-an-email", locale: "en" }))).toMatchObject({
      error: "Please check the highlighted fields.",
      fieldErrors: { email: "Enter a valid email address." },
    });
    const next = "a brand new long passphrase";
    expect(await redirectOf(actions.resetPassword(null, form({ token, password: next, confirm: next, locale: "en" })))).toBe(
      "/en/login?notice=passwordChanged",
    );
    expect(await db.select().from(sessions).where(eq(sessions.userId, u.id))).toEqual([]);
    expect(await actions.resetPassword(null, form({ token, password: next, confirm: next, locale: "en" }))).toMatchObject({ error: expect.any(String) });
  });
});

describe("invitations", () => {
  it("invites by email with the role, and the invitee joins after accepting the staff instructions", async () => {
    const owner = await makeUser({ orgId: orgA, role: "owner" });
    await auth.createSession(owner.id, orgA, { mfaVerifiedAt: new Date() });
    staffState.session = { ...(await auth.resolveSession(cookieToken()!))!, role: "owner" };
    const email = `new-${newId(6).toLowerCase()}@example.com`;
    expect(await team.inviteMember({ email, role: "practitioner" })).toMatchObject({ ok: true });
    const [invite] = await db.select().from(authTokens).where(and(eq(authTokens.email, email), eq(authTokens.kind, "invite")));
    expect(invite).toMatchObject({ orgId: orgA, role: "practitioner", createdByUserId: owner.id });
    expect(invite.expiresAt.getTime() - invite.createdAt.getTime()).toBe(7 * 86_400_000);

    // The raw token only travels by email; issue a known one for the test.
    const { issueAuthToken } = await import("./security/tokens");
    const { token } = await issueAuthToken({ kind: "invite", email, orgId: orgA, role: "practitioner", createdByUserId: owner.id });
    staffState.session = null;
    req.store.clear();
    asClient();
    const noBox = await actions.acceptInvite(null, form({ token, name: "Piero Neri", password: PASSWORD, locale: "it" }));
    expect(noBox?.fieldErrors?.acceptInstructions).toBeTruthy();
    expect(noBox?.error).toBeTruthy();
    expect(
      await redirectOf(actions.acceptInvite(null, form({ token, name: "Piero Neri", password: PASSWORD, acceptInstructions: "on", locale: "it" }))),
    ).toBe("/dashboard");
    const [joined] = await db.select().from(users).where(eq(users.email, email));
    const [m] = await db.select().from(memberships).where(and(eq(memberships.userId, joined.id), eq(memberships.orgId, orgA)));
    expect(m).toMatchObject({ role: "practitioner", instructionsVersion: "2026-10", invitedByUserId: owner.id });
    const [accepted] = await db.select().from(legalAcceptances).where(and(eq(legalAcceptances.userId, joined.id), eq(legalAcceptances.documentType, "staff_instructions")));
    expect(accepted.orgId).toBe(orgA);
    // Single use.
    expect(await actions.acceptInvite(null, form({ token, name: "X", password: PASSWORD, acceptInstructions: "on", locale: "it" }))).toMatchObject({
      error: expect.any(String),
    });
  });

  it("only owners hand out the owner role, and a practice keeps one owner", async () => {
    const { orgId } = await createPractice();
    const owner = await makeUser({ orgId, role: "owner" });
    const admin = await makeUser({ orgId, role: "admin" });
    await auth.createSession(admin.id, orgId, { mfaVerifiedAt: new Date() });
    staffState.session = { ...(await auth.resolveSession(cookieToken()!))!, role: "admin" };
    expect(await team.inviteMember({ email: "boss@example.com", role: "owner" })).toMatchObject({ ok: false, code: "owner_only" });
    expect(await team.changeMemberRole(owner.id, "reception")).toMatchObject({ ok: false, code: "owner_only" });
    expect(await team.removeMember(owner.id)).toMatchObject({ ok: false, code: "owner_only" });

    req.store.clear();
    await auth.createSession(owner.id, orgId, { mfaVerifiedAt: new Date() });
    staffState.session = { ...(await auth.resolveSession(cookieToken()!))!, role: "owner" };
    expect(await team.changeMemberRole(owner.id, "admin")).toMatchObject({ ok: false, code: "not_self" });
    expect(await team.changeMemberRole(admin.id, "owner")).toMatchObject({ ok: true });
    expect(await team.changeMemberRole(admin.id, "reception")).toMatchObject({ ok: true });
  });
});

describe("team actions stay inside the practice", () => {
  /** Sign in as `userId` in `orgId` with a fresh verification, as the session actions run under. */
  async function actAs(userId: string, orgId: string, role: MembershipRole) {
    req.store.clear();
    await auth.createSession(userId, orgId, { mfaVerifiedAt: new Date() });
    staffState.session = { ...(await auth.resolveSession(cookieToken()!))!, role };
  }

  it("a two-step reset is refused for someone who also works for another practice, or is a platform admin", async () => {
    const a = await createPractice();
    const b = await createPractice();
    const admin = await makeUser({ orgId: a.orgId, role: "admin" });
    // Dr. Rossi: practitioner here, owner of another practice, with MFA and a session there.
    const rossi = await makeUser({ orgId: a.orgId, role: "practitioner", mfaSecret: "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP" });
    await db.insert(memberships).values({ userId: rossi.id, orgId: b.orgId, role: "owner" });
    await auth.createSession(rossi.id, b.orgId, { mfaVerifiedAt: new Date() });

    await actAs(admin.id, a.orgId, "admin");
    expect(await team.resetMemberMfa(rossi.id)).toMatchObject({ ok: false, code: "shared_account" });
    const [after] = await db.select().from(users).where(eq(users.id, rossi.id));
    expect(after.totpEnabledAt).toBeInstanceOf(Date);
    expect((await db.select().from(sessions).where(eq(sessions.userId, rossi.id))).length).toBe(1);

    const platform = await makeUser({ orgId: a.orgId, role: "reception", mfaSecret: "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP" });
    await db.update(users).set({ isPlatformAdmin: true }).where(eq(users.id, platform.id));
    expect(await team.resetMemberMfa(platform.id)).toMatchObject({ ok: false, code: "shared_account" });

    // Someone who works here only: reset, and signed out.
    const solo = await makeUser({ orgId: a.orgId, role: "reception", mfaSecret: "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP" });
    expect(await team.resetMemberMfa(solo.id)).toMatchObject({ ok: true });
    const [cleared] = await db.select().from(users).where(eq(users.id, solo.id));
    expect(cleared.totpEnabledAt).toBeNull();
    const [logged] = await db.select().from(auditLog).where(and(eq(auditLog.orgId, a.orgId), eq(auditLog.action, "auth.mfa.reset")));
    expect(logged).toMatchObject({ actorId: admin.id, entityType: "user", entityId: solo.id });
  });

  it("withdrawing an open invitation is audited as member.invite_withdraw, and only in its own practice", async () => {
    const a = await createPractice();
    const b = await createPractice();
    const owner = await makeUser({ orgId: a.orgId, role: "owner" });
    await actAs(owner.id, a.orgId, "owner");
    const email = `invitee-${newId(6).toLowerCase()}@example.com`;
    expect(await team.inviteMember({ email, role: "reception" })).toMatchObject({ ok: true });
    const [invite] = await db.select().from(authTokens).where(and(eq(authTokens.email, email), eq(authTokens.kind, "invite")));
    const outsider = await makeUser({ orgId: b.orgId, role: "owner" });
    await actAs(outsider.id, b.orgId, "owner");
    expect(await team.withdrawInvite(invite.id)).toMatchObject({ ok: false, code: "not_found" });
    await actAs(owner.id, a.orgId, "owner");
    expect(await team.withdrawInvite(invite.id)).toMatchObject({ ok: true });
    const [logged] = await db.select().from(auditLog).where(and(eq(auditLog.orgId, a.orgId), eq(auditLog.action, "member.invite_withdraw")));
    expect(logged).toMatchObject({ actorId: owner.id, metadata: { inviteId: invite.id.slice(0, 16) } });
  });

  it("removing someone who works elsewhere too ends only their sessions in this practice", async () => {
    const a = await createPractice();
    const b = await createPractice();
    const owner = await makeUser({ orgId: a.orgId, role: "owner" });
    const member = await makeUser({ orgId: a.orgId, role: "reception" });
    await db.insert(memberships).values({ userId: member.id, orgId: b.orgId, role: "owner" });
    req.store.clear();
    const here = await auth.createSession(member.id, a.orgId);
    req.store.clear();
    const there = await auth.createSession(member.id, b.orgId);

    await actAs(owner.id, a.orgId, "owner");
    expect(await team.removeMember(member.id)).toMatchObject({ ok: true });
    const left = (await db.select().from(sessions).where(eq(sessions.userId, member.id))).map((r) => r.id);
    expect(left).toEqual([there]);
    expect(left).not.toContain(here);
  });

  it("removing or demoting a manager turns off the feed URLs they generated and revokes their API keys", async () => {
    const p = await createPractice();
    const [org] = await db.select().from(organizations).where(eq(organizations.id, p.orgId));
    await db
      .update(organizations)
      .set({ settings: { ...org.settings, privacy: { ...org.settings.privacy, icsFeedsEnabled: true } } })
      .where(eq(organizations.id, p.orgId));
    const owner = await makeUser({ orgId: p.orgId, role: "owner" });
    const ics = await import("@/app/dashboard/actions/ics");
    const keys = await import("@/app/dashboard/actions/apikeys");
    const feedOf = async (id: string) => (await db.select().from(practitioners).where(eq(practitioners.id, id)))[0];
    const keyOf = async (id: string) => (await db.select().from(apiKeys).where(eq(apiKeys.id, id)))[0];
    const newKeyBy = async (userId: string) => {
      expect(await keys.newApiKey({ name: "Partner", scopes: ["patients:read"] })).toMatchObject({ ok: true });
      const [k] = await db.select().from(apiKeys).where(and(eq(apiKeys.orgId, p.orgId), eq(apiKeys.createdByUserId, userId)));
      return k.id;
    };

    // X, an admin, issues Dr. A's feed and a partner key; Dr. B's feed is issued by the owner.
    const x = await makeUser({ orgId: p.orgId, role: "admin" });
    await actAs(x.id, p.orgId, "admin");
    expect(await ics.rotateIcsToken(p.drA)).toMatchObject({ ok: true });
    expect(await feedOf(p.drA)).toMatchObject({ icsIssuedByUserId: x.id });
    const xKey = await newKeyBy(x.id);
    await actAs(owner.id, p.orgId, "owner");
    expect(await ics.rotateIcsToken(p.drB)).toMatchObject({ ok: true });
    const ownerKey = await newKeyBy(owner.id);

    const removed = await team.removeMember(x.id);
    expect(removed).toMatchObject({ ok: true });
    expect(removed.ok && removed.message).toContain("1 calendar link they generated was turned off.");
    expect(removed.ok && removed.message).toContain("1 API key they created was revoked.");
    expect(await feedOf(p.drA)).toMatchObject({ icsEnabled: false, icsTokenHash: null, icsIssuedByUserId: null });
    expect((await keyOf(xKey)).revokedAt).toBeInstanceOf(Date);
    // What others issued stays.
    expect(await feedOf(p.drB)).toMatchObject({ icsEnabled: true, icsTokenHash: expect.any(String) });
    expect((await keyOf(ownerKey)).revokedAt).toBeNull();
    const logged = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.orgId, p.orgId), eq(auditLog.action, "apikey.revoke"), eq(auditLog.entityId, xKey)));
    expect(logged[0]?.metadata).toMatchObject({ cause: "member_removed" });

    // Y, an admin linked to Dr. C, issues Dr. C's feed (their own) and Dr. A's, plus a key; then is demoted.
    const y = await makeUser({ orgId: p.orgId, role: "admin" });
    await db.update(practitioners).set({ userId: y.id }).where(eq(practitioners.id, p.drC));
    await actAs(y.id, p.orgId, "admin");
    expect(await ics.rotateIcsToken(p.drC)).toMatchObject({ ok: true });
    expect(await ics.rotateIcsToken(p.drA)).toMatchObject({ ok: true });
    const yKey = await newKeyBy(y.id);
    await actAs(owner.id, p.orgId, "owner");
    // Owner to admin would keep both powers: here, admin to practitioner loses them.
    expect(await team.changeMemberRole(y.id, "practitioner")).toMatchObject({ ok: true });
    expect(await feedOf(p.drA)).toMatchObject({ icsEnabled: false, icsTokenHash: null });
    expect(await feedOf(p.drC)).toMatchObject({ icsEnabled: true, icsTokenHash: expect.any(String) });
    expect((await keyOf(yKey)).revokedAt).toBeInstanceOf(Date);
  });
});

describe("my security: re-authentication and leftovers", () => {
  const sec = () => import("@/app/dashboard/actions/security");

  /** Signed in as a fresh user, verified `minutesAgo` minutes ago. */
  async function me(minutesAgo: number, o: { role?: MembershipRole } = {}) {
    const u = await makeUser({ orgId: orgA, role: o.role ?? "reception" });
    req.store.clear();
    await auth.createSession(u.id, orgA, { mfaVerifiedAt: new Date(Date.now() - minutesAgo * MIN) });
    staffState.session = { ...(await auth.resolveSession(cookieToken()!))!, role: o.role ?? "reception" };
    return u;
  }

  it("setting up two-step verification needs a recent verification (a stolen cookie alone can't enrol)", async () => {
    const { startMfaEnrolment, confirmMfaEnrolmentAction } = await sec();
    asClient({ "next-action": "abc" });
    await me(30);
    expect(await startMfaEnrolment()).toMatchObject({ ok: false, code: STEP_UP_REQUIRED });
    expect(await confirmMfaEnrolmentAction("123456")).toMatchObject({ ok: false, code: STEP_UP_REQUIRED });

    // Right after signing in (the password counts as the verification): straight through.
    const u = await me(0);
    const started = await startMfaEnrolment();
    expect(started).toMatchObject({ ok: true });
    const secret = (started.ok && (started.data as { secret: string }).secret) || "";
    expect(await confirmMfaEnrolmentAction(totp(secret))).toMatchObject({ ok: true });
    const [row] = await db.select().from(users).where(eq(users.id, u.id));
    expect(row.totpEnabledAt).toBeInstanceOf(Date);
  });

  it("changing the password voids reset links requested before", async () => {
    const { changePassword } = await sec();
    const u = await me(0);
    const { issueAuthToken } = await import("./security/tokens");
    const { token } = await issueAuthToken({ kind: "password_reset", userId: u.id, email: u.email });
    const next = "another long passphrase here";
    expect(await changePassword({ current: PASSWORD, next, confirm: next })).toMatchObject({ ok: true });
    const later = "the attacker's own passphrase";
    expect(await actions.resetPassword(null, form({ token, password: later, confirm: later, locale: "en" }))).toMatchObject({ error: expect.any(String) });
  });

  it("audits every email confirmation, and a new confirmation link", async () => {
    const { resendVerificationEmail } = await sec();
    // A member who isn't the practice owner (an invited colleague whose address isn't the practice's).
    const u = await me(0);
    expect(await resendVerificationEmail()).toMatchObject({ ok: true });
    const { issueAuthToken } = await import("./security/tokens");
    const { token } = await issueAuthToken({ kind: "email_verify", userId: u.id, email: u.email });
    await redirectOf(actions.verifyEmail(null, form({ token, locale: "en" })));
    const rows = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.entityType, "user"), eq(auditLog.entityId, u.id)))
      .orderBy(auditLog.seq);
    expect(rows.map((r) => r.action)).toEqual(["auth.email.resend", "auth.email.verify"]);
    expect(rows.every((r) => r.orgId === orgA && r.actorId === u.id)).toBe(true);
  });

  it("turning two-step verification off is audited as auth.mfa.disable", async () => {
    const { removeMfa } = await sec();
    const u = await me(0);
    const [row] = await db.select().from(users).where(eq(users.id, u.id));
    const started = (await beginMfaEnrolment(row))!;
    await confirmMfaEnrolment(u.id, totp(started.secret));
    expect(await removeMfa("replace")).toMatchObject({ ok: true });
    const [logged] = await db.select().from(auditLog).where(and(eq(auditLog.action, "auth.mfa.disable"), eq(auditLog.entityId, u.id)));
    expect(logged).toMatchObject({ orgId: orgA, actorId: u.id, metadata: { change: "removed_for_replacement" } });
  });
});

describe("practice email confirmation", () => {
  async function ownerOfNewPractice() {
    const p = await createPractice();
    const owner = await makeUser({ orgId: p.orgId, role: "owner" });
    const [org] = await db.select().from(organizations).where(eq(organizations.id, p.orgId));
    return { orgId: p.orgId, owner, org };
  }

  it("a link to the practice's address confirms the practice email only, never the owner's own address", async () => {
    const { orgId, owner, org } = await ownerOfNewPractice();
    const practiceEmail = `segreteria-${newId(6).toLowerCase()}@example.com`;
    await db.update(organizations).set({ email: practiceEmail, emailVerifiedAt: null }).where(eq(organizations.id, orgId));
    const { sendPracticeEmailVerification } = await import("./security/emails");
    await sendPracticeEmailVerification({ org, owner: { id: owner.id, name: "Anna Verdi", locale: null }, email: practiceEmail });
    const [mail] = await db.select().from(messages).where(eq(messages.to, practiceEmail));
    expect(mail.body).toBe("[account email: verifyPracticeEmail]");
    const [issued] = await db.select().from(authTokens).where(and(eq(authTokens.email, practiceEmail), eq(authTokens.kind, "email_verify")));
    expect(issued).toMatchObject({ userId: owner.id, orgId });

    // The raw token only travels by email; issue a known one the same way.
    const { issueAuthToken } = await import("./security/tokens");
    const { token } = await issueAuthToken({ kind: "email_verify", userId: owner.id, email: practiceEmail, orgId });
    expect(await redirectOf(actions.verifyEmail(null, form({ token, locale: "it" })))).toBe("/it/login?notice=verified");
    const [o] = await db.select().from(organizations).where(eq(organizations.id, orgId));
    const [u] = await db.select().from(users).where(eq(users.id, owner.id));
    expect(o.emailVerifiedAt).toBeInstanceOf(Date);
    expect(u.emailVerifiedAt).toBeNull();
    const logged = await db.select().from(auditLog).where(and(eq(auditLog.action, "auth.email.verify"), eq(auditLog.orgId, orgId)));
    expect(logged.map((r) => [r.entityType, r.entityId])).toEqual([["org", orgId]]);
  });

  it("confirms nothing once the address is neither the practice's nor the user's any more, or the issuer no longer owns it", async () => {
    const { orgId, owner } = await ownerOfNewPractice();
    const { issueAuthToken } = await import("./security/tokens");
    const old = `old-${newId(6).toLowerCase()}@example.com`;
    await db.update(organizations).set({ email: old, emailVerifiedAt: null }).where(eq(organizations.id, orgId));
    const stale = await issueAuthToken({ kind: "email_verify", userId: owner.id, email: old, orgId });
    await db.update(organizations).set({ email: `new-${newId(6).toLowerCase()}@example.com` }).where(eq(organizations.id, orgId));
    expect(await actions.verifyEmail(null, form({ token: stale.token, locale: "en" }))).toMatchObject({ error: expect.any(String) });

    await db.update(organizations).set({ email: old }).where(eq(organizations.id, orgId));
    const demoted = await issueAuthToken({ kind: "email_verify", userId: owner.id, email: old, orgId });
    await db.update(memberships).set({ role: "admin" }).where(and(eq(memberships.userId, owner.id), eq(memberships.orgId, orgId)));
    expect(await actions.verifyEmail(null, form({ token: demoted.token, locale: "en" }))).toMatchObject({ error: expect.any(String) });
    const [o] = await db.select().from(organizations).where(eq(organizations.id, orgId));
    expect(o.emailVerifiedAt).toBeNull();
  });
});
