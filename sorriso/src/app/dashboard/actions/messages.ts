"use server";

import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { appointments, messages, patients } from "@/db/schema";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/i18n/config";
import { getStaffLocale, getT } from "@/i18n/server";
import { auditStaff } from "@/lib/audit";
import type { StaffSession } from "@/lib/auth";
import { redactPatientLinks } from "@/lib/dashboard";
import { isDemoMode } from "@/lib/demo";
import { handleInboundMessage } from "@/lib/inbound";
import { can } from "@/lib/permissions";
import { normalizePhone } from "@/lib/phone";
import { hasRestrictedAccess } from "@/lib/privacy/erasure";
import { fail, guard, ok, staff, type ActionResult } from "./_shared";

/** Message log and the reply simulator (WP3). */

async function staffT(s: StaffSession) {
  let locale: Locale;
  try {
    locale = await getStaffLocale();
  } catch {
    locale = isLocale(s.user.locale) ? s.user.locale : isLocale(s.org.defaultLocale) ? s.org.defaultLocale : DEFAULT_LOCALE;
  }
  return getT(locale, "reminders");
}

/**
 * The message thread of one appointment, oldest first. The calendar drawer gets the thread with
 * the appointment's detail (loadAppointmentDetail) and doesn't call this; it follows the same
 * rules:
 * - a restricted or erased patient's thread only with patient.restricted.read and a reason given
 *   (hasRestrictedAccess), else nothing;
 * - patients' personal links (manage page, calendar file) are replaced by a placeholder: staff get
 *   those only through issuePatientLink(), which is audited;
 * - reading it is audited as message.view on the appointment (not appointment.view: the drawer's
 *   own row stays the only one), with the patient for their access log.
 * Another practice's appointment gives nothing.
 */
export async function appointmentMessages(id: string) {
  const s = await staff("messages.read");
  const [appt] = await db
    .select({ patientId: patients.id, restrictedAt: patients.restrictedAt, erasedAt: patients.erasedAt })
    .from(appointments)
    .innerJoin(patients, and(eq(patients.id, appointments.patientId), eq(patients.orgId, s.org.id)))
    .where(and(eq(appointments.id, id), eq(appointments.orgId, s.org.id)));
  if (!appt) return [];
  if (appt.restrictedAt || appt.erasedAt) {
    const unlocked = can(s.role, "patient.restricted.read") && (await hasRestrictedAccess(s, appt.patientId));
    if (!unlocked) return [];
  }
  const rows = await db
    .select({
      id: messages.id,
      channel: messages.channel,
      direction: messages.direction,
      status: messages.status,
      intent: messages.intent,
      createdAt: messages.createdAt,
      subject: messages.subject,
      body: messages.body,
    })
    .from(messages)
    .where(and(eq(messages.appointmentId, id), eq(messages.orgId, s.org.id)))
    .orderBy(asc(messages.createdAt));
  if (!rows.length) return [];
  await auditStaff(
    s,
    "message.view",
    { type: "appointment", id },
    { metadata: { view: "thread", count: rows.length, patientId: appt.patientId } },
  );
  const linkLabel = (await staffT(s))("messages.linkRedacted");
  return rows.map((m) => ({
    ...m,
    subject: m.subject === null ? null : redactPatientLinks(m.subject, linkLabel),
    body: redactPatientLinks(m.body, linkLabel),
  }));
}

/**
 * Feed a fake SMS/WhatsApp reply from one of the practice's patients through the inbound handler,
 * scoped to this practice. Demo mode only (DEMO_MODE=1), with the messages.simulate permission:
 * on a real deployment a simulated "NO" would cancel a real patient's visit.
 */
export async function simulateReply(phone: string, body: string, channel: "sms" | "whatsapp"): Promise<ActionResult> {
  return guard(
    async (s) => {
      const t = await staffT(s);
      if (!isDemoMode()) return fail(t("actions.demoOnly"), "not_available");
      const normalized = normalizePhone(phone);
      if (!normalized) return fail(t("actions.invalidPhone"), "invalid");
      const [p] = await db
        .select({ id: patients.id })
        .from(patients)
        .where(and(eq(patients.orgId, s.org.id), eq(patients.phone, normalized)));
      if (!p) return fail(t("actions.noPatient"), "not_found");
      const res = await handleInboundMessage({
        channel: channel === "whatsapp" ? "whatsapp" : "sms",
        from: normalized,
        body: body.slice(0, 1000),
        replyMode: "deliver",
        orgId: s.org.id,
      });
      await auditStaff(
        s,
        "appointment.update",
        res.appointmentId ? { type: "appointment", id: res.appointmentId } : { type: "patient", id: p.id },
        { metadata: { simulated: true, intent: res.intent } },
      );
      const intent = t(`messages.intent.${res.intent}`);
      return ok(res.reply ? t("actions.simulatedReply", { intent, reply: res.reply }) : t("actions.simulated", { intent }));
    },
    { permission: "messages.simulate" },
  );
}
