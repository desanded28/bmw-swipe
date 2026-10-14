import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import type { MembershipRole } from "@/db/enums";
import { auditLog, legalAcceptances, messages, organizations, patients, privacyRequests, users, type StoredOrgSettings } from "@/db/schema";
import type { StaffSession } from "@/lib/auth";
import { newId } from "@/lib/ids";
import { customRegisterEntries } from "@/lib/privacy/register";
import { RETENTION_LIMITS } from "@/lib/privacy/settings";
import { LEGAL_VERSIONS } from "@/lib/privacy/versions";
import { resolveSettings } from "@/lib/settings";
import { todayIn } from "@/lib/time";
import { createPractice } from "@/test/fixtures";
import { saveBookingPolicy, saveProfile } from "./settings";
import {
  acceptLegalDocument,
  addRegisterEntry,
  completePrivacyRequestAction,
  extendPrivacyRequestAction,
  logPrivacyRequest,
  removeRegisterEntry,
  requestClosureAction,
  savePrivacySettings,
  startPrivacyRequestAction,
} from "./privacy";

const state = vi.hoisted(() => ({ session: null as StaffSession | null, stepUp: "ok" as "ok" | "required" }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-real-ip": "203.0.113.5", "user-agent": "vitest" }), cookies: async () => new Map() }));
vi.mock("@/lib/auth", async (orig) => ({
  ...(await orig<typeof import("@/lib/auth")>()),
  requireStaff: async () => {
    if (!state.session) throw new Error("no session in test");
    return state.session;
  },
  requireStepUp: async () => {
    if (state.stepUp === "required") throw Object.assign(new Error("step up"), { code: "step_up_required" });
  },
}));

let orgId: string;
const userIds: Partial<Record<MembershipRole, string>> = {};

async function signIn(role: MembershipRole) {
  const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
  if (!userIds[role]) {
    userIds[role] = newId();
    await db.insert(users).values({ id: userIds[role]!, email: `${role}-${userIds[role]}@example.org`, name: role, passwordHash: "x" });
  }
  state.session = { sessionId: "s1", user: { id: userIds[role]!, name: role, email: "x@example.org", isPlatformAdmin: false, locale: null }, org, role, orgs: [{ org, role }] };
  state.stepUp = "ok";
  return state.session;
}

const form = (fields: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
};
const stored = async () => (await db.select().from(organizations).where(eq(organizations.id, orgId)))[0];

beforeAll(async () => {
  ({ orgId } = await createPractice());
});

describe("privacy settings", () => {
  it("need a fresh second factor, clamp to the legal limits, keep the register's rows and are audited", async () => {
    await signIn("owner");
    await addRegisterEntry(null, form({ activity: "Cartelle cliniche cartacee", purpose: "Cura", retention: "10 anni" }));
    const fields = {
      messageContentLevel: "detailed",
      whatsappEnabled: "on",
      icsDetail: "initials",
      embedOrigins: "https://www.studio.it\nhttp://evil.example\nnot a url",
      sessionHours: "99",
      erasureDefault: "anonymise",
      "retention.auditMonths": "1",
      "retention.messageBodyMonths": "6",
    };
    state.stepUp = "required";
    expect(await savePrivacySettings(null, form(fields))).toMatchObject({ ok: false, code: "step_up_required" });
    state.stepUp = "ok";
    const res = await savePrivacySettings(null, form(fields));
    expect(res.ok).toBe(true);
    expect(res.ok && res.message).toContain("http://evil.example");

    const org = await stored();
    const p = resolveSettings(org.settings).privacy;
    expect(p).toMatchObject({ messageContentLevel: "detailed", whatsappEnabled: true, marketingEnabled: false, icsDetail: "initials", erasureDefault: "anonymise" });
    expect(p.embedOrigins).toEqual(["https://www.studio.it"]);
    expect(p.sessionHours).toBe(24);
    expect(p.retention.auditMonths).toBe(RETENTION_LIMITS.auditMonths.min);
    expect(p.retention.messageBodyMonths).toBe(6);
    expect(customRegisterEntries(org)).toHaveLength(1);

    const [a] = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.orgId, orgId), eq(auditLog.action, "settings.privacy.update")))
      .orderBy(auditLog.seq);
    expect(a).toBeDefined();
    const last = (await db.select().from(auditLog).where(and(eq(auditLog.orgId, orgId), eq(auditLog.action, "settings.privacy.update")))).at(-1)!;
    expect(String(last.metadata?.changed)).toContain("whatsappEnabled");

    // Saving other settings keeps the register too.
    await saveBookingPolicy(null, form({ minNoticeHours: "2", maxAdvanceDays: "60", slotStepMinutes: "15", cancelUntilHours: "24" }));
    expect(customRegisterEntries(await stored())).toHaveLength(1);
    const entry = customRegisterEntries(await stored())[0];
    expect((await removeRegisterEntry(entry.id)).ok).toBe(true);
    expect(customRegisterEntries(await stored())).toHaveLength(0);
    expect(((await stored()).settings as StoredOrgSettings).booking?.maxAdvanceDays).toBe(60);
  });

  it("are for managers only", async () => {
    await signIn("reception");
    expect(await savePrivacySettings(null, form({}))).toMatchObject({ ok: false, code: "forbidden" });
    expect(await addRegisterEntry(null, form({ activity: "x" }))).toMatchObject({ ok: false, code: "forbidden" });
  });
});

describe("practice profile", () => {
  it("stores the controller identity and validates the website as an http(s) URL", async () => {
    await signIn("owner");
    const base = { name: "Studio Test", brandColor: "#0d9488", legalName: "Studio Test S.r.l.", vatNumber: "IT01234567890", privacyEmail: "privacy@studio.it", dpoName: "Avv. Rossi", dpoEmail: "dpo@studio.it", medicalDirector: "Dr. Bianchi", registeredAddress: "Via Roma 1, Milano" };
    expect(await saveProfile(null, form({ ...base, website: "javascript:alert(1)" }))).toMatchObject({ ok: false, code: "invalid_website" });
    expect(await saveProfile(null, form({ ...base, website: "ftp://studio.it" }))).toMatchObject({ ok: false, code: "invalid_website" });
    expect(await saveProfile(null, form({ ...base, website: "https://studio", privacyEmail: "nope" }))).toMatchObject({ ok: false });
    expect((await saveProfile(null, form({ ...base, website: "www.studio.it" }))).ok).toBe(true);
    expect(await stored()).toMatchObject({ website: "https://www.studio.it", legalName: "Studio Test S.r.l.", vatNumber: "IT01234567890", dpoEmail: "dpo@studio.it", medicalDirector: "Dr. Bianchi" });
  });
});

describe("legal acceptance", () => {
  it("lets every member accept the staff instructions, and only managers the DPA", async () => {
    const reception = await signIn("reception");
    expect(await acceptLegalDocument("dpa")).toMatchObject({ ok: false, code: "forbidden" });
    expect((await acceptLegalDocument("staff_instructions")).ok).toBe(true);
    const owner = await signIn("owner");
    expect((await acceptLegalDocument("dpa")).ok).toBe(true);
    const rows = await db.select().from(legalAcceptances).where(eq(legalAcceptances.orgId, orgId));
    expect(rows.find((r) => r.documentType === "staff_instructions")).toMatchObject({ userId: reception.user.id, version: LEGAL_VERSIONS.staff_instructions });
    const dpa = rows.find((r) => r.documentType === "dpa")!;
    expect(dpa).toMatchObject({ userId: owner.user.id, version: LEGAL_VERSIONS.dpa });
    expect(dpa.ipHash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("privacy requests inbox", () => {
  it("logs a phone request from its day of receipt, then extends and completes it, telling the requester", async () => {
    await signIn("owner");
    const [patient] = await db
      .insert(patients)
      .values({ id: newId(), orgId, firstName: "Ada", lastName: "Neri", email: "ada.n@example.org", locale: "de" })
      .returning();
    const today = todayIn("Europe/Rome");
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    expect(await logPrivacyRequest(null, form({ type: "access", channel: "phone", receivedAt: "2999-01-01" }))).toMatchObject({ ok: false, code: "invalid_date" });
    expect((await logPrivacyRequest(null, form({ type: "access", channel: "phone", receivedAt: yesterday, patientId: patient.id, details: "Telefonata", language: "de" }))).ok).toBe(true);
    const [r] = await db.select().from(privacyRequests).where(eq(privacyRequests.patientId, patient.id));
    expect(r).toMatchObject({ channel: "phone", requesterLocale: "de", status: "open" });
    expect(r.receivedAt.toISOString().slice(0, 10) <= today).toBe(true);

    expect((await startPrivacyRequestAction(r.id)).ok).toBe(true);
    const until = new Date(r.dueAt.getTime() + 30 * 86_400_000).toISOString().slice(0, 10);
    expect(await extendPrivacyRequestAction(r.id, null, form({ until, reason: "" }))).toMatchObject({ ok: false, code: "reason_required" });
    expect((await extendPrivacyRequestAction(r.id, null, form({ until, reason: "Molti archivi da consultare" }))).ok).toBe(true);
    expect((await completePrivacyRequestAction(r.id, null, form({ decision: "granted", reason: "Copia inviata via email." }))).ok).toBe(true);
    const [done] = await db.select().from(privacyRequests).where(eq(privacyRequests.id, r.id));
    expect(done).toMatchObject({ status: "completed", decision: "granted", extensionReason: "Molti archivi da consultare" });
    const sent = await db.select().from(messages).where(eq(messages.patientId, patient.id));
    expect(sent.map((m) => m.to)).toEqual(["ada.n@example.org", "ada.n@example.org"]);
    expect(sent.at(-1)!.body).toContain("Copia inviata via email.");
  });
});

describe("closure", () => {
  it("needs the owner, the practice name typed and a fresh second factor", async () => {
    await signIn("admin");
    expect(await requestClosureAction(null, form({ confirm: "Studio Test" }))).toMatchObject({ ok: false, code: "forbidden" });
    await signIn("owner");
    expect(await requestClosureAction(null, form({ confirm: "Other" }))).toMatchObject({ ok: false, code: "confirm_mismatch" });
    state.stepUp = "required";
    expect(await requestClosureAction(null, form({ confirm: "Studio Test" }))).toMatchObject({ ok: false, code: "step_up_required" });
    state.stepUp = "ok";
    expect((await requestClosureAction(null, form({ confirm: "studio test" }))).ok).toBe(true);
    const org = await stored();
    expect(org.closureRequestedAt).not.toBeNull();
    expect(org.listed).toBe(false);
  });
});
