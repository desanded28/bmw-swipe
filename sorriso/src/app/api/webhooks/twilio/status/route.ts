import { and, eq, like, or } from "drizzle-orm";
import { db } from "@/db";
import { messages } from "@/db/schema";
import { absoluteUrl } from "@/lib/config";
import { redact } from "@/lib/log";
import { verifyTwilioWebhook, webhookChannel } from "@/lib/twilio";

/** Twilio statuses after which nothing changes any more (the provider copy may then be deleted). */
const FINAL = new Set(["delivered", "undelivered", "failed", "read", "canceled"]);

/**
 * Delivery receipts: Twilio calls this as messages move to delivered / failed. Final statuses
 * record messages.finalStatusAt; the reminders cron later deletes the provider's copy
 * (privacy.retention.providerMessageDays).
 */
export async function POST(req: Request) {
  const form = await req.formData();
  const params = Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]));
  const check = verifyTwilioWebhook(req, absoluteUrl("/api/webhooks/twilio/status"), params, webhookChannel(params));
  if (!check.ok) return new Response("Invalid signature", { status: check.status });

  const sid = params.MessageSid;
  const status = params.MessageStatus?.toLowerCase();
  if (sid && status) {
    const mapped =
      status === "delivered" || status === "read" ? "delivered" : status === "failed" || status === "undelivered" ? "failed" : null;
    const final = FINAL.has(status);
    if (mapped || final) {
      await db
        .update(messages)
        .set({
          ...(mapped ? { status: mapped, error: mapped === "failed" ? redact(`${status} (${params.ErrorCode ?? "?"})`) : null } : {}),
          ...(final ? { finalStatusAt: new Date() } : {}),
        })
        .where(and(eq(messages.providerId, sid), or(eq(messages.provider, "twilio"), like(messages.provider, "twilio:%"))));
    }
  }
  return new Response(null, { status: 204 });
}
