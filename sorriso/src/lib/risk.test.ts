import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { NO_CARE_FLAGS } from "@/components/dashboard/slots/contracts";
import { db } from "@/db";
import { appointments, organizations, patients } from "@/db/schema";
import { createPractice, MONDAY, NOW, TZ } from "@/test/fixtures";
import { evaluateSlot, getAvailability, loadAvailabilityContext } from "./availability";
import { createAppointment } from "./booking";
import { permissionsFor } from "./permissions";
import { withdrawConsent } from "./privacy/consent";
import { computeRisk, loadCareFlags, refreshAppointmentRisk, RISK_THRESHOLDS, type RiskInput } from "./risk";
import { zonedToUtc } from "./time";

const base: RiskInput = {
  history24m: { noShows: 0, lateCancels: 0, completed: 0 },
  leadTimeHours: 48,
  isNewPatient: false,
  unconfirmedAtT24: false,
  weekday: 2,
  hour: 10,
};
const risk = (o: Partial<RiskInput> & { history?: Partial<RiskInput["history24m"]> } = {}) =>
  computeRisk({ ...base, ...o, history24m: { ...base.history24m, ...o.history } });

describe("computeRisk (published weights, deterministic)", () => {
  it.each([
    ["a reliable regular", { history: { completed: 5 } }, "low", 0, []],
    ["one no-show", { history: { noShows: 1 } }, "medium", 25, ["no_show_history"]],
    ["one no-show, unconfirmed the day before", { history: { noShows: 1 }, unconfirmedAtT24: true }, "high", 45, ["no_show_history", "unconfirmed"]],
    ["two no-shows and two late cancellations", { history: { noShows: 2, lateCancels: 2 } }, "high", 55, ["no_show_history", "late_cancel_history"]],
    ["no-shows counted up to three", { history: { noShows: 7 } }, "high", 55, ["no_show_history"]],
    ["a single late cancellation is noise", { history: { lateCancels: 1 } }, "low", 0, []],
    [
      "a new patient booked 40 days ahead, unconfirmed",
      { isNewPatient: true, leadTimeHours: 40 * 24, unconfirmedAtT24: true },
      "high",
      45,
      ["unconfirmed", "long_lead_time", "new_patient"],
    ],
    ["a new patient booked 20 days ahead", { isNewPatient: true, leadTimeHours: 20 * 24 }, "low", 18, ["new_patient", "long_lead_time"]],
    ["very early in the day", { hour: 8 }, "low", 5, ["edge_of_day"]],
    ["from 18:00", { hour: 18 }, "low", 5, ["edge_of_day"]],
    ["a reliable history lowers the score", { history: { completed: 3 }, unconfirmedAtT24: true }, "low", 10, ["unconfirmed"]],
    ["equal weights list in the published order", { history: { lateCancels: 2 }, leadTimeHours: 31 * 24 }, "medium", 30, ["late_cancel_history", "long_lead_time"]],
  ] as const)("%s", (_name, input, level, score, reasons) => {
    const r = risk(input as Parameters<typeof risk>[0]);
    expect(r).toEqual({ level, score, reasons });
    // Same input, same answer.
    expect(risk(input as Parameters<typeof risk>[0])).toEqual(r);
  });

  it("cuts levels at the published thresholds", () => {
    expect(RISK_THRESHOLDS).toEqual({ medium: 25, high: 45 });
    expect(risk({ history: { noShows: 1 } }).level).toBe("medium"); // exactly 25
    expect(risk({ isNewPatient: true, leadTimeHours: 15 * 24, hour: 8 }).level).toBe("low"); // 23
  });
});

describe("risk in the booking flow", () => {
  let p: Awaited<ReturnType<typeof createPractice>>;
  const at = (hh: number, mm = 0) => zonedToUtc(MONDAY, hh * 60 + mm, TZ);
  let seq = 3470000000;
  const who = (firstName: string) => ({ firstName, lastName: "Risk", phone: `+39${seq++}`, locale: "it" as const });

  beforeAll(async () => {
    p = await createPractice();
    await db
      .update(organizations)
      .set({ settings: { ...p.settings, privacy: { ...p.settings.privacy, riskBasedReminders: true } } })
      .where(eq(organizations.id, p.orgId));
  });

  it("is computed on booking, and a patient who objected to adaptive reminders has riskLevel null", async () => {
    const first = await createAppointment({
      orgId: p.orgId,
      serviceId: p.visit,
      practitionerId: p.drA,
      locationId: p.milano,
      startsAt: at(9),
      patient: who("Ottavio"),
      source: "staff",
      online: false,
      now: NOW,
    });
    // New patient: computed, with its reasons.
    expect(first.appointment.riskLevel).not.toBeNull();
    expect(first.appointment.riskReasons).toContain("new_patient");
    expect(first.appointment.riskComputedAt).toEqual(NOW);

    await db.transaction((tx) =>
      withdrawConsent(tx, {
        orgId: p.orgId,
        patientId: first.patient.id,
        purpose: "adaptive_reminders",
        locale: "it",
        method: "staff_recorded",
        source: "staff",
        now: NOW,
      }),
    );
    const second = await createAppointment({
      orgId: p.orgId,
      serviceId: p.visit,
      practitionerId: p.drA,
      locationId: p.milano,
      startsAt: at(10),
      patient: { id: first.patient.id },
      source: "staff",
      online: false,
      now: NOW,
    });
    expect(second.appointment.riskLevel).toBeNull();
    expect(second.appointment.riskReasons).toEqual([]);
    // The refresh clears the earlier one too.
    expect(await refreshAppointmentRisk(db, first.appointment.id, NOW)).toBeNull();
    const [row] = await db.select().from(appointments).where(eq(appointments.id, first.appointment.id));
    expect(row.riskLevel).toBeNull();
  });

  it("is not computed where the practice hasn't turned on risk-based reminders", async () => {
    const q = await createPractice();
    const d = await createAppointment({
      orgId: q.orgId,
      serviceId: q.visit,
      practitionerId: q.drA,
      locationId: q.milano,
      startsAt: at(9),
      patient: who("Pia"),
      source: "staff",
      online: false,
      now: NOW,
    });
    expect(d.appointment.riskLevel).toBeNull();
  });

  it("never changes availability: evaluateSlot and getAvailability are the same whatever the risk", async () => {
    const before = await getAvailability({ orgId: p.orgId, serviceId: p.visit, fromDate: MONDAY, days: 3, timezone: TZ, now: NOW });
    const ctxBefore = await loadAvailabilityContext({
      orgId: p.orgId,
      serviceId: p.visit,
      rangeStart: zonedToUtc(MONDAY, 0, TZ),
      rangeEnd: zonedToUtc("2030-03-07", 0, TZ),
    });
    // The riskiest patient imaginable, on every appointment of the practice.
    await db.update(appointments).set({ riskLevel: "high", riskReasons: ["no_show_history", "unconfirmed"] }).where(eq(appointments.orgId, p.orgId));
    await db.update(patients).set({ noShowCount: 9 }).where(eq(patients.orgId, p.orgId));
    const after = await getAvailability({ orgId: p.orgId, serviceId: p.visit, fromDate: MONDAY, days: 3, timezone: TZ, now: NOW });
    expect(after!.slots).toEqual(before!.slots);
    expect(after!.slots.length).toBeGreaterThan(0);

    const ctxAfter = await loadAvailabilityContext({
      orgId: p.orgId,
      serviceId: p.visit,
      rangeStart: zonedToUtc(MONDAY, 0, TZ),
      rangeEnd: zonedToUtc("2030-03-07", 0, TZ),
    });
    for (const slot of before!.slots.slice(0, 10)) {
      const input = { practitionerId: slot.practitionerId, locationId: slot.locationId, start: slot.start, enforcePolicy: true, requireWorkingHours: true, now: NOW };
      expect(evaluateSlot(ctxAfter!, input)).toEqual(evaluateSlot(ctxBefore!, input));
    }
  });
});

describe("loadCareFlags", () => {
  it("returns an entry for every id; ids of other practices get nothing", async () => {
    const p = await createPractice();
    const flags = await loadCareFlags(p.orgId, ["a1", "a2"], permissionsFor("reception"));
    expect([...flags.keys()]).toEqual(["a1", "a2"]);
    for (const f of flags.values()) expect(f).toEqual(NO_CARE_FLAGS);
    expect(flags.get("a1")).not.toBe(flags.get("a2"));
    expect((await loadCareFlags(p.orgId, [], permissionsFor("owner"))).size).toBe(0);
  });

  it("shows risk only where the practice uses it, and only for upcoming visits", async () => {
    const p = await createPractice();
    const d = await createAppointment({
      orgId: p.orgId,
      serviceId: p.visit,
      practitionerId: p.drA,
      locationId: p.milano,
      startsAt: zonedToUtc(MONDAY, 9 * 60, TZ),
      patient: { firstName: "Flag", lastName: "Test", phone: "+393480000001", locale: "it" },
      source: "staff",
      online: false,
      now: NOW,
    });
    await db.update(appointments).set({ riskLevel: "high", riskReasons: ["no_show_history", "bogus"] }).where(eq(appointments.id, d.appointment.id));
    // Off: hidden even though a value is stored.
    expect((await loadCareFlags(p.orgId, [d.appointment.id], permissionsFor("reception"))).get(d.appointment.id)!.riskLevel).toBeNull();
    await db
      .update(organizations)
      .set({ settings: { ...p.settings, privacy: { ...p.settings.privacy, riskBasedReminders: true } } })
      .where(eq(organizations.id, p.orgId));
    const on = (await loadCareFlags(p.orgId, [d.appointment.id], permissionsFor("reception"))).get(d.appointment.id)!;
    expect(on.riskLevel).toBe("high");
    expect(on.riskReasons).toEqual(["no_show_history"]); // unknown keys dropped
    // Another practice asking for this id gets nothing.
    const other = await createPractice();
    expect((await loadCareFlags(other.orgId, [d.appointment.id], permissionsFor("owner"))).get(d.appointment.id)).toEqual(NO_CARE_FLAGS);
  });
});
