import { createHmac, timingSafeEqual } from "node:crypto";

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

export function twiml(message: string | null) {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const body = message ? `<Message>${esc(message)}</Message>` : "";
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`, {
    headers: { "Content-Type": "text/xml" },
  });
}
