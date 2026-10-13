import { absoluteUrl } from "@/lib/config";
import { handleInboundMessage } from "@/lib/inbound";
import { twiml, validTwilioSignature } from "@/lib/twilio";

/**
 * Twilio inbound webhook for SMS and WhatsApp replies.
 * Configure your Twilio number / WhatsApp sender "A message comes in" → POST {APP_URL}/api/webhooks/twilio
 * We answer inline with TwiML (no extra API call, no extra latency).
 */
export async function POST(req: Request) {
  const form = await req.formData();
  const params = Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]));

  const token = process.env.TWILIO_AUTH_TOKEN;
  if (token) {
    const url = absoluteUrl("/api/webhooks/twilio");
    if (!validTwilioSignature(url, params, req.headers.get("x-twilio-signature"), token)) {
      return new Response("Invalid signature", { status: 403 });
    }
  } else if (process.env.NODE_ENV === "production") {
    return new Response("TWILIO_AUTH_TOKEN not configured", { status: 503 });
  }

  const from = params.From ?? "";
  const result = await handleInboundMessage({
    channel: from.startsWith("whatsapp:") ? "whatsapp" : "sms",
    from,
    to: params.To ?? null,
    body: params.Body ?? "",
    providerId: params.MessageSid ?? null,
    replyMode: "return",
  });
  return twiml(result.reply);
}
