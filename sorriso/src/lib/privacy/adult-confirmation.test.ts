import { and, desc, eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { appointments, auditLog, consents, messages, patients, reminders } from "@/db/schema";
import { createAppointment } from "@/lib/booking";
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

/** A booking for another adult; `held` turns it into a marketplace booking waiting for that adult. */
async function bookForAdult(held: boolean, opts: { createdAt?: Date; startsAt?: Date; phone?: string | null; email?: string | null } = {}) {
  const k = n++;
  const d = await createAppointment({
    orgId: p.orgId,
    serviceId: p.visit,
    practitionerId: p.drA,
    locationId: p.milano,
    startsAt: opts.startsAt ?? zonedToUtc(addDays(MONDAY, 7 * (1 + Math.floor(k / 8))), 9 * 60 + (k % 8) * 30, TZ),
    patient: {
      firstName: "Nonna",
      lastName: "Pina",
      phone: opts.phone === undefined ? `+39340777${String(1000 + k)}` : opts.phone,
      email: opts.email === undefined ? `pina${k}@example.com` : opts.email,
      locale: "it",
    },
    relation: { bookedFor: "other_adult", bookedBy: { name: "Marco Pina", phone: BOOKER_PHONE, email: "marco@example.com" } },
    privacy: { choices: {}, noticeVersion: "2026-10", locale: "it", source: "booking" },
    processingContext: "practice",
    source: "online",
    online: false,
    notifyPatient: false,
    now: NOW,
  });
  if (held) {
    await db
      .update(appointments)
      .set({ processingContext: "marketplace", status: "requested", createdAt: opts.createdAt ?? NOW })
      .where(eq(appointments.id, d.appointment.id));
    await db.delete(reminders).where(eq(reminders.appointmentId, d.appointment.id));
  }
  const [a] = await db.select().from(appointments).where(eq(appointments.id, d.appointment.id));
  return { a, token: manageTokenOf(a)!, patient: d.patient };
}

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
    const { a, patient } = await bookForAdult(false);
    expect(a.bookedByName).toBe("Marco Pina");
    expect(await sendBookedForYouNotice(a.id)).toBe(true);
    const out = sent.filter((m) => m.to === patient.phone || m.to === patient.email);
    expect(out).toHaveLength(1);
    expect(out[0].text).toContain("Marco Pina");
    expect(out[0].text).toContain("/it/c/");
    expect(out[0].text).toContain("/privacy");
    expect(sent.some((m) => m.to === BOOKER_PHONE || m.to === "marco@example.com")).toBe(false);
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

  it("ask the adult to confirm through a link to their own contact", async () => {
    const { a, token, patient } = await bookForAdult(true);
    expect(await requestAdultConfirmation(a.id, NOW)).toBe(true);
    const out = sent.find((m) => m.to === patient.phone || m.to === patient.email)!;
    expect(out.text).toContain(`/a/${token}/privacy/confirm`);
    expect(sent.some((m) => m.to === BOOKER_PHONE)).toBe(false);
    const [logged] = await db.select().from(messages).where(eq(messages.appointmentId, a.id)).orderBy(desc(messages.createdAt));
    expect(logged.body).not.toMatch(/Visit|Anna A/);
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

  it("send the code only to the adult's own contact, never to one that is the booker's", async () => {
    const { token, patient } = await bookForAdult(true);
    const { masked } = await codeFor(token, patient.phone!);
    expect(masked).not.toContain(patient.phone!.slice(4, 9));
    expect(sent.some((m) => m.to === BOOKER_PHONE || m.to === "marco@example.com")).toBe(false);

    // The booker typed their own number as the patient's: only the patient's email can get a code.
    const same = await bookForAdult(true, { phone: BOOKER_PHONE });
    const [d] = await db.select().from(patients).where(eq(patients.id, same.patient.id));
    expect(adultContacts({ patient: d, appointment: same.a }).map((c) => c.kind)).toEqual(["email"]);
    expect(await requestAdultConfirmationCode({ token: same.token, kind: "phone", locale: "it", headers: visitor(), now: NOW })).toEqual({ ok: false, reason: "no_contact" });
    expect(sent.some((m) => m.to === BOOKER_PHONE)).toBe(false);
    expect((await requestAdultConfirmationCode({ token: same.token, kind: "email", locale: "it", headers: visitor(), now: NOW })).ok).toBe(true);
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
    const [log] = await db.select().from(auditLog).where(and(eq(auditLog.entityId, a.id), eq(auditLog.action, "appointment.update")));
    expect(log.metadata).toMatchObject({ change: "adult_confirmed", proof: "otp_phone" });
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
    const [log] = await db.select().from(auditLog).where(and(eq(auditLog.entityId, stale.id), eq(auditLog.action, "appointment.cancel")));
    expect(log).toMatchObject({ actorType: "system" });
  });
});
