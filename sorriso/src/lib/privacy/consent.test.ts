import { and, asc, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { auditLog, consents, patients, type ConsentPurpose, type Patient } from "@/db/schema";
import { createPractice } from "@/test/fixtures";
import { hmac } from "../crypto";
import { newId } from "../ids";
import {
  ConsentError,
  consentTextKey,
  currentConsents,
  isAllowed,
  PURPOSE_BASIS,
  recordBookingConsents,
  recordConsent,
  withdrawConsent,
  type RecordConsentInput,
} from "./consent";
import { PLATFORM_CONSENT_PURPOSES } from "./roles";
import { CONSENT_TEXT_VERSION } from "./versions";

const NOW = new Date("2030-03-01T09:00:00Z");
let orgId: string;
let otherOrgId: string;

beforeAll(async () => {
  orgId = (await createPractice()).orgId;
  otherOrgId = (await createPractice()).orgId;
});

let seq = 3300000000;
async function addPatient(overrides: Partial<Patient> = {}): Promise<Patient> {
  const [p] = await db
    .insert(patients)
    .values({ id: newId(), orgId, firstName: "Maria", lastName: "Rossi", phone: `+39${seq++}`, email: `m${seq}@example.com`, ...overrides })
    .returning();
  return p;
}

const base = (patientId: string, purpose: ConsentPurpose, granted = true): RecordConsentInput => ({
  orgId,
  patientId,
  purpose,
  granted,
  locale: "it",
  method: "web_checkbox",
  source: "privacy_center",
  now: NOW,
});

const record = (i: RecordConsentInput) => db.transaction((tx) => recordConsent(tx, i));
const later = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000);
const ledger = (patientId: string) => db.select().from(consents).where(eq(consents.patientId, patientId)).orderBy(asc(consents.createdAt));

describe("consent ledger", () => {
  it("appends rows with the text key, version and an HMAC of the IP", async () => {
    const p = await addPatient();
    const headers = new Headers({ "x-real-ip": "203.0.113.9" });
    const first = await record({ ...base(p.id, "marketing"), headers });
    await db.transaction((tx) =>
      withdrawConsent(tx, { orgId, patientId: p.id, purpose: "marketing", locale: "en", method: "email_link", source: "manage_link", now: later(1) }),
    );

    const rows = await ledger(p.id);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ id: first, granted: true, textKey: "consents.marketing.label", textVersion: CONSENT_TEXT_VERSION.marketing });
    expect(rows[0].ipHash).toBe(hmac("203.0.113.9", "ip"));
    expect(JSON.stringify(rows)).not.toContain("203.0.113.9");
    expect(rows[1]).toMatchObject({ granted: false, locale: "en", source: "manage_link", orgId });
    expect((await currentConsents(p.id)).marketing).toEqual({ granted: false, at: later(1), source: "manage_link" });
  });

  it("uses the consents namespace for text keys", () => {
    expect(consentTextKey("platform_booking_art9")).toBe("consents.platform_booking_art9.label");
  });

  it("orders rows written in the same millisecond by insertion", async () => {
    const p = await addPatient();
    await record(base(p.id, "feedback_request", true));
    await record(base(p.id, "feedback_request", false));
    expect(await isAllowed(p.id, "feedback_request")).toBe(false);
  });

  it("writes an audit row for every change", async () => {
    const p = await addPatient();
    const id = await record(base(p.id, "feedback_request"));
    const rows = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.action, "consent.record"), eq(auditLog.entityId, p.id)));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ orgId, actorType: "patient_session", entityType: "patient" });
    expect(rows[0].metadata).toMatchObject({ consentId: id, purpose: "feedback_request", granted: true });
  });

  it("stores Sorriso's own purposes with org_id NULL, on the platform audit chain", async () => {
    expect([...PLATFORM_CONSENT_PURPOSES].sort()).toEqual(["platform_booking_art9", "review_publication"]);
    const p = await addPatient();
    const id = await record(base(p.id, "platform_booking_art9"));
    const [row] = await db.select().from(consents).where(eq(consents.id, id));
    expect(row.orgId).toBeNull();
    const [a] = await db.select().from(auditLog).where(and(eq(auditLog.action, "consent.record"), eq(auditLog.entityId, p.id)));
    expect(a.orgId).toBeNull();
    expect(await isAllowed(p.id, "platform_booking_art9")).toBe(true);
  });

  it("refuses patients of another practice", async () => {
    const p = await addPatient();
    await expect(record({ ...base(p.id, "marketing"), orgId: otherOrgId })).rejects.toMatchObject({ code: "unknown_patient" });
    await expect(record(base(newId(), "marketing"))).rejects.toBeInstanceOf(ConsentError);
  });

  it("follows a merged duplicate to the kept record", async () => {
    const kept = await addPatient();
    const dup = await addPatient({ mergedIntoId: kept.id });
    await record(base(dup.id, "feedback_request"));
    expect(await isAllowed(kept.id, "feedback_request")).toBe(true);
    expect(await isAllowed(dup.id, "feedback_request")).toBe(true);
    const rows = await ledger(kept.id);
    expect(rows).toHaveLength(1);
  });
});

describe("isAllowed", () => {
  it("needs a current grant for consent purposes", async () => {
    const p = await addPatient();
    expect(await isAllowed(p.id, "marketing")).toBe(false);
    await record(base(p.id, "marketing"));
    expect(await isAllowed(p.id, "marketing")).toBe(true);
    await record({ ...base(p.id, "marketing", false), now: later(1) });
    expect(await isAllowed(p.id, "marketing")).toBe(false);
  });

  it("allows legitimate-interest, care and contract purposes until an objection or opt-out", async () => {
    const p = await addPatient();
    for (const purpose of ["no_show_tracking", "adaptive_reminders", "recalls", "sms_channel"] as const) {
      expect(PURPOSE_BASIS[purpose]).not.toBe("consent");
      expect(await isAllowed(p.id, purpose)).toBe(true);
      await record({ ...base(p.id, purpose, false), now: later(1) });
      expect(await isAllowed(p.id, purpose)).toBe(false);
      await record({ ...base(p.id, purpose, true), now: later(2) });
      expect(await isAllowed(p.id, purpose)).toBe(true);
    }
  });

  it("pairs profiling purposes with legitimate interest and recalls with care", () => {
    expect(PURPOSE_BASIS.adaptive_reminders).toBe("legitimate_interest");
    expect(PURPOSE_BASIS.no_show_tracking).toBe("legitimate_interest");
    expect(PURPOSE_BASIS.recalls).toBe("care");
  });
});

describe("under 14", () => {
  const consentPurposes = (Object.keys(PURPOSE_BASIS) as ConsentPurpose[]).filter((p) => PURPOSE_BASIS[p] === "consent");

  it("refuses every consent-based grant by the child alone", async () => {
    const child = await addPatient({ firstName: "Luca", birthDate: "2020-05-10" });
    for (const purpose of consentPurposes) {
      await expect(record(base(child.id, purpose))).rejects.toMatchObject({ name: "ConsentError", code: "guardian_required" });
    }
    expect(await ledger(child.id)).toHaveLength(0);
  });

  it("accepts the guardian's grant, the child's withdrawal and non-consent purposes", async () => {
    const child = await addPatient({ firstName: "Luca", birthDate: "2020-05-10" });
    await record({ ...base(child.id, "feedback_request"), actorRelation: "parent" });
    await record({ ...base(child.id, "feedback_request", false), now: later(1) });
    await record(base(child.id, "recalls"));
    expect(await ledger(child.id)).toHaveLength(3);
  });

  it("lets a 14-year-old consent", async () => {
    const teen = await addPatient({ firstName: "Sara", birthDate: "2016-02-28" });
    await expect(record(base(teen.id, "marketing"))).resolves.toBeTypeOf("string");
  });
});

describe("cached flags", () => {
  const flags = async (id: string) => (await db.select().from(patients).where(eq(patients.id, id)))[0];

  it("keeps smsOptIn and emailOptIn in step with the channel rows", async () => {
    const p = await addPatient();
    await record(base(p.id, "sms_channel", false));
    await record(base(p.id, "email_channel", false));
    expect(await flags(p.id)).toMatchObject({ smsOptIn: false, emailOptIn: false });
    await record({ ...base(p.id, "sms_channel", true), now: later(1) });
    expect(await flags(p.id)).toMatchObject({ smsOptIn: true, emailOptIn: false });
  });

  it("moves a WhatsApp patient back to SMS, or to email without a phone", async () => {
    const p = await addPatient({ preferredChannel: "whatsapp" });
    await record(base(p.id, "whatsapp_channel", false));
    expect((await flags(p.id)).preferredChannel).toBe("sms");

    const noPhone = await addPatient({ phone: null, preferredChannel: "whatsapp" });
    await record(base(noPhone.id, "whatsapp_channel", false));
    expect((await flags(noPhone.id)).preferredChannel).toBe("email");

    const email = await addPatient({ preferredChannel: "email" });
    await record(base(email.id, "whatsapp_channel", false));
    expect((await flags(email.id)).preferredChannel).toBe("email");
  });
});

describe("recordBookingConsents", () => {
  const book = (patientId: string, context: "practice" | "marketplace", choices: Record<string, boolean>) =>
    db.transaction((tx) =>
      recordBookingConsents(tx, {
        orgId,
        patientId,
        appointmentId: "appt-1",
        context,
        choices,
        locale: "it",
        source: "booking",
        actorRelation: "self",
        now: NOW,
      }),
    );

  it("writes only grants, and the platform consent only on the marketplace", async () => {
    const p = await addPatient();
    await book(p.id, "practice", { platformConsent: true, whatsapp: false, feedback: true, marketing: false });
    expect((await ledger(p.id)).map((r) => r.purpose)).toEqual(["feedback_request"]);

    const m = await addPatient();
    await book(m.id, "marketplace", { platformConsent: true, whatsapp: true });
    const rows = await ledger(m.id);
    expect(rows.map((r) => r.purpose).sort()).toEqual(["platform_booking_art9", "whatsapp_channel"]);
    expect(rows.every((r) => r.granted && r.method === "web_checkbox" && r.appointmentId === "appt-1")).toBe(true);
    expect(rows.find((r) => r.purpose === "platform_booking_art9")!.orgId).toBeNull();
  });
});
