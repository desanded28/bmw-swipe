import { and, desc, eq } from "drizzle-orm";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import type { MembershipRole } from "@/db/enums";
import { appointments, auditLog, messages, organizations, patients, reminders } from "@/db/schema";
import type { StaffSession } from "@/lib/auth";
import { createAppointment } from "@/lib/booking";
import { newId } from "@/lib/ids";
import { grantRestrictedAccess } from "@/lib/privacy/erasure";
import { resolveSettings } from "@/lib/settings";
import { zonedToUtc } from "@/lib/time";
import { createPractice, MONDAY, NOW, TZ } from "@/test/fixtures";
import { appointmentMessages, simulateReply } from "./messages";
import { runRemindersNow, saveInboundNumber, saveReminderSettings } from "./reminders";

/** The reminders and messages actions (WP3): permissions, practice scoping and what they store. */

const state = vi.hoisted(() => ({ session: null as StaffSession | null }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth")>()),
  requireStaff: async () => {
    if (!state.session) throw new Error("no session in test");
    return state.session;
  },
}));
vi.mock("@/i18n/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/i18n/server")>()),
  getStaffLocale: async () => "en",
}));

let A: Awaited<ReturnType<typeof createPractice>>;
let B: Awaited<ReturnType<typeof createPractice>>;

async function signIn(role: MembershipRole, orgId = A.orgId) {
  const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
  state.session = {
    sessionId: "s1",
    user: { id: `user-${role}`, name: "Test", email: "t@example.com", isPlatformAdmin: false, locale: "en" },
    org,
    role,
    orgs: [{ org, role }],
  } as StaffSession;
}

const settingsOf = async (orgId: string) =>
  resolveSettings((await db.select().from(organizations).where(eq(organizations.id, orgId)))[0].settings);

beforeAll(async () => {
  A = await createPractice();
  B = await createPractice();
});
afterEach(() => vi.unstubAllEnvs());

describe("saveReminderSettings", () => {
  it("stores onlyIfRisk per rule and the ASCII fallback", async () => {
    await signIn("admin");
    const res = await saveReminderSettings({
      rules: [
        { id: "r24", channel: "sms", offsetMinutes: 1440, askConfirmation: true, fallbackToEmail: true },
        { id: "r3 <x>", channel: "sms", offsetMinutes: 180, askConfirmation: false, fallbackToEmail: false, onlyIfRisk: "high" },
      ],
      sendBookingConfirmation: true,
      requestReviews: false,
      autoOfferToWaitlist: true,
      smsAsciiFallback: true,
    });
    expect(res).toMatchObject({ ok: true, message: "Reminder rules saved. They apply to new bookings and anything you reschedule." });
    const s = await settingsOf(A.orgId);
    expect(s.reminders.rules).toEqual([
      { id: "r24", channel: "sms", offsetMinutes: 1440, askConfirmation: true, fallbackToEmail: true },
      { id: "r3x", channel: "sms", offsetMinutes: 180, askConfirmation: false, fallbackToEmail: false, onlyIfRisk: "high" },
    ]);
    expect(s.reminders).toMatchObject({ smsAsciiFallback: true, requestReviews: false });
  });

  it("is refused without reminders.manage", async () => {
    await signIn("reception");
    const res = await saveReminderSettings({ rules: [], sendBookingConfirmation: true, requestReviews: true, autoOfferToWaitlist: true });
    expect(res).toMatchObject({ ok: false, code: "forbidden" });
  });
});

describe("runRemindersNow", () => {
  it("needs reminders.run and sends only the signed-in practice's reminders", async () => {
    const start = zonedToUtc(MONDAY, 10 * 60, TZ);
    const book = (orgId: string, p: typeof A) =>
      createAppointment({
        orgId,
        serviceId: p.visit,
        practitionerId: p.drA,
        locationId: p.milano,
        startsAt: start,
        patient: { firstName: "Rita", lastName: "Neri", phone: `+3934${Math.floor(Math.random() * 1e8)}` },
        source: "staff",
        online: false,
        notifyPatient: false,
        now: NOW,
      });
    const a = await book(A.orgId, A);
    const b = await book(B.orgId, B);
    // Due now: move the reminders into the past.
    for (const id of [a.appointment.id, b.appointment.id]) {
      await db.update(reminders).set({ sendAt: new Date(Date.now() - 60_000) }).where(eq(reminders.appointmentId, id));
      await db.update(appointments).set({ startsAt: new Date(Date.now() + 86_400_000), endsAt: new Date(Date.now() + 88_200_000) }).where(eq(appointments.id, id));
    }
    await signIn("reception");
    expect(await runRemindersNow()).toMatchObject({ ok: false, code: "forbidden" });
    await signIn("owner");
    const res = await runRemindersNow();
    expect(res.ok && res.message).toMatch(/^Processed \d+ due reminders?: /);
    const pending = async (id: string) =>
      (await db.select().from(reminders).where(and(eq(reminders.appointmentId, id), eq(reminders.status, "pending")))).length;
    expect(await pending(a.appointment.id)).toBe(0);
    expect(await pending(b.appointment.id)).toBeGreaterThan(0);
    // The run is on the practice's access log, with its counts (no names or contacts).
    const [entry] = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.orgId, A.orgId), eq(auditLog.actorId, "user-owner"), eq(auditLog.entityType, "org")))
      .orderBy(desc(auditLog.seq));
    expect(entry).toMatchObject({ action: "reminders.run", entityId: A.orgId });
    expect(entry.metadata).toMatchObject({ due: expect.any(Number), sent: expect.any(Number), skipped: expect.any(Number), failed: expect.any(Number) });
  });
});

describe("saveInboundNumber", () => {
  it("lets only the owner set the practice's reply number, normalised and unique", async () => {
    await signIn("admin");
    expect(await saveInboundNumber("+39 02 1234 5678")).toMatchObject({ ok: false, code: "forbidden" });
    await signIn("owner");
    expect(await saveInboundNumber("02 1234")).toMatchObject({ ok: false, code: "invalid" });
    expect(await saveInboundNumber("+39 02 1234 5678")).toMatchObject({ ok: true });
    const [org] = await db.select().from(organizations).where(eq(organizations.id, A.orgId));
    expect(org.inboundNumber).toBe("+390212345678");
    await signIn("owner", B.orgId);
    expect(await saveInboundNumber("+390212345678")).toMatchObject({ ok: false, code: "taken" });
    const service = `MG${"a".repeat(32)}`;
    expect(await saveInboundNumber(service)).toMatchObject({ ok: true });
    expect(await saveInboundNumber("")).toMatchObject({ ok: true, message: expect.stringContaining("removed") });
  });

  it("refuses the platform's shared senders, however they are written", async () => {
    const service = `MG${"b".repeat(32)}`;
    vi.stubEnv("TWILIO_FROM", "+390200000099");
    vi.stubEnv("TWILIO_MESSAGING_SERVICE_SID", service);
    vi.stubEnv("TWILIO_WHATSAPP_FROM", "whatsapp:+14155238886");
    vi.stubEnv("TWILIO_SHARED_SENDERS", "+390200000098, +390200000097");
    await signIn("owner", B.orgId);
    for (const value of ["+39 02 0000 0099", "0039 0200000099", service, service.toUpperCase(), "+1 415 523 8886", "+390200000097"]) {
      expect(await saveInboundNumber(value), value).toMatchObject({ ok: false, code: "shared" });
    }
    const [org] = await db.select().from(organizations).where(eq(organizations.id, B.orgId));
    expect(org.inboundNumber).toBeNull();
    // A Messaging Service of the practice's own is stored as Twilio writes it.
    expect(await saveInboundNumber(`MG${"C".repeat(32)}`)).toMatchObject({ ok: true });
    expect((await db.select().from(organizations).where(eq(organizations.id, B.orgId)))[0].inboundNumber).toBe(`MG${"c".repeat(32)}`);
    await saveInboundNumber("");
  });
});

describe("simulateReply", () => {
  it("works only in demo mode, with messages.simulate, for the practice's own patients", async () => {
    await signIn("reception");
    expect(await simulateReply("+393330000000", "SI", "sms")).toMatchObject({ ok: false, code: "forbidden" });
    await signIn("owner");
    vi.stubEnv("DEMO_MODE", "");
    expect(await simulateReply("+393330000000", "SI", "sms")).toMatchObject({ ok: false, code: "not_available" });
    vi.stubEnv("DEMO_MODE", "1");
    expect(await simulateReply("+393330000000", "SI", "sms")).toMatchObject({ ok: false, code: "not_found" });
    const d = await createAppointment({
      orgId: A.orgId,
      serviceId: A.visit,
      practitionerId: A.drB,
      locationId: A.milano,
      startsAt: new Date(Date.now() + 3 * 86_400_000),
      patient: { firstName: "Gaia", lastName: "Riva", phone: "+393331239876" },
      source: "staff",
      online: false,
      force: true,
      notifyPatient: false,
    });
    const res = await simulateReply("+393331239876", "TAK", "sms");
    expect(res).toMatchObject({ ok: true });
    expect(res.ok && res.message).toMatch(/^Understood as “confirmed”/);
    const [row] = await db.select().from(appointments).where(eq(appointments.id, d.appointment.id));
    expect(row.confirmation).toBe("confirmed");
  });
});

describe("appointmentMessages", () => {
  it("returns the thread with patients' links replaced, audited as message.view, and follows the restriction rule", async () => {
    const d = await createAppointment({
      orgId: A.orgId,
      serviceId: A.visit,
      practitionerId: A.drA,
      locationId: A.milano,
      startsAt: new Date(Date.now() + 5 * 86_400_000),
      patient: { firstName: "Nora", lastName: "Galli", phone: "+393331112299" },
      source: "staff",
      online: false,
      force: true,
      notifyPatient: false,
    });
    const id = d.appointment.id;
    const base = { orgId: A.orgId, appointmentId: id, patientId: d.patient.id, channel: "sms" as const, to: "+393331112299", provider: "dev" };
    await db.insert(messages).values([
      { ...base, id: newId(), direction: "outbound", status: "captured", body: "Studio: reminder. Details: https://sorriso.test/it/a/tok123SECRET. STOP", createdAt: new Date(NOW.getTime() - 60_000) },
      { ...base, id: newId(), direction: "inbound", status: "received", body: "SI", intent: "confirm", createdAt: NOW },
    ]);

    await signIn("reception");
    const thread = await appointmentMessages(id);
    expect(thread.map((m) => m.body)).toEqual(["Studio: reminder. Details: [patient link]. STOP", "SI"]);
    expect(thread[0]).not.toHaveProperty("to");
    expect(thread[0]).not.toHaveProperty("html");
    const rows = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.orgId, A.orgId), eq(auditLog.entityType, "appointment"), eq(auditLog.entityId, id)));
    expect(rows.map((r) => r.action)).toEqual(["message.view"]);
    expect(rows[0].metadata).toEqual({ view: "thread", count: 2, patientId: d.patient.id });

    // Another practice's appointment: nothing, and nothing audited.
    await signIn("owner", B.orgId);
    expect(await appointmentMessages(id)).toEqual([]);

    // A restricted patient: nothing for reception, nor for the owner until they give a reason.
    await db.update(patients).set({ restrictedAt: NOW, restrictionReason: "Art. 18 request" }).where(eq(patients.id, d.patient.id));
    await signIn("reception");
    expect(await appointmentMessages(id)).toEqual([]);
    await signIn("owner");
    expect(await appointmentMessages(id)).toEqual([]);
    await grantRestrictedAccess(state.session!, d.patient.id, "Patient called about this visit");
    expect(await appointmentMessages(id)).toHaveLength(2);
  });
});

describe("the messages page", () => {
  it("audits the log as message.view (no entity, counts) and an opened email on the message, with its patient", async () => {
    const { default: MessagesPage } = await import("../messages/page");
    const patientId = newId();
    await db.insert(patients).values({ id: patientId, orgId: B.orgId, firstName: "Ugo", lastName: "Sala", email: "ugo@example.com" });
    const emailId = newId();
    await db.insert(messages).values({
      id: emailId,
      orgId: B.orgId,
      patientId,
      channel: "email",
      direction: "outbound",
      to: "ugo@example.com",
      subject: "Promemoria",
      body: "Promemoria",
      html: "<p>Promemoria</p>",
      status: "captured",
      provider: "dev",
    });
    await signIn("reception", B.orgId);
    await MessagesPage({ searchParams: Promise.resolve({ f: "email", open: emailId }) });
    const rows = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.orgId, B.orgId), eq(auditLog.actorId, "user-reception"), eq(auditLog.action, "message.view")))
      .orderBy(desc(auditLog.seq));
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({ entityType: null, entityId: null });
    expect(rows[1].metadata).toMatchObject({ view: "messages", filter: "email", count: expect.any(Number) });
    expect(rows[0]).toMatchObject({ entityType: "message", entityId: emailId });
    expect(rows[0].metadata).toMatchObject({ view: "message", patientId });
  });

  it("shows a restricted patient's messages only after a reason, and never a patient's personal link", async () => {
    const { default: MessagesPage } = await import("../messages/page");
    const html = async () => renderToStaticMarkup(await MessagesPage({ searchParams: Promise.resolve({ f: "sms" }) }));
    const patientId = newId();
    await db.insert(patients).values({ id: patientId, orgId: B.orgId, firstName: "Ottavia", lastName: "Restricta", phone: "+393335550001" });
    await db.insert(messages).values({
      id: newId(),
      orgId: B.orgId,
      patientId,
      channel: "sms",
      direction: "outbound",
      to: "+393335550001",
      body: "Studio: reminder. Details: https://sorriso.test/it/a/tokSECRET99 STOP",
      status: "captured",
      provider: "dev",
    });
    await signIn("owner", B.orgId);
    let page = await html();
    expect(page).toContain("Ottavia Restricta");
    expect(page).toContain("Details: [patient link] STOP");
    expect(page).not.toContain("tokSECRET99");

    await db.update(patients).set({ restrictedAt: NOW, restrictionReason: "Art. 18 request" }).where(eq(patients.id, patientId));
    for (const role of ["reception", "owner"] as const) {
      await signIn(role, B.orgId);
      page = await html();
      expect(page, role).not.toContain("Ottavia");
      expect(page, role).not.toContain("Studio: reminder");
      expect(page, role).toContain("Restricted patient");
    }
    await grantRestrictedAccess(state.session!, patientId, "Patient asked about a text");
    page = await html();
    expect(page).toContain("Ottavia Restricta");
    expect(page).toContain("Details: [patient link] STOP");
  });
});
