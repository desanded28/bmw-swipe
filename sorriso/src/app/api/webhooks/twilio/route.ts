import { absoluteUrl } from "@/lib/config";
import { handleInboundMessage } from "@/lib/inbound";
import { logError } from "@/lib/log";
import { twiml, verifyTwilioWebhook, webhookChannel } from "@/lib/twilio";

/**
 * Twilio inbound webhook for SMS and WhatsApp replies.
 * Configure your Twilio number / WhatsApp sender "A message comes in" → POST {APP_URL}/api/webhooks/twilio
 * We answer inline with TwiML (no extra API call, no extra latency). The reply is matched to one
 * practice: the one whose own number (organizations.inboundNumber) received it, else the one that
 * last texted this number on the shared sender (src/lib/inbound.ts).
 */
export async function POST(req: Request) {
  const form = await req.formData();
  const params = Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]));
  const channel = webhookChannel(params);

  const check = verifyTwilioWebhook(req, absoluteUrl("/api/webhooks/twilio"), params, channel);
  if (!check.ok) return new Response("Invalid signature", { status: check.status });

  try {
    const result = await handleInboundMessage({
      channel,
      from: params.From ?? "",
      to: params.To ?? null,
      messagingServiceSid: params.MessagingServiceSid ?? null,
      body: params.Body ?? "",
      providerId: params.MessageSid ?? null,
      replyMode: "return",
    });
    return twiml(result.reply);
  } catch (err) {
    // Never echo the error (it may quote the message); Twilio retries on 5xx.
    logError("twilio-webhook", err, { channel });
    return new Response("Error", { status: 500 });
  }
}
