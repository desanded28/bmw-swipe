import { and, desc, eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { appointments, auditLog, consents, messages, patients, reminders } from "@/db/schema";
import { BookingError, createAppointment } from "@/lib/booking";
import { isContactVerified } from "@/lib/contact";
import { manageTokenOf } from "@/lib/links";
import { addDays, zonedToUtc } from "@/lib/time";
import { createPractice, MONDAY, NOW, TZ } from "@/test/fixtures";
import {
  ADULT_CONFIRMATION_HOURS,
  adultConfirmationDeadline,
  adultContacts,
  awaitsAdultConfirmation,
  confirmAdultBooking,
  declineAdultBooking,
  expireAdultConfirmations,
  requestAdultConfirmation,
  requestAdultConfirmationCode,
  sendBookedForYouNotice,
} from "./adult-confirmation";

const sent: { to: string; text: string }[] = [];
vi.mock("@/lib/messaging/providers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/messaging/providers")>()),
  sendSms: async (i: { to: string; text: string }) => {
    sent.push(i);
    return { status: "captured", provider: "dev", providerId: null, from: null };
  },
  sendEmail: async (i: { to: string; text: string }) => {
    sent.push(i);
    return { status: "captured", provider: "dev", providerId: null, from: null };
  },
}));

let p: Awaited<ReturnType<typeof createPractice>>;
let n = 0;
let ip = 0;
const HOUR = 3_600_000;
const BOOKER_PHONE = "+393407770999";
const visitor = () => new Headers({ "x-real-ip": `203.0.113.${(ip++ % 250) + 1}` });
const codeIn = (text: string) => text.match(/\b\d{6}\b/)![0];
const lastTo = (to: string) => sent.filter((m) => m.to === to).at(-1);

type BookOpts = { createdAt?: Date; startsAt?: Date; firstName?: string; phone?: string | null; email?: string | null };

/** The booking for another adult, as createAppointment makes it. */
function book(held: boolean, opts: BookOpts = {}) {
  const k = n++;
  return createAppointment({
    orgId: p.orgId,
    serviceId: p.visit,
    practitionerId: p.drA,
    locationId: p.milano,
    startsAt: opts.startsAt ?? zonedToUtc(addDays(MONDAY, 7 * (1 + Math.floor(k / 8))), 9 * 60 + (k % 8) * 30, TZ),
    patient: {
      firstName: opts.firstName ?? "Nonna",
      lastName: "Pina",
      phone: opts.phone === undefined ? `+39340777${String(1000 + k)}` : opts.phone,
      email: opts.email === undefined ? `pina${k}@example.com` : opts.email,
      locale: "it",
    },
    relation: { bookedFor: "other_adult", bookedBy: { name: "Marco Pina", phone: BOOKER_PHONE, email: "marco@example.com" } },
    privacy: { choices: {}, noticeVersion: "2026-10", locale: "it", source: "booking" },
    processingContext: held ? "marketplace" : "practice",
    source: "online",
    online: false,
    notifyPatient: false,
    now: NOW,
  });
}

/**
 * A booking for another adult. `held`: on the marketplace, so createAppointment holds it for that
 * adult ('requested', no consent, no reminders) and sends the confirmation request itself;
 * otherwise through the practice's channels, where it sends the Art. 14 notice.
 */
async function bookForAdult(held: boolean, opts: BookOpts = {}) {
  const d = await book(held, opts);
  if (opts.createdAt) await db.update(appointments).set({ createdAt: opts.createdAt }).where(eq(appointments.id, d.appointment.id));
  const [a] = await db.select().from(appointments).where(eq(appointments.id, d.appointment.id));
  return { a, token: manageTokenOf(a)!, patient: d.patient };
}

const auditOf = async (appointmentId: string, action: string) =>
  db.select().from(auditLog).where(and(eq(auditLog.entityId, appointmentId), eq(auditLog.action, action)));

/** What the adult does on the confirmation page: ask for a code to their phone and read it. */
async function codeFor(token: string, phone: string) {
  const r = await requestAdultConfirmationCode({ token, kind: "phone", locale: "it", headers: visitor(), now: NOW });
  if (!r.ok) throw new Error(r.reason);
  return { ticket: r.ticket, code: codeIn(lastTo(phone)!.text), masked: r.masked };
}

const art9Rows = async (appointmentId: string) =>
  db.select().from(consents).where(and(eq(consents.appointmentId, appointmentId), eq(consents.purpose, "platform_booking_art9")));

beforeAll(async () => {
  p = await createPractice();
});

beforeEach(() => {
  sent.length = 0;
});

describe("practice bookings for another adult (Art. 14)", () => {
  it("send the practice's notice to the adult's own contact, never to the booker", async () => {
    // createAppointment sends it right after booking.
    const { a, patient } = await bookForAdult(false);
    expect(a).toMatchObject({ bookedByName: "Marco Pina", status: "scheduled", processingContext: "practice" });
    const out = sent.filter((m) => m.to === patient.phone || m.to === patient.email);
    expect(out).toHaveLength(1);
    expect(out[0].text).toContain("Marco Pina");
    expect(out[0].text).toContain("/it/c/");
    expect(out[0].text).toContain("/privacy");
    expect(sent.some((m) => m.to === BOOKER_PHONE || m.to === "marco@example.com")).toBe(false);
  });

  it("never send the notice to a contact that is the booker's", async () => {
    // The booker typed their own number as the patient's: the notice goes to the patient's email.
    const { a, patient } = await bookForAdult(false, { firstName: "Zia", phone: BOOKER_PHONE });
    expect(sent.some((m) => m.to === BOOKER_PHONE)).toBe(false);
    expect(lastTo(patient.email!)!.text).toContain("Marco Pina");
    // Only the booker's contacts on the record: nothing is sent at all.
    await db.update(patients).set({ email: "marco@example.com" }).where(eq(patients.id, patient.id));
    sent.length = 0;
    expect(await sendBookedForYouNotice(a.id)).toBe(false);
    expect(sent).toEqual([]);
  });
});

describe("marketplace bookings for another adult", () => {
  it("wait for that adult for 48 hours, and never past the visit", async () => {
    const { a } = await bookForAdult(true);
    expect(await awaitsAdultConfirmation(a, NOW)).toBe(true);
    expect(await awaitsAdultConfirmation(a, new Date(NOW.getTime() + (ADULT_CONFIRMATION_HOURS + 1) * HOUR))).toBe(false);
    const { a: practice } = await bookForAdult(false);
    expect(await awaitsAdultConfirmation(practice, NOW)).toBe(false);
    const soon = { createdAt: NOW, startsAt: new Date(NOW.getTime() + 20 * HOUR) };
    expect(adultConfirmationDeadline(soon)).toEqual(soon.startsAt);
    expect(adultConfirmationDeadline(a)).toEqual(new Date(NOW.getTime() + ADULT_CONFIRMATION_HOURS * HOUR));
  });

  it("are held for the adult, who is asked to confirm through a link to their own contact", async () => {
    // createAppointment holds the booking and sends the request itself.
    const { a, token, patient } = await bookForAdult(true);
    expect(a).toMatchObject({ status: "requested", processingContext: "marketplace", bookedFor: "other_adult" });
    expect(await art9Rows(a.id)).toHaveLength(0);
    expect(await db.select().from(reminders).where(eq(reminders.appointmentId, a.id))).toEqual([]);
    const out = sent.filter((m) => m.to === patient.phone || m.to === patient.email);
    expect(out).toHaveLength(1);
    expect(out[0].text).toContain(`/a/${token}/privacy/confirm`);
    expect(sent.some((m) => m.to === BOOKER_PHONE || m.to === "marco@example.com")).toBe(false);
    const [logged] = await db.select().from(messages).where(eq(messages.appointmentId, a.id)).orderBy(desc(messages.createdAt));
    expect(logged.body).not.toMatch(/Visit|Anna A/);
    // Audited on the appointment, naming the patient for their access log.
    const [request] = await auditOf(a.id, "adult_confirmation.request");
    expect(request).toMatchObject({ actorType: "system", entityType: "appointment" });
    expect(request.metadata).toMatchObject({ step: "link", patientId: patient.id, channel: "sms" });
  });

  it("can't be confirmed or declined with the booker's manage link alone", async () => {
    const { a, token, patient } = await bookForAdult(true);
    // The booker has the token (the booking's confirmation shows the manage link), but no code.
    expect(await confirmAdultBooking({ token, ticket: "", code: "123456", consent: true, locale: "it", now: NOW })).toEqual({ ok: false, reason: "expired" });
    expect(await declineAdultBooking({ token, ticket: "", code: "123456", now: NOW })).toEqual({ ok: false, reason: "expired" });
    // A guessed code against a real ticket fails too.
    const { ticket, code } = await codeFor(token, patient.phone!);
    const wrong = code === "000000" ? "111111" : "000000";
    expect(await confirmAdultBooking({ token, ticket, code: wrong, consent: true, locale: "it", now: NOW })).toEqual({ ok: false, reason: "invalid" });
    expect(await art9Rows(a.id)).toHaveLength(0);
    const [after] = await db.select().from(appointments).where(eq(appointments.id, a.id));
    expect(after.status).toBe("requested");
  });

  it("send the link and the code only to the adult's own contact, never to one that is the booker's", async () => {
    const { a, token, patient } = await bookForAdult(true);
    const { masked } = await codeFor(token, patient.phone!);
    expect(masked).not.toContain(patient.phone!.slice(4, 9));
    expect(sent.some((m) => m.to === BOOKER_PHONE || m.to === "marco@example.com")).toBe(false);
    const codeRows = (await auditOf(a.id, "adult_confirmation.request")).filter((r) => r.metadata?.step === "code");
    expect(codeRows).toHaveLength(1);
    expect(codeRows[0]).toMatchObject({ actorType: "patient_link" });
    expect(codeRows[0].metadata).toMatchObject({ patientId: patient.id, kind: "phone" });

    // The booker typed their own number as the patient's: the link and the code go to the
    // patient's email only, whatever channel the patient prefers.
    const same = await bookForAdult(true, { firstName: "Cugina", phone: BOOKER_PHONE });
    const [d] = await db.select().from(patients).where(eq(patients.id, same.patient.id));
    expect(d.preferredChannel).not.toBe("email");
    expect(adultContacts({ patient: d, appointment: same.a }).map((c) => c.kind)).toEqual(["email"]);
    expect(lastTo(d.email!)!.text).toContain(`/a/${same.token}/privacy/confirm`);
    expect(await requestAdultConfirmation(same.a.id, NOW)).toBe(true);
    expect(await requestAdultConfirmationCode({ token: same.token, kind: "phone", locale: "it", headers: visitor(), now: NOW })).toEqual({ ok: false, reason: "no_contact" });
    expect(sent.some((m) => m.to === BOOKER_PHONE)).toBe(false);
    expect((await requestAdultConfirmationCode({ token: same.token, kind: "email", locale: "it", headers: visitor(), now: NOW })).ok).toBe(true);

    // A hold the adult could never confirm (only the booker's contacts) isn't made at all.
    const err = await book(true, { firstName: "Zio", phone: BOOKER_PHONE, email: "marco@example.com" }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BookingError);
    expect(err).toMatchObject({ code: "invalid", reason: "other_adult_contact_required", field: "phone" });
  });

  it("record the adult's own Art. 9 consent with the code and release the hold", async () => {
    const { a, token, patient } = await bookForAdult(true);
    const { ticket, code } = await codeFor(token, patient.phone!);
    // The consent is ticked by the adult; without it nothing happens and the code is still good.
    expect(await confirmAdultBooking({ token, ticket, code, consent: false, locale: "en", now: NOW })).toEqual({ ok: false, reason: "consent_required" });
    const r = await confirmAdultBooking({ token, ticket, code, consent: true, locale: "en", headers: new Headers({ "x-real-ip": "192.0.2.5" }), now: NOW });
    expect(r).toEqual({ ok: true, status: "scheduled" });
    const [row] = await art9Rows(a.id);
    expect(row).toMatchObject({ orgId: null, granted: true, actorRelation: "self", source: "manage_link", method: "web_checkbox", locale: "en" });
    const [after] = await db.select().from(appointments).where(eq(appointments.id, a.id));
    expect(after.status).toBe("scheduled");
    expect((await db.select().from(reminders).where(eq(reminders.appointmentId, a.id))).length).toBeGreaterThan(0);
    const [pt] = await db.select().from(patients).where(eq(patients.id, patient.id));
    expect(isContactVerified(pt, "phone", patient.phone)).toBe(true);
    const [log] = await auditOf(a.id, "adult_confirmation.confirm");
    expect(log).toMatchObject({ actorType: "patient_link" });
    expect(log.metadata).toMatchObject({ status: "scheduled", proof: "otp_phone", patientId: patient.id });
    // The code is used up, and the booking no longer waits.
    expect(await confirmAdultBooking({ token, ticket, code, consent: true, locale: "en", now: NOW })).toEqual({ ok: false, reason: "not_waiting" });
  });

  it("refuse a code sent for another booking", async () => {
    const first = await bookForAdult(true);
    const second = await bookForAdult(true);
    const { ticket, code } = await codeFor(first.token, first.patient.phone!);
    expect(await confirmAdultBooking({ token: second.token, ticket, code, consent: true, locale: "it", now: NOW })).toEqual({ ok: false, reason: "invalid" });
    expect(await art9Rows(second.a.id)).toHaveLength(0);
  });

  it("cancel the booking when the adult declines with the code, as nobody's late cancellation", async () => {
    const { a, token, patient } = await bookForAdult(true);
    const { ticket, code } = await codeFor(token, patient.phone!);
    expect(await declineAdultBooking({ token, ticket, code, now: NOW })).toEqual({ ok: true, status: "cancelled" });
    const [after] = await db.select().from(appointments).where(eq(appointments.id, a.id));
    expect(after).toMatchObject({ status: "cancelled", cancelledBy: null, confirmation: "declined" });
    expect(await art9Rows(a.id)).toHaveLength(0);
    const [log] = await auditOf(a.id, "adult_confirmation.decline");
    expect(log).toMatchObject({ actorType: "patient_link" });
    expect(log.metadata).toMatchObject({ proof: "otp_phone", patientId: patient.id });
    expect(await auditOf(a.id, "appointment.cancel")).toEqual([]);
  });

  it("cancel holds nobody confirmed in time as a system cancellation (not the practice's), and tell the booker", async () => {
    const old = new Date(NOW.getTime() - (ADULT_CONFIRMATION_HOURS + 2) * HOUR);
    const { a: stale } = await bookForAdult(true, { createdAt: old });
    const { a: fresh } = await bookForAdult(true, { createdAt: NOW });
    const { a: started } = await bookForAdult(true, { createdAt: new Date(NOW.getTime() - 3 * HOUR), startsAt: new Date(NOW.getTime() - HOUR) });
    expect(await expireAdultConfirmations(NOW)).toBeGreaterThanOrEqual(2);
    const status = async (id: string) => (await db.select().from(appointments).where(eq(appointments.id, id)))[0];
    expect(await status(stale.id)).toMatchObject({ status: "cancelled", cancelledBy: null });
    expect(await status(started.id)).toMatchObject({ status: "cancelled", cancelledBy: null });
    expect((await status(fresh.id)).status).toBe("requested");
    const toBooker = sent.filter((m) => m.to === BOOKER_PHONE);
    expect(toBooker.length).toBeGreaterThanOrEqual(2);
    expect(toBooker[0].text).toContain("Nonna");
    const [log] = await auditOf(stale.id, "adult_confirmation.expire");
    expect(log).toMatchObject({ actorType: "system" });
    expect(log.metadata).toMatchObject({ patientId: stale.patientId });
    expect(await auditOf(fresh.id, "adult_confirmation.expire")).toEqual([]);
  });
});
