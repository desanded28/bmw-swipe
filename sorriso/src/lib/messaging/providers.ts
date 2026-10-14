import nodemailer, { type Transporter } from "nodemailer";
import { APP_NAME, APP_URL } from "../config";

/**
 * Delivery providers. Each one is optional: when its environment variables are
 * missing the message is "captured" (stored in the message log and shown in the
 * dashboard's Messages page) instead of being delivered. That makes the whole
 * reminder/confirmation loop testable locally without any accounts.
 *
 *   Email     SMTP_URL=smtp://user:pass@smtp.example.com:587   EMAIL_FROM="Studio <noreply@…>"
 *             (works with any SMTP service: Resend, Postmark, SES, Mailgun, Gmail…)
 *   SMS       TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM (or TWILIO_MESSAGING_SERVICE_SID)
 *   WhatsApp  TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_WHATSAPP_FROM
 */

export type Attachment = { filename: string; content: string; contentType: string };

export type SendResult = { status: "sent" | "captured"; provider: string; providerId: string | null; from: string | null };

export function providerStatus() {
  return {
    email: process.env.SMTP_URL ? "smtp" : "captured",
    sms: twilioConfigured() && (process.env.TWILIO_FROM || process.env.TWILIO_MESSAGING_SERVICE_SID) ? "twilio" : "captured",
    whatsapp: twilioConfigured() && process.env.TWILIO_WHATSAPP_FROM ? "twilio" : "captured",
  } as const;
}

let transporter: Transporter | null = null;
function getTransporter(): Transporter | null {
  if (!process.env.SMTP_URL) return null;
  transporter ??= nodemailer.createTransport(process.env.SMTP_URL);
  return transporter;
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  fromName?: string;
  replyTo?: string | null;
  attachments?: Attachment[];
}): Promise<SendResult> {
  const fromAddress = process.env.EMAIL_FROM ?? `${APP_NAME} <no-reply@localhost>`;
  // Show the practice name as sender while sending from the platform's domain.
  const from = input.fromName ? `"${input.fromName.replace(/"/g, "")}" <${extractAddress(fromAddress)}>` : fromAddress;
  const t = getTransporter();
  if (!t) return { status: "captured", provider: "dev", providerId: null, from };
  const info = await t.sendMail({
    from,
    to: input.to,
    replyTo: input.replyTo ?? undefined,
    subject: input.subject,
    text: input.text,
    html: input.html,
    attachments: input.attachments?.map((a) => ({ filename: a.filename, content: a.content, contentType: a.contentType })),
  });
  return { status: "sent", provider: "smtp", providerId: info.messageId ?? null, from };
}

function extractAddress(from: string): string {
  const m = from.match(/<([^>]+)>/);
  return m ? m[1] : from;
}

function twilioConfigured() {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
}

async function twilioSend(params: Record<string, string>): Promise<string> {
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const auth = Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64");
  const body = new URLSearchParams({ ...params, StatusCallback: `${APP_URL}/api/webhooks/twilio/status` });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json().catch(() => ({}))) as { sid?: string; message?: string; code?: number };
  if (!res.ok || !json.sid) throw new Error(`Twilio ${res.status}: ${json.message ?? "unknown error"} (${json.code ?? "-"})`);
  return json.sid;
}

export async function sendSms(input: { to: string; text: string }): Promise<SendResult> {
  const from = process.env.TWILIO_FROM ?? null;
  const service = process.env.TWILIO_MESSAGING_SERVICE_SID;
  if (!twilioConfigured() || (!from && !service)) return { status: "captured", provider: "dev", providerId: null, from };
  const providerId = await twilioSend({
    To: input.to,
    Body: input.text,
    ...(service ? { MessagingServiceSid: service } : { From: from! }),
  });
  return { status: "sent", provider: "twilio", providerId, from };
}

/**
 * WhatsApp via Twilio. Note: business-initiated WhatsApp messages outside the
 * 24h customer-care window must use a Meta-approved template. Set
 * TWILIO_WHATSAPP_CONTENT_SID to send the reminder through an approved Content
 * template (variables: 1=name, 2=date/time, 3=practice, 4=manage link).
 */
export async function sendWhatsApp(input: { to: string; text: string; variables?: Record<string, string> }): Promise<SendResult> {
  const from = process.env.TWILIO_WHATSAPP_FROM ?? null;
  if (!twilioConfigured() || !from) return { status: "captured", provider: "dev", providerId: null, from };
  const contentSid = process.env.TWILIO_WHATSAPP_CONTENT_SID;
  const providerId = await twilioSend({
    To: `whatsapp:${input.to}`,
    From: `whatsapp:${from}`,
    ...(contentSid && input.variables
      ? { ContentSid: contentSid, ContentVariables: JSON.stringify(input.variables) }
      : { Body: input.text }),
  });
  return { status: "sent", provider: "twilio", providerId, from };
}

/**
 * Delete a sent message's copy at the provider (data minimisation; also called by erasure, WP5).
 * `provider` and `providerId` are the values stored on the messages row. Never throws for a
 * message that is already gone.
 *
 * STUB with its final signature (WP3): a no-op. WP3 implements the Twilio Message DELETE (SMS and
 * WhatsApp) through the configured region and edge, and the cleanup step that sets
 * messages.providerDeletedAt. Email can't be recalled from an SMTP relay: a no-op there too.
 */
export async function deleteProviderMessage(provider: string, providerId: string): Promise<void> {
  void provider;
  void providerId;
}
