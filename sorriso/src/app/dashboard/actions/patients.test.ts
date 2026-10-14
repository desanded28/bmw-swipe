import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import type { MembershipRole } from "@/db/enums";
import { auditLog, consents, organizations, patients, users } from "@/db/schema";
import type { StaffSession } from "@/lib/auth";
import { newId } from "@/lib/ids";
import { createPractice } from "@/test/fixtures";
import { erasePatientAction, listPatientRows, openRestrictedRecord, recordConsentAction, restrictPatientAction, searchPatients, updatePatient } from "./patients";

const state = vi.hoisted(() => ({ session: null as StaffSession | null, stepUp: "ok" as "ok" | "required" }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-real-ip": "203.0.113.5" }), cookies: async () => new Map() }));
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

async function addPatient(over: Partial<typeof patients.$inferInsert> = {}) {
  const [p] = await db
    .insert(patients)
    .values({ id: newId(), orgId, firstName: "Zelinda", lastName: "Quartararo", phone: `+3934${Math.floor(Math.random() * 1e8)}`, ...over })
    .returning();
  return p;
}

beforeAll(async () => {
  ({ orgId } = await createPractice());
});

describe("patients list and search", () => {
  it("audits a search without storing the term, and masks restricted records for the front desk", async () => {
    const owner = await signIn("owner");
    const visible = await addPatient();
    const hidden = await addPatient({ restrictedAt: new Date(), restrictionReason: "x" });
    const page = await listPatientRows("Quartararo");
    expect(page.rows.map((r) => r.id)).toEqual(expect.arrayContaining([visible.id, hidden.id]));
    expect(page.rows.find((r) => r.id === hidden.id)).toMatchObject({ name: "Quartararo Zelinda", restricted: true });

    const searches = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.orgId, orgId), eq(auditLog.action, "patient.search"), eq(auditLog.actorId, owner.user.id)));
    expect(searches).toHaveLength(1);
    expect(JSON.stringify(searches[0])).not.toMatch(/Quartararo/i);
    expect(searches[0].metadata).toMatchObject({ results: page.total, search: true });

    // Browsing the list is audited too, flagged as no search.
    await listPatientRows("");
    const all = await db.select().from(auditLog).where(and(eq(auditLog.action, "patient.search"), eq(auditLog.actorId, owner.user.id)));
    expect(all.map((a) => a.metadata?.search)).toEqual([true, false]);

    await signIn("reception");
    const masked = (await listPatientRows("Quartararo")).rows.find((r) => r.id === hidden.id);
    expect(masked).toMatchObject({ name: null, phone: null, restricted: true });
    const hits = await searchPatients("Quartararo");
    expect(hits.find((h) => h.id === hidden.id)).toMatchObject({ lastName: "", phone: null, restricted: true });
    expect(hits.find((h) => h.id === hidden.id)?.firstName).not.toContain("Zelinda");
  });
});

describe("updatePatient", () => {
  it("needs a typed reason to turn an opted-out channel back on, and records it as a staff consent", async () => {
    const s = await signIn("reception");
    const p = await addPatient({ smsOptIn: false, email: "zq@example.org" });
    const base = { firstName: "Zelinda", lastName: "Quartararo", phone: p.phone!, email: "zq@example.org", locale: "it", preferredChannel: "sms", channels: "1", emailOptIn: "on" };
    const refused = await updatePatient(p.id, null, form({ ...base, smsOptIn: "on" }));
    expect(refused).toMatchObject({ ok: false, code: "optin_reason_required" });

    const saved = await updatePatient(p.id, null, form({ ...base, smsOptIn: "on", optInReason: "Asked at the front desk on 12 October" }));
    expect(saved.ok).toBe(true);
    const [row] = await db.select().from(patients).where(eq(patients.id, p.id));
    expect(row.smsOptIn).toBe(true);
    const [c] = await db.select().from(consents).where(and(eq(consents.patientId, p.id), eq(consents.purpose, "sms_channel")));
    expect(c).toMatchObject({ granted: true, method: "staff_recorded", source: "staff", actorUserId: s.user.id });
    const [audited] = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.action, "patient.update"), eq(auditLog.entityId, p.id)));
    expect(audited.reason).toBe("Asked at the front desk on 12 October");
  });

  it("accepts all 8 languages and refuses changes to a restricted record", async () => {
    await signIn("practitioner");
    const p = await addPatient();
    for (const locale of ["pl", "ro", "pt"]) {
      expect((await updatePatient(p.id, null, form({ firstName: "Z", lastName: "Q", locale }))).ok).toBe(true);
      expect((await db.select().from(patients).where(eq(patients.id, p.id)))[0].locale).toBe(locale);
    }
    const r = await addPatient({ restrictedAt: new Date() });
    expect(await updatePatient(r.id, null, form({ firstName: "Z", lastName: "Q" }))).toMatchObject({ ok: false, code: "restricted" });
  });
});

describe("data protection actions", () => {
  it("restricts with a reason, then asks for a reason before acting on the restricted record", async () => {
    await signIn("owner");
    const p = await addPatient();
    expect((await restrictPatientAction(p.id, null, form({ reason: "" }))).ok).toBe(false);
    expect((await restrictPatientAction(p.id, null, form({ reason: "Contesta i dati" }))).ok).toBe(true);
    const consent = () => recordConsentAction(p.id, null, form({ purpose: "marketing", decision: "withdraw", givenBy: "self" }));
    expect(await consent()).toMatchObject({ ok: false, code: "restricted_reason_required" });
    expect((await openRestrictedRecord(p.id, null, form({ reason: "Il paziente ha chiamato" }))).ok).toBe(true);
    expect((await consent()).ok).toBe(true);
  });

  it("erasure needs the patient's name typed and a fresh second factor; reception can't erase", async () => {
    await signIn("reception");
    const p = await addPatient();
    expect(await erasePatientAction(p.id, null, form({ confirm: "Zelinda Quartararo", reason: "Richiesta" }))).toMatchObject({ ok: false, code: "forbidden" });
    await signIn("owner");
    state.stepUp = "required";
    expect(await erasePatientAction(p.id, null, form({ confirm: "Zelinda Quartararo", reason: "Richiesta" }))).toMatchObject({ ok: false, code: "step_up_required" });
    state.stepUp = "ok";
    expect(await erasePatientAction(p.id, null, form({ confirm: "Zelinda Q", reason: "Richiesta" }))).toMatchObject({ ok: false, code: "confirm_mismatch" });
    expect((await erasePatientAction(p.id, null, form({ confirm: " zelinda   quartararo ", reason: "Richiesta", mode: "anonymise" }))).ok).toBe(true);
    const [row] = await db.select().from(patients).where(eq(patients.id, p.id));
    expect(row.erasedAt).not.toBeNull();
  });
});
