import { createHmac, timingSafeEqual } from "node:crypto";
import { isDemoMode } from "./demo";
import { twilioWebhookToken } from "./messaging/providers";

/**
 * Validate X-Twilio-Signature: base64(HMAC-SHA1(authToken, url + sorted(key+value)...)).
 * https://www.twilio.com/docs/usage/webhooks/webhooks-security
 */
export function validTwilioSignature(url: string, params: Record<string, string>, signature: string | null, authToken: string) {
  if (!signature) return false;
  const data = Object.keys(params)
    .sort()
    .reduce((acc, key) => acc + key + params[key], url);
  const expected = createHmac("sha1", authToken).update(data).digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/** Is this request addressed to the local machine (by URL and Host header)? */
function isLocalRequest(req: Request): boolean {
  const url = new URL(req.url);
  const host = (req.headers.get("host") ?? url.host).replace(/:\d+$/, "").toLowerCase();
  return LOCAL_HOSTS.has(url.hostname.toLowerCase()) && LOCAL_HOSTS.has(host);
}

/**
 * Check a Twilio webhook. The signature is validated with the auth token of the region that sends
 * this channel's webhooks: IE1 for SMS when TWILIO_REGION=ie1, US1 for WhatsApp (providers.ts).
 * Without a token the request is refused, except in demo mode on localhost (a developer posting
 * by hand); everything else gets 403.
 */
export function verifyTwilioWebhook(
  req: Request,
  url: string,
  params: Record<string, string>,
  channel: "sms" | "whatsapp",
): { ok: true } | { ok: false; status: 403 } {
  const token = twilioWebhookToken(channel);
  if (!token) return isDemoMode() && isLocalRequest(req) ? { ok: true } : { ok: false, status: 403 };
  return validTwilioSignature(url, params, req.headers.get("x-twilio-signature"), token) ? { ok: true } : { ok: false, status: 403 };
}

/** The channel of a Twilio webhook: WhatsApp addresses carry the "whatsapp:" prefix. */
export function webhookChannel(params: Record<string, string>): "sms" | "whatsapp" {
  return /^whatsapp:/i.test(params.From ?? "") || /^whatsapp:/i.test(params.To ?? "") ? "whatsapp" : "sms";
}

export function twiml(message: string | null) {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const body = message ? `<Message>${esc(message)}</Message>` : "";
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`, {
    headers: { "Content-Type": "text/xml" },
  });
}
