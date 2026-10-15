import { and, asc, eq } from "drizzle-orm";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { appointments, messages, noticeVersions, organizations, reminders, waitlist, type OrgSettings, type ReminderRule } from "@/db/schema";
import { createPractice, MONDAY, NOW, TZ } from "@/test/fixtures";
import { cancelAppointment, createAppointment, type NewPatientInput } from "./booking";
import { appointmentLinks, getAppointmentDetails } from "./appointments";
import { newId } from "./ids";
import { recordConsent, withdrawConsent } from "./privacy/consent";
import { appointmentIcs, enqueueNow, processDueReminders, reminderRiskGate } from "./reminders";
import { addDays, zonedToUtc } from "./time";
import { joinWaitlist } from "./waitlist";

/** Set to make the next deliver() throw, as a failed insert into the message log would. */
const deliveryFailure = vi.hoisted(() => ({ error: null as Error | null }));
vi.mock("./messaging", async (importOriginal) => {
  const mod = await importOriginal<typeof import("./messaging")>();
  return {
    ...mod,
    deliver: async (...args: Parameters<typeof mod.deliver>) => {
      const error = deliveryFailure.error;
      if (error) {
        deliveryFailure.error = null;
        throw error;
      }
      return mod.deliver(...args);
    },
  };
});

type Practice = Awaited<ReturnType<typeof createPractice>>;

let seq = 3471000000;
let slot = 0;
const nextSlot = () => {
  const n = slot++;
  return zonedToUtc(addDays(MONDAY, 7 + Math.floor(n / 8)), 9 * 60 + (n % 8) * 30, TZ);
};
const person = (over: Partial<NewPatientInput> = {}): NewPatientInput => ({
  firstName: "Lucia",
  lastName: "Bassi",
  email: `lucia${seq}@example.com`,
  phone: `+39${seq++}`,
  locale: "it",
  ...over,
});

/** Booked by the front desk without a confirmation: only the timed reminders are queued. */
const book = (p: Practice, patient: NewPatientInput, startsAt = nextSlot()) =>
  createAppointment({
    orgId: p.orgId,
    serviceId: p.visit,
    practitionerId: p.drA,
    locationId: p.milano,
    startsAt,
    patient,
    source: "staff",
    online: false,
    notifyPatient: false,
    now: NOW,
  });

async function practiceWith(change: (s: OrgSettings) => OrgSettings): Promise<Practice> {
  const p = await createPractice();
  await db.update(organizations).set({ settings: change(p.settings) }).where(eq(organizations.id, p.orgId));
  return p;
}

const rule = (over: Partial<ReminderRule>): ReminderRule => ({
  id: "r24",
  channel: "sms",
  offsetMinutes: 24 * 60,
  askConfirmation: true,
  fallbackToEmail: false,
  ...over,
});

const reminderRows = (appointmentId: string) =>
  db.select().from(reminders).where(eq(reminders.appointmentId, appointmentId)).orderBy(asc(reminders.sendAt));
const sentTo = (appointmentId: string) =>
  db
    .select({ channel: messages.channel, to: messages.to, body: messages.body, subject: messages.subject })
    .from(messages)
    .where(and(eq(messages.appointmentId, appointmentId), eq(messages.direction, "outbound")))
    .orderBy(asc(messages.createdAt));
/** Just after the 24-hour reminder of an appointment is due. */
const dayBefore = (start: Date) => new Date(start.getTime() - 23 * 3_600_000);

let A: Practice;
let B: Practice;
beforeAll(async () => {
  A = await createPractice();
  B = await createPractice();
});
afterEach(() => vi.unstubAllEnvs());

describe("processDueReminders", () => {
  it("with an orgId sends only that practice's reminders and leaves the others pending", async () => {
    const start = nextSlot();
    const a = await book(A, person(), start);
    const b = await book(B, person(), start);
    const summary = await processDueReminders({ orgId: A.orgId, now: dayBefore(start) });
    expect(summary.sent).toBeGreaterThan(0);
    expect((await reminderRows(a.appointment.id)).filter((r) => r.status === "pending")).toHaveLength(1); // the 2-hour one
    expect((await reminderRows(b.appointment.id)).every((r) => r.status === "pending")).toBe(true);
    expect(await sentTo(b.appointment.id)).toHaveLength(0);

    await processDueReminders({ orgId: B.orgId, now: dayBefore(start) });
    expect((await sentTo(b.appointment.id)).length).toBeGreaterThan(0);
  });

  it("sends a discreet SMS: no treatment or practitioner", async () => {
    const start = nextSlot();
    const d = await book(A, person());
    await db.update(appointments).set({ startsAt: start }).where(eq(appointments.id, d.appointment.id));
    await enqueueNow(db, d.appointment.id, "reminder", "sms", dayBefore(start));
    await processDueReminders({ appointmentId: d.appointment.id, now: dayBefore(start) });
    const [sms] = (await sentTo(d.appointment.id)).filter((m) => m.channel === "sms");
    expect(sms.body).toMatch(/^Studio Test: promemoria appuntamento /);
    expect(sms.body).not.toContain("Visit");
    expect(sms.body).not.toContain("Anna A");
  });

  it("sends a child's reminders to the guardian's contacts", async () => {
    const start = nextSlot();
    const guardianPhone = `+39${seq++}`;
    const d = await book(
      A,
      person({ firstName: "Nina", birthDate: "2019-05-05", phone: `+39${seq++}`, email: "nina@example.com", guardianName: "Marco Bassi", guardianRelation: "parent", guardianPhone, guardianEmail: "marco@example.com" }),
      start,
    );
    await processDueReminders({ appointmentId: d.appointment.id, now: new Date(start.getTime() - 47 * 3_600_000) });
    await processDueReminders({ appointmentId: d.appointment.id, now: dayBefore(start) });
    const sent = await sentTo(d.appointment.id);
    expect(sent.map((m) => [m.channel, m.to])).toEqual([
      ["email", "marco@example.com"],
      ["sms", guardianPhone],
    ]);
  });

  it("sends nothing to a restricted or erased patient", async () => {
    const start = nextSlot();
    const d = await book(A, person(), start);
    const { patients } = await import("@/db/schema");
    await db.update(patients).set({ restrictedAt: NOW }).where(eq(patients.id, d.patient.id));
    await processDueReminders({ appointmentId: d.appointment.id, now: dayBefore(start) });
    expect(await sentTo(d.appointment.id)).toHaveLength(0);
    const rows = await reminderRows(d.appointment.id);
    expect(rows.filter((r) => r.status === "skipped").map((r) => r.error)).toEqual(["patient restricted", "patient restricted"]);
  });
});

describe("review requests", () => {
  it("are sent only with a current feedback_request consent", async () => {
    const without = await book(A, person());
    const withConsent = await book(A, person());
    await recordConsent(db, {
      orgId: A.orgId,
      patientId: withConsent.patient.id,
      purpose: "feedback_request",
      granted: true,
      locale: "it",
      method: "web_checkbox",
      source: "booking",
    });
    for (const d of [without, withConsent]) {
      await db.update(appointments).set({ status: "completed" }).where(eq(appointments.id, d.appointment.id));
      await enqueueNow(db, d.appointment.id, "review_request", "email", NOW);
      await processDueReminders({ appointmentId: d.appointment.id, now: NOW });
    }
    const [skipped] = (await reminderRows(without.appointment.id)).filter((r) => r.kind === "review_request");
    expect(skipped).toMatchObject({ status: "skipped", error: "no feedback_request consent" });
    expect(await sentTo(without.appointment.id)).toHaveLength(0);
    const [review] = await sentTo(withConsent.appointment.id);
    expect(review).toMatchObject({ channel: "email", subject: "Com'è andata da Studio Test?" });

    // A later withdrawal stops the next one.
    await withdrawConsent(db, {
      orgId: A.orgId,
      patientId: withConsent.patient.id,
      purpose: "feedback_request",
      locale: "it",
      method: "web_checkbox",
      source: "manage_link",
    });
    await enqueueNow(db, withConsent.appointment.id, "review_request", "email", NOW);
    await processDueReminders({ appointmentId: withConsent.appointment.id, now: NOW });
    expect(await sentTo(withConsent.appointment.id)).toHaveLength(1);
  });

  it("for a marketplace booking, stop once the patient withdrew Sorriso's booking consent (Sorriso's own invitation)", async () => {
    const d = await book(A, person());
    await db.update(appointments).set({ status: "completed", processingContext: "marketplace" }).where(eq(appointments.id, d.appointment.id));
    for (const [purpose, granted] of [["feedback_request", true], ["platform_booking_art9", true], ["platform_booking_art9", false]] as const) {
      await recordConsent(db, { orgId: A.orgId, patientId: d.patient.id, purpose, granted, locale: "it", method: "web_checkbox", source: "privacy_center" });
    }
    await enqueueNow(db, d.appointment.id, "review_request", "email", NOW);
    await processDueReminders({ appointmentId: d.appointment.id, now: NOW });
    const [skipped] = (await reminderRows(d.appointment.id)).filter((r) => r.kind === "review_request");
    expect(skipped).toMatchObject({ status: "skipped", error: "Sorriso's booking consent withdrawn" });
    expect(await sentTo(d.appointment.id)).toHaveLength(0);
  });
});

describe("risk-gated rules (onlyIfRisk)", () => {
  let R: Practice;
  beforeAll(async () => {
    R = await practiceWith((s) => ({
      ...s,
      reminders: { ...s.reminders, rules: [rule({ id: "rhigh", onlyIfRisk: "high" }), rule({ id: "r48", channel: "email", offsetMinutes: 48 * 60 })] },
      privacy: { ...s.privacy, riskBasedReminders: true },
    }));
  });

  const risky = async (risk: "low" | "medium" | "high" | null) => {
    const start = nextSlot();
    const d = await book(R, person(), start);
    await db.update(appointments).set({ riskLevel: risk }).where(eq(appointments.id, d.appointment.id));
    return { d, start };
  };

  it("schedules the gate with the reminder, in reminders.only_if_risk", async () => {
    const { d } = await risky("low");
    const rows = await reminderRows(d.appointment.id);
    expect(rows.map((r) => r.onlyIfRisk)).toEqual([null, "high"]);
    expect(rows.map((r) => reminderRiskGate(r))).toEqual([null, "high"]);
    // The id no longer carries it.
    expect(rows.every((r) => !r.id.includes(".risk-"))).toBe(true);
  });

  it("still honours a gate scheduled before the column existed (the old id suffix)", async () => {
    expect(reminderRiskGate({ id: "abc.risk-medium", onlyIfRisk: null })).toBe("medium");
    expect(reminderRiskGate({ id: "abc", onlyIfRisk: null })).toBeNull();
    // A legacy row whose id carries the gate but whose column was not backfilled.
    const { d, start } = await risky("low");
    const [gated] = (await reminderRows(d.appointment.id)).filter((r) => r.onlyIfRisk);
    await db.delete(reminders).where(eq(reminders.id, gated.id));
    await db.insert(reminders).values({ ...gated, id: `${gated.id}.risk-high`, onlyIfRisk: null });
    await processDueReminders({ appointmentId: d.appointment.id, now: dayBefore(start) });
    expect((await sentTo(d.appointment.id)).filter((m) => m.channel === "sms")).toHaveLength(0);
    expect((await reminderRows(d.appointment.id)).find((r) => r.id === `${gated.id}.risk-high`)).toMatchObject({
      status: "skipped",
      error: "only for high no-show risk",
    });
  });

  it("skips a high-risk-only rule for a low- or medium-risk appointment and sends it for a high one", async () => {
    for (const [risk, sent] of [["low", false], ["medium", false], [null, false], ["high", true]] as const) {
      const { d, start } = await risky(risk);
      await processDueReminders({ appointmentId: d.appointment.id, now: dayBefore(start) });
      const sms = (await sentTo(d.appointment.id)).filter((m) => m.channel === "sms");
      expect(sms.length, `risk ${risk}`).toBe(sent ? 1 : 0);
      if (!sent) {
        const gated = (await reminderRows(d.appointment.id)).find((r) => r.onlyIfRisk);
        expect(gated).toMatchObject({ status: "skipped", error: "only for high no-show risk" });
      }
    }
  });

  it("treats a patient who objected to adaptive reminders as no risk", async () => {
    const { d, start } = await risky("high");
    await withdrawConsent(db, {
      orgId: R.orgId,
      patientId: d.patient.id,
      purpose: "adaptive_reminders",
      locale: "it",
      method: "web_checkbox",
      source: "privacy_center",
    });
    await processDueReminders({ appointmentId: d.appointment.id, now: dayBefore(start) });
    expect((await sentTo(d.appointment.id)).filter((m) => m.channel === "sms")).toHaveLength(0);
  });

  it("treats every appointment as no risk while the practice has risk-based reminders off", async () => {
    const off = await practiceWith((s) => ({ ...s, reminders: { ...s.reminders, rules: [rule({ onlyIfRisk: "medium" })] } }));
    const start = nextSlot();
    const d = await book(off, person(), start);
    await db.update(appointments).set({ riskLevel: "high" }).where(eq(appointments.id, d.appointment.id));
    await processDueReminders({ appointmentId: d.appointment.id, now: dayBefore(start) });
    expect(await sentTo(d.appointment.id)).toHaveLength(0);
  });
});

describe("WhatsApp only with an approved template in the patient's language", () => {
  const SID = `HX${"a".repeat(32)}`;
  let W: Practice;
  beforeAll(async () => {
    W = await practiceWith((s) => ({ ...s, reminders: { ...s.reminders, rules: [rule({})] }, privacy: { ...s.privacy, whatsappEnabled: true } }));
  });

  const waPatient = async (p: Practice, locale: "it" | "en") => {
    const start = nextSlot();
    const d = await book(p, person({ preferredChannel: "whatsapp", locale }), start);
    await recordConsent(db, {
      orgId: p.orgId,
      patientId: d.patient.id,
      purpose: "whatsapp_channel",
      granted: true,
      locale,
      method: "web_checkbox",
      source: "booking",
    });
    return { d, start };
  };

  it("uses WhatsApp where a template exists and falls back to SMS where it doesn't", async () => {
    vi.stubEnv("TWILIO_WHATSAPP_CONTENT_SIDS", JSON.stringify({ reminder: { it: SID }, reminderAsk: { it: SID } }));
    const it = await waPatient(W, "it");
    const en = await waPatient(W, "en");
    for (const { d, start } of [it, en]) await processDueReminders({ appointmentId: d.appointment.id, now: dayBefore(start) });
    expect((await sentTo(it.d.appointment.id)).map((m) => m.channel)).toEqual(["whatsapp"]);
    const [fallback] = await sentTo(en.d.appointment.id);
    expect(fallback.channel).toBe("sms");
    expect(fallback.body).toMatch(/^Studio Test: appointment reminder /);
  });

  it("never uses WhatsApp where the practice has it off", async () => {
    vi.stubEnv("TWILIO_WHATSAPP_CONTENT_SIDS", JSON.stringify({ reminder: { it: SID }, reminderAsk: { it: SID } }));
    const off = await practiceWith((s) => ({ ...s, reminders: { ...s.reminders, rules: [rule({})] } }));
    const { d, start } = await waPatient(off, "it");
    await processDueReminders({ appointmentId: d.appointment.id, now: dayBefore(start) });
    expect((await sentTo(d.appointment.id)).map((m) => m.channel)).toEqual(["sms"]);
  });
});

describe("calendar invites", () => {
  it("say only 'Appointment – practice', the address and the phone, in the patient's language", async () => {
    const d = await book(A, person({ locale: "en" }));
    const details = (await getAppointmentDetails({ id: d.appointment.id }))!;
    const ics = appointmentIcs(details);
    expect(ics).toContain("SUMMARY:Appointment – Studio Test");
    expect(ics).toContain("DESCRIPTION:Via Roma 1\\, Milano");
    expect(ics).not.toMatch(/Visit|Anna A|\/a\/|URL:/);
    const it = appointmentIcs({ ...details, patient: { ...details.patient, locale: "it" } });
    expect(it).toContain("SUMMARY:Appuntamento – Studio Test");
  });

  it("are served with no-store, and only for a valid token", async () => {
    const d = await book(A, person());
    const { GET } = await import("@/app/api/ics/appointment/[token]/route");
    const get = (token: string) =>
      GET(new Request(`https://sorriso.test/api/ics/appointment/${token}`, { headers: { "x-real-ip": "203.0.113.9" } }), {
        params: Promise.resolve({ token }),
      });
    const ok = await get(d.appointment.manageTokenEnc!);
    expect(ok.status).toBe(200);
    expect(ok.headers.get("Cache-Control")).toContain("no-store");
    expect(await ok.text()).toContain("SUMMARY:Appuntamento – Studio Test");
    const missing = await get("not-a-token");
    expect(missing.status).toBe(404);
    expect(missing.headers.get("Cache-Control")).toContain("no-store");
    // Expired: 60 days after the visit.
    await db
      .update(appointments)
      .set({ endsAt: new Date(Date.now() - 61 * 86_400_000), startsAt: new Date(Date.now() - 61 * 86_400_000 - 1_800_000) })
      .where(eq(appointments.id, d.appointment.id));
    expect((await get(d.appointment.manageTokenEnc!)).status).toBe(404);
  });
});

describe("failures", () => {
  it("store no contact, name or message text in reminders.error", async () => {
    const start = nextSlot();
    const d = await book(A, person({ firstName: "Ottavia", lastName: "Quercia" }), start);
    const phone = d.patient.phone!;
    const email = d.patient.email!;
    // DrizzleQueryError's message ends with the bound values.
    deliveryFailure.error = new Error(
      `Failed query: insert into "messages" ("id", "to", "body") values (?, ?, ?)\nparams: m1,${phone},Ottavia Quercia: promemoria per ${email}`,
    );
    await processDueReminders({ appointmentId: d.appointment.id, now: dayBefore(start) });
    const [failed] = (await reminderRows(d.appointment.id)).filter((r) => r.error);
    expect(failed.status).toBe("pending"); // retried later
    expect(failed.error).toContain("params: [redacted]");
    for (const secret of [phone, email, "Ottavia", "Quercia", "promemoria"]) expect(failed.error).not.toContain(secret);

    // A provider-style message quoting the recipient is masked too.
    const later = nextSlot();
    const e = await book(A, person(), later);
    deliveryFailure.error = new Error(`Twilio 400: The 'To' number ${e.patient.phone} is not valid`);
    await processDueReminders({ appointmentId: e.appointment.id, now: dayBefore(later) });
    const [masked] = (await reminderRows(e.appointment.id)).filter((r) => r.error);
    expect(masked.error).toMatch(/^Twilio 400: The 'To' number \+39•••\d{4} is not valid$/);
  });
});

describe("the privacy-choices link without a manage link", () => {
  it("opens the privacy center in the patient's language", async () => {
    const d = await book(A, person({ locale: "de" }));
    const details = (await getAppointmentDetails({ id: d.appointment.id }))!;
    const appointment = { ...details.appointment, manageTokenEnc: null };
    expect(appointmentLinks({ ...details, appointment }).preferencesUrl).toBe("https://sorriso.test/de/privacy");
    // Without the patient: the practice's language.
    expect(appointmentLinks({ appointment, org: details.org }).preferencesUrl).toBe(`https://sorriso.test/${details.org.defaultLocale}/privacy`);
    expect(appointmentLinks(details).preferencesUrl).toBe(`https://sorriso.test/a/${d.appointment.manageTokenEnc}/privacy`);
  });

  it("is in the patient's language in a waiting-list offer", async () => {
    const W = await createPractice();
    const start = nextSlot();
    const cancelled = await book(W, person(), start);
    const waiting = await book(W, person({ firstName: "Wanda", locale: "de", preferredChannel: "email" }), nextSlot());
    await db
      .insert(waitlist)
      .values({ id: newId(), orgId: W.orgId, patientId: waiting.patient.id, serviceId: W.visit, earliestDate: MONDAY, latestDate: addDays(MONDAY, 30) });
    await cancelAppointment(cancelled.appointment.id, { by: "staff", now: NOW });
    const [offer] = await db
      .select({ channel: messages.channel, html: messages.html })
      .from(messages)
      .where(and(eq(messages.patientId, waiting.patient.id), eq(messages.channel, "email")));
    expect(offer.html).toContain('href="https://sorriso.test/de/privacy"');
    expect(offer.html).not.toContain('href="https://sorriso.test/privacy"');
  });
});

describe("joinWaitlist", () => {
  it("records the notices the waitlist form showed, in its language; an entry made without the form records none", async () => {
    const W = await createPractice();
    const shown = () => db.select().from(noticeVersions).where(eq(noticeVersions.orgId, W.orgId));
    const entry = (privacy?: Parameters<typeof joinWaitlist>[0]["privacy"]) =>
      joinWaitlist({
        orgId: W.orgId,
        serviceId: W.visit,
        earliestDate: MONDAY,
        latestDate: addDays(MONDAY, 14),
        partOfDay: "any",
        patient: person({ locale: "pl" }),
        privacy,
        now: NOW,
      });
    await entry();
    expect(await shown()).toEqual([]);
    await entry({
      choices: { feedback: false },
      noticeVersion: null,
      locale: "pl",
      source: "waitlist",
    });
    expect((await shown()).map((n) => [n.kind, n.locale])).toEqual([["practice_patient", "pl"]]);
  });
});
