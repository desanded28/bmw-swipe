import { and, eq, isNull } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { messages, organizations, patients, recalls, services, users } from "@/db/schema";
import { createPractice, MONDAY, NOW, TZ } from "@/test/fixtures";
import { cancelAppointment, createAppointment, setOutcome } from "./booking";
import { newId } from "./ids";
import { withdrawConsent } from "./privacy/consent";
import { addMonthsToDate, processDueRecalls, recallDashboard, setRecallInterval, upsertRecall } from "./recalls";
import { zonedToUtc } from "./time";

let p: Awaited<ReturnType<typeof createPractice>>;
let clinician: string;
const at = (date: string, hh: number, mm = 0) => zonedToUtc(date, hh * 60 + mm, TZ);
const AFTER_VISIT = new Date("2030-03-04T15:00:00Z");
const DAY = 86_400_000;
let seq = 3480000000;
const who = (firstName: string, extra: Record<string, unknown> = {}) => ({
  firstName,
  lastName: "Recall",
  phone: `+39${seq++}`,
  email: `${firstName.toLowerCase()}${seq}@example.com`,
  locale: "it" as const,
  ...extra,
});

/** A completed cleaning on MONDAY at `hh` for a new patient; returns the appointment details. */
async function completedCleaning(firstName: string, hh: number, extra: Record<string, unknown> = {}, practice = p) {
  const d = await createAppointment({
    orgId: practice.orgId,
    serviceId: practice.cleaning,
    practitionerId: practice.drA,
    locationId: practice.milano,
    startsAt: at(MONDAY, hh),
    patient: who(firstName, extra),
    source: "staff",
    online: false,
    force: true,
    now: NOW,
  });
  await setOutcome(d.appointment.id, "completed", AFTER_VISIT);
  return d;
}

const recallOf = async (appointmentId: string) =>
  (await db.select().from(recalls).where(eq(recalls.sourceAppointmentId, appointmentId)))[0];
const recallMessages = (patientId: string) =>
  db.select().from(messages).where(and(eq(messages.patientId, patientId), isNull(messages.appointmentId)));

beforeAll(async () => {
  p = await createPractice();
  await db.update(services).set({ recallMonths: 6 }).where(eq(services.id, p.cleaning));
  clinician = newId();
  await db.insert(users).values({ id: clinician, email: `dr-${clinician}@example.com`, name: "Dr Recall", passwordHash: "x" });
});

describe("addMonthsToDate", () => {
  it.each([
    ["2030-03-04", 6, "2030-09-04"],
    ["2030-01-31", 1, "2030-02-28"],
    ["2031-08-31", 6, "2032-02-29"],
    ["2030-11-15", 3, "2031-02-15"],
    ["2030-03-04", 24, "2032-03-04"],
  ])("%s + %i months = %s", (date, months, expected) => {
    expect(addMonthsToDate(date, months)).toBe(expected);
  });
});

describe("recall on completion", () => {
  it("completing a hygiene visit with recallMonths 6 creates a recall due 6 months after the visit", async () => {
    const d = await completedCleaning("Rita", 9);
    const r = await recallOf(d.appointment.id);
    expect(r).toMatchObject({
      orgId: p.orgId,
      patientId: d.patient.id,
      serviceId: p.cleaning,
      dueDate: "2030-09-04",
      intervalMonths: 6,
      status: "due",
      attempts: 0,
      // Only a suggestion until a clinician confirms it.
      setByUserId: null,
      reasonCode: "hygiene",
    });
  });

  it("booking the same treatment marks it booked; cancelling that booking opens it again", async () => {
    const d = await completedCleaning("Bruna", 10);
    const next = await createAppointment({
      orgId: p.orgId,
      serviceId: p.cleaning,
      practitionerId: p.drA,
      locationId: p.milano,
      startsAt: at("2030-09-02", 9),
      patient: { id: d.patient.id },
      source: "staff",
      online: false,
      now: AFTER_VISIT,
    });
    let r = await recallOf(d.appointment.id);
    expect(r.status).toBe("booked");
    expect(r.bookedAppointmentId).toBe(next.appointment.id);

    await cancelAppointment(next.appointment.id, { by: "patient", now: AFTER_VISIT, notifyPatient: false });
    r = await recallOf(d.appointment.id);
    expect(r.status).toBe("due");
    expect(r.bookedAppointmentId).toBeNull();
  });

  it("a visit set back from completed takes its unsent recall back", async () => {
    const d = await completedCleaning("Ugo", 11);
    expect(await recallOf(d.appointment.id)).toBeDefined();
    await setOutcome(d.appointment.id, "scheduled", AFTER_VISIT);
    expect(await recallOf(d.appointment.id)).toBeUndefined();
  });

  it("the clinician's interval wins and carries over to the next visit for the same treatment", async () => {
    const d = await completedCleaning("Carla", 12);
    const set = await setRecallInterval({ orgId: p.orgId, appointmentId: d.appointment.id, months: 9, actor: { userId: clinician }, now: AFTER_VISIT });
    expect(set).toMatchObject({ intervalMonths: 9, dueDate: "2030-12-04", setByUserId: clinician, status: "due" });

    // Next cleaning, completed later: same recall row, new due date, the clinician's 9 months kept.
    const again = await createAppointment({
      orgId: p.orgId,
      serviceId: p.cleaning,
      practitionerId: p.drA,
      locationId: p.milano,
      startsAt: at("2030-12-02", 9),
      patient: { id: d.patient.id },
      source: "staff",
      online: false,
      force: true,
      now: AFTER_VISIT,
    });
    await setOutcome(again.appointment.id, "completed", new Date("2030-12-02T12:00:00Z"));
    const open = await db.select().from(recalls).where(and(eq(recalls.patientId, d.patient.id), eq(recalls.status, "due")));
    expect(open).toHaveLength(1);
    expect(open[0]).toMatchObject({ sourceAppointmentId: again.appointment.id, intervalMonths: 9, dueDate: "2031-09-02", setByUserId: clinician });
  });

  it("no service suggestion and no clinician choice: no recall", async () => {
    const d = await createAppointment({
      orgId: p.orgId,
      serviceId: p.visit,
      practitionerId: p.drB,
      locationId: p.milano,
      startsAt: at(MONDAY, 9),
      patient: who("Nadia"),
      source: "staff",
      online: false,
      force: true,
      now: NOW,
    });
    await setOutcome(d.appointment.id, "completed", AFTER_VISIT);
    expect(await recallOf(d.appointment.id)).toBeUndefined();
    expect(await db.transaction((tx) => upsertRecall(tx, { orgId: p.orgId, appointmentId: d.appointment.id }))).toBeNull();
  });
});

describe("processDueRecalls", () => {
  const due = new Date("2030-09-05T08:00:00Z");
  const run = (now: Date, practice = p) => processDueRecalls(now, { orgId: practice.orgId });

  it("sends at most recallMaxAttempts messages, then sets status 'call'; messages name no treatment", async () => {
    const d = await completedCleaning("Marta", 9, { lastName: "Pulizia" });
    await setRecallInterval({ orgId: p.orgId, appointmentId: d.appointment.id, months: 6, actor: { userId: clinician }, now: AFTER_VISIT });

    expect((await run(due)).sent).toBeGreaterThanOrEqual(1);
    expect(await recallMessages(d.patient.id)).toHaveLength(1);
    expect((await recallOf(d.appointment.id)).status).toBe("sent");

    // Not again before two weeks.
    await run(new Date(due.getTime() + DAY));
    expect(await recallMessages(d.patient.id)).toHaveLength(1);

    await run(new Date(due.getTime() + 15 * DAY));
    expect(await recallMessages(d.patient.id)).toHaveLength(2);
    const r = await recallOf(d.appointment.id);
    expect(r).toMatchObject({ status: "sent", attempts: 2 });

    // Default recallMaxAttempts is 2: then the front desk calls.
    await run(new Date(due.getTime() + 30 * DAY));
    expect((await recallOf(d.appointment.id)).status).toBe("call");
    await run(new Date(due.getTime() + 60 * DAY));
    expect(await recallMessages(d.patient.id)).toHaveLength(2);

    for (const m of await recallMessages(d.patient.id)) {
      const text = `${m.subject ?? ""} ${m.body} ${m.html ?? ""}`;
      expect(text).not.toMatch(/cleaning|hygiene|igiene|pulizia/i);
      expect(m.body).toContain(`/book/test-`);
      expect(m.body).toContain("via=recall");
      expect(m.body).toContain("ref=");
      // The opt-out: the privacy center, where the patient can object to recalls.
      expect(m.body).toContain("/privacy");
    }
  });

  it("never sends a suggestion no clinician confirmed", async () => {
    const d = await completedCleaning("Silvia", 10);
    await run(due);
    expect(await recallMessages(d.patient.id)).toHaveLength(0);
    expect((await recallOf(d.appointment.id)).status).toBe("due");
  });

  it("a restricted patient gets none", async () => {
    const d = await completedCleaning("Renata", 11);
    await setRecallInterval({ orgId: p.orgId, appointmentId: d.appointment.id, months: 6, actor: { userId: clinician }, now: AFTER_VISIT });
    await db.update(patients).set({ restrictedAt: AFTER_VISIT, restrictionReason: "Art. 18 request" }).where(eq(patients.id, d.patient.id));
    await run(due);
    await run(new Date(due.getTime() + 40 * DAY));
    expect(await recallMessages(d.patient.id)).toHaveLength(0);
    expect((await recallOf(d.appointment.id)).status).toBe("due");
  });

  it("an objection to recalls stops them for good", async () => {
    const d = await completedCleaning("Olga", 12);
    await setRecallInterval({ orgId: p.orgId, appointmentId: d.appointment.id, months: 6, actor: { userId: clinician }, now: AFTER_VISIT });
    await db.transaction((tx) =>
      withdrawConsent(tx, { orgId: p.orgId, patientId: d.patient.id, purpose: "recalls", locale: "it", method: "staff_recorded", source: "staff" }),
    );
    await run(due);
    expect(await recallMessages(d.patient.id)).toHaveLength(0);
    expect((await recallOf(d.appointment.id)).status).toBe("dismissed");
  });

  it("goes to the guardian for a child under 14", async () => {
    const d = await completedCleaning("Bimbo", 9, {
      phone: null,
      email: null,
      birthDate: "2024-05-01",
      guardianName: "Mamma Bimbo",
      guardianRelation: "parent",
      guardianPhone: "+393489999123",
    });
    await setRecallInterval({ orgId: p.orgId, appointmentId: d.appointment.id, months: 6, actor: { userId: clinician }, now: AFTER_VISIT });
    await run(due);
    const sent = await recallMessages(d.patient.id);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("+393489999123");
  });

  it("an upcoming visit for the same treatment books the recall instead of messaging", async () => {
    const d = await completedCleaning("Lia", 10);
    await setRecallInterval({ orgId: p.orgId, appointmentId: d.appointment.id, months: 6, actor: { userId: clinician }, now: AFTER_VISIT });
    const next = await createAppointment({
      orgId: p.orgId,
      serviceId: p.cleaning,
      practitionerId: p.drA,
      locationId: p.milano,
      startsAt: at("2030-09-20", 9),
      patient: { id: d.patient.id },
      source: "staff",
      online: false,
      force: true,
      now: AFTER_VISIT,
    });
    // As if the visit had been booked before the recall existed (markRecallBooked never saw it).
    await db.update(recalls).set({ status: "due", bookedAppointmentId: null }).where(eq(recalls.sourceAppointmentId, d.appointment.id));
    await run(due);
    expect(await recallMessages(d.patient.id)).toHaveLength(0);
    expect(await recallOf(d.appointment.id)).toMatchObject({ status: "booked", bookedAppointmentId: next.appointment.id });
  });

  it("parallel runs send each recall once (lease)", async () => {
    const q = await createPractice();
    await db.update(services).set({ recallMonths: 6 }).where(eq(services.id, q.cleaning));
    const d = await completedCleaning("Lease", 9, {}, q);
    await setRecallInterval({ orgId: q.orgId, appointmentId: d.appointment.id, months: 6, actor: { userId: clinician }, now: AFTER_VISIT });
    const [a, b] = await Promise.all([run(due, q), run(due, q)]);
    expect(a.sent + b.sent).toBe(1);
    expect(await recallMessages(d.patient.id)).toHaveLength(1);
  });

  it("does nothing where the practice turned recalls off", async () => {
    const q = await createPractice();
    await db.update(services).set({ recallMonths: 6 }).where(eq(services.id, q.cleaning));
    await db.update(organizations).set({ settings: { ...q.settings, care: { ...q.settings.care, recallsEnabled: false } } }).where(eq(organizations.id, q.orgId));
    const d = await completedCleaning("Spento", 9, {}, q);
    await setRecallInterval({ orgId: q.orgId, appointmentId: d.appointment.id, months: 6, actor: { userId: clinician }, now: AFTER_VISIT });
    expect(await run(due, q)).toEqual({ sent: 0, toCall: 0, booked: 0, dismissed: 0 });
    expect(await recallMessages(d.patient.id)).toHaveLength(0);
  });
});

describe("recallDashboard", () => {
  it("lists recalls by section and counts conversions", async () => {
    const q = await createPractice();
    await db.update(services).set({ recallMonths: 6 }).where(eq(services.id, q.cleaning));
    const confirmed = await completedCleaning("Uno", 9, {}, q);
    await setRecallInterval({ orgId: q.orgId, appointmentId: confirmed.appointment.id, months: 6, actor: { userId: clinician }, now: AFTER_VISIT });
    await completedCleaning("Due", 10, {}, q);
    const board = await recallDashboard(q.orgId, TZ, new Date("2030-08-20T08:00:00Z"), { contacts: false });
    expect(board.dueSoon.map((r) => r.patientName)).toEqual(["Uno Recall"]);
    expect(board.awaitingClinician.map((r) => r.patientName)).toEqual(["Due Recall"]);
    expect(board.dueSoon[0].phone).toBeNull();
    const later = await recallDashboard(q.orgId, TZ, new Date("2030-09-20T08:00:00Z"), { contacts: true });
    expect(later.overdue.map((r) => r.patientName)).toEqual(["Uno Recall"]);
    expect(later.overdue[0].phone).toMatch(/^\+39/);
    expect(later.stats.due).toBe(1);
  });
});
