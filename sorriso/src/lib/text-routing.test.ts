import { and, asc, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { appointments, messages, organizations, patients, waitlist } from "@/db/schema";
import { createPractice, MONDAY, NOW, TZ } from "@/test/fixtures";
import { cancelAppointment, createAppointment, sendReminderNow, type BookingPrivacy, type NewPatientInput } from "./booking";
import { newId } from "./ids";
import { handleInboundMessage } from "./inbound";
import { addDays, zonedToUtc } from "./time";

/**
 * Which channel and which number patient texts go to: WhatsApp only where the practice enabled it
 * and the patient consented (textChannelFor), and replies matched on the number we text (a child's
 * messages go to the guardian).
 */

let off: Awaited<ReturnType<typeof createPractice>>;
/** WhatsApp enabled. */
let wa: Awaited<ReturnType<typeof createPractice>>;

let slotSeq = 0;
/** A fresh 30-minute slot with Dr. A (Mon-Fri 09-13 in Milano), shared across both practices. */
function nextSlot(): Date {
  const n = slotSeq++;
  return zonedToUtc(addDays(MONDAY, Math.floor(n / 8)), 9 * 60 + (n % 8) * 30, TZ);
}
let phoneSeq = 3482000000;
const person = (over: Partial<NewPatientInput> = {}): NewPatientInput => ({
  firstName: "Carla",
  lastName: "Moro",
  email: `carla${phoneSeq}@example.com`,
  phone: `+39${phoneSeq++}`,
  locale: "it",
  ...over,
});
const practicePrivacy = (whatsapp = false): BookingPrivacy => ({
  choices: { whatsapp, feedback: false },
  noticeVersion: "2026-10",
  locale: "it",
  source: "booking",
});

/** Booked by the front desk: the patient's preferred channel is stored as given, no consent recorded. */
function staffBook(practice: typeof off, patient: NewPatientInput, startsAt = nextSlot()) {
  return createAppointment({
    orgId: practice.orgId,
    serviceId: practice.visit,
    practitionerId: practice.drA,
    locationId: practice.milano,
    startsAt,
    patient,
    source: "staff",
    online: false,
    now: NOW,
  });
}

function onlineBook(practice: typeof off, patient: NewPatientInput, over: Partial<Parameters<typeof createAppointment>[0]> = {}) {
  return createAppointment({
    orgId: practice.orgId,
    serviceId: practice.visit,
    practitionerId: practice.drA,
    locationId: practice.milano,
    startsAt: nextSlot(),
    patient,
    source: "online",
    online: true,
    processingContext: "practice",
    privacy: practicePrivacy(),
    now: NOW,
    ...over,
  });
}

/** Channels of the texts and emails sent about an appointment, oldest first. */
async function sentChannels(appointmentId: string) {
  const rows = await db
    .select({ channel: messages.channel })
    .from(messages)
    .where(and(eq(messages.appointmentId, appointmentId), eq(messages.direction, "outbound")))
    .orderBy(asc(messages.createdAt));
  return rows.map((r) => r.channel);
}

beforeAll(async () => {
  off = await createPractice();
  wa = await createPractice();
  await db
    .update(organizations)
    .set({ settings: { ...wa.settings, privacy: { whatsappEnabled: true } } })
    .where(eq(organizations.id, wa.orgId));
});

describe("WhatsApp only where enabled and consented", () => {
  it("never texts on WhatsApp where the practice hasn't enabled it, whatever the stored preference", async () => {
    // A record from before the consent ledger, or set by staff: preferredChannel 'whatsapp'.
    const d = await staffBook(off, person({ preferredChannel: "whatsapp" }));
    await sendReminderNow(d.appointment.id, "sms");
    await sendReminderNow(d.appointment.id, "whatsapp");
    expect(await sentChannels(d.appointment.id)).toEqual(["sms", "sms"]);
  });

  it("needs the patient's WhatsApp consent where the practice offers it: a bare preference gets SMS", async () => {
    const d = await staffBook(wa, person({ preferredChannel: "whatsapp" }));
    await sendReminderNow(d.appointment.id, "sms");
    expect(await sentChannels(d.appointment.id)).toEqual(["sms"]);
  });

  it("uses WhatsApp with the consent recorded at booking", async () => {
    const d = await onlineBook(wa, person({ preferredChannel: "whatsapp" }), { privacy: practicePrivacy(true) });
    // The booking confirmation goes by email first; the reminder by WhatsApp.
    await sendReminderNow(d.appointment.id, "sms");
    expect(await sentChannels(d.appointment.id)).toEqual(["email", "whatsapp"]);
  });

  it("doesn't let a WhatsApp rule override a patient who chose SMS", async () => {
    const d = await staffBook(wa, person({ preferredChannel: "sms" }));
    await sendReminderNow(d.appointment.id, "whatsapp");
    expect(await sentChannels(d.appointment.id)).toEqual(["sms"]);
  });

  it("applies to staff notices and waitlist offers too", async () => {
    const start = nextSlot();
    const cancelled = await staffBook(wa, person({ preferredChannel: "whatsapp" }), start);
    const waiting = await staffBook(wa, person({ firstName: "Wally", preferredChannel: "whatsapp" }), nextSlot());
    await db.insert(waitlist).values({ id: newId(), orgId: wa.orgId, patientId: waiting.patient.id, serviceId: wa.visit, earliestDate: MONDAY, latestDate: addDays(MONDAY, 7) });

    await cancelAppointment(cancelled.appointment.id, { by: "staff", now: NOW });
    expect(await sentChannels(cancelled.appointment.id)).toEqual(["sms"]);
    const offers = await db.select({ channel: messages.channel }).from(messages).where(eq(messages.patientId, waiting.patient.id));
    expect(offers.map((m) => m.channel)).toEqual(["sms"]);
  });
});

describe("replies to texts sent to a guardian", () => {
  const relationFor = (phone: string) => ({ bookedFor: "minor" as const, guardian: { name: "Paolo Riva", relation: "parent" as const, phone } });

  it("acts on the child's visit the guardian was texted about, not the guardian's own", async () => {
    const guardian = `+39${phoneSeq++}`;
    // The parent is a patient too, with a sooner visit of his own (booked by staff: nobody was texted).
    const parent = await staffBook(off, person({ firstName: "Paolo", lastName: "Riva", phone: guardian, email: null }), zonedToUtc(addDays(MONDAY, 21), 9 * 60, TZ));
    // The child (own phone, but under 14) is booked as a minor: the SMS confirmation goes to the parent.
    const child = await onlineBook(
      off,
      person({ firstName: "Nina", lastName: "Riva", email: null, birthDate: "2018-04-04", preferredChannel: "sms" }),
      { relation: relationFor(guardian), startsAt: zonedToUtc(addDays(MONDAY, 24), 12 * 60, TZ) },
    );
    const [confirmation] = await db.select().from(messages).where(eq(messages.appointmentId, child.appointment.id));
    expect(confirmation).toMatchObject({ channel: "sms", to: guardian });

    const res = await handleInboundMessage({ channel: "sms", from: guardian, body: "ANNULLA", replyMode: "return", now: NOW });
    expect(res.appointmentId).toBe(child.appointment.id);
    const status = async (id: string) => (await db.select().from(appointments).where(eq(appointments.id, id)))[0].status;
    expect(await status(child.appointment.id)).toBe("cancelled");
    expect(await status(parent.appointment.id)).toBe("scheduled");

    // STOP from the guardian's number stops the texts to that number: the child's included.
    await handleInboundMessage({ channel: "sms", from: guardian, body: "STOP", replyMode: "return", now: NOW });
    const optIn = async (id: string) => (await db.select().from(patients).where(eq(patients.id, id)))[0].smsOptIn;
    expect(await optIn(child.patient.id)).toBe(false);
    expect(await optIn(parent.patient.id)).toBe(false);
  });

  it("confirms the child's visit for a guardian who is not a patient, and ignores the child's own number", async () => {
    const guardian = `+39${phoneSeq++}`;
    const childPhone = `+39${phoneSeq++}`;
    const child = await onlineBook(
      off,
      person({ firstName: "Teo", lastName: "Riva", phone: childPhone, email: null, birthDate: "2018-04-04", preferredChannel: "sms" }),
      { relation: relationFor(guardian) },
    );
    // We never text the child's own number, so a reply from it matches nothing.
    const fromChild = await handleInboundMessage({ channel: "sms", from: childPhone, body: "SI", replyMode: "return", now: NOW });
    expect(fromChild.appointmentId).toBeNull();

    const fromGuardian = await handleInboundMessage({ channel: "sms", from: guardian, body: "SI", replyMode: "return", now: NOW });
    expect(fromGuardian.appointmentId).toBe(child.appointment.id);
    const [row] = await db.select().from(appointments).where(eq(appointments.id, child.appointment.id));
    expect(row.confirmation).toBe("confirmed");
  });
});
