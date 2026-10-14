"use server";

import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import type { AnamnesisSheetData, AppointmentCareData, CareResult } from "@/components/care/types";
import { db } from "@/db";
import { appointments, locations, patients } from "@/db/schema";
import { getStaffLocale } from "@/i18n/server";
import { getT } from "@/i18n/t";
import { auditStaff } from "@/lib/audit";
import type { StaffSession } from "@/lib/auth";
import { dismissDuplicate, mergePatients } from "@/lib/booking";
import { anamnesisStatuses, auditClinicalView, clinicalAnamnesis, inviteNow, markFormExported, mayReadPatient } from "@/lib/forms";
import { logError } from "@/lib/log";
import { can, PermissionError, permissionsFor, type Permission } from "@/lib/permissions";
import { getCare } from "@/lib/privacy/settings";
import { rebookStatus } from "@/lib/rebooking";
import { appointmentRecall, confirmRecall, dismissRecall, markRecallCalled, RECALL_MONTHS_MAX, RECALL_MONTHS_MIN, setRecallInterval } from "@/lib/recalls";
import { fail, guard, ok, staff, type ActionResult } from "./_shared";

/**
 * Continuity-of-care actions (WP8): a visit's recall interval and care details, recalls, the
 * medical history (clinical team only, audited), and duplicate patients. Texts are in the staff
 * member's language (care namespace).
 */

async function tc() {
  return getT(await getStaffLocale(), "care");
}

/**
 * A read for a client panel: like guard() (session, permission, errors) but without revalidating
 * the dashboard, which a read doesn't change.
 */
async function read<T>(permission: Permission, fn: (s: StaffSession) => Promise<CareResult<T>>): Promise<CareResult<T>> {
  try {
    return await fn(await staff(permission));
  } catch (err) {
    const t = await tc();
    if (err instanceof PermissionError) return { ok: false, error: t("actions.forbidden"), code: "forbidden" };
    if (err && typeof err === "object" && "digest" in err) throw err;
    logError("care action", err);
    return { ok: false, error: t("actions.failed") };
  }
}

/**
 * Everything the appointment drawer's care panel shows for one visit, filtered for the viewer. A
 * restricted patient's visit only after the viewer gave a reason (code "restricted" otherwise),
 * whatever the drawer shows. The red flags (which conditions) only with patient.clinical.read,
 * and showing them is audited as patient.clinical.view.
 */
export async function loadAppointmentCare(appointmentId: string): Promise<CareResult<AppointmentCareData>> {
  return read("calendar.read", async (s) => {
    const [row] = await db
      .select({ a: appointments, timezone: locations.timezone, p: { id: patients.id, restrictedAt: patients.restrictedAt, erasedAt: patients.erasedAt } })
      .from(appointments)
      .innerJoin(locations, eq(locations.id, appointments.locationId))
      .innerJoin(patients, eq(patients.id, appointments.patientId))
      .where(and(eq(appointments.id, appointmentId), eq(appointments.orgId, s.org.id)));
    if (!row) return { ok: false, error: (await tc())("actions.notFound"), code: "not_found" };
    const { a } = row;
    if (!(await mayReadPatient({ orgId: s.org.id, patient: row.p, permissions: permissionsFor(s.role), userId: s.user.id }))) {
      return { ok: false, error: (await tc())("actions.restricted"), code: "restricted" };
    }
    const care = getCare(s.org);
    const clinical = can(s.role, "patient.clinical.read");
    const [recall, forms, rebook] = await Promise.all([
      appointmentRecall(s.org.id, a.id),
      anamnesisStatuses(s.org.id, [a], care),
      rebookStatus(s.org.id, a.id),
    ]);
    const f = forms.get(a.id);
    const redFlags = clinical && f?.status === "complete" ? f.redFlags : null;
    if (redFlags?.length) {
      await auditClinicalView({
        orgId: s.org.id,
        patientId: a.patientId,
        actor: { type: "user", id: s.user.id },
        view: "red_flags",
        metadata: { submissionId: f?.submissionId ?? null, appointmentId: a.id, count: redFlags.length },
        headers: await headers(),
      });
    }
    const upcoming = (a.status === "scheduled" || a.status === "requested") && a.startsAt.getTime() > Date.now();
    return {
      ok: true,
      data: {
        status: a.status,
        timezone: row.timezone,
        recall: recall?.recall ?? null,
        suggestedMonths: recall?.suggestedMonths ?? null,
        canSetInterval: clinical && can(s.role, "recalls.manage"),
        canReadClinical: clinical,
        anamnesis: {
          status: f?.status ?? null,
          signedAt: f?.signedAt?.toISOString() ?? null,
          redFlags,
          canInvite: care.anamnesisEnabled && upcoming && f?.status !== "complete",
        },
        rebook,
      },
    };
  });
}

/** May this viewer act on this visit's patient? Restricted records need a recent reason (mayReadPatient). */
async function visitOpen(s: StaffSession, appointmentId: string): Promise<boolean> {
  const [p] = await db
    .select({ id: patients.id, restrictedAt: patients.restrictedAt, erasedAt: patients.erasedAt })
    .from(appointments)
    .innerJoin(patients, eq(patients.id, appointments.patientId))
    .where(and(eq(appointments.id, appointmentId), eq(appointments.orgId, s.org.id)));
  return !p || (await mayReadPatient({ orgId: s.org.id, patient: p, permissions: permissionsFor(s.role), userId: s.user.id }));
}

/** A clinician's recall decision after a completed visit: `months` (3–24) or none (null). */
export async function setRecallIntervalAction(appointmentId: string, months: number | null): Promise<ActionResult> {
  return guard(
    async (s) => {
      const t = await tc();
      if (!can(s.role, "patient.clinical.read")) return fail(t("panel.recall.clinicianOnly"), "forbidden");
      if (!(await visitOpen(s, appointmentId))) return fail(t("actions.restricted"), "restricted");
      if (months !== null && (!Number.isInteger(months) || months < RECALL_MONTHS_MIN || months > RECALL_MONTHS_MAX)) {
        return fail(t("actions.failed"), "invalid");
      }
      const recall = await setRecallInterval({
        orgId: s.org.id,
        appointmentId,
        months,
        actor: { userId: s.user.id, headers: await headers() },
      });
      if (!recall && months !== null) return fail(t("panel.recall.afterCompletion"), "not_completed");
      return ok(months === null ? t("panel.recall.removed") : t("panel.recall.saved"));
    },
    { permission: "recalls.manage" },
  );
}

/** A clinician confirms an interval suggested by the treatment: the recall may now be sent. */
export async function confirmRecallAction(recallId: string): Promise<ActionResult> {
  return guard(
    async (s) => {
      const t = await tc();
      if (!can(s.role, "patient.clinical.read")) return fail(t("panel.recall.clinicianOnly"), "forbidden");
      const done = await confirmRecall(s.org.id, recallId, { userId: s.user.id, headers: await headers() });
      return done ? ok(t("recalls.actions.confirmed")) : fail(t("recalls.actions.notFound"), "not_found");
    },
    { permission: "recalls.manage" },
  );
}

export async function dismissRecallAction(recallId: string): Promise<ActionResult> {
  return guard(
    async (s) => {
      const t = await tc();
      const done = await dismissRecall(s.org.id, recallId, { userId: s.user.id, headers: await headers() });
      return done ? ok(t("recalls.actions.dismissed")) : fail(t("recalls.actions.notFound"), "not_found");
    },
    { permission: "recalls.manage" },
  );
}

export async function markRecallCalledAction(recallId: string): Promise<ActionResult> {
  return guard(
    async (s) => {
      const t = await tc();
      const done = await markRecallCalled(s.org.id, recallId, { userId: s.user.id, headers: await headers() });
      return done ? ok(t("recalls.actions.calledDone")) : fail(t("recalls.actions.notFound"), "not_found");
    },
    { permission: "recalls.manage" },
  );
}

/**
 * The medical history for the clinical team: the form that counts for a visit, or one submission.
 * Needs patient.clinical.read; a restricted patient's also a recent restricted-access reason.
 * Every opening is audited as patient.clinical.view (src/lib/forms.ts).
 */
export async function loadAnamnesis(target: { appointmentId?: string; submissionId?: string }): Promise<CareResult<AnamnesisSheetData>> {
  return read("patient.clinical.read", async (s) => {
    const t = await tc();
    const res = await clinicalAnamnesis({
      orgId: s.org.id,
      appointmentId: target.appointmentId,
      submissionId: target.submissionId,
      permissions: permissionsFor(s.role),
      actor: { type: "user", id: s.user.id },
      headers: await headers(),
    });
    if (!res.ok) {
      const error = res.reason === "forbidden" ? t("sheet.forbidden") : res.reason === "restricted" ? t("actions.restricted") : t("sheet.notFound");
      return { ok: false, error, code: res.reason };
    }
    const f = res.form;
    const [visit] = f.appointment
      ? await db
          .select({ timezone: locations.timezone })
          .from(appointments)
          .innerJoin(locations, eq(locations.id, appointments.locationId))
          .where(and(eq(appointments.id, f.appointment.id), eq(appointments.orgId, s.org.id)))
      : [];
    return {
      ok: true,
      data: {
        id: f.id,
        version: f.version,
        locale: f.locale,
        signedAt: f.signedAt.toISOString(),
        signerName: f.signerName,
        signedVia: f.signedVia,
        exportedAt: f.exportedAt?.toISOString() ?? null,
        redFlags: f.redFlags,
        answers: f.answers,
        schema: f.schema,
        patient: f.patient,
        visit: f.appointment && visit ? { start: f.appointment.startsAt.toISOString(), timezone: visit.timezone } : null,
        clinic: s.org.name,
      },
    };
  });
}

/** The form was printed or copied into the clinical record (retention may delete it only after that). */
export async function markFormExportedAction(submissionId: string): Promise<ActionResult> {
  return guard(
    async (s) => {
      const t = await tc();
      const done = await markFormExported({
        orgId: s.org.id,
        submissionId,
        permissions: permissionsFor(s.role),
        actor: { type: "user", id: s.user.id },
      });
      return done ? ok(t("sheet.exportedDone")) : fail(t("sheet.notFound"), "not_found");
    },
    { permission: "patient.clinical.read" },
  );
}

/** Send the medical-history form link for an upcoming visit now. */
export async function sendFormInviteAction(appointmentId: string): Promise<ActionResult> {
  return guard(
    async (s) => {
      const t = await tc();
      const res = await inviteNow(s.org.id, appointmentId);
      if (res === "closed") return fail(t("panel.anamnesis.closed"), "closed");
      await auditStaff(s, "appointment.update", { type: "appointment", id: appointmentId }, { metadata: { formInvite: res === "sent" } });
      return res === "sent" ? ok(t("panel.anamnesis.sent")) : fail(t("panel.anamnesis.notSent"), "unreachable");
    },
    { permission: "appointment.write" },
  );
}

/** Merge `mergeId` into `keepId` after staff confirmed they are the same person (audited patient.merge). */
export async function mergePatientsAction(keepId: string, mergeId: string): Promise<ActionResult> {
  return guard(
    async (s) => {
      const t = await tc();
      const res = await mergePatients({ orgId: s.org.id, keepId, mergeId, actor: { type: "user", id: s.user.id }, headers: await headers() });
      return res.ok ? ok(t("duplicates.merged")) : fail(t(`duplicates.errors.${res.code}`), res.code);
    },
    { permission: "patient.write" },
  );
}

/** Two flagged records are different people. */
export async function dismissDuplicateAction(patientId: string): Promise<ActionResult> {
  return guard(
    async (s) => {
      const t = await tc();
      const done = await dismissDuplicate({ orgId: s.org.id, patientId, actor: { type: "user", id: s.user.id }, headers: await headers() });
      return done ? ok(t("duplicates.dismissed")) : fail(t("duplicates.errors.not_found"), "not_found");
    },
    { permission: "patient.write" },
  );
}
