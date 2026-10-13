import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { appointments, patients, timeOff } from "@/db/schema";
import { createPractice, MONDAY, NOW, TUESDAY, TZ } from "@/test/fixtures";
import { evaluateSlot, getAvailability, loadAvailabilityContext, rangeForDates } from "./availability";
import { newId, newToken } from "./ids";
import { addMinutes, zonedToUtc } from "./time";

let p: Awaited<ReturnType<typeof createPractice>>;
let patientId: string;

async function book(practitionerId: string, locationId: string, roomId: string | null, date: string, minute: number, duration = 30) {
  const startsAt = zonedToUtc(date, minute, TZ);
  await db.insert(appointments).values({
    id: newId(),
    orgId: p.orgId,
    locationId,
    practitionerId,
    roomId,
    serviceId: p.visit,
    patientId,
    startsAt,
    endsAt: addMinutes(startsAt, duration),
    blockedUntil: addMinutes(startsAt, duration),
    source: "staff",
    manageToken: newToken(),
  });
}

const at = (date: string, hh: number, mm = 0) => zonedToUtc(date, hh * 60 + mm, TZ);

beforeAll(async () => {
  p = await createPractice();
  patientId = newId();
  await db.insert(patients).values({ id: patientId, orgId: p.orgId, firstName: "Test", lastName: "Patient", phone: "+393330000000" });
});

describe("availability", () => {
  it("only offers slots inside working hours, on the grid", async () => {
    const res = await getAvailability({
      orgId: p.orgId,
      serviceId: p.visit,
      practitionerIds: [p.drA],
      fromDate: MONDAY,
      days: 1,
      timezone: TZ,
      now: NOW,
    });
    const slots = res!.slots;
    // 09:00–13:00 with a 30' service every 15' → 09:00 … 12:30 = 15 slots
    expect(slots).toHaveLength(15);
    expect(slots[0].start.toISOString()).toBe(at(MONDAY, 9).toISOString());
    expect(slots.at(-1)!.start.toISOString()).toBe(at(MONDAY, 12, 30).toISOString());
    expect(slots.every((s) => s.roomId)).toBe(true);
  });

  it("respects working location per weekday", async () => {
    const res = await getAvailability({ orgId: p.orgId, serviceId: p.visit, practitionerIds: [p.drB], fromDate: TUESDAY, days: 1, timezone: TZ, now: NOW });
    expect(new Set(res!.slots.map((s) => s.locationId))).toEqual(new Set([p.monza]));
  });

  it("does not offer services the practitioner doesn't do", async () => {
    const res = await getAvailability({ orgId: p.orgId, serviceId: p.cleaning, practitionerIds: [p.drB], fromDate: MONDAY, days: 1, timezone: TZ, now: NOW });
    expect(res!.slots).toHaveLength(0);
  });

  it("blocks overlapping appointments including cleanup buffers", async () => {
    await book(p.drA, p.milano, p.chair1, MONDAY, 10 * 60); // 10:00–10:30
    const ctx = (await loadAvailabilityContext({ orgId: p.orgId, serviceId: p.cleaning, ...rangeForDates(MONDAY, 1, TZ) }))!;
    // cleaning = 45' + 15' buffer: 09:15 would run into 10:00 with its buffer
    expect(evaluateSlot(ctx, { practitionerId: p.drA, locationId: p.milano, start: at(MONDAY, 9, 15), now: NOW })).toEqual({ ok: false, reason: "practitioner_busy" });
    expect(evaluateSlot(ctx, { practitionerId: p.drA, locationId: p.milano, start: at(MONDAY, 9, 0), now: NOW })).toMatchObject({ ok: true });
    expect(evaluateSlot(ctx, { practitionerId: p.drA, locationId: p.milano, start: at(MONDAY, 10, 30), now: NOW })).toMatchObject({ ok: true });
  });

  it("runs out of chairs when every chair at the office is taken", async () => {
    await book(p.drB, p.milano, p.chair1, MONDAY, 11 * 60);
    await book(p.drC, p.milano, p.chair2, MONDAY, 11 * 60);
    const ctx = (await loadAvailabilityContext({ orgId: p.orgId, serviceId: p.visit, ...rangeForDates(MONDAY, 1, TZ) }))!;
    expect(evaluateSlot(ctx, { practitionerId: p.drA, locationId: p.milano, start: at(MONDAY, 11), now: NOW })).toEqual({ ok: false, reason: "no_room" });
  });

  it("blocks a practitioner across offices (no double booking between locations)", async () => {
    // Dr. B is booked in Milano on Monday 11:00; pretend we check Monza at the same time
    const ctx = (await loadAvailabilityContext({ orgId: p.orgId, serviceId: p.visit, ...rangeForDates(MONDAY, 1, TZ) }))!;
    expect(evaluateSlot(ctx, { practitionerId: p.drB, locationId: p.monza, start: at(MONDAY, 11), now: NOW })).toEqual({ ok: false, reason: "practitioner_busy" });
  });

  it("applies time off and office closures", async () => {
    await db.insert(timeOff).values([
      { id: newId(), orgId: p.orgId, practitionerId: p.drA, startsAt: at(TUESDAY, 9), endsAt: at(TUESDAY, 11), reason: "Dentist" },
      { id: newId(), orgId: p.orgId, locationId: p.monza, startsAt: at(TUESDAY, 0), endsAt: at(TUESDAY, 23, 59), reason: "Closed" },
    ]);
    const a = await getAvailability({ orgId: p.orgId, serviceId: p.visit, practitionerIds: [p.drA], fromDate: TUESDAY, days: 1, timezone: TZ, now: NOW });
    expect(a!.slots[0].start.toISOString()).toBe(at(TUESDAY, 11).toISOString());
    const b = await getAvailability({ orgId: p.orgId, serviceId: p.visit, practitionerIds: [p.drB], fromDate: TUESDAY, days: 1, timezone: TZ, now: NOW });
    expect(b!.slots).toHaveLength(0);
  });

  it("enforces minimum notice and the booking horizon", async () => {
    const ctx = (await loadAvailabilityContext({ orgId: p.orgId, serviceId: p.visit, ...rangeForDates(MONDAY, 1, TZ) }))!;
    const now = new Date(at(MONDAY, 9).getTime() - 30 * 60_000);
    expect(evaluateSlot(ctx, { practitionerId: p.drA, locationId: p.milano, start: at(MONDAY, 9), now, enforcePolicy: true })).toEqual({ ok: false, reason: "too_soon" });
    expect(evaluateSlot(ctx, { practitionerId: p.drA, locationId: p.milano, start: at(MONDAY, 9), now, enforcePolicy: false })).toMatchObject({ ok: true });
    const farNow = new Date(at(MONDAY, 9).getTime() - 200 * 86_400_000);
    expect(evaluateSlot(ctx, { practitionerId: p.drA, locationId: p.milano, start: at(MONDAY, 9), now: farNow, enforcePolicy: true })).toEqual({ ok: false, reason: "too_far" });
  });
});
