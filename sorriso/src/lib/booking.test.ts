import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { appointments, auditLog, messages, patients, reminders, waitlist } from "@/db/schema";
import { createPractice, MONDAY, NOW, TZ } from "@/test/fixtures";
import {
  BookingError,
  cancelAppointment,
  createAppointment,
  dismissDuplicate,
  listDuplicatePairs,
  mergePatients,
  rescheduleAppointment,
  setOutcome,
} from "./booking";
import { handleInboundMessage, parseIntent } from "./inbound";
import { newId } from "./ids";
import { isAllowed, recordConsent } from "./privacy/consent";
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
    expect(msg.html).toContain(`/a/${d.appointment.manageTokenEnc}`);
    expect(d.appointment.manageToken).toBe(`h:${d.appointment.id}`);
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
    expect(moved.appointment.manageTokenHash).toBe(d.appointment.manageTokenHash);
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

describe("same-name protection and duplicates (WP8)", () => {
  it("a staff upsert with the same name and phone but a different birth date creates a new patient with possibleDuplicateOfId set", async () => {
    const q = await createPractice();
    const base = { firstName: "Giulia", lastName: "Neri", phone: "+393471234500", locale: "it" as const };
    const book = (patient: Record<string, unknown>, hh: number) =>
      createAppointment({ orgId: q.orgId, serviceId: q.visit, practitionerId: q.drA, locationId: q.milano, startsAt: at(hh), patient: { ...base, ...patient }, source: "staff", online: false, now: NOW });
    const first = await book({ birthDate: "1980-05-01" }, 9);
    // Same person: same birth date, or none given — the record is reused.
    expect((await book({ birthDate: "1980-05-01" }, 10)).patient.id).toBe(first.patient.id);
    expect((await book({}, 11)).patient.id).toBe(first.patient.id);
    // Same name and phone, another birth date: someone else until staff say otherwise.
    const other = await book({ birthDate: "2012-09-30" }, 12);
    expect(other.patient.id).not.toBe(first.patient.id);
    expect(other.patient.possibleDuplicateOfId).toBe(first.patient.id);
    expect(first.patient.possibleDuplicateOfId).toBeNull();
  });

  it("a public booking that doesn't match every detail gets its own record, flagged", async () => {
    const q = await createPractice();
    const who = { firstName: "Sara", lastName: "Blu", phone: "+393471234501", email: "sara@example.com", locale: "it" as const };
    const a = await createAppointment({ orgId: q.orgId, serviceId: q.visit, practitionerId: q.drA, locationId: q.milano, startsAt: at(9), patient: who, source: "online", online: true, now: NOW });
    const b = await createAppointment({ orgId: q.orgId, serviceId: q.visit, practitionerId: q.drA, locationId: q.milano, startsAt: at(10), patient: { ...who, email: "other@example.com" }, source: "online", online: true, now: NOW });
    expect(b.patient.id).not.toBe(a.patient.id);
    expect(b.patient.possibleDuplicateOfId).toBe(a.patient.id);
    const pairs = await listDuplicatePairs(q.orgId, { contacts: false });
    expect(pairs.map((x) => [x.patient.id, x.other.id])).toEqual([[b.patient.id, a.patient.id]]);
    expect(pairs[0].patient.email).toBeNull();
  });

  it("restricted patients: staff need a reason (audited), public bookings never reuse the record", async () => {
    const q = await createPractice();
    const who = { firstName: "Rosa", lastName: "Ristretta", phone: "+393471234502", locale: "it" as const };
    const first = await createAppointment({ orgId: q.orgId, serviceId: q.visit, practitionerId: q.drA, locationId: q.milano, startsAt: at(9), patient: who, source: "staff", online: false, now: NOW });
    await db.update(patients).set({ restrictedAt: NOW, restrictionReason: "Art. 18" }).where(eq(patients.id, first.patient.id));
    const staffBooking = (extra: Record<string, unknown>) =>
      createAppointment({ orgId: q.orgId, serviceId: q.visit, practitionerId: q.drA, locationId: q.milano, startsAt: at(10), patient: { id: first.patient.id }, source: "staff", online: false, now: NOW, ...extra });
    await expect(staffBooking({})).rejects.toMatchObject({ code: "restricted", reason: "restriction_reason_required" });
    const ok = await staffBooking({ restrictedAccessReason: "Urgent pain, patient called", actor: { type: "user", id: null } });
    expect(ok.patient.id).toBe(first.patient.id);
    const logged = await db.select().from(auditLog).where(and(eq(auditLog.action, "patient.restricted_access"), eq(auditLog.entityId, first.patient.id)));
    expect(logged).toHaveLength(1);
    expect(logged[0].reason).toBe("Urgent pain, patient called");

    const online = await createAppointment({ orgId: q.orgId, serviceId: q.visit, practitionerId: q.drA, locationId: q.milano, startsAt: at(11), patient: who, source: "online", online: true, now: NOW });
    expect(online.patient.id).not.toBe(first.patient.id);
    expect(online.patient.restrictedAt).toBeNull();
    expect(online.patient.possibleDuplicateOfId).toBe(first.patient.id);
  });

  it("merging moves the person's records to the kept one; the merged record stays as a tombstone the consent ledger follows", async () => {
    const q = await createPractice();
    const keep = await createAppointment({ orgId: q.orgId, serviceId: q.visit, practitionerId: q.drA, locationId: q.milano, startsAt: at(9), patient: { firstName: "Elia", lastName: "Uno", phone: "+393471234503", locale: "it" }, source: "staff", online: false, now: NOW });
    const dupe = await createAppointment({ orgId: q.orgId, serviceId: q.visit, practitionerId: q.drA, locationId: q.milano, startsAt: at(10), patient: { firstName: "Elia", lastName: "Uno", phone: "+393471234503", email: "elia@example.com", birthDate: "1990-01-01", locale: "it" }, source: "staff", online: false, now: NOW });
    expect(dupe.patient.possibleDuplicateOfId).toBeNull(); // the first record had no birth date: same person, reused
    // Force a flagged pair: a second record with a different birth date.
    const flagged = await createAppointment({ orgId: q.orgId, serviceId: q.visit, practitionerId: q.drA, locationId: q.milano, startsAt: at(11), patient: { firstName: "Elia", lastName: "Uno", phone: "+393471234503", birthDate: "1991-02-02", locale: "it" }, source: "staff", online: false, now: NOW });
    expect(flagged.patient.possibleDuplicateOfId).toBe(keep.patient.id);
    await db.transaction((tx) =>
      recordConsent(tx, { orgId: q.orgId, patientId: flagged.patient.id, purpose: "feedback_request", granted: true, locale: "it", method: "staff_recorded", source: "staff" }),
    );
    const other = await createPractice();
    expect(await mergePatients({ orgId: other.orgId, keepId: keep.patient.id, mergeId: flagged.patient.id, actor: { type: "user", id: null } })).toEqual({ ok: false, code: "not_found" });

    const res = await mergePatients({ orgId: q.orgId, keepId: keep.patient.id, mergeId: flagged.patient.id, actor: { type: "user", id: null } });
    expect(res).toMatchObject({ ok: true, moved: { appointments: 1 } });
    const [moved] = await db.select().from(appointments).where(eq(appointments.id, flagged.appointment.id));
    expect(moved.patientId).toBe(keep.patient.id);
    const [tomb] = await db.select().from(patients).where(eq(patients.id, flagged.patient.id));
    expect(tomb.mergedIntoId).toBe(keep.patient.id);
    expect(tomb.possibleDuplicateOfId).toBeNull();
    // The ledger row stays on the tombstone and still counts for the kept record.
    expect(await isAllowed(keep.patient.id, "feedback_request")).toBe(true);
    const audit = await db.select().from(auditLog).where(and(eq(auditLog.action, "patient.merge"), eq(auditLog.entityId, keep.patient.id)));
    expect(audit).toHaveLength(1);
    // A booking by the merged id lands on the kept record.
    const later = await createAppointment({ orgId: q.orgId, serviceId: q.visit, practitionerId: q.drA, locationId: q.milano, startsAt: at(12), patient: { id: flagged.patient.id }, source: "staff", online: false, now: NOW });
    expect(later.patient.id).toBe(keep.patient.id);
    expect(await listDuplicatePairs(q.orgId, { contacts: true })).toEqual([]);
  });

  it("dismissing a flagged pair clears the flag", async () => {
    const q = await createPractice();
    const a = await createAppointment({ orgId: q.orgId, serviceId: q.visit, practitionerId: q.drA, locationId: q.milano, startsAt: at(9), patient: { firstName: "Teo", lastName: "Due", phone: "+393471234504", birthDate: "1970-01-01", locale: "it" }, source: "staff", online: false, now: NOW });
    const b = await createAppointment({ orgId: q.orgId, serviceId: q.visit, practitionerId: q.drA, locationId: q.milano, startsAt: at(10), patient: { firstName: "Teo", lastName: "Due", phone: "+393471234504", birthDate: "2001-01-01", locale: "it" }, source: "staff", online: false, now: NOW });
    expect(b.patient.possibleDuplicateOfId).toBe(a.patient.id);
    expect(await dismissDuplicate({ orgId: q.orgId, patientId: b.patient.id, actor: { type: "user", id: null } })).toBe(true);
    expect(await listDuplicatePairs(q.orgId, { contacts: true })).toEqual([]);
  });

  it("a child reachable only through the guardian's phone is texted when staff move the visit", async () => {
    const q = await createPractice();
    const d = await createAppointment({
      orgId: q.orgId,
      serviceId: q.visit,
      practitionerId: q.drA,
      locationId: q.milano,
      startsAt: at(9),
      patient: { firstName: "Piccolo", lastName: "Tutore", birthDate: "2022-06-01", guardianName: "Papà", guardianRelation: "parent", guardianPhone: "+393471234505", locale: "it" },
      source: "staff",
      online: false,
      now: NOW,
    });
    expect(d.patient.preferredChannel).toBe("sms");
    await rescheduleAppointment(d.appointment.id, { startsAt: at(10), by: "staff", now: NOW });
    const sent = await db.select().from(messages).where(eq(messages.appointmentId, d.appointment.id));
    expect(sent.map((m) => [m.channel, m.to])).toEqual([["sms", "+393471234505"]]);
  });
});
