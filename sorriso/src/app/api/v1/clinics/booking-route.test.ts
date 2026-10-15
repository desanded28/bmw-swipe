import { and, eq, inArray } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { appointments, auditLog, consents, organizations, patients, waitlist } from "@/db/schema";
import { createApiKey } from "@/lib/api";
import * as log from "@/lib/log";
import { newId } from "@/lib/ids";
import { signPracticeRef } from "@/lib/privacy/context";
import { NOTICE_VERSIONS } from "@/lib/privacy/versions";
import { addDays, todayIn, zonedToUtc } from "@/lib/time";
import { createPractice, TZ } from "@/test/fixtures";
import { POST as postAppointment } from "./[slug]/appointments/route";
import { POST as postWaitlist } from "./[slug]/waitlist/route";

// The compliance gate (WP5) is a stub that always accepts: drive it from the tests.
const gate = vi.hoisted(() => ({ accept: true }));
vi.mock("@/lib/privacy/gates", () => ({
  canAcceptOnlineBookings: async () => gate.accept,
  enforceDashboardGates: async () => {},
}));

let p: Awaited<ReturnType<typeof createPractice>>;
let other: Awaited<ReturnType<typeof createPractice>>;
let slug: string;

/** The public routes check slots against the real clock: a Monday 7-13 days from today (Dr. A works Mon-Fri). */
function upcomingMonday(): string {
  const today = todayIn(TZ);
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  return addDays(today, 7 + ((8 - weekday) % 7));
}
const BASE_MONDAY = upcomingMonday();
let slotSeq = 0;
const nextStart = () => {
  const n = slotSeq++;
  return zonedToUtc(addDays(BASE_MONDAY, Math.floor(n / 8)), 9 * 60 + (n % 8) * 30, TZ).toISOString();
};
// Every request from its own address, so the per-IP rate limits never get in the way.
let ipSeq = 1;
let phoneSeq = 3479000000;

function request(path: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(`https://sorriso.test${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": `198.51.100.${ipSeq++}`, ...headers },
    body: JSON.stringify(body),
  });
}

const privacy = (over: Record<string, unknown> = {}) => ({
  noticeVersion: "2026-10",
  noticeAck: true,
  locale: "en",
  platformConsent: true,
  feedback: false,
  ...over,
});

function bookingBody(over: Record<string, unknown> = {}) {
  return {
    serviceId: p.visit,
    practitionerId: p.drA,
    locationId: p.milano,
    start: nextStart(),
    patient: { firstName: "Sara", lastName: "Conti", phone: `+39${phoneSeq++}`, locale: "it" },
    privacy: privacy(),
    ...over,
  };
}

async function book(body: unknown, headers?: Record<string, string>, orgSlug = slug) {
  const res = await postAppointment(request(`/api/v1/clinics/${orgSlug}/appointments`, body, headers), {
    params: Promise.resolve({ slug: orgSlug }),
  });
  return { status: res.status, json: await res.json() };
}

async function joinWaitlist(body: unknown, headers?: Record<string, string>) {
  const res = await postWaitlist(request(`/api/v1/clinics/${slug}/waitlist`, body, headers), { params: Promise.resolve({ slug }) });
  return { status: res.status, json: await res.json() };
}

const stored = async (id: string) => (await db.select().from(appointments).where(eq(appointments.id, id)))[0];

beforeAll(async () => {
  p = await createPractice();
  other = await createPractice();
  [{ slug }] = await db.select({ slug: organizations.slug }).from(organizations).where(eq(organizations.id, p.orgId));
});

beforeEach(() => {
  gate.accept = true;
});

describe("POST /api/v1/clinics/:slug/appointments", () => {
  it("requires privacy without an API key", async () => {
    const res = await book(bookingBody({ privacy: undefined }));
    expect(res.status).toBe(422);
    expect(res.json.error).toMatchObject({ code: "privacy_required", field: "privacy" });
  });

  it("books Sorriso-hosted requests in the marketplace context with the Art. 9 consent", async () => {
    const res = await book(bookingBody());
    expect(res.status).toBe(201);
    const a = await stored(res.json.appointment.id);
    expect(a).toMatchObject({ processingContext: "marketplace", noticeVersion: NOTICE_VERSIONS.platform_patient, noticeLocale: "en" });
    const rows = await db.select().from(consents).where(eq(consents.appointmentId, a.id));
    expect(rows.map((r) => r.purpose)).toEqual(["platform_booking_art9"]);
    expect(rows[0].ipHash).toBeTruthy();
  });

  it("refuses the marketplace without the Art. 9 consent, with the rule's code and field", async () => {
    const res = await book(bookingBody({ privacy: privacy({ platformConsent: false }) }));
    expect(res.status).toBe(422);
    expect(res.json.error).toMatchObject({ code: "platform_consent_required", field: "platformConsent" });
  });

  it("uses the practice context for a valid practice ref", async () => {
    const res = await book(bookingBody({ practiceRef: signPracticeRef(p.orgId), privacy: privacy({ platformConsent: false }) }));
    expect(res.status).toBe(201);
    const a = await stored(res.json.appointment.id);
    expect(a).toMatchObject({ processingContext: "practice", noticeVersion: NOTICE_VERSIONS.practice_patient });
    expect(await db.select().from(consents).where(eq(consents.appointmentId, a.id))).toEqual([]);
  });

  it("ignores a forged ref or another practice's ref (marketplace)", async () => {
    for (const practiceRef of ["0123456789abcdef", signPracticeRef(other.orgId)]) {
      const refused = await book(bookingBody({ practiceRef, privacy: privacy({ platformConsent: false }) }));
      expect(refused.json.error?.code).toBe("platform_consent_required");
      const res = await book(bookingBody({ practiceRef }));
      expect(res.status).toBe(201);
      expect((await stored(res.json.appointment.id)).processingContext).toBe("marketplace");
    }
  });

  it("never takes the context from the client: a 'widget' source alone is still the marketplace", async () => {
    const res = await book(bookingBody({ source: "widget", entry: "direct" }));
    expect(res.status).toBe(201);
    expect((await stored(res.json.appointment.id)).processingContext).toBe("marketplace");
  });

  it("books with an API key without privacy input, in the practice context", async () => {
    const { secret } = await createApiKey(p.orgId, "Partner");
    const res = await book(bookingBody({ privacy: undefined }), { authorization: `Bearer ${secret}` });
    expect(res.status).toBe(201);
    const a = await stored(res.json.appointment.id);
    expect(a).toMatchObject({ processingContext: "practice", source: "api", noticeVersion: null });
  });

  it("refuses an API key of another practice", async () => {
    const { secret } = await createApiKey(other.orgId, "Elsewhere");
    const res = await book(bookingBody(), { authorization: `Bearer ${secret}` });
    expect(res.status).toBe(403);
    expect(res.json.error.code).toBe("forbidden");
  });

  it("answers guardian_required for a child under 14 booking alone", async () => {
    const res = await book(
      bookingBody({ patient: { firstName: "Tommaso", lastName: "Conti", phone: `+39${phoneSeq++}`, birthDate: "2020-02-02" } }),
    );
    expect(res.status).toBe(422);
    expect(res.json.error).toMatchObject({ code: "guardian_required", field: "bookedFor" });
  });

  it("books a child through a practice link when the form asked no relation (a parent booking for them)", async () => {
    const res = await book(
      bookingBody({
        practiceRef: signPracticeRef(p.orgId),
        privacy: privacy({ platformConsent: false }),
        patient: { firstName: "Tommaso", lastName: "Conti", phone: `+39${phoneSeq++}`, birthDate: "2020-02-02" },
      }),
    );
    expect(res.status).toBe(201);
  });

  it("answers from what was sent: a stored patient's name and phone get a stranger's answer", async () => {
    // A child the practice holds (entered by staff with a birth date).
    const phone = `+39${phoneSeq++}`;
    await db.insert(patients).values({ id: newId(), orgId: p.orgId, firstName: "Luca", lastName: "Neri", phone, birthDate: "2019-03-03" });
    const probe = (patient: Record<string, unknown>) =>
      book(bookingBody({ practiceRef: signPracticeRef(p.orgId), privacy: privacy({ platformConsent: false }), patient, relation: { bookedFor: "minor" } }));
    const matched = await probe({ firstName: "Luca", lastName: "X", phone });
    const stranger = await probe({ firstName: "Luca", lastName: "X", phone: `+39${phoneSeq++}` });
    expect(matched.status).toBe(422);
    expect(matched.json).toEqual(stranger.json);
    expect(matched.json.error.code).toBe("birthdate_required");
  });

  it("normalises the phone with phoneCountry", async () => {
    const res = await book(bookingBody({ patient: { firstName: "Jan", lastName: "Nowak", phone: "512 345 678", phoneCountry: "48" } }));
    expect(res.status).toBe(201);
    const a = await stored(res.json.appointment.id);
    const [row] = await db.select().from(patients).where(eq(patients.id, a.patientId));
    expect(row.phone).toBe("+48512345678");
  });

  it("validates the new fields", async () => {
    const res = await book(bookingBody({ note: "x".repeat(501), patient: { firstName: "A", lastName: "B", phone: "333 1234567", phoneCountry: "0049" } }));
    expect(res.status).toBe(422);
    const paths = (res.json.error.issues as { path: string }[]).map((i) => i.path);
    expect(paths).toEqual(expect.arrayContaining(["note", "patient.phoneCountry"]));
  });

  it("answers 403 not_accepting when the practice can't take online bookings", async () => {
    gate.accept = false;
    const res = await book(bookingBody());
    expect(res.status).toBe(403);
    expect(res.json.error.code).toBe("not_accepting");
  });

  it("answers a malformed JSON body (booking or waitlist) with 422 validation_error, not a logged 500", async () => {
    const raw = (path: string) =>
      new Request(`https://sorriso.test${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": `198.51.100.${ipSeq++}` },
        body: "{bad",
      });
    const errors = vi.spyOn(log, "logError");
    const booked = await postAppointment(raw(`/api/v1/clinics/${slug}/appointments`), { params: Promise.resolve({ slug }) });
    const joined = await postWaitlist(raw(`/api/v1/clinics/${slug}/waitlist`), { params: Promise.resolve({ slug }) });
    for (const res of [booked, joined]) {
      expect(res.status).toBe(422);
      expect(((await res.json()) as { error: { code: string } }).error.code).toBe("validation_error");
    }
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });
});

describe("POST /api/v1/clinics/:slug/waitlist", () => {
  const waitlistBody = (over: Record<string, unknown> = {}) => ({
    serviceId: p.visit,
    earliestDate: BASE_MONDAY,
    latestDate: addDays(BASE_MONDAY, 7),
    patient: { firstName: "Elena", lastName: "Riva", phone: `+39${phoneSeq++}` },
    privacy: privacy({ feedback: true }),
    ...over,
  });

  it("requires privacy without an API key", async () => {
    const res = await joinWaitlist(waitlistBody({ privacy: undefined }));
    expect(res.status).toBe(422);
    expect(res.json.error.code).toBe("privacy_required");
  });

  it("stores the marketplace context and the consents against the entry", async () => {
    const res = await joinWaitlist(waitlistBody());
    expect(res.status).toBe(201);
    const id = res.json.waitlistEntry.id as string;
    const [entry] = await db.select().from(waitlist).where(eq(waitlist.id, id));
    expect(entry).toMatchObject({ processingContext: "marketplace", noticeVersion: NOTICE_VERSIONS.platform_patient });
    const rows = await db.select().from(consents).where(eq(consents.waitlistId, id));
    expect(rows.map((r) => r.purpose).sort()).toEqual(["feedback_request", "platform_booking_art9"]);
  });

  it("uses the practice context for a valid ref, and with an API key", async () => {
    const viaRef = await joinWaitlist(waitlistBody({ practiceRef: signPracticeRef(p.orgId), privacy: privacy({ platformConsent: false }) }));
    expect(viaRef.status).toBe(201);
    const { secret } = await createApiKey(p.orgId, "Partner 2");
    const viaKey = await joinWaitlist(waitlistBody({ privacy: undefined }), { authorization: `Bearer ${secret}` });
    expect(viaKey.status).toBe(201);
    for (const id of [viaRef.json.waitlistEntry.id, viaKey.json.waitlistEntry.id]) {
      const [entry] = await db.select().from(waitlist).where(eq(waitlist.id, id));
      expect(entry.processingContext).toBe("practice");
    }
  });

  it("with an API key: needs appointments:write, and audits api.request", async () => {
    const readOnly = await createApiKey(p.orgId, { name: "Read only", scopes: ["appointments:read"] });
    const before = (await db.select().from(waitlist).where(eq(waitlist.orgId, p.orgId))).length;
    const denied = await joinWaitlist(waitlistBody({ privacy: undefined }), { authorization: `Bearer ${readOnly.secret}` });
    expect(denied.status).toBe(403);
    expect(denied.json.error.code).toBe("insufficient_scope");
    expect((await db.select().from(waitlist).where(eq(waitlist.orgId, p.orgId))).length).toBe(before);

    const writer = await createApiKey(p.orgId, { name: "Writer", scopes: ["appointments:write"] });
    const res = await joinWaitlist(waitlistBody({ privacy: undefined }), { authorization: `Bearer ${writer.secret}` });
    expect(res.status).toBe(201);
    const logged = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.orgId, p.orgId), eq(auditLog.action, "api.request"), inArray(auditLog.actorId, [readOnly.id, writer.id])));
    expect(logged.map((r) => [r.actorType, r.actorId, r.metadata?.route, r.metadata?.status])).toEqual([
      ["api_key", readOnly.id, "clinics.waitlist", 403],
      ["api_key", writer.id, "clinics.waitlist", 201],
    ]);
  });

  it("doesn't reveal a stored minor: their name and email join the waitlist like anyone's", async () => {
    const email = `minor${phoneSeq++}@example.com`;
    await db.insert(patients).values({ id: newId(), orgId: p.orgId, firstName: "Sofia", lastName: "Re", email, birthDate: "2019-03-03" });
    const res = await joinWaitlist(waitlistBody({ patient: { firstName: "Sofia", lastName: "Re", email } }));
    expect(res.status).toBe(201);
  });

  it("answers 403 not_accepting when the practice can't take online bookings", async () => {
    gate.accept = false;
    const res = await joinWaitlist(waitlistBody());
    expect(res.status).toBe(403);
    expect(res.json.error.code).toBe("not_accepting");
  });
});
