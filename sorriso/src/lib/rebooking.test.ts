import { and, eq, inArray, ne } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/db";
import { appointments, messages, patients, reminders, timeOff, waitlist } from "@/db/schema";
import { createPractice, MONDAY, NOW, TUESDAY, TZ } from "@/test/fixtures";
import { createAppointment, proposeAlternatives, rescheduleAppointment } from "./booking";
import { newId } from "./ids";
import { manageTokenOf } from "./links";
import {
  acceptAlternative,
  afterClosureRemoved,
  cancelForClosure,
  choiceKey,
  clashingAppointments,
  frontDeskCallList,
  needsRebooking,
  PRACTICE_UNAVAILABLE,
  rebookState,
  requestCallBack,
  sendRebookOffers,
} from "./rebooking";
import { zonedParts, zonedToUtc } from "./time";

const at = (date: string, hh: number, mm = 0) => zonedToUtc(date, hh * 60 + mm, TZ);
const staffActor = { type: "user" as const, id: null };
let seq = 3490000000;
const who = (firstName: string) => ({ firstName, lastName: "Moved", phone: `+39${seq++}`, email: `${firstName.toLowerCase()}${seq}@example.com`, locale: "it" as const });

type Practice = Awaited<ReturnType<typeof createPractice>>;
async function book(p: Practice, firstName: string, startsAt: Date, o: { serviceId?: string; practitionerId?: string } = {}) {
  return createAppointment({
    orgId: p.orgId,
    serviceId: o.serviceId ?? p.visit,
    practitionerId: o.practitionerId ?? p.drA,
    locationId: p.milano,
    startsAt,
    patient: who(firstName),
    source: "staff",
    online: false,
    now: NOW,
  });
}
async function close(p: Practice, scope: { practitionerId?: string; roomId?: string; locationId?: string }, startsAt: Date, endsAt: Date) {
  const row = { id: newId(), orgId: p.orgId, startsAt, endsAt, practitionerId: null, locationId: null, roomId: null, reason: null, ...scope };
  await db.insert(timeOff).values(row);
  return row;
}

describe("rebooking assistant", () => {
  it("a time-off that clashes with 3 appointments sends 3 offers", async () => {
    const p = await createPractice();
    const booked = [await book(p, "Ada", at(MONDAY, 9)), await book(p, "Bea", at(MONDAY, 10)), await book(p, "Cleo", at(MONDAY, 11))];
    // Another practitioner's visit at the same time is not affected.
    const other = await book(p, "Dina", at(MONDAY, 9), { practitionerId: p.drB });
    const closure = await close(p, { practitionerId: p.drA }, at(MONDAY, 0), at(TUESDAY, 0));

    const ids = await clashingAppointments(p.orgId, closure, NOW);
    expect(ids.sort()).toEqual(booked.map((d) => d.appointment.id).sort());

    const res = await sendRebookOffers(p.orgId, [...ids, other.appointment.id], staffActor, NOW);
    expect(res.sent.sort()).toEqual([...ids].sort());
    expect(res.skipped).toEqual([other.appointment.id]);

    for (const d of booked) {
      const sent = await db.select().from(messages).where(eq(messages.appointmentId, d.appointment.id));
      expect(sent).toHaveLength(1);
      expect(sent[0].body).toContain(`/a/${manageTokenOf(d.appointment)}/rebook`);
      // Discreet: no treatment, no practitioner.
      expect(sent[0].body).not.toMatch(/Visit|Anna/);
      const [row] = await db.select().from(appointments).where(eq(appointments.id, d.appointment.id));
      expect(row.needsAttention).toBe(true);
      // Reminders would announce a visit that can't take place.
      const pending = await db
        .select()
        .from(reminders)
        .where(and(eq(reminders.appointmentId, d.appointment.id), eq(reminders.status, "pending"), eq(reminders.kind, "reminder")));
      expect(pending).toHaveLength(0);
    }
  });

  it("alternatives: same practitioner first, closest days, never a busy or closed slot", async () => {
    const p = await createPractice();
    const d = await book(p, "Elsa", at(MONDAY, 9));
    // Dr A is busy on Tuesday at 9:00 and Wednesday at 9:00 – 10:30.
    await book(p, "Busy1", at(TUESDAY, 9));
    await book(p, "Busy2", at("2030-03-06", 9));
    await book(p, "Busy3", at("2030-03-06", 9, 30));
    await book(p, "Busy4", at("2030-03-06", 10));
    await close(p, { practitionerId: p.drA }, at(MONDAY, 0), at(TUESDAY, 0));

    const alts = await proposeAlternatives(d.appointment.id, 3, { now: NOW });
    expect(alts).toHaveLength(3);
    expect(alts.every((a) => a.practitionerId === p.drA && a.samePractitioner)).toBe(true);
    // One per day, the days closest to Monday.
    const days = alts.map((a) => zonedParts(a.start, TZ).date);
    expect(new Set(days).size).toBe(3);
    expect(days).toContain(TUESDAY);

    const busy = await db
      .select()
      .from(appointments)
      .where(and(eq(appointments.orgId, p.orgId), eq(appointments.practitionerId, p.drA), ne(appointments.status, "cancelled"), ne(appointments.id, d.appointment.id)));
    for (const a of alts) {
      for (const b of busy) expect(a.start < b.blockedUntil && b.startsAt < a.end).toBe(false);
      expect(zonedParts(a.start, TZ).date).not.toBe(MONDAY);
      expect(a.start.getTime()).toBeGreaterThanOrEqual(NOW.getTime() + 2 * 3_600_000);
    }
  });

  it("offers another practitioner at the same office when the practitioner has no time", async () => {
    const p = await createPractice();
    const d = await book(p, "Fede", at(MONDAY, 9));
    // Dr A is away for the whole search window; Dr B and Dr C (Mondays in Milano) offer the visit.
    await close(p, { practitionerId: p.drA }, at("2030-02-01", 0), at("2030-05-01", 0));
    const alts = await proposeAlternatives(d.appointment.id, 3, { now: NOW });
    expect(alts.length).toBeGreaterThan(0);
    expect(alts.every((a) => !a.samePractitioner && a.locationId === p.milano)).toBe(true);
  });

  it("when the patient picks an alternative, the visit moves and the original slot is freed and offered to the waitlist", async () => {
    const p = await createPractice();
    const d = await book(p, "Gaia", at(MONDAY, 9), { serviceId: p.cleaning });
    expect(d.appointment.roomId).toBe(p.chair1);
    // Someone waiting for a cleaning on Monday.
    const waiterId = newId();
    await db.insert(patients).values({ id: waiterId, orgId: p.orgId, firstName: "Wanda", lastName: "Waiting", phone: "+393481112233", locale: "it" });
    const entryId = newId();
    await db.insert(waitlist).values({ id: entryId, orgId: p.orgId, patientId: waiterId, serviceId: p.cleaning, earliestDate: MONDAY, latestDate: MONDAY });
    // Chair 1 is out of service on Monday morning.
    await close(p, { roomId: p.chair1, locationId: p.milano }, at(MONDAY, 8), at(MONDAY, 10, 30));
    expect(await needsRebooking(d.appointment, NOW)).toBe(true);
    await sendRebookOffers(p.orgId, [d.appointment.id], staffActor, NOW);

    const token = manageTokenOf(d.appointment)!;
    const state = await rebookState(token, NOW);
    expect(state.kind).toBe("needed");
    const choices = state.kind === "needed" ? state.choices : [];
    expect(choices.length).toBeGreaterThan(0);
    const pick = choices.find((c) => zonedParts(c.start, TZ).date !== MONDAY)!;
    expect(pick).toBeDefined();

    const res = await acceptAlternative(token, pick.key, { now: NOW });
    expect(res.ok).toBe(true);
    const [moved] = await db.select().from(appointments).where(eq(appointments.id, d.appointment.id));
    expect(moved.startsAt).toEqual(pick.start);
    expect(moved.needsAttention).toBe(false);
    expect(moved.confirmation).toBe("confirmed");
    // Reminders are back for the new time.
    const pending = await db.select().from(reminders).where(and(eq(reminders.appointmentId, d.appointment.id), eq(reminders.status, "pending")));
    expect(pending.length).toBeGreaterThan(0);

    // Monday 9:00 is free again (chair 2), and the waitlist heard about it.
    const offers = await db.select().from(messages).where(eq(messages.patientId, waiterId));
    expect(offers.some((m) => m.body.includes(`wl=${entryId}`))).toBe(true);
    const [entry] = await db.select().from(waitlist).where(eq(waitlist.id, entryId));
    expect(entry.offersSent).toBe(1);

    // The link no longer offers anything.
    expect((await rebookState(token, NOW)).kind).toBe("not_needed");
  });

  it("the practice's move skips the patient booking policies, and a busy choice is refused", async () => {
    // Online bookings need 5 days' notice here.
    const p = await createPractice({ minNoticeMinutes: 5 * 24 * 60 });
    const d = await book(p, "Ines", at(MONDAY, 9));
    const blocker = await book(p, "Blocker", at(TUESDAY, 10));
    await close(p, { practitionerId: p.drA }, at(MONDAY, 0), at(TUESDAY, 0));
    const token = manageTokenOf(d.appointment)!;

    // A patient moving their own visit would be refused...
    await expect(rescheduleAppointment(d.appointment.id, { startsAt: at(TUESDAY, 9), by: "patient", now: NOW })).rejects.toMatchObject({
      code: "too_soon",
    });
    // ...the assistant refuses a busy slot...
    const busyKey = choiceKey({ practitionerId: p.drA, locationId: p.milano, start: blocker.appointment.startsAt });
    expect(await acceptAlternative(token, busyKey, { now: NOW })).toEqual({ ok: false, reason: "taken" });
    // ...and a practitioner at another office that isn't the patient's,
    expect(await acceptAlternative(token, choiceKey({ practitionerId: p.drB, locationId: p.monza, start: at(TUESDAY, 9) }), { now: NOW })).toEqual({
      ok: false,
      reason: "not_offered",
    });
    // ...but books a free time the practice offers, policies aside.
    const ok = await acceptAlternative(token, choiceKey({ practitionerId: p.drA, locationId: p.milano, start: at(TUESDAY, 9) }), { now: NOW });
    expect(ok.ok).toBe(true);
  });

  it("call me instead puts the visit on the call list; staff may cancel with practice_unavailable", async () => {
    const p = await createPractice();
    const a = await book(p, "Lara", at(MONDAY, 9));
    const b = await book(p, "Mara", at(MONDAY, 10));
    await close(p, { locationId: p.milano }, at(MONDAY, 0), at(TUESDAY, 0));
    await sendRebookOffers(p.orgId, [a.appointment.id, b.appointment.id], staffActor, NOW);

    expect(await requestCallBack(manageTokenOf(a.appointment)!, { now: NOW })).toBe("ok");
    const calls = await frontDeskCallList(p.orgId, NOW, { contacts: true });
    expect(calls.map((c) => [c.appointmentId, c.reason])).toEqual([
      [a.appointment.id, "rebook_call"],
      [b.appointment.id, "rebook"],
    ]);
    expect(calls[0].phone).toMatch(/^\+39/);
    expect((await frontDeskCallList(p.orgId, NOW, { contacts: false }))[0].phone).toBeNull();

    const done = await cancelForClosure(p.orgId, [b.appointment.id], staffActor, NOW);
    expect(done).toEqual([b.appointment.id]);
    const [row] = await db.select().from(appointments).where(eq(appointments.id, b.appointment.id));
    expect(row).toMatchObject({ status: "cancelled", cancelledBy: "staff", cancelReason: PRACTICE_UNAVAILABLE });
  });

  it("removing the closure brings the reminders back", async () => {
    const p = await createPractice();
    const d = await book(p, "Nora", at(MONDAY, 9));
    const closure = await close(p, { practitionerId: p.drA }, at(MONDAY, 0), at(TUESDAY, 0));
    await sendRebookOffers(p.orgId, [d.appointment.id], staffActor, NOW);
    const pending = () =>
      db.select().from(reminders).where(and(eq(reminders.appointmentId, d.appointment.id), eq(reminders.status, "pending"), eq(reminders.kind, "reminder")));
    expect(await pending()).toHaveLength(0);
    await db.delete(timeOff).where(eq(timeOff.id, closure.id));
    expect(await afterClosureRemoved(p.orgId, closure, NOW)).toBe(1);
    expect((await pending()).length).toBeGreaterThan(0);
    expect(await needsRebooking(d.appointment, NOW)).toBe(false);
  });

  it("ignores visits of other practices", async () => {
    const p = await createPractice();
    const q = await createPractice();
    const d = await book(p, "Olga", at(MONDAY, 9));
    await close(p, { practitionerId: p.drA }, at(MONDAY, 0), at(TUESDAY, 0));
    const res = await sendRebookOffers(q.orgId, [d.appointment.id], staffActor, NOW);
    expect(res).toEqual({ sent: [], unreachable: [], skipped: [d.appointment.id] });
    expect(await cancelForClosure(q.orgId, [d.appointment.id], staffActor, NOW)).toEqual([]);
    expect(await proposeAlternatives(d.appointment.id, 3, { now: NOW, orgId: q.orgId })).toEqual([]);
    const sent = await db.select().from(messages).where(inArray(messages.appointmentId, [d.appointment.id]));
    expect(sent).toHaveLength(0);
  });
});
