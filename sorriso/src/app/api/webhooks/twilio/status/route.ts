import { eq } from "drizzle-orm";
import { db } from "@/db";
import { messages } from "@/db/schema";
import { absoluteUrl } from "@/lib/config";
import { validTwilioSignature } from "@/lib/twilio";

/** Delivery receipts: Twilio calls this as messages move to delivered / failed. */
export async function POST(req: Request) {
  const form = await req.formData();
  const params = Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]));
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token || !validTwilioSignature(absoluteUrl("/api/webhooks/twilio/status"), params, req.headers.get("x-twilio-signature"), token)) {
    return new Response("Invalid signature", { status: 403 });
  }
  const sid = params.MessageSid;
  const status = params.MessageStatus;
  if (sid && status) {
    const mapped = status === "delivered" || status === "read" ? "delivered" : status === "failed" || status === "undelivered" ? "failed" : null;
    if (mapped) {
      await db
        .update(messages)
        .set({ status: mapped, error: mapped === "failed" ? `${status} (${params.ErrorCode ?? "?"})` : null })
        .where(eq(messages.providerId, sid));
    }
  }
  return new Response(null, { status: 204 });
}
