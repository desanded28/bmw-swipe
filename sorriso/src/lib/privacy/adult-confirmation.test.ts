import { and, desc, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { appointments, consents, messages, reminders } from "@/db/schema";
import { createAppointment } from "@/lib/booking";
import { manageTokenOf } from "@/lib/links";
import { addDays, zonedToUtc } from "@/lib/time";
import { createPractice, MONDAY, NOW, TZ } from "@/test/fixtures";
import {
  ADULT_CONFIRMATION_HOURS,
  awaitsAdultConfirmation,
  confirmAdultBooking,
  declineAdultBooking,
  expireAdultConfirmations,
  requestAdultConfirmation,
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
const HOUR = 3_600_000;

/** A booking for another adult; `held` turns it into a marketplace booking waiting for that adult. */
async function bookForAdult(held: boolean, createdAt = NOW) {
  const k = n++;
  const d = await createAppointment({
    orgId: p.orgId,
    serviceId: p.visit,
    practitionerId: p.drA,
    locationId: p.milano,
    startsAt: zonedToUtc(addDays(MONDAY, 7 * (1 + Math.floor(k / 8))), 9 * 60 + (k % 8) * 30, TZ),
    patient: { firstName: "Nonna", lastName: "Pina", phone: `+39340777${String(1000 + k)}`, email: `pina${k}@example.com`, locale: "it" },
    relation: { bookedFor: "other_adult", bookedBy: { name: "Marco Pina", phone: "+393407770999", email: "marco@example.com" } },
    privacy: { choices: {}, noticeVersion: "2026-10", locale: "it", source: "booking" },
    processingContext: "practice",
    source: "online",
    online: false,
    notifyPatient: false,
    now: NOW,
  });
  if (held) {
    await db.update(appointments).set({ processingContext: "marketplace", status: "requested", createdAt }).where(eq(appointments.id, d.appointment.id));
    await db.delete(reminders).where(eq(reminders.appointmentId, d.appointment.id));
  }
  const [a] = await db.select().from(appointments).where(eq(appointments.id, d.appointment.id));
  return { a, token: manageTokenOf(a)!, patient: d.patient };
}

beforeAll(async () => {
  p = await createPractice();
});

describe("practice bookings for another adult (Art. 14)", () => {
  it("send the practice's notice to the adult's own contact, never to the booker", async () => {
    sent.length = 0;
    const { a, patient } = await bookForAdult(false);
    expect(a.bookedByName).toBe("Marco Pina");
    expect(await sendBookedForYouNotice(a.id)).toBe(true);
    const out = sent.filter((m) => m.to === patient.phone || m.to === patient.email);
    expect(out).toHaveLength(1);
    expect(out[0].text).toContain("Marco Pina");
    expect(out[0].text).toContain("/it/c/");
    expect(out[0].text).toContain("/privacy");
    expect(sent.some((m) => m.to === "+393407770999" || m.to === "marco@example.com")).toBe(false);
  });
});

describe("marketplace bookings for another adult", () => {
  it("wait for that adult, for 48 hours", async () => {
    const { a } = await bookForAdult(true);
    expect(await awaitsAdultConfirmation(a, NOW)).toBe(true);
    expect(await awaitsAdultConfirmation(a, new Date(NOW.getTime() + (ADULT_CONFIRMATION_HOURS + 1) * HOUR))).toBe(false);
    const { a: practice } = await bookForAdult(false);
    expect(await awaitsAdultConfirmation(practice, NOW)).toBe(false);
  });

  it("ask the adult to confirm through a link to their own contact", async () => {
    sent.length = 0;
    const { a, token, patient } = await bookForAdult(true);
    expect(await requestAdultConfirmation(a.id, NOW)).toBe(true);
    const out = sent.find((m) => m.to === patient.phone || m.to === patient.email)!;
    expect(out.text).toContain(`/a/${token}/privacy/confirm`);
    const [logged] = await db.select().from(messages).where(eq(messages.appointmentId, a.id)).orderBy(desc(messages.createdAt));
    expect(logged.body).not.toMatch(/Visit|Anna A/);
  });

  it("record the adult's own Art. 9 consent and release the hold when they confirm", async () => {
    const { a, token } = await bookForAdult(true);
    const r = await confirmAdultBooking({ token, locale: "en", headers: new Headers({ "x-real-ip": "192.0.2.5" }), now: NOW });
    expect(r).toEqual({ ok: true, status: "scheduled" });
    const [row] = await db.select().from(consents).where(and(eq(consents.appointmentId, a.id), eq(consents.purpose, "platform_booking_art9")));
    expect(row).toMatchObject({ orgId: null, granted: true, actorRelation: "self", source: "manage_link", method: "web_checkbox", locale: "en" });
    const [after] = await db.select().from(appointments).where(eq(appointments.id, a.id));
    expect(after.status).toBe("scheduled");
    expect((await db.select().from(reminders).where(eq(reminders.appointmentId, a.id))).length).toBeGreaterThan(0);
    expect(await confirmAdultBooking({ token, locale: "en", now: NOW })).toEqual({ ok: false, reason: "not_waiting" });
  });

  it("cancel the booking when the adult declines", async () => {
    const { a, token } = await bookForAdult(true);
    expect(await declineAdultBooking({ token, now: NOW })).toEqual({ ok: true, status: "cancelled" });
    const [after] = await db.select().from(appointments).where(eq(appointments.id, a.id));
    expect(after.status).toBe("cancelled");
    const rows = await db.select().from(consents).where(eq(consents.appointmentId, a.id));
    expect(rows.some((c) => c.purpose === "platform_booking_art9")).toBe(false);
  });

  it("cancel holds nobody confirmed in time", async () => {
    const old = new Date(NOW.getTime() - (ADULT_CONFIRMATION_HOURS + 2) * HOUR);
    const { a: stale } = await bookForAdult(true, old);
    const { a: fresh } = await bookForAdult(true, NOW);
    expect(await expireAdultConfirmations(NOW)).toBeGreaterThanOrEqual(1);
    const [s] = await db.select().from(appointments).where(eq(appointments.id, stale.id));
    const [f] = await db.select().from(appointments).where(eq(appointments.id, fresh.id));
    expect(s.status).toBe("cancelled");
    expect(f.status).toBe("requested");
  });
});
