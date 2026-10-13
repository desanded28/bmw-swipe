import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { appointments, messages, reminders, waitlist } from "@/db/schema";
import { createPractice, MONDAY, NOW, TZ } from "@/test/fixtures";
import { BookingError, cancelAppointment, createAppointment, rescheduleAppointment, setOutcome } from "./booking";
import { handleInboundMessage, parseIntent } from "./inbound";
import { newId } from "./ids";
import { processDueReminders } from "./reminders";
import { zonedToUtc } from "./time";

let p: Awaited<ReturnType<typeof createPractice>>;
const at = (hh: number, mm = 0) => zonedToUtc(MONDAY, hh * 60 + mm, TZ);
let phoneSeq = 3400000000;
const patient = (overrides: Record<string, unknown> = {}) => ({
  firstName: "Maria",
  lastName: "Rossi",
  email: `maria${phoneSeq}@example.com`,
  phone: `+39${phoneSeq++}`,
  locale: "it" as const,
  ...overrides,
});

beforeAll(async () => {
  p = await createPractice();
});

describe("online booking", () => {
  it("books a slot, schedules reminders and sends the confirmation", async () => {
    const d = await createAppointment({
      orgId: p.orgId,
      serviceId: p.visit,
      practitionerId: p.drA,
      locationId: p.milano,
      startsAt: at(9),
      patient: patient(),
      source: "online",
      online: true,
      now: NOW,
    });
    expect(d.appointment.status).toBe("scheduled");
    expect(d.appointment.roomId).toBe(p.chair1);
    const rows = await db.select().from(reminders).where(eq(reminders.appointmentId, d.appointment.id));
    // booking confirmation (sent) + 48h email + 24h sms + 2h sms
    expect(rows.filter((r) => r.kind === "reminder" && r.status === "pending")).toHaveLength(3);
    expect(rows.find((r) => r.kind === "booking_confirmation")?.status).toBe("sent");
    const [msg] = await db.select().from(messages).where(eq(messages.appointmentId, d.appointment.id));
    expect(msg.status).toBe("captured");
    expect(msg.subject).toContain("Appuntamento prenotato");
    expect(msg.html).toContain(`/a/${d.appointment.manageToken}`);
  });

  it("refuses to double-book the same practitioner", async () => {
    await expect(
      createAppointment({
        orgId: p.orgId,
        serviceId: p.visit,
        practitionerId: p.drA,
        locationId: p.milano,
        startsAt: at(9, 15),
        patient: patient(),
        source: "online",
        online: true,
        now: NOW,
      }),
    ).rejects.toMatchObject({ code: "practitioner_busy" });
  });

  it("serialises concurrent bookings for the last free slot", async () => {
    const attempt = (i: number) =>
      createAppointment({
        orgId: p.orgId,
        serviceId: p.visit,
        practitionerId: p.drB,
        locationId: p.milano,
        startsAt: at(12),
        patient: patient({ firstName: `Racer${i}` }),
        source: "online",
        online: true,
        now: NOW,
      });
    const results = await Promise.allSettled([attempt(1), attempt(2), attempt(3)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    for (const r of results.filter((r) => r.status === "rejected")) {
      expect((r as PromiseRejectedResult).reason).toBeInstanceOf(BookingError);
    }
  });

  it("rejects bookings outside working hours online but lets staff force them", async () => {
    const base = {
      orgId: p.orgId,
      serviceId: p.visit,
      practitionerId: p.drA,
      locationId: p.milano,
      startsAt: at(18),
      source: "online" as const,
      now: NOW,
    };
    await expect(createAppointment({ ...base, patient: patient(), online: true })).rejects.toMatchObject({ code: "outside_hours" });
    const d = await createAppointment({ ...base, patient: patient(), online: false, source: "staff" });
    expect(d.appointment.status).toBe("scheduled");
  });

  it("reuses the patient record when the same person books again", async () => {
    const who = patient({ firstName: "Luigi" });
    const a = await createAppointment({ orgId: p.orgId, serviceId: p.visit, practitionerId: p.drC, locationId: p.milano, startsAt: at(9), patient: who, source: "online", online: true, now: NOW });
    const b = await createAppointment({ orgId: p.orgId, serviceId: p.visit, practitionerId: p.drC, locationId: p.milano, startsAt: at(10), patient: { ...who, phone: who.phone.replace("+39", "") }, source: "online", online: true, now: NOW });
    expect(b.patient.id).toBe(a.patient.id);
    // …but a child sharing the parent's contacts gets their own record
    const c = await createAppointment({ orgId: p.orgId, serviceId: p.visit, practitionerId: p.drC, locationId: p.milano, startsAt: at(11), patient: { ...who, firstName: "Pietro" }, source: "online", online: true, now: NOW });
    expect(c.patient.id).not.toBe(a.patient.id);
  });

  it("turns online bookings into requests when approval is required", async () => {
    const q = await createPractice({ requireApproval: true });
    const d = await createAppointment({ orgId: q.orgId, serviceId: q.visit, practitionerId: q.drA, locationId: q.milano, startsAt: at(9), patient: patient(), source: "online", online: true, now: NOW });
    expect(d.appointment.status).toBe("requested");
    const pending = await db.select().from(reminders).where(and(eq(reminders.appointmentId, d.appointment.id), eq(reminders.kind, "reminder")));
    expect(pending).toHaveLength(0);
  });
});

describe("cancel, reschedule and waitlist", () => {
  it("cancelling frees the slot and offers it to the waitlist", async () => {
    const d = await createAppointment({ orgId: p.orgId, serviceId: p.cleaning, practitionerId: p.drA, locationId: p.milano, startsAt: at(11), patient: patient(), source: "online", online: true, now: NOW });
    const waiting = await createAppointment({ orgId: p.orgId, serviceId: p.visit, practitionerId: p.drC, locationId: p.milano, startsAt: at(12), patient: patient({ firstName: "Wanda" }), source: "staff", online: false, now: NOW });
    const entryId = newId();
    await db.insert(waitlist).values({ id: entryId, orgId: p.orgId, patientId: waiting.patient.id, serviceId: p.cleaning, earliestDate: MONDAY, latestDate: MONDAY });

    const cancelled = await cancelAppointment(d.appointment.id, { by: "patient", now: NOW });
    expect(cancelled!.appointment.status).toBe("cancelled");
    const pending = await db.select().from(reminders).where(and(eq(reminders.appointmentId, d.appointment.id), eq(reminders.status, "pending")));
    expect(pending).toHaveLength(0);

    const [entry] = await db.select().from(waitlist).where(eq(waitlist.id, entryId));
    expect(entry.offersSent).toBe(1);
    const offers = await db.select().from(messages).where(eq(messages.patientId, waiting.patient.id));
    expect(offers.some((m) => m.body.includes(`wl=${entryId}`))).toBe(true);
  });

  it("reschedules, keeps the token and resets reminders", async () => {
    const d = await createAppointment({ orgId: p.orgId, serviceId: p.visit, practitionerId: p.drB, locationId: p.milano, startsAt: at(10, 30), patient: patient(), source: "online", online: true, now: NOW });
    // overlaps its own current slot: must be ignored when checking conflicts
    const moved = await rescheduleAppointment(d.appointment.id, { startsAt: at(10, 45), by: "patient", now: NOW });
    expect(moved.appointment.startsAt.toISOString()).toBe(at(10, 45).toISOString());
    expect(moved.appointment.manageToken).toBe(d.appointment.manageToken);
    expect(moved.appointment.confirmation).toBe("confirmed");
    const pending = await db.select().from(reminders).where(and(eq(reminders.appointmentId, d.appointment.id), eq(reminders.status, "pending")));
    expect(pending).toHaveLength(3);
  });

  it("counts no-shows on the patient", async () => {
    const d = await createAppointment({ orgId: p.orgId, serviceId: p.visit, practitionerId: p.drB, locationId: p.milano, startsAt: at(10), patient: patient(), source: "staff", online: false, now: NOW });
    const after = await setOutcome(d.appointment.id, "no_show", NOW);
    expect(after.patient.noShowCount).toBe(1);
    const undone = await setOutcome(d.appointment.id, "completed", NOW);
    expect(undone.patient.noShowCount).toBe(0);
  });
});

describe("reminders", () => {
  it("sends due reminders exactly once and stops asking after confirmation", async () => {
    const d = await createAppointment({ orgId: p.orgId, serviceId: p.visit, practitionerId: p.drC, locationId: p.milano, startsAt: at(12, 30), patient: patient({ firstName: "Ugo" }), source: "online", online: true, now: NOW });
    const t48 = new Date(at(12, 30).getTime() - 47 * 3_600_000);
    const [r1, r2] = await Promise.all([processDueReminders({ now: t48, appointmentId: d.appointment.id }), processDueReminders({ now: t48, appointmentId: d.appointment.id })]);
    expect(r1.sent + r2.sent).toBe(1);

    // Patient replies "SI" to the email → confirmed; next SMS reminder must not ask again
    await db.update(appointments).set({ confirmation: "confirmed" }).where(eq(appointments.id, d.appointment.id));
    const t24 = new Date(at(12, 30).getTime() - 23 * 3_600_000);
    await processDueReminders({ now: t24, appointmentId: d.appointment.id });
    const sms = await db.select().from(messages).where(and(eq(messages.appointmentId, d.appointment.id), eq(messages.channel, "sms")));
    expect(sms).toHaveLength(1);
    expect(sms[0].body).not.toContain("Rispondi SI");
  });

  it("falls back to email when the patient has no phone", async () => {
    const d = await createAppointment({ orgId: p.orgId, serviceId: p.visit, practitionerId: p.drC, locationId: p.milano, startsAt: at(9, 30), patient: patient({ firstName: "Nora", phone: null }), source: "online", online: true, now: NOW });
    const t24 = new Date(at(9, 30).getTime() - 23 * 3_600_000);
    await processDueReminders({ now: t24, appointmentId: d.appointment.id });
    const sent = await db.select().from(messages).where(eq(messages.appointmentId, d.appointment.id));
    expect(sent.map((m) => m.channel).sort()).toEqual(["email", "email", "email"]);
  });
});

describe("two-way SMS", () => {
  it.each([
    ["SI", "confirm"],
    ["Sì, grazie!", "confirm"],
    ["yes", "confirm"],
    ["👍", "confirm"],
    ["Ci sarò", "confirm"],
    ["NO", "cancel"],
    ["non posso venire, scusate", "cancel"],
    ["Posso spostarlo a giovedì?", "reschedule"],
    ["STOP", "stop"],
    ["Devo portare le lastre?", "unknown"],
  ])("understands %s", (text, intent) => {
    expect(parseIntent(text)).toBe(intent);
  });

  it("confirms, cancels and flags replies against the next appointment", async () => {
    const who = patient({ firstName: "Sms" });
    const d = await createAppointment({ orgId: p.orgId, serviceId: p.visit, practitionerId: p.drB, locationId: p.milano, startsAt: at(11, 30), patient: who, source: "online", online: true, now: NOW });

    const r1 = await handleInboundMessage({ channel: "sms", from: who.phone, body: "Devo portare le lastre?", replyMode: "return", now: NOW });
    expect(r1.intent).toBe("unknown");
    let [row] = await db.select().from(appointments).where(eq(appointments.id, d.appointment.id));
    expect(row.needsAttention).toBe(true);

    const r2 = await handleInboundMessage({ channel: "sms", from: who.phone.replace("+39", "0039 "), body: "SI", replyMode: "return", now: NOW });
    expect(r2.reply).toContain("Presenza confermata");
    [row] = await db.select().from(appointments).where(eq(appointments.id, d.appointment.id));
    expect(row.confirmation).toBe("confirmed");
    expect(row.confirmedVia).toBe("sms");
    expect(row.needsAttention).toBe(false);

    const r3 = await handleInboundMessage({ channel: "whatsapp", from: `whatsapp:${who.phone}`, body: "No", replyMode: "deliver", now: NOW });
    expect(r3.intent).toBe("cancel");
    [row] = await db.select().from(appointments).where(eq(appointments.id, d.appointment.id));
    expect(row.status).toBe("cancelled");
    expect(row.cancelledBy).toBe("patient");
  });

  it("matches a reply to the visit we last texted about, across practices", async () => {
    const other = await createPractice();
    const who = patient({ firstName: "Doppio" });
    const soon = await createAppointment({ orgId: p.orgId, serviceId: p.visit, practitionerId: p.drA, locationId: p.milano, startsAt: zonedToUtc("2030-03-05", 9 * 60, TZ), patient: who, source: "online", online: true, now: NOW });
    const later = await createAppointment({ orgId: other.orgId, serviceId: other.visit, practitionerId: other.drA, locationId: other.milano, startsAt: zonedToUtc("2030-03-06", 10 * 60, TZ), patient: who, source: "online", online: true, now: NOW });
    // The second practice's 24h SMS goes out; the patient answers it.
    const t = new Date(later.appointment.startsAt.getTime() - 23 * 3_600_000);
    await processDueReminders({ now: t, appointmentId: later.appointment.id });
    const res = await handleInboundMessage({ channel: "sms", from: who.phone, body: "SI", replyMode: "return", now: NOW });
    expect(res.appointmentId).toBe(later.appointment.id);
    const [a] = await db.select().from(appointments).where(eq(appointments.id, soon.appointment.id));
    expect(a.confirmation).toBe("pending");
  });
});
