import { and, eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import type { MembershipRole } from "@/db/enums";
import { appointments, auditLog, messages, organizations, patients, reminders, users, waitlist } from "@/db/schema";
import { getT } from "@/i18n/t";
import { createPractice, TZ } from "@/test/fixtures";
import type { StaffSession } from "./auth";
import { newId } from "./ids";
import type { Permission } from "./permissions";
import { zonedToUtc } from "./time";

/**
 * WP2 data minimisation, the drawer's audited detail, localised action errors and the staff
 * language. Dashboard actions run as a session the tests set; next/headers is a request without
 * cookies, as a server action sees it.
 */

const state = vi.hoisted(() => ({ session: null as unknown, withhold: new Set<string>() }));

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }),
  headers: async () => new Headers({ "accept-language": "it-IT" }),
}));
vi.mock("@/lib/auth", async (importOriginal) => {
  const original = await importOriginal<typeof import("./auth")>();
  return {
    ...original,
    requireStaff: async () => {
      if (!state.session) throw new Error("no session in test");
      return state.session as StaffSession;
    },
    getSession: async () => state.session,
  };
});
// No role lacks contacts or appointment notes today (permissions.ts, WP6): the tests withhold a
// permission from the signed-in role to prove the detail checks each one.
vi.mock("@/lib/permissions", async (importOriginal) => {
  const o = await importOriginal<typeof import("./permissions")>();
  const can = (role: MembershipRole | null | undefined, p: Permission) => !state.withhold.has(p) && o.can(role, p);
  return {
    ...o,
    can,
    permissionsFor: (role: MembershipRole) => o.permissionsFor(role).filter((p) => !state.withhold.has(p)),
    assertPermission: (s: { role: MembershipRole }, p: Permission) => {
      if (!can(s.role, p)) throw new o.PermissionError(p);
    },
  };
});
vi.mock("@/lib/privacy/gates", () => ({ enforceDashboardGates: async () => {}, gatePage: async () => null, canAcceptOnlineBookings: async () => true }));
vi.mock("@/app/fonts", () => ({ jakarta: { variable: "font-jakarta" } }));

const { listAppointments, listViewer, redactPatientLinks } = await import("./dashboard");
const { getAppointmentDetail, getAppointmentPhone, openRestrictedAppointment, createStaffAppointment, moveAppointment, cancelByStaff, remindNow } =
  await import("@/app/dashboard/actions/appointments");
const { updateMyLocale } = await import("@/app/dashboard/actions/session");

/** A string that must never leave the server in a list. */
const SECRET_NOTE = "ZEBRA-ANTICOAGULANT-7731";
const SECRET_INTERNAL = "QUOKKA-INTERNAL-5521";
const SECRET_REASON = "WOMBAT-CANCEL-9902";

let practice: Awaited<ReturnType<typeof createPractice>>;
let other: Awaited<ReturnType<typeof createPractice>>;
const userIds: Partial<Record<MembershipRole, string>> = {};

async function signIn(role: MembershipRole, orgId = practice.orgId) {
  const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
  if (!userIds[role]) {
    userIds[role] = newId();
    await db.insert(users).values({ id: userIds[role]!, email: `${role}-${userIds[role]}@example.org`, name: `Test ${role}`, passwordHash: "x" });
  }
  const [u] = await db.select().from(users).where(eq(users.id, userIds[role]!));
  state.session = {
    sessionId: "s1",
    user: { id: u.id, name: u.name, email: u.email, isPlatformAdmin: false, locale: u.locale },
    org,
    role,
    orgs: [{ org, role }],
    auth: { mfaVerifiedAt: null },
  };
  return state.session as StaffSession;
}

let seq = 0;
async function addAppointment(p: typeof practice, over: Partial<typeof appointments.$inferInsert> = {}, patient: Partial<typeof patients.$inferInsert> = {}) {
  const patientId = newId();
  seq++;
  await db.insert(patients).values({
    id: patientId,
    orgId: p.orgId,
    firstName: "Ottavia",
    lastName: `Brambilla${seq}`,
    phone: `+39333${String(1000000 + seq)}`,
    email: `ottavia${seq}@example.org`,
    ...patient,
  });
  const startsAt = zonedToUtc("2030-03-04", 9 * 60 + seq * 30, TZ);
  const id = newId();
  await db.insert(appointments).values({
    id,
    orgId: p.orgId,
    locationId: p.milano,
    practitionerId: p.drA,
    serviceId: p.visit,
    patientId,
    startsAt,
    endsAt: new Date(startsAt.getTime() + 30 * 60_000),
    blockedUntil: new Date(startsAt.getTime() + 30 * 60_000),
    source: "online",
    manageToken: `h:${id}`,
    manageTokenHash: `hash-${id}`,
    patientNote: SECRET_NOTE,
    internalNote: SECRET_INTERNAL,
    ...over,
  });
  return { id, patientId };
}

const viewRows = (id: string) =>
  db
    .select()
    .from(auditLog)
    .where(and(eq(auditLog.action, "appointment.view"), eq(auditLog.entityType, "appointment"), eq(auditLog.entityId, id)));

beforeAll(async () => {
  practice = await createPractice();
  other = await createPractice();
});

beforeEach(() => {
  state.withhold.clear();
});

/**
 * The data a server component tree hands on (what ends up in the HTML or the RSC payload): every
 * element's props, recursively, without the component functions themselves.
 */
function propsJson(tree: unknown): string {
  const seen = new WeakSet<object>();
  return JSON.stringify(tree, (key, value) => {
    if (key === "type" || key === "_owner" || key === "_store") return undefined;
    if (value && typeof value === "object") {
      if (seen.has(value)) return undefined;
      seen.add(value);
    }
    return value;
  });
}

/** Every key of a value, recursively. */
function keysOf(v: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(v)) v.forEach((x) => keysOf(x, out));
  else if (v && typeof v === "object") {
    for (const [k, x] of Object.entries(v)) {
      out.add(k);
      keysOf(x, out);
    }
  }
  return out;
}

describe("listAppointments (data minimisation)", () => {
  it("rows carry no notes, cancellation reason, contacts or link token", async () => {
    const s = await signIn("owner");
    const { id } = await addAppointment(practice, { status: "cancelled", cancelledBy: "staff", cancelReason: SECRET_REASON, cancelledAt: new Date() });
    const rows = await listAppointments(practice.orgId, { includeCancelled: true, viewer: listViewer(s, "en") });
    const row = rows.find((r) => r.id === id)!;
    expect(row).toBeTruthy();
    const keys = keysOf(rows);
    for (const k of ["patientNote", "internalNote", "cancelReason", "email", "phone", "token", "manageToken", "manageTokenEnc", "manageTokenHash"]) {
      expect(keys.has(k), k).toBe(false);
    }
    const json = JSON.stringify(rows);
    for (const secret of [SECRET_NOTE, SECRET_INTERNAL, SECRET_REASON, "@example.org", "+39333"]) expect(json).not.toContain(secret);
    // What it adds instead.
    expect(row).toMatchObject({ hasNotes: true, minorFlag: false, restricted: false, riskLevel: null, riskReasons: [] });
    expect(row.patient).toEqual({ id: row.patient.id, name: expect.stringContaining("Ottavia"), masked: false, noShowCount: 0, preferredChannel: "sms" });
  });

  it("hides the notes marker from a role without appointment.notes.read, and defaults to the minimum without a viewer", async () => {
    const s = await signIn("reception");
    const { id } = await addAppointment(practice);
    state.withhold.add("appointment.notes.read");
    expect((await listAppointments(practice.orgId, { ids: [id], viewer: listViewer(s, "en") }))[0].hasNotes).toBe(false);
    state.withhold.clear();
    expect((await listAppointments(practice.orgId, { ids: [id] }))[0].hasNotes).toBe(false);
    expect((await listAppointments(practice.orgId, { ids: [id], viewer: listViewer(s, "en") }))[0].hasNotes).toBe(true);
  });

  it("replaces a restricted patient's name with the localised placeholder unless the viewer has patient.restricted.read", async () => {
    const { id } = await addAppointment(practice, {}, { restrictedAt: new Date(), restrictionReason: "Art. 18 request" });
    const reception = await signIn("reception");
    const [masked] = await listAppointments(practice.orgId, { ids: [id], viewer: listViewer(reception, "en") });
    expect(masked.patient).toMatchObject({ name: getT("en", "calendar")("restrictedPatient"), masked: true, noShowCount: 0 });
    expect(masked).toMatchObject({ restricted: true, hasNotes: false, riskLevel: null });
    expect(JSON.stringify(masked)).not.toContain("Ottavia");
    const [inGerman] = await listAppointments(practice.orgId, { ids: [id], viewer: listViewer(reception, "de") });
    expect(inGerman.patient.name).toBe(getT("de", "calendar")("restrictedPatient"));

    const owner = await signIn("owner");
    const [open] = await listAppointments(practice.orgId, { ids: [id], viewer: listViewer(owner, "en") });
    expect(open.patient).toMatchObject({ masked: false, name: expect.stringContaining("Ottavia") });
    expect(open.restricted).toBe(true);
  });

  it("never returns another practice's appointments", async () => {
    const { id } = await addAppointment(other);
    expect(await listAppointments(practice.orgId, { ids: [id], includeCancelled: true })).toEqual([]);
  });
});

describe("getAppointmentDetail (the drawer)", () => {
  it("returns contacts only with patient.contact.read and notes only with appointment.notes.read", async () => {
    const { id } = await addAppointment(practice, { cancelReason: SECRET_REASON });
    await signIn("practitioner");
    const full = await getAppointmentDetail(id);
    if (!full.ok) throw new Error(full.error);
    expect(full.data.contacts).toMatchObject({ phone: expect.stringMatching(/^\+39333/), email: expect.stringContaining("@example.org") });
    expect(full.data).toMatchObject({ patientNote: SECRET_NOTE, internalNote: SECRET_INTERNAL, cancelReason: SECRET_REASON });
    expect(full.data.access).toMatchObject({ contacts: true, notes: true, restricted: "open" });

    state.withhold.add("patient.contact.read");
    const noContacts = await getAppointmentDetail(id);
    if (!noContacts.ok) throw new Error(noContacts.error);
    expect(noContacts.data.contacts).toBeNull();
    expect(noContacts.data.access.contacts).toBe(false);
    expect(noContacts.data.patientNote).toBe(SECRET_NOTE);
    expect(JSON.stringify(noContacts.data)).not.toContain("@example.org");

    state.withhold.clear();
    state.withhold.add("appointment.notes.read");
    const noNotes = await getAppointmentDetail(id);
    if (!noNotes.ok) throw new Error(noNotes.error);
    expect(noNotes.data).toMatchObject({ patientNote: null, internalNote: null, cancelReason: null, hasNotes: false });
    expect(noNotes.data.access.notes).toBe(false);
    expect(noNotes.data.contacts?.phone).toMatch(/^\+39333/);
    const json = JSON.stringify(noNotes.data);
    for (const secret of [SECRET_NOTE, SECRET_INTERNAL, SECRET_REASON]) expect(json).not.toContain(secret);
  });

  it("writes exactly one appointment.view audit row per opening, with the appointment id", async () => {
    const { id } = await addAppointment(practice);
    await db.insert(messages).values({
      id: newId(),
      orgId: practice.orgId,
      appointmentId: id,
      channel: "sms",
      direction: "outbound",
      to: "+393330000000",
      body: "Reminder",
      status: "captured",
      provider: "test",
    });
    const s = await signIn("reception");
    expect(await viewRows(id)).toHaveLength(0);
    const res = await getAppointmentDetail(id);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.messages).toHaveLength(1);
    const rows = await viewRows(id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ orgId: practice.orgId, actorType: "user", actorId: s.user.id, entityType: "appointment", entityId: id });
    expect(JSON.stringify(rows[0].metadata)).not.toMatch(/Ottavia|example\.org|\+39/);
    await getAppointmentDetail(id);
    expect(await viewRows(id)).toHaveLength(2);
  });

  it("returns not_found (and audits nothing) for another practice's appointment", async () => {
    const { id } = await addAppointment(other);
    await signIn("owner");
    const res = await getAppointmentDetail(id);
    expect(res).toMatchObject({ ok: false, code: "not_found" });
    expect(await viewRows(id)).toHaveLength(0);
  });

  it("refuses a role without calendar.read", async () => {
    const { id } = await addAppointment(practice);
    await signIn("reception");
    state.withhold.add("calendar.read");
    expect(await getAppointmentDetail(id)).toMatchObject({ ok: false, code: "forbidden" });
    expect(await viewRows(id)).toHaveLength(0);
  });

  it("shows a restricted record as a placeholder, or after a reason recorded as patient.restricted_access", async () => {
    const { id, patientId } = await addAppointment(practice, {}, { restrictedAt: new Date(), restrictionReason: "Art. 18 request" });
    await signIn("reception");
    const placeholder = await getAppointmentDetail(id);
    if (!placeholder.ok) throw new Error(placeholder.error);
    expect(placeholder.data).toMatchObject({ contacts: null, patientNote: null, messages: null, access: { restricted: "placeholder" } });
    expect(placeholder.data.patient.masked).toBe(true);

    const owner = await signIn("owner");
    const pending = await getAppointmentDetail(id);
    if (!pending.ok) throw new Error(pending.error);
    expect(pending.data).toMatchObject({ contacts: null, patientNote: null, access: { restricted: "needs_reason" } });

    expect(await openRestrictedAppointment(id, "x")).toMatchObject({ ok: false, code: "reason_required" });
    const opened = await openRestrictedAppointment(id, "Patient at the desk asking to move the visit");
    if (!opened.ok) throw new Error(opened.error);
    expect(opened.data.access.restricted).toBe("open");
    expect(opened.data.patientNote).toBe(SECRET_NOTE);
    const access = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.action, "patient.restricted_access"), eq(auditLog.entityId, patientId), eq(auditLog.actorId, owner.user.id)));
    expect(access).toHaveLength(1);
  });
});

describe("the drawer's message thread", () => {
  const TOKEN = "Zk3_fAKEtokenFAKEtoken-0123456789abcdefghijk";

  it("replaces the patient's personal links with a placeholder and keeps other links", async () => {
    const { id } = await addAppointment(practice);
    const texts = [
      `Studio: appointment reminder Tue 4 Mar 10:00. Details: https://sorriso.test/a/${TOKEN} Reply STOP to opt out`,
      `Please review your visit: https://sorriso.test/it/a/${TOKEN}/review.`,
      `Calendar: https://sorriso.test/api/ics/appointment/${TOKEN}, see you soon`,
      `Book again: https://sorriso.test/book/studio?service=x and our page https://sorriso.test/c/studio`,
    ];
    await db.insert(messages).values(
      texts.map((body, i) => ({
        id: newId(),
        orgId: practice.orgId,
        appointmentId: id,
        channel: "sms" as const,
        direction: "outbound" as const,
        to: "+393330000000",
        body,
        status: "captured" as const,
        provider: "test",
        createdAt: new Date(Date.UTC(2030, 0, 1, 9, i)),
      })),
    );
    await signIn("reception");
    const res = await getAppointmentDetail(id);
    if (!res.ok) throw new Error(res.error);
    const bodies = res.data.messages!.map((m) => m.body);
    expect(JSON.stringify(res.data)).not.toContain(TOKEN);
    const label = getT("it", "calendar")("drawer.linkRedacted");
    expect(bodies[0]).toBe(`Studio: appointment reminder Tue 4 Mar 10:00. Details: ${label} Reply STOP to opt out`);
    expect(bodies[1]).toBe(`Please review your visit: ${label}.`);
    expect(bodies[2]).toBe(`Calendar: ${label}, see you soon`);
    expect(bodies[3]).toBe(texts[3]);
  });

  it("redactPatientLinks leaves text without personal links unchanged", () => {
    expect(redactPatientLinks("Reply YES to confirm (https://x.test/c/a-clinic).", "[link]")).toBe("Reply YES to confirm (https://x.test/c/a-clinic).");
    expect(redactPatientLinks(`Manage: http://localhost:3000/a/${TOKEN}/rebook`, "[link]")).toBe("Manage: [link]");
    expect(redactPatientLinks(`(https://x.test/en/a/${TOKEN}/forms/anamnesis)`, "[link]")).toBe("([link])");
  });
});

describe("getAppointmentPhone (a list row's Call button)", () => {
  it("returns only the mobile number, audited, and needs patient.contact.read", async () => {
    const { id } = await addAppointment(practice);
    const s = await signIn("reception");
    const res = await getAppointmentPhone(id);
    expect(res).toEqual({ ok: true, phone: expect.stringMatching(/^\+39333/) });
    const rows = await viewRows(id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ actorId: s.user.id, entityId: id, metadata: { view: "call", contacts: true } });

    state.withhold.add("patient.contact.read");
    expect(await getAppointmentPhone(id)).toMatchObject({ ok: false, code: "forbidden" });
    expect(await viewRows(id)).toHaveLength(1);
  });

  it("asks for a reason first for a restricted patient, and is not_found for another practice", async () => {
    const { id } = await addAppointment(practice, {}, { restrictedAt: new Date(), restrictionReason: "Art. 18 request" });
    await signIn("owner");
    expect(await getAppointmentPhone(id)).toMatchObject({ ok: false, code: "restricted" });
    expect(await viewRows(id)).toHaveLength(0);
    await openRestrictedAppointment(id, "Patient on the phone asking to move the visit");
    expect(await getAppointmentPhone(id)).toMatchObject({ ok: true, phone: expect.stringMatching(/^\+39333/) });

    const foreign = await addAppointment(other);
    expect(await getAppointmentPhone(foreign.id)).toMatchObject({ ok: false, code: "not_found" });
    expect(await viewRows(foreign.id)).toHaveLength(0);
  });
});

describe("remindNow", () => {
  it("tells the staff a restricted patient gets no messages, and queues no reminder", async () => {
    const { id } = await addAppointment(practice, { status: "scheduled" }, { restrictedAt: new Date(), restrictionReason: "Art. 18 request" });
    await signIn("owner");
    const res = await remindNow(id, "sms");
    // No users.locale: the request's Accept-Language (it-IT) picks the language.
    expect(res).toEqual({ ok: false, error: getT("it", "calendar")("errors.restrictedNoMessages"), code: "restricted" });
    expect(await db.select().from(reminders).where(eq(reminders.appointmentId, id))).toHaveLength(0);
  });
});

describe("actions answer in the staff member's language", () => {
  it("returns Zod and BookingError messages through the German translator", async () => {
    await signIn("reception");
    await db.update(users).set({ locale: "de" }).where(eq(users.id, userIds.reception!));
    await signIn("reception");
    const tDe = getT("de", "calendar");

    // Zod (zodErrorMap("de")), prefixed with the field's label.
    const zod = await createStaffAppointment({
      patientId: "x",
      serviceId: practice.visit,
      practitionerId: practice.drA,
      locationId: practice.milano,
      date: "2030-03-04",
      time: "09:00",
      durationMinutes: "abc" as unknown as number,
      notifyPatient: false,
      force: false,
    });
    expect(zod.ok).toBe(false);
    if (!zod.ok) {
      expect(zod.error).toContain("Ungültige Eingabe");
      expect(zod.error).toBe(tDe("validation.field", { field: tDe("fields.durationMinutes"), message: zod.error.split(": ").slice(1).join(": ") }));
    }

    // BookingError codes read calendar.errors.<code> in German.
    const first = await addAppointment(practice, { status: "scheduled" });
    const second = await addAppointment(practice, { status: "scheduled" });
    const [target] = await db.select().from(appointments).where(eq(appointments.id, first.id));
    const local = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(target.startsAt);
    const busy = await moveAppointment({ id: second.id, date: "2030-03-04", time: local, practitionerId: practice.drA, notifyPatient: false });
    expect(busy).toEqual({ ok: false, error: tDe("errors.practitioner_busy"), code: "practitioner_busy" });

    const missing = await cancelByStaff("missing-id", "", false);
    expect(missing).toEqual({ ok: false, error: tDe("errors.not_found"), code: "not_found" });

    // A missing permission too.
    state.withhold.add("appointment.write");
    expect(await cancelByStaff(first.id, "", false)).toEqual({ ok: false, error: tDe("errors.forbidden"), code: "forbidden" });
    await db.update(users).set({ locale: null }).where(eq(users.id, userIds.reception!));
  });
});

describe("staff language", () => {
  it("choosing Deutsch stores users.locale = 'de' and the next dashboard response has <html lang=de>", async () => {
    const s = await signIn("practitioner");
    expect((await updateMyLocale("xx" as never)).ok).toBe(false);
    const res = await updateMyLocale("de");
    expect(res).toMatchObject({ ok: true, message: getT("de", "dashboard")("language.saved") });
    const [row] = await db.select({ locale: users.locale }).from(users).where(eq(users.id, s.user.id));
    expect(row.locale).toBe("de");

    // The next request: a fresh session read from the database.
    await signIn("practitioner");
    const { default: DashboardLayout } = await import("@/app/dashboard/layout");
    const html = (await DashboardLayout({ children: null })) as { props: { lang: string } };
    expect(html.props.lang).toBe("de");

    await updateMyLocale(null);
    const [auto] = await db.select({ locale: users.locale }).from(users).where(eq(users.id, s.user.id));
    expect(auto.locale).toBeNull();
  });
});

describe("pages send no free text to the browser", () => {
  it("/dashboard/calendar and /dashboard pass no note to their client components", async () => {
    await signIn("owner");
    await addAppointment(practice, { startsAt: new Date(Date.now() + 3600_000), endsAt: new Date(Date.now() + 5400_000), blockedUntil: new Date(Date.now() + 5400_000), needsAttention: true });
    const { default: CalendarPage } = await import("@/app/dashboard/calendar/page");
    const calendar = (await CalendarPage({ searchParams: Promise.resolve({ date: "2030-03-04" }) })) as { props: { appointments: unknown[] } };
    expect(calendar.props.appointments.length).toBeGreaterThan(0);
    const { default: Overview } = await import("@/app/dashboard/page");
    const overview = await Overview({ searchParams: Promise.resolve({}) });
    for (const tree of [calendar, overview]) {
      const json = propsJson(tree);
      expect(json).toContain("Ottavia");
      for (const secret of [SECRET_NOTE, SECRET_INTERNAL, "@example.org"]) expect(json).not.toContain(secret);
    }
  });

  it("/dashboard shows no reply text of a restricted patient, even to a role with patient.restricted.read", async () => {
    const soon = { startsAt: new Date(Date.now() + 2 * 3600_000), endsAt: new Date(Date.now() + 3 * 3600_000), blockedUntil: new Date(Date.now() + 3 * 3600_000) };
    const locked = await addAppointment(practice, { ...soon, status: "scheduled", needsAttention: true }, { restrictedAt: new Date(), restrictionReason: "Art. 18 request" });
    const open = await addAppointment(practice, { ...soon, status: "scheduled", needsAttention: true });
    const reply = (appointmentId: string, body: string) => ({
      id: newId(),
      orgId: practice.orgId,
      appointmentId,
      channel: "sms" as const,
      direction: "inbound" as const,
      to: "+390000000000",
      body,
      status: "received" as const,
      provider: "test",
    });
    await db.insert(messages).values([reply(locked.id, "IBIS-REPLY-3318 my gums hurt"), reply(open.id, "HERON-REPLY-2207 maybe later")]);
    await signIn("owner");
    const { default: Overview } = await import("@/app/dashboard/page");
    const json = propsJson(await Overview({ searchParams: Promise.resolve({}) }));
    expect(json).toContain("HERON-REPLY-2207");
    expect(json).not.toContain("IBIS-REPLY-3318");
  });

  it("/dashboard/waitlist shows no contacts or note of a restricted patient, even to a role with patient.restricted.read", async () => {
    const entry = async (patient: Partial<typeof patients.$inferInsert>, note: string) => {
      const patientId = newId();
      await db.insert(patients).values({ id: patientId, orgId: practice.orgId, firstName: "Ornella", lastName: "Vanoni", ...patient });
      await db.insert(waitlist).values({
        id: newId(),
        orgId: practice.orgId,
        patientId,
        serviceId: practice.visit,
        earliestDate: "2030-03-01",
        latestDate: "2030-03-31",
        note,
      });
      return patientId;
    };
    const lockedId = await entry({ phone: "+393339990001", email: "hidden-wl@example.org", restrictedAt: new Date(), restrictionReason: "Art. 18 request" }, "KIWI-WL-NOTE-6620");
    await entry({ phone: "+393339990002", email: "open-wl@example.org" }, "MOA-WL-NOTE-1187");
    await signIn("owner");
    const { default: WaitlistPage } = await import("@/app/dashboard/waitlist/page");
    const json = propsJson(await WaitlistPage());
    expect(json).toContain("open-wl@example.org");
    expect(json).toContain("MOA-WL-NOTE-1187");
    expect(json).not.toContain("hidden-wl@example.org");
    expect(json).not.toContain("KIWI-WL-NOTE-6620");
    expect(json.replace(/\s/g, "")).not.toContain("3339990001");
    // The way to the data: the patient record, which asks for a reason.
    expect(json).toContain(getT("it", "dashboard")("waitlist.restricted"));
    expect(json).toContain(`/dashboard/patients/${lockedId}`);
  });
});
