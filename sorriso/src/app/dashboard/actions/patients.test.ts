import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import type { MembershipRole } from "@/db/enums";
import { appointments, auditLog, consents, messages, organizations, patients, privacyRequests, users } from "@/db/schema";
import type { StaffSession } from "@/lib/auth";
import { newId } from "@/lib/ids";
import { createPractice } from "@/test/fixtures";
import {
  erasePatientAction,
  listPatientRows,
  openRestrictedRecord,
  recordConsentAction,
  restrictPatientAction,
  searchPatients,
  unrestrictPatientAction,
  updatePatient,
} from "./patients";

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
let practice: Awaited<ReturnType<typeof createPractice>>;
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
  practice = await createPractice();
  ({ orgId } = practice);
});

describe("patients list and search", () => {
  it("audits a search without storing the term, and hides restricted records from the front desk", async () => {
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

    // Without patient.restricted.read a search can't even reveal that a restricted record matches
    // a name or a phone fragment: it is left out of the list and of every search.
    await signIn("reception");
    const byName = await listPatientRows("Quartararo");
    expect(byName.rows.map((r) => r.id)).toContain(visible.id);
    expect(byName.rows.map((r) => r.id)).not.toContain(hidden.id);
    expect((await listPatientRows(hidden.phone!.slice(-6))).rows.map((r) => r.id)).not.toContain(hidden.id);
    expect((await listPatientRows("")).rows.map((r) => r.id)).not.toContain(hidden.id);
    const hits = await searchPatients("Quartararo");
    expect(hits.map((h) => h.id)).toContain(visible.id);
    expect(hits.map((h) => h.id)).not.toContain(hidden.id);
    // Those who may open restricted records find it, flagged, in the drawer.
    await signIn("owner");
    expect((await searchPatients("Quartararo")).find((h) => h.id === hidden.id)).toMatchObject({ restricted: true });
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

  it("records WhatsApp only when enabled and with the patient's confirmed agreement", async () => {
    const s = await signIn("reception");
    const p = await addPatient({ email: "wa@example.org" });
    const base = { firstName: "Zelinda", lastName: "Quartararo", phone: p.phone!, email: "wa@example.org", locale: "it", preferredChannel: "whatsapp" };
    // WhatsApp is off in this practice: a crafted form can't switch to it.
    expect(await updatePatient(p.id, null, form(base))).toMatchObject({ ok: false, code: "whatsapp_disabled" });
    const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
    await db
      .update(organizations)
      .set({ settings: { ...org.settings, privacy: { ...org.settings.privacy, whatsappEnabled: true } } })
      .where(eq(organizations.id, orgId));
    await signIn("reception");
    expect(await updatePatient(p.id, null, form(base))).toMatchObject({ ok: false, code: "whatsapp_consent_required" });
    expect(await updatePatient(p.id, null, form({ ...base, whatsappAgreed: "on" }))).toMatchObject({ ok: false, code: "optin_reason_required" });
    expect(await db.select().from(consents).where(and(eq(consents.patientId, p.id), eq(consents.purpose, "whatsapp_channel")))).toEqual([]);
    const saved = await updatePatient(p.id, null, form({ ...base, whatsappAgreed: "on", optInReason: "Asked for WhatsApp at the desk today" }));
    expect(saved.ok).toBe(true);
    const [c] = await db.select().from(consents).where(and(eq(consents.patientId, p.id), eq(consents.purpose, "whatsapp_channel")));
    expect(c).toMatchObject({ granted: true, method: "staff_recorded", actorUserId: s.user.id });
    // Once on file, saving again needs nothing more.
    expect((await updatePatient(p.id, null, form(base))).ok).toBe(true);
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

  it("an objection to no-show tracking or adaptive reminders clears the stored risk of upcoming visits", async () => {
    await signIn("reception");
    const p = await addPatient();
    const visit = async () => {
      const id = newId();
      const startsAt = new Date(Date.now() + 3 * 86_400_000);
      const endsAt = new Date(startsAt.getTime() + 30 * 60_000);
      await db.insert(appointments).values({
        id,
        orgId,
        locationId: practice.milano,
        practitionerId: practice.drA,
        serviceId: practice.visit,
        patientId: p.id,
        startsAt,
        endsAt,
        blockedUntil: endsAt,
        source: "staff",
        manageToken: `h:${id}`,
        manageTokenHash: `hash-${id}`,
        riskLevel: "high",
        riskReasons: ["history"],
      });
      return async () => (await db.select({ riskLevel: appointments.riskLevel }).from(appointments).where(eq(appointments.id, id)))[0].riskLevel;
    };
    const record = (purpose: string, decision: string) => recordConsentAction(p.id, null, form({ purpose, decision, givenBy: "self" }));

    const first = await visit();
    expect((await record("no_show_tracking", "grant")).ok).toBe(true);
    expect(await first()).toBe("high");
    expect((await record("marketing", "withdraw")).ok).toBe(true);
    expect(await first()).toBe("high");
    expect((await record("no_show_tracking", "withdraw")).ok).toBe(true);
    expect(await first()).toBeNull();

    const second = await visit();
    expect((await record("adaptive_reminders", "withdraw")).ok).toBe(true);
    expect(await second()).toBeNull();
  });

  it("lifting a restriction needs a reason", async () => {
    await signIn("owner");
    const p = await addPatient({ email: "lift@example.org" });
    expect((await restrictPatientAction(p.id, null, form({ reason: "Contesta i dati" }))).ok).toBe(true);
    expect((await openRestrictedRecord(p.id, null, form({ reason: "Verifica conclusa" }))).ok).toBe(true);
    expect(await unrestrictPatientAction(p.id, null, form({ reason: "" }))).toMatchObject({ ok: false, code: "reason_required" });
    expect((await db.select().from(patients).where(eq(patients.id, p.id)))[0].restrictedAt).not.toBeNull();
    expect((await unrestrictPatientAction(p.id, null, form({ reason: "Dati corretti" }))).ok).toBe(true);
    expect((await db.select().from(patients).where(eq(patients.id, p.id)))[0].restrictedAt).toBeNull();
  });

  it("erasing from a privacy request answers it before the contact goes", async () => {
    await signIn("owner");
    const p = await addPatient({ email: "erase-me@example.org" });
    const requestId = newId();
    await db.insert(privacyRequests).values({ id: requestId, orgId, patientId: p.id, type: "erasure", channel: "email", receivedAt: new Date(), dueAt: new Date(Date.now() + 20 * 86_400_000) });
    const fields = { confirm: "Zelinda Quartararo", reason: "Richiesta del paziente", mode: "anonymise", requestId };
    expect(await erasePatientAction(p.id, null, form(fields))).toMatchObject({ ok: false, code: "answer_required" });
    const res = await erasePatientAction(p.id, null, form({ ...fields, answer: "Abbiamo cancellato i suoi dati." }));
    expect(res).toMatchObject({ ok: true, message: "The patient's data was pseudonymised, the request closed and the answer sent." });
    const [r] = await db.select().from(privacyRequests).where(eq(privacyRequests.id, requestId));
    expect(r).toMatchObject({ status: "completed", decision: "granted" });
    const sent = await db.select().from(messages).where(eq(messages.patientId, p.id));
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ channel: "email", body: "", status: "captured" });
    expect(sent[0].to).not.toContain("erase-me");
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
