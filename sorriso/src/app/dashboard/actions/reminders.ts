"use server";

import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { CHANNELS, organizations, type ReminderRule } from "@/db/schema";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/i18n/config";
import { getStaffLocale, getT } from "@/i18n/server";
import { auditStaff } from "@/lib/audit";
import type { StaffSession } from "@/lib/auth";
import { isMessagingServiceSid, isPlatformSender, senderKey } from "@/lib/messaging/providers";
import { normalizePhone } from "@/lib/phone";
import { processDueReminders } from "@/lib/reminders";
import { fail, guard, ok, updateSettings, type ActionResult } from "./_shared";

/** Reminder rules, the manual reminder run and the practice's reply number (WP3). */

const rulesSchema = z
  .array(
    z.object({
      id: z.string().max(40),
      channel: z.enum(CHANNELS),
      offsetMinutes: z.number().int().min(15).max(14 * 24 * 60),
      askConfirmation: z.boolean(),
      fallbackToEmail: z.boolean(),
      onlyIfRisk: z.enum(["medium", "high"]).optional(),
    }),
  )
  .max(6);

/** The staff member's dashboard language (their choice, then the request, then the practice's). */
async function staffT(s: StaffSession) {
  let locale: Locale;
  try {
    locale = await getStaffLocale();
  } catch {
    // Outside a request (tests, scripts): the session's own preference.
    locale = isLocale(s.user.locale) ? s.user.locale : isLocale(s.org.defaultLocale) ? s.org.defaultLocale : DEFAULT_LOCALE;
  }
  return getT(locale, "reminders");
}

export async function saveReminderSettings(input: {
  rules: ReminderRule[];
  sendBookingConfirmation: boolean;
  requestReviews: boolean;
  autoOfferToWaitlist: boolean;
  smsAsciiFallback?: boolean;
}): Promise<ActionResult> {
  return guard(
    async (s) => {
      const rules = rulesSchema
        .parse(input.rules)
        // Rule ids are kept only as letters, digits and dashes (reminder rows derive from them).
        .map((r) => ({ ...r, id: r.id.replace(/[^A-Za-z0-9-]/g, "").slice(0, 24) || `r${r.offsetMinutes}` }))
        .sort((a, b) => b.offsetMinutes - a.offsetMinutes);
      await updateSettings(s.org.id, (cur) => ({
        ...cur,
        reminders: {
          ...cur.reminders,
          rules,
          sendBookingConfirmation: input.sendBookingConfirmation === true,
          requestReviews: input.requestReviews === true,
          autoOfferToWaitlist: input.autoOfferToWaitlist === true,
          smsAsciiFallback: input.smsAsciiFallback === undefined ? cur.reminders.smsAsciiFallback : input.smsAsciiFallback === true,
        },
      }));
      return ok((await staffT(s))("actions.saved"));
    },
    { permission: "reminders.manage", audit: "settings.update" },
  );
}

/**
 * Process this practice's due reminders now (never another practice's). It reads patients'
 * contacts and sends them messages, so the run is on the access log with its counts. The audit
 * list has no reminders action yet (requested as "reminders.run"); appointment.update on the
 * practice is the closest.
 */
export async function runRemindersNow(): Promise<ActionResult> {
  return guard(
    async (s) => {
      const summary = await processDueReminders({ orgId: s.org.id });
      await auditStaff(
        s,
        "appointment.update",
        { type: "org", id: s.org.id },
        {
          metadata: {
            job: "reminders.run",
            due: summary.due,
            sent: summary.sent,
            skipped: summary.skipped,
            failed: summary.failed,
            retry: summary.retry,
          },
        },
      );
      const t = await staffT(s);
      return ok(t("actions.ran", { count: summary.due, sent: summary.sent, skipped: summary.skipped, failed: summary.failed }));
    },
    { permission: "reminders.run" },
  );
}

/**
 * The number (E.164) or Twilio Messaging Service SID on which this practice receives replies
 * (organizations.inboundNumber): replies arriving there are matched to this practice only
 * (src/lib/inbound.ts), and its SMS go out from it. Owners only. An empty value clears it.
 * Never one of the platform's shared senders (TWILIO_FROM, TWILIO_MESSAGING_SERVICE_SID,
 * TWILIO_WHATSAPP_FROM, TWILIO_SHARED_SENDERS): every practice's patients reply to those, and the
 * practice claiming one would receive them all.
 */
export async function saveInboundNumber(value: string): Promise<ActionResult> {
  return guard(async (s) => {
    const t = await staffT(s);
    if (s.role !== "owner") return fail(t("actions.ownerOnly"), "forbidden");
    const raw = value.trim();
    let next: string | null = null;
    if (raw) {
      next = isMessagingServiceSid(raw) ? senderKey(raw) : raw.startsWith("+") || raw.startsWith("00") ? normalizePhone(raw) : null;
      if (!next) return fail(t("actions.inboundInvalid"), "invalid");
      if (isPlatformSender(next)) return fail(t("actions.inboundShared"), "shared");
      const [taken] = await db
        .select({ id: organizations.id })
        .from(organizations)
        .where(and(eq(organizations.inboundNumber, next), ne(organizations.id, s.org.id)));
      if (taken) return fail(t("actions.inboundTaken"), "taken");
    }
    await db.update(organizations).set({ inboundNumber: next }).where(eq(organizations.id, s.org.id));
    await auditStaff(s, "settings.update", { type: "org", id: s.org.id }, { metadata: { field: "inboundNumber", set: Boolean(next) } });
    return ok(t(next ? "actions.inboundSaved" : "actions.inboundCleared"));
  }, { permission: "settings.manage" });
}
