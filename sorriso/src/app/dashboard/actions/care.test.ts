/**
 * The care actions behind the appointment drawer and the rebooking drawer, as the browser calls
 * them: restricted patients (Art. 18) stay closed whatever the UI hides, showing which red flags a
 * form raised is a clinical view on the patient's access log, and listing the visits a closure
 * covers is audited.
 */
import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import type { MembershipRole } from "@/db/enums";
import { auditLog, formSubmissions, organizations, patients, timeOff, users } from "@/db/schema";
import type { StaffSession } from "@/lib/auth";
import { createAppointment } from "@/lib/booking";
import { ensureDefaultTemplate } from "@/lib/forms";
import { newId } from "@/lib/ids";
import { grantRestrictedAccess } from "@/lib/privacy/erasure";
import { zonedToUtc } from "@/lib/time";
import { createPractice, MONDAY, NOW, TUESDAY, TZ } from "@/test/fixtures";

const state = vi.hoisted(() => ({ session: null as StaffSession | null }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers(), cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth")>()),
  requireStaff: async () => {
    if (!state.session) throw new Error("no session in test");
    return state.session;
  },
}));

const care = await import("./care");
const timeoff = await import("./timeoff");

let p: Awaited<ReturnType<typeof createPractice>>;
let seq = 3520000000;
const at = (date: string, hh: number) => zonedToUtc(date, hh * 60, TZ);

async function signIn(role: MembershipRole) {
  const [org] = await db.select().from(organizations).where(eq(organizations.id, p.orgId));
  state.session = {
    sessionId: "s1",
    user: { id: `user-${role}`, name: "Test", email: `${role}@example.com`, isPlatformAdmin: false, locale: "en" },
    org,
    role,
    orgs: [{ org, role }],
  } as unknown as StaffSession;
}

/** An upcoming visit with a signed medical history that flags blood thinners. */
async function visitWithForm(firstName: string, hh: number) {
  const d = await createAppointment({
    orgId: p.orgId,
    serviceId: p.visit,
    practitionerId: p.drA,
    locationId: p.milano,
    startsAt: at(MONDAY, hh),
    patient: { firstName, lastName: "Care", phone: `+39${seq++}`, locale: "it" },
    source: "staff",
    online: false,
    force: true,
    now: NOW,
  });
  const template = await ensureDefaultTemplate();
  await db.insert(formSubmissions).values({
    id: newId(),
    orgId: p.orgId,
    patientId: d.patient.id,
    appointmentId: d.appointment.id,
    templateId: template.id,
    version: template.version,
    locale: "it",
    answers: JSON.stringify({ anticoagulants: "yes" }),
    redFlags: ["anticoagulants"],
    signerName: `${firstName} Care`,
    signedAt: NOW,
    signedVia: "otp_sms",
  });
  return d;
}

const clinicalViews = (patientId: string) =>
  db
    .select()
    .from(auditLog)
    .where(and(eq(auditLog.action, "patient.clinical.view"), eq(auditLog.entityType, "patient"), eq(auditLog.entityId, patientId)));

beforeAll(async () => {
  p = await createPractice();
  await db
    .update(organizations)
    .set({ settings: { ...p.settings, care: { ...p.settings.care, anamnesisEnabled: true } } })
    .where(eq(organizations.id, p.orgId));
  for (const role of ["owner", "practitioner", "reception"]) {
    await db.insert(users).values({ id: `user-${role}`, email: `${role}@example.com`, name: role, passwordHash: "x" }).onConflictDoNothing();
  }
});

describe("loadAppointmentCare", () => {
  it("shows the red flags to clinicians only, and records each showing on the patient's access log", async () => {
    const d = await visitWithForm("Flaggata", 9);
    await signIn("reception");
    const forReception = await care.loadAppointmentCare(d.appointment.id);
    expect(forReception.ok && forReception.data.anamnesis).toMatchObject({ status: "complete", redFlags: null });
    expect(await clinicalViews(d.patient.id)).toHaveLength(0);

    await signIn("practitioner");
    const forClinician = await care.loadAppointmentCare(d.appointment.id);
    expect(forClinician.ok && forClinician.data.anamnesis.redFlags).toEqual(["anticoagulants"]);
    const views = await clinicalViews(d.patient.id);
    expect(views).toHaveLength(1);
    expect(views[0]).toMatchObject({ actorType: "user", actorId: "user-practitioner" });
    expect(views[0].metadata).toMatchObject({ view: "red_flags", appointmentId: d.appointment.id, count: 1 });
    expect(JSON.stringify(views[0].metadata)).not.toContain("anticoagulants");
  });

  it("refuses a restricted patient's visit until the viewer gave a reason, whatever the drawer shows", async () => {
    const d = await visitWithForm("Ristretta", 10);
    await db.update(patients).set({ restrictedAt: NOW, restrictionReason: "Art. 18 request" }).where(eq(patients.id, d.patient.id));

    await signIn("practitioner");
    expect(await care.loadAppointmentCare(d.appointment.id)).toMatchObject({ ok: false, code: "restricted" });
    expect(await care.loadAnamnesis({ appointmentId: d.appointment.id })).toMatchObject({ ok: false, code: "restricted" });
    expect(await care.setRecallIntervalAction(d.appointment.id, 6)).toMatchObject({ ok: false, code: "restricted" });

    await signIn("owner");
    expect(await care.loadAppointmentCare(d.appointment.id)).toMatchObject({ ok: false, code: "restricted" });
    expect(await care.loadAnamnesis({ appointmentId: d.appointment.id })).toMatchObject({ ok: false, code: "restricted" });
    // Nothing clinical was shown, so nothing was logged as shown.
    expect(await clinicalViews(d.patient.id)).toHaveLength(0);

    await grantRestrictedAccess({ user: { id: "user-owner" }, org: { id: p.orgId } }, d.patient.id, "Patient in the chair now");
    const opened = await care.loadAppointmentCare(d.appointment.id);
    expect(opened.ok && opened.data.anamnesis.redFlags).toEqual(["anticoagulants"]);
    const sheet = await care.loadAnamnesis({ appointmentId: d.appointment.id });
    expect(sheet.ok && sheet.data.answers).toEqual({ anticoagulants: "yes" });
    expect((await clinicalViews(d.patient.id)).map((r) => r.metadata?.view)).toEqual(["red_flags", "answers"]);
  });
});

describe("loadClosureClashes", () => {
  it("is audited as a patient listing and masks restricted patients for staff who may not see them", async () => {
    const open = await visitWithForm("Aperto", 11);
    const hidden = await visitWithForm("Nascosto", 12);
    await db.update(patients).set({ restrictedAt: NOW, restrictionReason: "Art. 18 request" }).where(eq(patients.id, hidden.patient.id));
    const closureId = newId();
    await db.insert(timeOff).values({ id: closureId, orgId: p.orgId, practitionerId: p.drA, startsAt: at(MONDAY, 0), endsAt: at(TUESDAY, 0) });

    await signIn("reception");
    const res = await timeoff.loadClosureClashes(closureId);
    if (!res.ok) throw new Error(res.error);
    expect(res.data.find((r) => r.id === open.appointment.id)).toMatchObject({ patientName: "Aperto Care", masked: false });
    expect(res.data.find((r) => r.id === hidden.appointment.id)).toMatchObject({ patientName: "", masked: true });
    const [row] = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.action, "patient.search"), eq(auditLog.actorId, "user-reception")));
    expect(row.metadata).toMatchObject({ view: "closure-clashes", timeOffId: closureId, rows: res.data.length });

    await signIn("owner");
    const forOwner = await timeoff.loadClosureClashes(closureId);
    expect(forOwner.ok && forOwner.data.find((r) => r.id === hidden.appointment.id)).toMatchObject({ patientName: "Nascosto Care", masked: false });
  });
});
