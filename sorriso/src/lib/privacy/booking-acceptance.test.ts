import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { POST as postAppointment } from "@/app/api/v1/clinics/[slug]/appointments/route";
import { db } from "@/db";
import { appointments, consents, organizations, patients } from "@/db/schema";
import { recipientFor } from "@/lib/contact";
import { hmac } from "@/lib/crypto";
import { signPracticeRef } from "@/lib/privacy/context";
import { addDays, todayIn, zonedToUtc } from "@/lib/time";
import { createPractice, TZ } from "@/test/fixtures";
import { CONSENT_TEXT_VERSION, NOTICE_VERSIONS } from "./versions";

/**
 * WP4's booking acceptance criteria, end to end through the public booking API: the Art. 9
 * consent on the marketplace only, the WhatsApp confirmation, the under-14 rule and the
 * guardian's details for a minor.
 */

// The compliance gate (WP5) is driven by its own tests; here it always accepts.
vi.mock("@/lib/privacy/gates", () => ({ canAcceptOnlineBookings: async () => true, enforceDashboardGates: async () => {} }));

let p: Awaited<ReturnType<typeof createPractice>>;
let slug: string;
let noWhatsApp: Awaited<ReturnType<typeof createPractice>>;
let noWhatsAppSlug: string;

function upcomingMonday(): string {
  const today = todayIn(TZ);
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  return addDays(today, 7 + ((8 - weekday) % 7));
}
const MON = upcomingMonday();
let slot = 0;
const nextStart = () => {
  const n = slot++;
  return zonedToUtc(addDays(MON, Math.floor(n / 8) * 7), 9 * 60 + (n % 8) * 30, TZ).toISOString();
};
let ipSeq = 1;
let phoneSeq = 3471230000;
const CLIENT_IP = (n: number) => `203.0.113.${n}`;

function book(body: Record<string, unknown>, orgSlug = slug) {
  const ip = CLIENT_IP(ipSeq++);
  const req = new Request(`https://sorriso.test/api/v1/clinics/${orgSlug}/appointments`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-real-ip": ip },
    body: JSON.stringify(body),
  });
  return postAppointment(req, { params: Promise.resolve({ slug: orgSlug }) }).then(async (res) => ({ status: res.status, json: await res.json(), ip }));
}

const body = (over: Record<string, unknown> = {}, privacy: Record<string, unknown> = {}, orgP = p) => ({
  serviceId: orgP.visit,
  practitionerId: orgP.drA,
  locationId: orgP.milano,
  start: nextStart(),
  patient: { firstName: "Sara", lastName: "Conti", phone: `+39${phoneSeq++}`, locale: "it" },
  privacy: { noticeVersion: "2026-10", locale: "it", ...privacy },
  ...over,
});

const stored = async (id: string) => (await db.select().from(appointments).where(eq(appointments.id, id)))[0];

beforeAll(async () => {
  p = await createPractice();
  [{ slug }] = await db.select({ slug: organizations.slug }).from(organizations).where(eq(organizations.id, p.orgId));
  await db
    .update(organizations)
    .set({ settings: { ...p.settings, privacy: { ...p.settings.privacy, whatsappEnabled: true } } })
    .where(eq(organizations.id, p.orgId));
  noWhatsApp = await createPractice();
  [{ slug: noWhatsAppSlug }] = await db.select({ slug: organizations.slug }).from(organizations).where(eq(organizations.id, noWhatsApp.orgId));
});

describe("the Art. 9 consent (marketplace only)", () => {
  it("refuses a marketplace booking without it: 422 platform_consent_required", async () => {
    const r = await book(body());
    expect(r.status).toBe(422);
    expect(r.json.error).toMatchObject({ code: "platform_consent_required", field: "platformConsent" });
  });

  it("never requires it from the practice's own channels (signed practice link, widget)", async () => {
    const r = await book(body({ practiceRef: signPracticeRef(p.orgId) }));
    expect(r.status).toBe(201);
    const a = await stored(r.json.appointment.id);
    expect(a).toMatchObject({ processingContext: "practice", noticeVersion: NOTICE_VERSIONS.practice_patient });
    const rows = await db.select().from(consents).where(eq(consents.appointmentId, a.id));
    expect(rows.some((c) => c.purpose === "platform_booking_art9")).toBe(false);
  });

  it("records it with its text version, language and an HMAC of the IP, and stores the notice version", async () => {
    const r = await book(body({}, { platformConsent: true, locale: "en" }));
    expect(r.status).toBe(201);
    const a = await stored(r.json.appointment.id);
    expect(a).toMatchObject({ processingContext: "marketplace", noticeVersion: NOTICE_VERSIONS.platform_patient, noticeLocale: "en" });
    const [row] = await db
      .select()
      .from(consents)
      .where(and(eq(consents.appointmentId, a.id), eq(consents.purpose, "platform_booking_art9")));
    expect(row).toMatchObject({
      orgId: null,
      granted: true,
      textKey: "consents.platform_booking_art9.label",
      textVersion: CONSENT_TEXT_VERSION.platform_booking_art9,
      locale: "en",
      method: "web_checkbox",
      source: "booking",
    });
    expect(row.ipHash).toBe(hmac(r.ip, "ip"));
    expect(JSON.stringify(row)).not.toContain(r.ip);
  });

  it("refuses a form that showed an outdated notice", async () => {
    const r = await book(body({}, { platformConsent: true, noticeVersion: "2001-01" }));
    expect(r.status).toBe(422);
    expect(r.json.error.code).toBe("notice_outdated");
  });
});

describe("WhatsApp", () => {
  it("needs the confirmation (422), then records it and makes WhatsApp the channel", async () => {
    const patient = { firstName: "Teo", lastName: "Riva", phone: `+39${phoneSeq++}`, locale: "it", preferredChannel: "whatsapp" };
    const refused = await book(body({ patient }, { platformConsent: true }));
    expect(refused.status).toBe(422);
    expect(refused.json.error).toMatchObject({ code: "whatsapp_consent_required", field: "whatsapp" });

    const ok = await book(body({ patient }, { platformConsent: true, whatsapp: true }));
    expect(ok.status).toBe(201);
    const a = await stored(ok.json.appointment.id);
    const [pat] = await db.select().from(patients).where(eq(patients.id, a.patientId));
    expect(pat.preferredChannel).toBe("whatsapp");
    const rows = await db.select().from(consents).where(and(eq(consents.patientId, pat.id), eq(consents.purpose, "whatsapp_channel")));
    expect(rows).toEqual([expect.objectContaining({ granted: true, orgId: p.orgId })]);
  });

  it("is refused where the practice doesn't offer it", async () => {
    const patient = { firstName: "Ivo", lastName: "Sala", phone: `+39${phoneSeq++}`, locale: "it", preferredChannel: "whatsapp" };
    const r = await book(body({ patient }, { platformConsent: true, whatsapp: true }, noWhatsApp), noWhatsAppSlug);
    expect(r.status).toBe(422);
    expect(r.json.error).toMatchObject({ code: "whatsapp_unavailable", field: "preferredChannel" });
  });
});

describe("minors and guardians", () => {
  it("refuses a child under 14 booking alone: 422 guardian_required", async () => {
    const r = await book(
      body({
        patient: { firstName: "Bea", lastName: "Riva", phone: `+39${phoneSeq++}`, birthDate: "2018-06-01", locale: "it" },
        relation: { bookedFor: "self" },
      }, { platformConsent: true }),
    );
    expect(r.status).toBe(422);
    expect(r.json.error).toMatchObject({ code: "guardian_required", field: "bookedFor" });
  });

  it("stores the guardian on a minor's record, flags the visit, and routes messages to the guardian", async () => {
    const guardianPhone = `+39${phoneSeq++}`;
    const r = await book(
      body({
        patient: { firstName: "Leo", lastName: "Riva", phone: `+39${phoneSeq++}`, birthDate: "2018-06-01", locale: "it" },
        relation: { bookedFor: "minor", guardian: { name: "Anna Riva", relation: "parent", phone: guardianPhone, email: "anna@example.com" } },
      }, { platformConsent: true, feedback: true }),
    );
    expect(r.status).toBe(201);
    const a = await stored(r.json.appointment.id);
    expect(a).toMatchObject({ bookedFor: "minor", minorFlag: true });
    const [pat] = await db.select().from(patients).where(eq(patients.id, a.patientId));
    expect(pat).toMatchObject({ guardianName: "Anna Riva", guardianRelation: "parent", guardianPhone, guardianEmail: "anna@example.com" });
    expect(recipientFor(pat)).toMatchObject({ phone: guardianPhone, email: "anna@example.com", viaGuardian: true });
    // The guardian gave the consents, as the ledger says.
    const rows = await db.select().from(consents).where(eq(consents.appointmentId, a.id));
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((c) => c.actorRelation === "parent")).toBe(true);
  });

  it("requires the child's birth date for a minor: 422 birthdate_required", async () => {
    const r = await book(
      body({
        patient: { firstName: "Mia", lastName: "Riva", phone: `+39${phoneSeq++}`, locale: "it" },
        relation: { bookedFor: "minor", guardian: { name: "Anna Riva", relation: "parent", phone: `+39${phoneSeq++}` } },
      }, { platformConsent: true }),
    );
    expect(r.status).toBe(422);
    expect(r.json.error).toMatchObject({ code: "birthdate_required", field: "birthDate" });
  });

  it("lets a 15-year-old book alone", async () => {
    const birth = addDays(todayIn(TZ), -(15 * 365 + 10));
    const r = await book(
      body({ patient: { firstName: "Ada", lastName: "Riva", phone: `+39${phoneSeq++}`, birthDate: birth, locale: "it" }, relation: { bookedFor: "self" } }, { platformConsent: true }),
    );
    expect(r.status).toBe(201);
  });
});
