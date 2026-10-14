"use server";

import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { messages, patients } from "@/db/schema";
import { handleInboundMessage } from "@/lib/inbound";
import { normalizePhone } from "@/lib/phone";
import { fail, guard, ok, staff, type ActionResult } from "./_shared";

/** Message log and the reply simulator (WP3). */

/** The message thread of one appointment (the drawer's history). */
export async function appointmentMessages(id: string) {
  const s = await staff("messages.read");
  return db
    .select()
    .from(messages)
    .where(and(eq(messages.appointmentId, id), eq(messages.orgId, s.org.id)))
    .orderBy(asc(messages.createdAt));
}

/**
 * Feed a fake SMS/WhatsApp reply from one of the practice's patients through the inbound handler.
 * Any staff member may use it today (no permission checked); WP3 restricts it to
 * messages.simulate and demo mode.
 */
export async function simulateReply(phone: string, body: string, channel: "sms" | "whatsapp"): Promise<ActionResult> {
  return guard(async (s) => {
    const normalized = normalizePhone(phone);
    if (!normalized) return fail("Enter a valid phone number.");
    const [p] = await db
      .select({ id: patients.id })
      .from(patients)
      .where(and(eq(patients.orgId, s.org.id), eq(patients.phone, normalized)));
    if (!p) return fail("No patient of this practice has that number.");
    const res = await handleInboundMessage({ channel, from: normalized, body, replyMode: "deliver", orgId: s.org.id });
    return ok(`Understood as “${res.intent}”.${res.reply ? ` Auto-reply: ${res.reply}` : ""}`);
  });
}
