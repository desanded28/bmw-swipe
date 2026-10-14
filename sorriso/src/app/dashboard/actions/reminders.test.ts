import { and, eq } from "drizzle-orm";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import type { MembershipRole } from "@/db/enums";
import { appointments, organizations, reminders } from "@/db/schema";
import type { StaffSession } from "@/lib/auth";
import { createAppointment } from "@/lib/booking";
import { resolveSettings } from "@/lib/settings";
import { zonedToUtc } from "@/lib/time";
import { createPractice, MONDAY, NOW, TZ } from "@/test/fixtures";
import { simulateReply } from "./messages";
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
