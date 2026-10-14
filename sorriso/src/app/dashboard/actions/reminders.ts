"use server";

import { z } from "zod";
import { CHANNELS, type ReminderRule } from "@/db/schema";
import { processDueReminders } from "@/lib/reminders";
import { guard, ok, updateSettings, type ActionResult } from "./_shared";

/** Reminder rules and the manual reminder run (WP3). */

const rulesSchema = z
  .array(
    z.object({
      id: z.string(),
      channel: z.enum(CHANNELS),
      offsetMinutes: z.number().int().min(15).max(14 * 24 * 60),
      askConfirmation: z.boolean(),
      fallbackToEmail: z.boolean(),
    }),
  )
  .max(6);

export async function saveReminderSettings(input: {
  rules: ReminderRule[];
  sendBookingConfirmation: boolean;
  requestReviews: boolean;
  autoOfferToWaitlist: boolean;
}): Promise<ActionResult> {
  return guard(
    async (s) => {
      const rules = rulesSchema.parse(input.rules).sort((a, b) => b.offsetMinutes - a.offsetMinutes);
      await updateSettings(s.org.id, (cur) => ({
        ...cur,
        reminders: {
          ...cur.reminders,
          rules,
          sendBookingConfirmation: input.sendBookingConfirmation,
          requestReviews: input.requestReviews,
          autoOfferToWaitlist: input.autoOfferToWaitlist,
        },
      }));
      return ok("Reminder rules saved. They apply to new bookings and anything you reschedule.");
    },
    { permission: "reminders.manage" },
  );
}

/**
 * Process every practice's due reminders now. Any staff member may run it today (no permission
 * checked); WP3 restricts it to reminders.run and to the current org.
 */
export async function runRemindersNow(): Promise<ActionResult> {
  return guard(async () => {
    const summary = await processDueReminders();
    return ok(`Processed ${summary.due} due reminder${summary.due === 1 ? "" : "s"}: ${summary.sent} sent, ${summary.skipped} skipped, ${summary.failed} failed.`);
  });
}
