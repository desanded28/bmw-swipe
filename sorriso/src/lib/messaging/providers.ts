import nodemailer, { type Transporter } from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import { APP_NAME, APP_URL } from "../config";
import { isAllowedRecipient } from "../demo";
import { normalizePhone } from "../phone";

/**
 * Delivery providers. Each one is optional: when its environment variables are missing the
 * message is "captured" (stored in the message log and shown in the dashboard's Messages page)
 * instead of being delivered. That makes the whole reminder/confirmation loop testable locally
 * without any accounts. Outside the live deployment (and always in demo mode) a configured
 * provider still only delivers to MESSAGING_ALLOWLIST; everyone else is "captured" too
 * (isAllowedRecipient in src/lib/demo.ts).
 *
 *   Email     SMTP_URL=smtp://user:pass@smtp.example.eu:587   EMAIL_FROM="Studio <noreply@…>"
 *             STARTTLS with TLS 1.2+ is required unless SMTP_REQUIRE_TLS=0 (a local test server).
 *   SMS       TWILIO_ACCOUNT_SID + TWILIO_FROM (or TWILIO_MESSAGING_SERVICE_SID), and either
 *             TWILIO_AUTH_TOKEN (default US1 region) or, with TWILIO_REGION=ie1 and
 *             TWILIO_EDGE=dublin, the IE1 credentials TWILIO_IE1_API_KEY_SID/SECRET (or
 *             TWILIO_IE1_AUTH_TOKEN): requests then go to https://api.dublin.ie1.twilio.com.
 *   WhatsApp  TWILIO_WHATSAPP_FROM, always on the default US1 region (TWILIO_US1_AUTH_TOKEN, else
 *             TWILIO_AUTH_TOKEN); templates in src/lib/messaging/whatsapp.ts.
 *   Shared    TWILIO_SHARED_SENDERS (optional, comma-separated): the numbers in the shared Messaging
 *             Service's pool and former shared senders, which no practice may claim as its own.
 */

export type Attachment = { filename: string; content: string; contentType: string };

export type SendResult = { status: "sent" | "captured"; provider: string; providerId: string | null; from: string | null };

export function providerStatus() {
  return {
    email: process.env.SMTP_URL ? "smtp" : "captured",
    sms: smsConfigured() ? "twilio" : "captured",
    whatsapp: whatsappConfigured() ? "twilio" : "captured",
  } as const;
}

/** Where texts go, for the dashboard: the SMS region and edge, and whether SMTP insists on TLS. */
export function providerDetails() {
  const r = twilioSmsRegion();
  return { smsRegion: r?.region ?? null, smsEdge: r?.edge ?? null, smtpRequireTls: smtpRequireTls() };
}

// ---------------------------------------------------------------- email

function smtpRequireTls(): boolean {
  return process.env.SMTP_REQUIRE_TLS !== "0";
}

/**
 * Transport options for SMTP_URL: STARTTLS required (SMTP_REQUIRE_TLS, on by default) and never
 * below TLS 1.2. Link and open tracking must be off at the provider (no pixels, no redirects).
 */
export function smtpTransportOptions(): SMTPTransport.Options | null {
  const url = process.env.SMTP_URL;
  if (!url) return null;
  return { url, requireTLS: smtpRequireTls(), tls: { minVersion: "TLSv1.2" } };
}

let transporter: { key: string; t: Transporter } | null = null;
function getTransporter(): Transporter | null {
  const options = smtpTransportOptions();
  if (!options) return null;
  const key = `${options.url}|${options.requireTLS}`;
  if (transporter?.key !== key) transporter = { key, t: nodemailer.createTransport(options) };
  return transporter.t;
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  fromName?: string;
  replyTo?: string | null;
  attachments?: Attachment[];
  /** Extra headers: Content-Language, List-Unsubscribe and List-Unsubscribe-Post (see deliver()). */
  headers?: Record<string, string>;
}): Promise<SendResult> {
  const fromAddress = process.env.EMAIL_FROM ?? `${APP_NAME} <no-reply@localhost>`;
  // Show the practice name as sender while sending from the platform's domain.
  const from = input.fromName ? `"${input.fromName.replace(/["\r\n]/g, "")}" <${extractAddress(fromAddress)}>` : fromAddress;
  const t = getTransporter();
  if (!t) return { status: "captured", provider: "dev", providerId: null, from };
  if (!isAllowedRecipient(input.to)) return { status: "captured", provider: "allowlist", providerId: null, from };
  const info = await t.sendMail({
    from,
    to: input.to,
    replyTo: input.replyTo ?? undefined,
    subject: input.subject,
    text: input.text,
    html: input.html,
    headers: input.headers,
    attachments: input.attachments?.map((a) => ({ filename: a.filename, content: a.content, contentType: a.contentType })),
  });
  return { status: "sent", provider: "smtp", providerId: info.messageId ?? null, from };
}

function extractAddress(from: string): string {
  const m = from.match(/<([^>]+)>/);
  return m ? m[1] : from;
}

// ---------------------------------------------------------------- Twilio

/** Default edge for each Twilio region, used when TWILIO_EDGE is not set for it. */
const DEFAULT_EDGE: Record<string, string> = { ie1: "dublin", au1: "sydney", us1: "ashburn" };

const SHAPE = /^[a-z0-9]{2,12}$/;

/** TWILIO_REGION + TWILIO_EDGE (e.g. ie1 + dublin) for SMS, or null for the default US1 endpoint. */
export function twilioSmsRegion(): { region: string; edge: string } | null {
  const region = process.env.TWILIO_REGION?.trim().toLowerCase();
  if (!region || !SHAPE.test(region) || region === "us1") return null;
  const edge = process.env.TWILIO_EDGE?.trim().toLowerCase() || DEFAULT_EDGE[region];
  return edge && SHAPE.test(edge) ? { region, edge } : null;
}

type TwilioTarget = {
  baseUrl: string;
  /** "Basic …" */
  authorization: string | null;
  /** Stored in messages.provider: "twilio" (US1) or "twilio:<region>", so deletion finds the copy. */
  provider: string;
};

const env = (name: string) => process.env[name]?.trim() || undefined;

function basic(user: string | undefined, secret: string | undefined): string | null {
  return user && secret ? `Basic ${Buffer.from(`${user}:${secret}`).toString("base64")}` : null;
}

/**
 * Endpoint and credentials for a region. Credentials are per region: an API key or auth token
 * created in IE1 works only there (TWILIO_IE1_API_KEY_SID/SECRET or TWILIO_IE1_AUTH_TOKEN); the
 * default region uses TWILIO_US1_AUTH_TOKEN or TWILIO_AUTH_TOKEN.
 */
function twilioTarget(region: { region: string; edge: string } | null): TwilioTarget {
  const sid = env("TWILIO_ACCOUNT_SID");
  if (!region) {
    return {
      baseUrl: "https://api.twilio.com",
      authorization: basic(sid, env("TWILIO_US1_AUTH_TOKEN") ?? env("TWILIO_AUTH_TOKEN")),
      provider: "twilio",
    };
  }
  const R = region.region.toUpperCase();
  const authorization =
    basic(env(`TWILIO_${R}_API_KEY_SID`), env(`TWILIO_${R}_API_KEY_SECRET`)) ??
    basic(sid, env(`TWILIO_${R}_AUTH_TOKEN`) ?? env("TWILIO_AUTH_TOKEN"));
  return { baseUrl: `https://api.${region.edge}.${region.region}.twilio.com`, authorization, provider: `twilio:${region.region}` };
}

function targetFor(channel: "sms" | "whatsapp"): TwilioTarget {
  // WhatsApp stays on the default region (Meta's API is not available in IE1).
  return twilioTarget(channel === "sms" ? twilioSmsRegion() : null);
}

/** The base URL SMS requests go to (https://api.dublin.ie1.twilio.com with ie1 + dublin). */
export function twilioSmsBaseUrl(): string {
  return targetFor("sms").baseUrl;
}

/** The auth token Twilio signs this channel's webhooks with: the token of the region that sends them. */
export function twilioWebhookToken(channel: "sms" | "whatsapp"): string | null {
  if (channel === "whatsapp") return env("TWILIO_US1_AUTH_TOKEN") ?? env("TWILIO_AUTH_TOKEN") ?? null;
  const region = twilioSmsRegion();
  return (region ? env(`TWILIO_${region.region.toUpperCase()}_AUTH_TOKEN`) : undefined) ?? env("TWILIO_AUTH_TOKEN") ?? null;
}

/** The provider name for inbound texts on this channel (where Twilio stores them). */
export function twilioProviderName(channel: "sms" | "whatsapp"): string {
  return targetFor(channel).provider;
}

function smsConfigured(): boolean {
  const sender = env("TWILIO_FROM") || env("TWILIO_MESSAGING_SERVICE_SID");
  return Boolean(env("TWILIO_ACCOUNT_SID") && targetFor("sms").authorization && sender);
}

export function whatsappConfigured(): boolean {
  return Boolean(env("TWILIO_ACCOUNT_SID") && targetFor("whatsapp").authorization && env("TWILIO_WHATSAPP_FROM"));
}

/** Create a Twilio Message resource; returns its SID. Errors carry Twilio's message (redacted by deliver()). */
export async function twilioCreateMessage(
  channel: "sms" | "whatsapp",
  params: Record<string, string>,
): Promise<{ sid: string; provider: string }> {
  const target = targetFor(channel);
  const sid = env("TWILIO_ACCOUNT_SID");
  if (!sid || !target.authorization) throw new Error("Twilio is not configured");
  const body = new URLSearchParams({ ...params, StatusCallback: `${APP_URL}/api/webhooks/twilio/status` });
  const res = await fetch(`${target.baseUrl}/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: { Authorization: target.authorization, "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json().catch(() => ({}))) as { sid?: string; message?: string; code?: number };
  if (!res.ok || !json.sid) throw new Error(`Twilio ${res.status}: ${json.message ?? "unknown error"} (${json.code ?? "-"})`);
  return { sid: json.sid, provider: target.provider };
}

const MESSAGING_SERVICE = /^MG[0-9a-fA-F]{32}$/;

/** A Twilio Messaging Service SID ("MG" + 32 hex), as Twilio writes it (lower-case hex). */
export function isMessagingServiceSid(value: string | null | undefined): boolean {
  return Boolean(value && MESSAGING_SERVICE.test(value));
}

/**
 * A sender in comparable form: "whatsapp:+39 02 1234 5678" -> "+390212345678", a Messaging Service
 * SID with lower-case hex, an alphanumeric sender ID in lower case. Null when empty.
 */
export function senderKey(value: string | null | undefined): string | null {
  const v = value?.trim().replace(/^whatsapp:/i, "").trim();
  if (!v) return null;
  if (MESSAGING_SERVICE.test(v)) return `MG${v.slice(2).toLowerCase()}`;
  if (/^(\+|00)?[\d\s().\-/]+$/.test(v)) return normalizePhone(v) ?? v.replace(/[\s().\-/]/g, "");
  return v.toLowerCase();
}

/**
 * The platform's shared senders, which every practice without a number of its own texts from:
 * TWILIO_FROM, TWILIO_MESSAGING_SERVICE_SID, the WhatsApp sender TWILIO_WHATSAPP_FROM, and
 * TWILIO_SHARED_SENDERS (comma-separated: the numbers in the shared Messaging Service's pool, and
 * any former shared sender). A reply to one of them belongs to no single practice, so none of
 * them can ever be a practice's organizations.inboundNumber (saveInboundNumber refuses them and
 * src/lib/inbound.ts ignores them).
 */
export function platformSenders(): Set<string> {
  const values = [
    env("TWILIO_FROM"),
    env("TWILIO_MESSAGING_SERVICE_SID"),
    env("TWILIO_WHATSAPP_FROM"),
    ...(env("TWILIO_SHARED_SENDERS") ?? "").split(","),
  ];
  return new Set(values.map(senderKey).filter((k): k is string => k !== null));
}

export function isPlatformSender(value: string | null | undefined): boolean {
  const key = senderKey(value);
  return key !== null && platformSenders().has(key);
}

/**
 * The practice's own sender (organizations.inboundNumber), or null when it has none, or when the
 * stored value is one of the platform's shared senders (then it is the shared sender like any other).
 */
export function practiceSender(inboundNumber: string | null | undefined): string | null {
  const own = inboundNumber?.trim() || null;
  return own && !isPlatformSender(own) ? own : null;
}

/**
 * Send an SMS. `sender` is the practice's own number or Messaging Service
 * (organizations.inboundNumber), so that replies come back to it and are matched to that practice
 * only; without one, the shared platform sender (TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM).
 * `from` in the result (stored as messages.from) is the number or Messaging Service SID it left
 * from: inbound.ts reads it to tell texts sent from the shared sender from a practice's own.
 */
export async function sendSms(input: { to: string; text: string; sender?: string | null }): Promise<SendResult> {
  const own = input.sender?.trim() || null;
  const service = own ? (MESSAGING_SERVICE.test(own) ? own : undefined) : env("TWILIO_MESSAGING_SERVICE_SID");
  const from = service ?? (own || env("TWILIO_FROM")) ?? null;
  if (!smsConfigured()) return { status: "captured", provider: "dev", providerId: null, from };
  if (!isAllowedRecipient(input.to)) return { status: "captured", provider: "allowlist", providerId: null, from };
  const { sid, provider } = await twilioCreateMessage("sms", {
    To: input.to,
    Body: input.text,
    ...(service ? { MessagingServiceSid: service } : { From: from ?? "" }),
  });
  return { status: "sent", provider, providerId: sid, from };
}

const MESSAGE_SID = /^(SM|MM|IM)[0-9a-fA-F]{32}$/;

/** Where a stored message's provider copy lives ("twilio" = US1, "twilio:<region>"), or null when it isn't Twilio's. */
function deletionTarget(provider: string): TwilioTarget | null {
  const [name, regionName] = provider.split(":");
  if (name !== "twilio") return null;
  const current = twilioSmsRegion();
  const region = regionName
    ? { region: regionName, edge: current?.region === regionName ? current.edge : (DEFAULT_EDGE[regionName] ?? regionName) }
    : null;
  return twilioTarget(region);
}

/**
 * Can this deployment delete copies kept by `provider`? False for a Twilio region whose
 * credentials are not set here (e.g. after moving from IE1 back to US1): the reminders cron then
 * leaves those rows alone instead of failing on them every run.
 */
export function canDeleteProviderCopies(provider: string): boolean {
  const target = deletionTarget(provider);
  return target === null || Boolean(env("TWILIO_ACCOUNT_SID") && target.authorization);
}

/**
 * Delete a message's copy at the provider (data minimisation: the reminders cron after
 * privacy.retention.providerMessageDays, and erasure in src/lib/privacy/erasure.ts).
 * `provider` and `providerId` are the values stored on the messages row.
 *
 * - Twilio (SMS and WhatsApp, inbound and outbound): DELETE on the Message resource, in the region
 *   it was sent through. Twilio refuses while a message is still being delivered; that throws, and
 *   the caller retries later. A message that is already gone (404) is not an error.
 * - Email can't be recalled from an SMTP relay, and captured, simulated or allowlist-held messages
 *   never left: nothing to do.
 *
 * Throws when a Twilio copy can't be deleted (not configured here, network, Twilio error), so the
 * caller does not mark it deleted.
 */
export async function deleteProviderMessage(provider: string, providerId: string): Promise<void> {
  const target = deletionTarget(provider);
  if (!target) return;
  if (!MESSAGE_SID.test(providerId)) return; // not a Twilio message SID (e.g. a test or simulator id)
  const sid = env("TWILIO_ACCOUNT_SID");
  if (!sid || !target.authorization) throw new Error(`Twilio (${provider}) is not configured: can't delete the provider copy`);
  const res = await fetch(`${target.baseUrl}/2010-04-01/Accounts/${sid}/Messages/${providerId}.json`, {
    method: "DELETE",
    headers: { Authorization: target.authorization },
  });
  if (res.status === 204 || res.status === 404) return;
  const json = (await res.json().catch(() => ({}))) as { message?: string; code?: number };
  throw new Error(`Twilio ${res.status}: ${json.message ?? "delete failed"} (${json.code ?? "-"})`);
}
