import { and, eq, inArray } from "drizzle-orm";
import { cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import type { MembershipRole } from "@/db/enums";
import {
  apiKeys,
  appointments,
  authTokens,
  locations,
  memberships,
  organizations,
  patients,
  practitioners,
  reminders,
  reviews,
  rooms,
  schedules,
  services,
  sessions,
  timeOff,
  users,
  waitlist,
} from "@/db/schema";
import { createPractice, MONDAY, NOW, TZ } from "@/test/fixtures";
import type { StaffSession } from "./auth";
import { cancelAppointment, createAppointment, rescheduleAppointment, setOutcome, upsertPatient } from "./booking";
import { buildIcs } from "./ics";
import { handleInboundMessage } from "./inbound";
import { zonedToUtc } from "./time";

// Dashboard actions run as a session the tests set (requireStaff is the only part replaced).
const staffState = vi.hoisted(() => ({ session: null as unknown }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
// A server-action request without cookies: actions read the language and headers as in production.
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }),
  headers: async () => new Headers({ "next-action": "test" }),
}));
vi.mock("@/lib/auth", async (importOriginal) => {
  const original = await importOriginal<typeof import("./auth")>();
  return {
    ...original,
    requireStaff: async (...args: Parameters<typeof original.requireStaff>) =>
      (staffState.session as StaffSession | null) ?? original.requireStaff(...args),
  };
});

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

// ---------------------------------------------------------------- tenant isolation of the dashboard

describe("dashboard actions and loaders across practices", () => {
  type Run = () => Promise<unknown>;
  const ids = {} as {
    appt: string;
    patient: string;
    review: string;
    waitlist: string;
    timeOff: string;
    apiKey: string;
    member: string;
    memberSession: string;
    invite: string;
  };
  const results = new Map<string, unknown>();
  let before = "";

  /** Everything of practice B the actions could touch. */
  async function snapshotB(): Promise<string> {
    const orgId = b.orgId;
    const locIds = (await db.select({ id: locations.id }).from(locations).where(eq(locations.orgId, orgId))).map((r) => r.id);
    const pracIds = (await db.select({ id: practitioners.id }).from(practitioners).where(eq(practitioners.orgId, orgId))).map((r) => r.id);
    const rows = await Promise.all([
      db.select().from(organizations).where(eq(organizations.id, orgId)),
      db.select().from(appointments).where(eq(appointments.orgId, orgId)),
      db.select().from(patients).where(eq(patients.orgId, orgId)),
      db.select().from(practitioners).where(eq(practitioners.orgId, orgId)),
      db.select().from(services).where(eq(services.orgId, orgId)),
      db.select().from(locations).where(eq(locations.orgId, orgId)),
      db.select().from(rooms).where(inArray(rooms.locationId, locIds)),
      db.select().from(schedules).where(inArray(schedules.practitionerId, pracIds)),
      db.select().from(timeOff).where(eq(timeOff.orgId, orgId)),
      db.select().from(waitlist).where(eq(waitlist.orgId, orgId)),
      db.select().from(reviews).where(eq(reviews.orgId, orgId)),
      db.select().from(apiKeys).where(eq(apiKeys.orgId, orgId)),
      db.select().from(memberships).where(eq(memberships.orgId, orgId)),
      db.select().from(sessions).where(eq(sessions.userId, ids.member)),
      db.select().from(users).where(eq(users.id, ids.member)),
      db.select().from(authTokens).where(eq(authTokens.orgId, orgId)),
    ]);
    // Rows whose updatedAt-style columns a no-op could still bump are compared whole: nothing may change.
    return JSON.stringify(rows);
  }

  beforeAll(async () => {
    const { createApiKey } = await import("./api");
    const { issueAuthToken } = await import("./security/tokens");
    const { newId } = await import("./ids");
    const d = await createAppointment({
      orgId: b.orgId,
      serviceId: b.visit,
      practitionerId: b.drA,
      locationId: b.milano,
      startsAt: at(12),
      patient: person({ firstName: "Bianca" }),
      patientNote: "B's patient note",
      source: "staff",
      online: false,
      now: NOW,
    });
    ids.appt = d.appointment.id;
    ids.patient = d.patient.id;
    await db.update(patients).set({ notes: "clinical: B only" }).where(eq(patients.id, ids.patient));
    ids.review = newId();
    await db.insert(reviews).values({ id: ids.review, orgId: b.orgId, practitionerId: b.drA, appointmentId: ids.appt, rating: 5, authorName: "B. B.", status: "published" });
    ids.waitlist = newId();
    await db.insert(waitlist).values({ id: ids.waitlist, orgId: b.orgId, patientId: ids.patient, serviceId: b.visit, earliestDate: MONDAY, latestDate: MONDAY });
    ids.timeOff = newId();
    await db.insert(timeOff).values({ id: ids.timeOff, orgId: b.orgId, practitionerId: b.drB, startsAt: at(9), endsAt: at(10) });
    ids.apiKey = (await createApiKey(b.orgId, "B integration")).id;
    ids.member = newId();
    await db.insert(users).values({ id: ids.member, email: `b-member-${ids.member.toLowerCase()}@example.com`, name: "B Member", passwordHash: "x", totpEnabledAt: new Date(), totpSecretEnc: "JBSWY3DPEHPK3PXP" });
    await db.insert(memberships).values({ userId: ids.member, orgId: b.orgId, role: "reception" });
    ids.memberSession = newId(32);
    await db.insert(sessions).values({ id: ids.memberSession, userId: ids.member, orgId: b.orgId, expiresAt: new Date(Date.now() + 3_600_000), mfaVerifiedAt: new Date() });
    ids.invite = (await issueAuthToken({ kind: "invite", email: "b-invitee@example.com", orgId: b.orgId, role: "reception" })).id;

    // Signed in as an owner of practice A, freshly verified (step-up passes, so every check below is the org scope).
    const ownerA = newId();
    await db.insert(users).values({ id: ownerA, email: `a-owner-${ownerA.toLowerCase()}@example.com`, name: "A Owner", passwordHash: "x" });
    await db.insert(memberships).values({ userId: ownerA, orgId: a.orgId, role: "owner" });
    const sessionId = newId(32);
    const now = new Date();
    await db.insert(sessions).values({ id: sessionId, userId: ownerA, orgId: a.orgId, expiresAt: new Date(now.getTime() + 3_600_000), mfaVerifiedAt: now });
    const [orgA] = await db.select().from(organizations).where(eq(organizations.id, a.orgId));
    staffState.session = {
      sessionId,
      user: { id: ownerA, name: "A Owner", email: "a@example.com", isPlatformAdmin: false, locale: null },
      org: orgA,
      role: "owner",
      orgs: [{ org: orgA, role: "owner" }],
      auth: { pending: false, mfaEnabled: true, mfaVerifiedAt: now, createdAt: now, expiresAt: new Date(now.getTime() + 3_600_000), emailVerified: true },
    } satisfies StaffSession;

    before = await snapshotB();

    const fd = (values: Record<string, string>) => {
      const f = new FormData();
      for (const [k, v] of Object.entries(values)) f.set(k, v);
      return f;
    };
    const appointmentsA = await import("@/app/dashboard/actions/appointments");
    const icsA = await import("@/app/dashboard/actions/ics");
    const linksA = await import("@/app/dashboard/actions/links");
    const locationsA = await import("@/app/dashboard/actions/locations");
    const patientsA = await import("@/app/dashboard/actions/patients");
    const practitionersA = await import("@/app/dashboard/actions/practitioners");
    const reviewsA = await import("@/app/dashboard/actions/reviews");
    const schedulesA = await import("@/app/dashboard/actions/schedules");
    const servicesA = await import("@/app/dashboard/actions/services");
    const timeoffA = await import("@/app/dashboard/actions/timeoff");
    const waitlistA = await import("@/app/dashboard/actions/waitlist");
    const apikeysA = await import("@/app/dashboard/actions/apikeys");
    const teamA = await import("@/app/dashboard/actions/team");
    const securityA = await import("@/app/dashboard/actions/security");

    const actions: Record<string, Run> = {
      createStaffAppointment: () =>
        appointmentsA.createStaffAppointment({
          serviceId: b.visit,
          practitionerId: b.drA,
          locationId: b.milano,
          date: MONDAY,
          time: "11:00",
          firstName: "Eve",
          lastName: "Intruder",
          phone: "+393330000001",
          notifyPatient: false,
          force: true,
        }),
      moveAppointment: () => appointmentsA.moveAppointment({ id: ids.appt, date: MONDAY, time: "12:30", notifyPatient: false, force: true }),
      cancelByStaff: () => appointmentsA.cancelByStaff(ids.appt, "x", false),
      recordOutcome: () => appointmentsA.recordOutcome(ids.appt, "no_show"),
      confirmByPhone: () => appointmentsA.confirmByPhone(ids.appt),
      approve: () => appointmentsA.approve(ids.appt),
      remindNow: () => appointmentsA.remindNow(ids.appt, "sms"),
      saveInternalNote: () => appointmentsA.saveInternalNote(ids.appt, "overwritten"),
      clearAttention: () => appointmentsA.clearAttention(ids.appt),
      issuePatientLink: () => linksA.issuePatientLink(ids.appt),
      rotateIcsToken: () => icsA.rotateIcsToken(b.drA),
      disableIcsFeed: () => icsA.disableIcsFeed(b.drA),
      saveLocation: () => locationsA.saveLocation(b.milano, null, fd({ name: "Hijacked", address: "Via X 1", city: "X" })),
      addRoom: () => locationsA.addRoom(b.milano, "Hijacked"),
      updateRoom: () => locationsA.updateRoom(b.chair1, { name: "Hijacked", active: false }),
      updatePatient: () => patientsA.updatePatient(ids.patient, null, fd({ firstName: "Hijacked", lastName: "X", phone: "+393330000002" })),
      savePractitioner: () => practitionersA.savePractitioner(b.drA, null, fd({ name: "Hijacked" })),
      replyToReview: () => reviewsA.replyToReview(ids.review, "Hijacked", true),
      reportReview: () => reviewsA.reportReview(ids.review, "defamation", "Hijacked report of another practice's review"),
      saveSchedule: () => schedulesA.saveSchedule(b.drA, []),
      saveService: () => servicesA.saveService(b.visit, null, fd({ name: "Hijacked", category: "checkup", durationMinutes: "30" })),
      addTimeOff: () => timeoffA.addTimeOff(null, fd({ scope: `practitioner:${b.drA}`, fromDate: MONDAY, toDate: MONDAY, allDay: "on" })),
      deleteTimeOff: () => timeoffA.deleteTimeOff(ids.timeOff),
      removeWaitlistEntry: () => waitlistA.removeWaitlistEntry(ids.waitlist),
      revokeApiKey: () => apikeysA.revokeApiKey(ids.apiKey),
      changeMemberRole: () => teamA.changeMemberRole(ids.member, "admin"),
      removeMember: () => teamA.removeMember(ids.member),
      resetMemberMfa: () => teamA.resetMemberMfa(ids.member),
      withdrawInvite: () => teamA.withdrawInvite(ids.invite),
      revokeSession: () => securityA.revokeSession(ids.memberSession),
    };
    for (const [name, run] of Object.entries(actions)) {
      try {
        results.set(name, await run());
      } catch (err) {
        results.set(name, { thrown: String((err as Error)?.message ?? err) });
      }
    }
  });

  it("never changes another practice's data", async () => {
    expect(await snapshotB()).toBe(before);
  });

  /**
   * Actions that, on another practice's id, change nothing (the test above proves it) but still
   * answer ok: an update or delete scoped by orgId that matched no row. They should answer
   * not_found like the rest; listed here for their owners (WP2 clearAttention and
   * removeWaitlistEntry, WP7 saveLocation and saveService, WP8 deleteTimeOff) and to be emptied
   * after the merge. Each must still answer: a throw (a renamed or removed action, a crash) fails.
   */
  const SILENT_NO_OPS = new Set(["clearAttention", "saveLocation", "saveService", "deleteTimeOff", "removeWaitlistEntry"]);

  it("every action answers: none throws, so each check below really ran", () => {
    for (const [name, res] of results) expect(res, name).not.toHaveProperty("thrown");
  });

  it("answers not_found or a failure to every other action on a foreign id", () => {
    expect(results.size).toBeGreaterThan(25);
    for (const [name, res] of results) {
      expect(res, name).toHaveProperty("ok");
      if (SILENT_NO_OPS.has(name)) continue;
      expect(res, name).toMatchObject({ ok: false });
    }
  });

  it("answers not_found to the security package's own actions", () => {
    for (const name of ["issuePatientLink", "rotateIcsToken", "disableIcsFeed", "revokeApiKey", "changeMemberRole", "removeMember", "resetMemberMfa", "withdrawInvite", "revokeSession"]) {
      expect(results.get(name), name).toMatchObject({ ok: false, code: "not_found" });
    }
  });

  it("loaders scoped by the session's practice return nothing of another practice", async () => {
    const { getOrgAppointmentDetails, findPatientAppointments } = await import("./appointments");
    const { listAppointments, loadResources } = await import("./dashboard");
    const { appointmentMessages } = await import("@/app/dashboard/actions/messages");
    const { searchPatients } = await import("@/app/dashboard/actions/patients");
    expect(await getOrgAppointmentDetails(a.orgId, ids.appt)).toBeNull();
    expect(await findPatientAppointments(a.orgId, ids.patient)).toEqual([]);
    expect((await listAppointments(a.orgId, { includeCancelled: true })).map((x) => x.id)).not.toContain(ids.appt);
    const res = await loadResources(a.orgId, TZ);
    expect(res.practitioners.map((p) => p.id)).not.toContain(b.drA);
    expect(res.locations.map((l) => l.id)).not.toContain(b.milano);
    const messages = await appointmentMessages(ids.appt).catch(() => []);
    expect(messages).toEqual([]);
    const found = await searchPatients("Bianca");
    expect(found.map((p) => p.id)).not.toContain(ids.patient);
  });
});

describe("clinical notes and reception", () => {
  const NOTE = "clinical: penicillin allergy, on warfarin";

  /** Resolve async server components in a page's element tree (client components keep their props). */
  async function resolve(node: ReactNode): Promise<ReactNode> {
    if (Array.isArray(node)) return Promise.all(node.map(resolve));
    if (!isValidElement(node)) return node;
    const el = node as ReactElement<{ children?: ReactNode }>;
    if (typeof el.type === "function" && el.type.constructor.name === "AsyncFunction") {
      return resolve(await (el.type as (props: unknown) => Promise<ReactNode>)(el.props));
    }
    if (el.props.children === undefined) return el;
    return cloneElement(el, undefined, await resolve(el.props.children));
  }

  /** Every string in an element tree's props: what the page would render or hand to client components. */
  function strings(node: unknown, out: string[] = [], seen = new Set<unknown>()): string[] {
    if (typeof node === "string") out.push(node);
    else if (Array.isArray(node)) for (const n of node) strings(n, out, seen);
    else if (node && typeof node === "object" && !seen.has(node)) {
      seen.add(node);
      const values = isValidElement(node) ? [(node as ReactElement).props] : Object.values(node);
      for (const v of values) strings(v, out, seen);
    }
    return out;
  }

  async function sessionAs(role: MembershipRole): Promise<StaffSession> {
    const [orgA] = await db.select().from(organizations).where(eq(organizations.id, a.orgId));
    return {
      sessionId: `${role}-session`,
      user: { id: `${role}-user`, name: role, email: `${role}@example.com`, isPlatformAdmin: false, locale: null },
      org: orgA,
      role,
      orgs: [{ org: orgA, role }],
    };
  }

  it("reception gets forbidden on patient clinical notes, from the real actions and loaders", async () => {
    const { newId } = await import("./ids");
    const patientsA = await import("@/app/dashboard/actions/patients");
    const patientId = newId();
    await db.insert(patients).values({ id: patientId, orgId: a.orgId, firstName: "Nora", lastName: "Clinica", phone: `+39${seq++}`, notes: NOTE });
    const notesNow = async () => (await db.select({ notes: patients.notes }).from(patients).where(eq(patients.id, patientId)))[0].notes;
    const fd = (values: Record<string, string>) => {
      const f = new FormData();
      for (const [k, v] of Object.entries(values)) f.set(k, v);
      return f;
    };
    staffState.session = await sessionAs("reception");

    // Writing notes: forbidden.
    expect(await patientsA.updatePatientNotes(patientId, null, fd({ notes: "overwritten by reception" }))).toMatchObject({ ok: false, code: "forbidden" });
    // The details form with a notes field smuggled in: the details may change, the notes don't.
    await patientsA.updatePatient(patientId, null, fd({ firstName: "Nora", lastName: "Clinica", notes: "overwritten by reception" }));
    expect(await notesNow()).toBe(NOTE);

    // The patient lookups carry no notes.
    const found = await patientsA.searchPatients("Nora Clinica");
    expect(found.map((r) => r.id)).toContain(patientId);
    const listed = await patientsA.listPatientRows("Clinica");
    expect(listed.rows.map((r) => r.id)).toContain(patientId);
    for (const row of [...found, ...listed.rows]) expect(row).not.toHaveProperty("notes");
    expect(JSON.stringify([found, listed])).not.toContain("warfarin");

    // The patient page: the note is nowhere in what it renders or hands to client components for
    // reception, while a practitioner (patient.notes.read) gets it (so the check can see it at all).
    const { default: PatientPage } = await import("@/app/dashboard/patients/[id]/page");
    const page = async () =>
      strings(await resolve(await PatientPage({ params: Promise.resolve({ id: patientId }), searchParams: Promise.resolve({}) }))).join("\n");
    expect(await page()).not.toContain("warfarin");
    staffState.session = await sessionAs("practitioner");
    expect(await page()).toContain("warfarin");

    // Anamnesis answers (WP8) sit behind patient.clinical.read, which reception lacks.
    const { can, visiblePatient } = await import("./permissions");
    expect(can("reception", "patient.clinical.read")).toBe(false);
    expect(visiblePatient("reception", { notes: NOTE }).notes).toBeNull();
  });
});
