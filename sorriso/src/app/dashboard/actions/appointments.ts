"use server";

import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";
import type { DetailResult, PhoneResult } from "@/components/dashboard/types";
import { db } from "@/db";
import { appointments, CHANNELS, locations, practitioners, type Channel } from "@/db/schema";
import { getT } from "@/i18n/server";
import { zodErrorMap } from "@/i18n/zod";
import { auditStaff } from "@/lib/audit";
import {
  approveRequest,
  cancelAppointment,
  confirmAttendance,
  createAppointment,
  rescheduleAppointment,
  sendReminderNow,
  setOutcome,
} from "@/lib/booking";
import { isRestricted } from "@/lib/contact";
import type { StaffSession } from "@/lib/auth";
import { calendarTexts, dashboardAction, loadAppointmentDetail, loadAppointmentPhone, type CalendarT } from "@/lib/dashboard";
import { logError } from "@/lib/log";
import { can, PermissionError } from "@/lib/permissions";
import { ErasureError, grantRestrictedAccess, restrictedAccessReason } from "@/lib/privacy/erasure";
import { normalizePhone } from "@/lib/phone";
import { hhmmToMinutes, zonedToUtc } from "@/lib/time";
import type { Locale } from "@/i18n/config";
import { fail, ok, ownAppointment, staff, type ActionResult } from "./_shared";

/**
 * Calendar and appointment actions (WP2). Every message is in the staff member's language
 * (dashboardAction): input is parsed with zodErrorMap(locale), BookingError codes read
 * calendar.errors.<code>. Changes need appointment.write and are audited; the drawer's detail
 * needs calendar.read and is audited as appointment.view.
 */

const TIME = /^\d{1,2}:\d{2}$/;

/**
 * A restricted (Art. 18) or erased patient's visit is changed only by someone who may read
 * restricted records and gave a reason for this patient within the access window (the drawer's
 * openRestrictedAppointment), as for the patient record's own actions (patients.ts). Returns the
 * failure, or the reason the change was made under (null for an unrestricted patient), which
 * goes into the change's audit row.
 */
async function restrictedChange(
  s: StaffSession,
  patient: { id: string; restrictedAt: Date | null; erasedAt: Date | null },
  t: CalendarT,
): Promise<{ denied: ActionResult } | { reason: string | null }> {
  if (!isRestricted(patient)) return { reason: null };
  const reason = can(s.role, "patient.restricted.read") ? await restrictedAccessReason(s, patient.id) : null;
  return reason ? { reason } : { denied: fail(t("errors.restrictedChange"), "restricted_reason_required") };
}
/** Free text kept with the appointment (staff note, cancellation reason): encrypted at rest. */
const NOTE_MAX = 2000;

const staffBookingSchema = (t: CalendarT) =>
  z.object({
    patientId: z.string().max(40).optional(),
    firstName: z.string().trim().max(80).optional(),
    lastName: z.string().trim().max(80).optional(),
    phone: z.string().trim().max(40).optional(),
    email: z.union([z.literal(""), z.email().max(254)]).optional(),
    serviceId: z.string().min(1, { error: t("errors.chooseService") }).max(40),
    practitionerId: z.string().min(1, { error: t("errors.choosePractitioner") }).max(40),
    locationId: z.string().min(1, { error: t("errors.chooseOffice") }).max(40),
    roomId: z.string().max(40).optional(),
    date: z.iso.date({ error: t("errors.chooseDate") }),
    time: z.string().regex(TIME, { error: t("errors.invalidTime") }),
    durationMinutes: z.coerce.number().int().min(5).max(480).optional(),
    internalNote: z.string().max(NOTE_MAX).optional(),
    notifyPatient: z.boolean(),
    force: z.boolean(),
    restrictedAccessReason: z.string().trim().max(500).optional(),
  });

export type StaffBookingInput = z.input<ReturnType<typeof staffBookingSchema>>;

/** Book from the dashboard (new or existing patient). Audited as appointment.create. */
export async function createStaffAppointment(input: StaffBookingInput): Promise<ActionResult> {
  return dashboardAction(
    async (s, t, locale) => {
      const v = staffBookingSchema(t).parse(input, { error: zodErrorMap(locale) });
      // createAppointment records any reason it gets (it doesn't know the role): only staff who
      // may read restricted records may give one, as for openRestrictedAppointment.
      if (v.restrictedAccessReason && !can(s.role, "patient.restricted.read")) return fail(t("errors.forbidden"), "forbidden");
      const [loc] = await db
        .select()
        .from(locations)
        .where(and(eq(locations.id, v.locationId), eq(locations.orgId, s.org.id)));
      if (!loc) return fail(t("errors.officeNotFound"), "not_found");
      const minutes = hhmmToMinutes(v.time);
      if (minutes == null) return fail(t("errors.invalidTime"), "invalid");
      let patient: Parameters<typeof createAppointment>[0]["patient"];
      if (v.patientId) patient = { id: v.patientId };
      else {
        if (!v.firstName || !v.lastName) return fail(t("errors.patientName"), "invalid");
        if (!v.phone && !v.email) return fail(t("errors.patientContact"), "invalid");
        if (v.phone && !normalizePhone(v.phone)) return fail(t("errors.phoneInvalid"), "invalid");
        patient = { firstName: v.firstName, lastName: v.lastName, phone: v.phone || null, email: v.email || null };
      }
      const d = await createAppointment({
        orgId: s.org.id,
        serviceId: v.serviceId,
        practitionerId: v.practitionerId,
        locationId: v.locationId,
        roomId: v.roomId || undefined,
        startsAt: zonedToUtc(v.date, minutes, loc.timezone),
        durationMinutes: v.durationMinutes,
        patient,
        source: "staff",
        online: false,
        force: v.force,
        internalNote: v.internalNote?.trim() || null,
        notifyPatient: v.notifyPatient,
        restrictedAccessReason: v.restrictedAccessReason || null,
        // createAppointment audits patient.create and appointment.create in its transaction.
        actor: { type: "user", id: s.user.id },
        headers: await headers(),
      });
      return ok(t("done.booked"), { id: d.appointment.id });
    },
    { permission: "appointment.write" },
  );
}

const moveSchema = z.object({
  id: z.string().min(1).max(40),
  date: z.iso.date(),
  time: z.string().regex(TIME),
  practitionerId: z.string().max(40).optional(),
  locationId: z.string().max(40).optional(),
  roomId: z.string().max(40).nullable().optional(),
  durationMinutes: z.number().int().min(5).max(480).optional(),
  notifyPatient: z.boolean(),
  force: z.boolean().optional(),
});

/** Move an appointment to another time, practitioner, office or chair. Audited as appointment.update. */
export async function moveAppointment(input: z.input<typeof moveSchema>): Promise<ActionResult> {
  return dashboardAction(
    async (s, t, locale) => {
      const v = moveSchema.parse(input, { error: zodErrorMap(locale) });
      const d = await ownAppointment(s.org.id, v.id);
      const gate = await restrictedChange(s, d.patient, t);
      if ("denied" in gate) return gate.denied;
      const locationId = v.locationId || d.location.id;
      const [loc] = await db
        .select()
        .from(locations)
        .where(and(eq(locations.id, locationId), eq(locations.orgId, s.org.id)));
      if (!loc) return fail(t("errors.officeNotFound"), "not_found");
      if (v.practitionerId) {
        const [p] = await db
          .select({ id: practitioners.id })
          .from(practitioners)
          .where(and(eq(practitioners.id, v.practitionerId), eq(practitioners.orgId, s.org.id)));
        if (!p) return fail(t("errors.practitionerNotFound"), "not_found");
      }
      const minutes = hhmmToMinutes(v.time);
      if (minutes == null) return fail(t("errors.invalidTime"), "invalid");
      await rescheduleAppointment(v.id, {
        startsAt: zonedToUtc(v.date, minutes, loc.timezone),
        practitionerId: v.practitionerId || undefined,
        locationId,
        roomId: v.roomId,
        durationMinutes: v.durationMinutes,
        by: "staff",
        force: v.force,
        notifyPatient: v.notifyPatient,
      });
      await auditStaff(s, "appointment.update", { type: "appointment", id: v.id }, { reason: gate.reason, metadata: { change: "move", notified: v.notifyPatient } });
      return ok(v.notifyPatient ? t("done.movedNotified") : t("done.moved"));
    },
    { permission: "appointment.write" },
  );
}

const reasonSchema = z.string().max(500);

/** Cancel (or decline a request). The reason is internal and stored encrypted. Audited as appointment.cancel. */
export async function cancelByStaff(id: string, reason: string, notifyPatient: boolean): Promise<ActionResult> {
  return dashboardAction(
    async (s, t, locale) => {
      const text = reasonSchema.parse(reason ?? "", { error: zodErrorMap(locale) }).trim();
      const d = await ownAppointment(s.org.id, id);
      const gate = await restrictedChange(s, d.patient, t);
      if ("denied" in gate) return gate.denied;
      const wasRequest = d.appointment.status === "requested";
      const res = await cancelAppointment(id, { by: "staff", reason: text || null, notifyPatient: Boolean(notifyPatient) });
      if (!res) return fail(t("errors.alreadyCancelled"), "not_allowed");
      await auditStaff(s, "appointment.cancel", { type: "appointment", id }, { reason: gate.reason, metadata: { notified: Boolean(notifyPatient), request: wasRequest } });
      return ok(wasRequest ? t("done.declined") : t("done.cancelled"));
    },
    { permission: "appointment.write" },
  );
}

const outcomeSchema = z.enum(["completed", "no_show", "scheduled"]);

/** Record the visit's outcome (or clear it). Audited as appointment.update. */
export async function recordOutcome(id: string, outcome: "completed" | "no_show" | "scheduled"): Promise<ActionResult> {
  return dashboardAction(
    async (s, t, locale) => {
      const v = outcomeSchema.parse(outcome, { error: zodErrorMap(locale) });
      const gate = await restrictedChange(s, (await ownAppointment(s.org.id, id)).patient, t);
      if ("denied" in gate) return gate.denied;
      await setOutcome(id, v);
      await auditStaff(s, "appointment.update", { type: "appointment", id }, { reason: gate.reason, metadata: { change: "outcome", outcome: v } });
      return ok(v === "completed" ? t("done.completed") : v === "no_show" ? t("done.noShow") : t("done.reset"));
    },
    { permission: "appointment.write" },
  );
}

/** The patient confirmed by phone or at the desk. Audited as appointment.update. */
export async function confirmByPhone(id: string): Promise<ActionResult> {
  return dashboardAction(
    async (s, t) => {
      const gate = await restrictedChange(s, (await ownAppointment(s.org.id, id)).patient, t);
      if ("denied" in gate) return gate.denied;
      const res = await confirmAttendance(id, "staff");
      if (!res) return fail(t("errors.notConfirmable"), "not_allowed");
      await auditStaff(s, "appointment.update", { type: "appointment", id }, { reason: gate.reason, metadata: { change: "confirm" } });
      return ok(t("done.confirmed"));
    },
    { permission: "appointment.write" },
  );
}

/** Approve an online request (when the practice reviews online bookings). Audited as appointment.update. */
export async function approve(id: string): Promise<ActionResult> {
  return dashboardAction(
    async (s, t) => {
      const gate = await restrictedChange(s, (await ownAppointment(s.org.id, id)).patient, t);
      if ("denied" in gate) return gate.denied;
      if (!(await approveRequest(id))) return fail(t("errors.notRequest"), "not_allowed");
      await auditStaff(s, "appointment.update", { type: "appointment", id }, { reason: gate.reason, metadata: { change: "approve" } });
      return ok(t("done.approved"));
    },
    { permission: "appointment.write" },
  );
}

/** Send a reminder now on one channel. Audited as appointment.update (the message itself is logged by deliver()). */
export async function remindNow(id: string, channel: Channel): Promise<ActionResult> {
  return dashboardAction(
    async (s, t, locale) => {
      const c = z.enum(CHANNELS).parse(channel, { error: zodErrorMap(locale) });
      const d = await ownAppointment(s.org.id, id);
      if (d.appointment.status !== "scheduled") return fail(t("errors.reminderNotScheduled"), "not_allowed");
      // The reminder engine sends nothing to a restricted or erased patient: say so, and queue nothing.
      if (isRestricted(d.patient)) return fail(t("errors.restrictedNoMessages"), "restricted");
      const summary = await sendReminderNow(id, c, d.appointment.confirmation === "pending");
      if (!summary.sent) return fail(c === "email" ? t("errors.noEmail") : t("errors.noPhone"), "unreachable");
      await auditStaff(s, "appointment.update", { type: "appointment", id }, { metadata: { change: "reminder", channel: c } });
      return ok(t("done.reminderSent", { channel: getT(locale, "common")(`channels.${c}`) }));
    },
    { permission: "appointment.write" },
  );
}

/** The staff note on the appointment (encrypted at rest). Audited as appointment.note.update. */
export async function saveInternalNote(id: string, note: string): Promise<ActionResult> {
  return dashboardAction(
    async (s, t, locale) => {
      const text = z.string().max(NOTE_MAX).parse(note ?? "", { error: zodErrorMap(locale) }).trim();
      const gate = await restrictedChange(s, (await ownAppointment(s.org.id, id)).patient, t);
      if ("denied" in gate) return gate.denied;
      await db
        .update(appointments)
        .set({ internalNote: text || null, updatedAt: new Date() })
        .where(and(eq(appointments.id, id), eq(appointments.orgId, s.org.id)));
      await auditStaff(s, "appointment.note.update", { type: "appointment", id }, { reason: gate.reason, metadata: { cleared: !text } });
      return ok(t("done.noteSaved"));
    },
    { permission: "appointment.notes.write" },
  );
}

/** The front desk dealt with a reply the system couldn't understand. Audited as appointment.update. */
export async function clearAttention(id: string): Promise<ActionResult> {
  return dashboardAction(
    async (s, t) => {
      const [row] = await db
        .update(appointments)
        .set({ needsAttention: false })
        .where(and(eq(appointments.id, id), eq(appointments.orgId, s.org.id)))
        .returning({ id: appointments.id });
      if (!row) return fail(t("errors.not_found"), "not_found");
      await auditStaff(s, "appointment.update", { type: "appointment", id }, { metadata: { change: "handled" } });
      return ok(t("done.handled"));
    },
    { permission: "appointment.write" },
  );
}

type ReadFailure = { ok: false; error: string; code?: string };

/**
 * Read-only actions don't go through guard(): it revalidates the whole dashboard after every
 * success, which would re-render (and re-audit) the calendar each time a drawer opens.
 */
async function readAction<R>(fn: (s: Awaited<ReturnType<typeof staff>>, t: CalendarT, locale: Locale) => Promise<R>): Promise<R | ReadFailure> {
  const s = await staff();
  const { t, locale } = await calendarTexts(s);
  try {
    if (!can(s.role, "calendar.read")) return { ok: false, error: t("errors.forbidden"), code: "forbidden" };
    return await fn(s, t, locale);
  } catch (err) {
    if (err instanceof PermissionError) return { ok: false, error: t("errors.forbidden"), code: "forbidden" };
    if (err && typeof err === "object" && "digest" in err) throw err;
    logError("appointment detail", err);
    return { ok: false, error: t("errors.loadFailed"), code: "unexpected" };
  }
}

/**
 * The drawer's view of one appointment: contacts only with patient.contact.read, notes only with
 * appointment.notes.read, messages only with messages.read; a restricted patient only after a
 * reason was given. Needs calendar.read. Writes one audit row, appointment.view, per call;
 * another org's id is not_found (and not audited).
 */
export async function getAppointmentDetail(id: string): Promise<DetailResult> {
  return readAction<DetailResult>(async (s, t, locale) => {
    if (typeof id !== "string" || !id || id.length > 40) return { ok: false, error: t("errors.not_found"), code: "not_found" };
    const detail = await loadAppointmentDetail(s, id, locale);
    return detail ? { ok: true, data: detail } : { ok: false, error: t("errors.not_found"), code: "not_found" };
  });
}

/**
 * Only the patient's mobile number, for a list row's "Call" button (no notes, no thread): needs
 * calendar.read and patient.contact.read; a restricted patient's number only after a reason was
 * given in the drawer. Audited as appointment.view (view "call").
 */
export async function getAppointmentPhone(id: string): Promise<PhoneResult> {
  return readAction<PhoneResult>(async (s, t) => {
    if (typeof id !== "string" || !id || id.length > 40) return { ok: false, error: t("errors.not_found"), code: "not_found" };
    const res = await loadAppointmentPhone(s, id);
    if (res.ok) return { ok: true, phone: res.phone };
    const error =
      res.code === "forbidden" ? t("drawer.contactsHidden") : res.code === "restricted" ? t("errors.restrictedOpenRecord") : t("errors.not_found");
    return { ok: false, error, code: res.code };
  });
}

/**
 * Open a restricted patient's appointment: records the reason (patient.restricted_access, WP5's
 * grantRestrictedAccess) and returns the detail. Needs patient.restricted.read.
 */
export async function openRestrictedAppointment(id: string, reason: string): Promise<DetailResult> {
  return readAction<DetailResult>(async (s, t, locale) => {
    if (!can(s.role, "patient.restricted.read")) {
      return { ok: false, error: t("errors.forbidden"), code: "forbidden" };
    }
    const text = typeof reason === "string" ? reason.trim().slice(0, 500) : "";
    if (text.length < 3) return { ok: false, error: t("errors.reasonRequired"), code: "reason_required" };
    const [row] = await db
      .select({ patientId: appointments.patientId })
      .from(appointments)
      .where(and(eq(appointments.id, id), eq(appointments.orgId, s.org.id)));
    if (!row) return { ok: false, error: t("errors.not_found"), code: "not_found" };
    try {
      await grantRestrictedAccess(s, row.patientId, text, { headers: await requestHeaders() });
    } catch (err) {
      if (!(err instanceof ErasureError)) throw err;
      if (err.code === "reason_required") return { ok: false, error: t("errors.reasonRequired"), code: "reason_required" };
      // not_restricted: nothing to unlock; show the record as it is.
    }
    const detail = await loadAppointmentDetail(s, id, locale);
    return detail ? { ok: true, data: detail } : { ok: false, error: t("errors.not_found"), code: "not_found" };
  });
}

async function requestHeaders(): Promise<Headers | undefined> {
  try {
    return await headers();
  } catch {
    return undefined;
  }
}
