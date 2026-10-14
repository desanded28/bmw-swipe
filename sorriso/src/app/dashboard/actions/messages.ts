"use server";

import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { messages, patients } from "@/db/schema";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/i18n/config";
import { getStaffLocale, getT } from "@/i18n/server";
import { auditStaff } from "@/lib/audit";
import type { StaffSession } from "@/lib/auth";
import { isDemoMode } from "@/lib/demo";
import { handleInboundMessage } from "@/lib/inbound";
import { normalizePhone } from "@/lib/phone";
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

/** The message thread of one appointment (the drawer's history). Reading it is audited. */
export async function appointmentMessages(id: string) {
  const s = await staff("messages.read");
  const rows = await db
    .select()
    .from(messages)
    .where(and(eq(messages.appointmentId, id), eq(messages.orgId, s.org.id)))
    .orderBy(asc(messages.createdAt));
  if (rows.length) {
    await auditStaff(s, "appointment.view", { type: "appointment", id }, { metadata: { view: "messages", count: rows.length } });
  }
  return rows;
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
