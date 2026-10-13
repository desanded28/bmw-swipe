import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { appointments, patients, reminders } from "@/db/schema";
import { createPractice, MONDAY, NOW, TZ } from "@/test/fixtures";
import { cancelAppointment, createAppointment, rescheduleAppointment, setOutcome, upsertPatient } from "./booking";
import { buildIcs } from "./ics";
import { handleInboundMessage } from "./inbound";
import { zonedToUtc } from "./time";

let a: Awaited<ReturnType<typeof createPractice>>;
let b: Awaited<ReturnType<typeof createPractice>>;
const at = (hh: number, mm = 0) => zonedToUtc(MONDAY, hh * 60 + mm, TZ);
let seq = 3500000000;
const person = (o: Record<string, unknown> = {}) => ({ firstName: "Vera", lastName: "Neri", phone: `+39${seq++}`, email: `vera${seq}@example.com`, ...o });

beforeAll(async () => {
  a = await createPractice();
  b = await createPractice();
});

describe("tenant isolation and tampering", () => {
  it("public bookings never modify an existing patient's contact details", async () => {
    const victim = person();
    const first = await createAppointment({ orgId: a.orgId, serviceId: a.visit, practitionerId: a.drA, locationId: a.milano, startsAt: at(9), patient: victim, source: "online", online: true, now: NOW });
    // Same first name + phone, attacker's email and opt-outs
    const res = await db.transaction((tx) =>
      upsertPatient(tx, a.orgId, { firstName: "Vera", lastName: "X", phone: victim.phone, email: "attacker@example.com", smsOptIn: false }, "public"),
    );
    expect(res.created).toBe(true);
    const [original] = await db.select().from(patients).where(eq(patients.id, first.patient.id));
    expect(original.email).toBe(victim.email);
    expect(original.smsOptIn).toBe(true);
    // An exact match on everything given is reused (returning patient), still unmodified.
    const again = await db.transaction((tx) => upsertPatient(tx, a.orgId, { firstName: "vera", lastName: "Neri", phone: victim.phone, locale: "en" }, "public"));
    expect(again.patient.id).toBe(first.patient.id);
    expect(again.patient.locale).toBe("it");
  });

  it("the reply simulator only touches the practice's own appointments", async () => {
    const shared = person({ firstName: "Ugo" });
    const d = await createAppointment({ orgId: b.orgId, serviceId: b.visit, practitionerId: b.drA, locationId: b.milano, startsAt: at(10), patient: shared, source: "online", online: true, now: NOW });
    // Practice A creates a patient with the same number and "simulates" a NO.
    await db.transaction((tx) => upsertPatient(tx, a.orgId, { ...shared }, "staff"));
    const res = await handleInboundMessage({ channel: "sms", from: shared.phone, body: "NO", replyMode: "deliver", orgId: a.orgId, now: NOW });
    expect(res.appointmentId).toBeNull();
    const [row] = await db.select().from(appointments).where(eq(appointments.id, d.appointment.id));
    expect(row.status).toBe("scheduled");
    const [bPatient] = await db.select().from(patients).where(eq(patients.id, d.patient.id));
    expect(bPatient.smsOptIn).toBe(true);
  });

  it("force-booking can't use another practice's practitioner or another office's chair", async () => {
    const base = { orgId: a.orgId, serviceId: a.visit, locationId: a.milano, startsAt: at(11), patient: person(), source: "staff" as const, online: false, force: true, now: NOW };
    await expect(createAppointment({ ...base, practitionerId: b.drA })).rejects.toMatchObject({ code: "not_found" });
    await expect(createAppointment({ ...base, practitionerId: a.drA, roomId: a.chairMonza })).rejects.toMatchObject({ code: "not_found" });
    await expect(createAppointment({ ...base, practitionerId: a.drA, roomId: b.chair1 })).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("status races", () => {
  it("counts a double-clicked no-show once", async () => {
    const d = await createAppointment({ orgId: a.orgId, serviceId: a.visit, practitionerId: a.drB, locationId: a.milano, startsAt: at(9), patient: person({ firstName: "Lia" }), source: "staff", online: false, now: NOW });
    await Promise.all([setOutcome(d.appointment.id, "no_show", NOW), setOutcome(d.appointment.id, "no_show", NOW)]);
    const [p] = await db.select().from(patients).where(eq(patients.id, d.patient.id));
    expect(p.noShowCount).toBe(1);
  });

  it("doesn't move an appointment that was cancelled meanwhile", async () => {
    const d = await createAppointment({ orgId: a.orgId, serviceId: a.visit, practitionerId: a.drB, locationId: a.milano, startsAt: at(10), patient: person({ firstName: "Rita" }), source: "staff", online: false, now: NOW });
    await cancelAppointment(d.appointment.id, { by: "patient", notifyPatient: false, now: NOW });
    await expect(rescheduleAppointment(d.appointment.id, { startsAt: at(11), by: "staff", now: NOW })).rejects.toMatchObject({ code: "not_allowed" });
    const [row] = await db.select().from(appointments).where(eq(appointments.id, d.appointment.id));
    expect(row.startsAt.toISOString()).toBe(at(10).toISOString());
  });

  it("undoing a mistaken outcome brings the reminders back", async () => {
    const d = await createAppointment({ orgId: a.orgId, serviceId: a.visit, practitionerId: a.drC, locationId: a.milano, startsAt: at(12), patient: person({ firstName: "Elio" }), source: "staff", online: false, now: NOW });
    const pending = () =>
      db.select().from(reminders).where(and(eq(reminders.appointmentId, d.appointment.id), eq(reminders.status, "pending"), eq(reminders.kind, "reminder")));
    expect(await pending()).toHaveLength(3);
    await setOutcome(d.appointment.id, "completed", NOW);
    expect(await pending()).toHaveLength(0);
    await setOutcome(d.appointment.id, "scheduled", NOW);
    expect(await pending()).toHaveLength(3);
  });
});

describe("ics", () => {
  it("escapes separators and line breaks", () => {
    const ics = buildIcs({ name: "T", events: [{ uid: "1", start: new Date(0), end: new Date(60_000), summary: "a;b,c\\d\re\nf" }] });
    expect(ics).toContain(String.raw`SUMMARY:a\;b\,c\\d\ne\nf`);
  });
});
