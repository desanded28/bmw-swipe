import { and, eq } from "drizzle-orm";
import { db, type Tx } from "@/db";
import type { ConsentPurpose } from "@/db/enums";
import { appointments, locations, messages, organizations, type Channel, type Message, type Patient } from "@/db/schema";
import { isLocale, type Locale } from "@/i18n/config";
import { lhref } from "@/i18n/href";
import { getT } from "@/i18n/t";
import type { NoVars, SourceMessages, Vars } from "@/i18n/types";
import { absoluteUrl, APP_URL } from "../config";
import { canReachByEmail, isRestricted, recipientFor, type ContactPatient } from "../contact";
import { newId } from "../ids";
import { manageTokenOf, unsubscribeToken } from "../links";
import { logError, logInfo, redact } from "../log";
import { isAllowed } from "../privacy/consent";
import { resolveSettings } from "../settings";
import { renderEmailLayout } from "./layout";
import { sendEmail, sendSms, type Attachment, type SendResult } from "./providers";
import { fitSmsBudget, prepareSms } from "./sms-encoding";
import { privacyFooter } from "./templates";
import { chooseTextChannel, sendWhatsApp, whatsappVariables, type WhatsAppSkip } from "./whatsapp";

export type OutboundMessage = {
  orgId: string | null;
  appointmentId?: string | null;
  patientId?: string | null;
  channel: Channel;
  to: string;
  subject?: string;
  text: string;
  html?: string;
  fromName?: string;
  replyTo?: string | null;
  attachments?: Attachment[];
  whatsappVariables?: Record<string, string>;
  /**
   * Stored in the message log instead of `text` (and the HTML part is not stored), for
   * messages carrying a secret such as a one-time code: the log must not hold it in clear.
   */
  logBody?: string;
  /**
   * The recipient's language: the email's Content-Language header (default: the html lang that
   * renderEmailLayout writes) and the WhatsApp template's language.
   */
  locale?: Locale;
  /**
   * WhatsApp only: the message kind whose approved template carries it (whatsapp.ts), with
   * `whatsappVariables`. Without it, `text` goes as a free-form reply, which WhatsApp accepts only
   * within 24 hours of the patient's own message.
   */
  whatsappKind?: string;
};

/** The language an email was rendered in (renderEmailLayout writes it as the html lang). */
function htmlLang(html: string | undefined): Locale | undefined {
  const lang = html?.match(/<html[^>]*\blang="([a-z]{2})"/i)?.[1];
  return isLocale(lang) ? lang : undefined;
}

/** One-click unsubscribe (RFC 8058) for a patient's emails; handled by /api/privacy/unsubscribe (WP4). */
export function unsubscribeUrl(patientId: string, channel: "email" | "sms" | "whatsapp" = "email"): string {
  return `${APP_URL}/api/privacy/unsubscribe?t=${encodeURIComponent(unsubscribeToken(patientId, channel))}&c=${channel}`;
}

/**
 * Headers of a patient email: Content-Language, and List-Unsubscribe with List-Unsubscribe-Post
 * (one click, no confirmation page) when it is about a patient record.
 */
export function patientEmailHeaders(opts: { patientId?: string | null; locale?: Locale }): Record<string, string> {
  const headers: Record<string, string> = {};
  if (opts.locale) headers["Content-Language"] = opts.locale;
  if (opts.patientId) {
    headers["List-Unsubscribe"] = `<${unsubscribeUrl(opts.patientId, "email")}>`;
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }
  return headers;
}

/**
 * Send a message through the right provider and record it in the message log.
 * Never throws: failures are logged with status "failed" and returned. The stored error is
 * redacted (provider errors often quote the recipient's number).
 */
export async function deliver(msg: OutboundMessage, tx: Tx = db): Promise<Message> {
  let result: SendResult | WhatsAppSkip | null = null;
  let error: string | null = null;
  try {
    if (msg.channel === "email") {
      result = await sendEmail({
        to: msg.to,
        subject: msg.subject ?? "",
        text: msg.text,
        html: msg.html,
        fromName: msg.fromName,
        replyTo: msg.replyTo,
        attachments: msg.attachments,
        headers: patientEmailHeaders({ patientId: msg.patientId, locale: msg.locale ?? htmlLang(msg.html) }),
      });
    } else if (msg.channel === "sms") {
      // From the practice's own number when it has one, so replies come back to that practice.
      const [org] = msg.orgId
        ? await tx.select({ inboundNumber: organizations.inboundNumber }).from(organizations).where(eq(organizations.id, msg.orgId))
        : [];
      result = await sendSms({ to: msg.to, text: msg.text, sender: org?.inboundNumber ?? null });
    } else {
      result = await sendWhatsApp({
        to: msg.to,
        kind: msg.whatsappKind,
        locale: msg.locale,
        variables: msg.whatsappVariables,
        text: msg.text,
      });
      if (result.status === "skipped") {
        error = `whatsapp: no approved template for ${msg.whatsappKind ?? "?"} in ${msg.locale ?? "?"}`;
        result = null;
      }
    }
  } catch (err) {
    error = redact(err instanceof Error ? err.message : String(err));
  }

  const sent = result && result.status !== "skipped" ? result : null;
  const row = {
    id: newId(),
    orgId: msg.orgId,
    appointmentId: msg.appointmentId ?? null,
    patientId: msg.patientId ?? null,
    channel: msg.channel,
    direction: "outbound" as const,
    to: msg.to,
    from: sent?.from ?? null,
    subject: msg.subject ?? null,
    body: msg.logBody ?? msg.text,
    html: msg.logBody === undefined ? (msg.html ?? null) : null,
    status: sent ? sent.status : ("failed" as const),
    provider: sent?.provider ?? (msg.channel === "email" ? "smtp" : "twilio"),
    providerId: sent?.providerId ?? null,
    error,
  };
  const [saved] = await tx.insert(messages).values(row).returning();
  if (error) logError("messaging", error, { channel: msg.channel, messageId: saved.id });
  else if (sent?.status === "captured") {
    logInfo("messaging", "captured", { channel: msg.channel, messageId: saved.id, provider: sent.provider });
  }
  return saved;
}

export { providerStatus } from "./providers";

// ---------------------------------------------------------------- patient messages (frozen signature)

/** Server-only namespaces whose texts go to patients (or, for children, their guardians). */
export type PatientMessageNamespace =
  | "patientMessages"
  | "careMessages"
  | "privacyMessages"
  | "privacyAdminEmails"
  | "reviewEmails";

/**
 * A message kind is a top-level key of its namespace holding a group of texts:
 *   subject   the email subject                                   } both, for email
 *   body      the email's main paragraph                           }
 *   cta       the email button's label; the button opens `url`     (optional)
 *   sms       the SMS text (straight quotes, short: GSM-7 budget)  (for SMS)
 *   smsShort  a shorter SMS, sent when `sms` goes over the budget  (optional)
 * A kind has the email texts, the SMS text or both; it is sent only on a channel it has texts
 * for. Its {placeholders} are the union over its texts. Discreet by default: no service,
 * category, practitioner or note in the SMS or the subject (docs/messaging.md).
 */
type MessageKindTexts = { readonly subject: string; readonly body: string } | { readonly sms: string };

/** The kinds declared in namespace N's English file (e.g. "recall" for careMessages.recall). */
export type PatientMessageKind<N extends PatientMessageNamespace> = {
  [K in keyof SourceMessages[N] & string]: SourceMessages[N][K] extends MessageKindTexts ? K : never;
}[keyof SourceMessages[N] & string];

type KindTexts<N extends PatientMessageNamespace, K extends PatientMessageKind<N>> = SourceMessages[N][K];

/** The kind's placeholders (over all of its texts), each a string or number; {} when it has none. */
export type PatientMessageVars<N extends PatientMessageNamespace, K extends PatientMessageKind<N>> = [
  Vars<KindTexts<N, K>[keyof KindTexts<N, K>]>,
] extends [never]
  ? NoVars
  : { [V in Vars<KindTexts<N, K>[keyof KindTexts<N, K>]>]: string | number };

export type PatientMessageInput<N extends PatientMessageNamespace, K extends PatientMessageKind<N>> = {
  orgId: string;
  /** Must belong to orgId. Guardian routing, opt-ins and restriction are read from it. */
  patient: ContactPatient & Pick<Patient, "id" | "orgId">;
  ns: N;
  kind: K;
  /** Placeholder values, already formatted for the recipient's locale (fmtWhen, formatMoney, absolute links). */
  vars: PatientMessageVars<N, K>;
  /** Absolute link opened by the email button (the kind's `cta`). An SMS that shows it says {url} in its text. */
  url?: string;
  appointmentId?: string | null;
  /** Checked with isAllowed() first: a withdrawal or objection skips the message (not_allowed). */
  purpose?: ConsentPurpose;
  now?: Date;
};

/**
 * restricted:  the patient is restricted (Art. 18) or erased;
 * not_allowed: `purpose` was withdrawn or objected to;
 * unreachable: no contact on any channel the patient accepts;
 * no_template: the patient is reachable, but not on a channel the kind has texts for.
 */
export type PatientMessageSkip = "restricted" | "not_allowed" | "unreachable" | "no_template";

export type SendPatientMessageResult = { ok: true; message: Message } | { ok: false; reason: PatientMessageSkip };

type LooseTranslator = { (key: string, vars?: Record<string, string | number>): string; has(key: string): boolean };

/** The WhatsApp template key of a kind: its name in patientMessages, "<namespace>.<kind>" elsewhere. */
export function whatsappKindKey(ns: PatientMessageNamespace, kind: string): string {
  return ns === "patientMessages" ? kind : `${ns}.${kind}`;
}

/**
 * Send a patient-facing message for another package (recalls, practice-moved notices, privacy
 * receipts, review invitations) on the right channel, to the right person (the guardian for a
 * child under 14), in the recipient's language, and log it through deliver(). Delivery failures
 * don't throw (see deliver()); it throws only when the patient belongs to another practice or
 * the practice doesn't exist. One-time codes don't go through here (src/lib/otp.ts).
 *
 * Frozen signature, owned by WP3. Channel: a text first (email first when the patient prefers
 * email), falling back to the other channel when the first one is unusable or the kind has no
 * text for it. A text goes by WhatsApp only through chooseTextChannel() (practice setting,
 * whatsapp_channel consent, an approved template for "<ns>.<kind>" in the patient's language),
 * otherwise by SMS. SMS get the GSM-7 typography, the practice's ASCII fallback and the segment
 * budget (`smsShort` when `sms` is too long). Emails get the privacy footer, Content-Language and
 * one-click List-Unsubscribe headers. Texts of other namespaces are sent as written: keeping them
 * discreet is their authors' job (docs/messaging.md).
 */
export async function sendPatientMessage<N extends PatientMessageNamespace, K extends PatientMessageKind<N>>(
  input: PatientMessageInput<N, K>,
  tx: Tx = db,
): Promise<SendPatientMessageResult> {
  const { patient, orgId, now = new Date() } = input;
  if (patient.orgId !== orgId) throw new Error("sendPatientMessage: the patient belongs to another practice");
  if (isRestricted(patient)) return { ok: false, reason: "restricted" };
  if (input.purpose && !(await isAllowed(patient.id, input.purpose, tx))) return { ok: false, reason: "not_allowed" };
  const [org] = await tx.select().from(organizations).where(eq(organizations.id, orgId));
  if (!org) throw new Error("sendPatientMessage: unknown practice");
  const settings = resolveSettings(org.settings);

  const to = recipientFor(patient, now);
  // PatientMessageKind checks the kind; the texts under it are read by name.
  const t = getT(to.locale, input.ns) as unknown as LooseTranslator;
  const vars = input.vars as Record<string, string | number>;
  const key = (leaf: "subject" | "body" | "cta" | "sms" | "smsShort") => `${input.kind}.${leaf}`;
  const waKind = whatsappKindKey(input.ns, input.kind);
  const text = await chooseTextChannel(patient, settings.privacy, { kind: waKind, now, tx });
  const reach = {
    // SMS when the patient can be texted; a WhatsApp patient without a template here gets SMS
    // from chooseTextChannel, never a WhatsApp message in the wrong language.
    text: Boolean(to.phone && text),
    email: Boolean(to.email && canReachByEmail(patient, now)),
  };
  const texts = { text: t.has(key("sms")), email: t.has(key("subject")) && t.has(key("body")) };
  const order = patient.preferredChannel === "email" ? (["email", "text"] as const) : (["text", "email"] as const);
  const channel = order.find((c) => reach[c] && texts[c]);
  const base = { orgId, appointmentId: input.appointmentId ?? null, patientId: patient.id, locale: to.locale };

  if (channel === "email") {
    const links = await recipientLinks(tx, org, input.appointmentId ?? null, to.locale);
    const [office] = org.registeredAddress
      ? []
      : await tx
          .select({ address: locations.address, city: locations.city })
          .from(locations)
          .where(and(eq(locations.orgId, orgId), eq(locations.active, true)))
          .limit(1);
    const { html, text: plain } = renderEmailLayout({
      locale: to.locale,
      brandColor: org.brandColor,
      brandName: org.name,
      intro: t(key("body"), vars),
      buttons: input.url && t.has(key("cta")) ? [{ label: t(key("cta"), vars), url: input.url }] : [],
      ...privacyFooter({
        locale: to.locale,
        clinicName: org.name,
        clinicPhone: org.phone,
        address: org.registeredAddress ?? (office ? `${office.address}, ${office.city}` : ""),
        legalName: org.legalName,
        legalAddress: org.registeredAddress,
        privacyUrl: links.privacyUrl,
        preferencesUrl: links.preferencesUrl,
        viaGuardian: to.viaGuardian,
        patientFirstName: patient.firstName,
        reason: input.appointmentId ? "appointment" : "patient",
      }),
    });
    const subject = t(key("subject"), vars);
    const message = await deliver(
      { ...base, channel: "email", to: to.email!, subject, text: plain, html, fromName: org.name, replyTo: org.email },
      tx,
    );
    return { ok: true, message };
  }
  if (channel === "text") {
    const smsVars = { ...vars, ...(input.url && vars.url === undefined ? { url: input.url } : {}) };
    const body = fitSmsBudget(
      (["sms", "smsShort"] as const)
        .filter((leaf) => t.has(key(leaf)))
        .map((leaf) => prepareSms(t(key(leaf), smsVars), to.locale, { asciiFallback: settings.reminders.smsAsciiFallback })),
    );
    if (text === "whatsapp") {
      const date = typeof vars.when === "string" ? vars.when : typeof vars.date === "string" ? vars.date : null;
      const message = await deliver(
        {
          ...base,
          channel: "whatsapp",
          to: to.phone!,
          text: body,
          whatsappKind: waKind,
          whatsappVariables: whatsappVariables({ name: patient.firstName, date, clinic: org.name, link: input.url ?? null }),
        },
        tx,
      );
      return { ok: true, message };
    }
    const message = await deliver({ ...base, channel: "sms", to: to.phone!, text: body }, tx);
    return { ok: true, message };
  }
  return { ok: false, reason: reach.text || reach.email ? "no_template" : "unreachable" };
}

/** The practice's privacy notice and the patient's privacy choices (their visit's page, else the privacy center). */
async function recipientLinks(
  tx: Tx,
  org: { id: string; slug: string },
  appointmentId: string | null,
  locale: Locale,
): Promise<{ privacyUrl: string; preferencesUrl: string }> {
  let token: string | null = null;
  if (appointmentId) {
    const [a] = await tx
      .select({ manageTokenEnc: appointments.manageTokenEnc })
      .from(appointments)
      .where(and(eq(appointments.id, appointmentId), eq(appointments.orgId, org.id)));
    token = a ? manageTokenOf(a) : null;
  }
  return {
    privacyUrl: absoluteUrl(lhref(locale, `/c/${org.slug}/privacy`)),
    preferencesUrl: token ? absoluteUrl(`/a/${token}/privacy`) : absoluteUrl(lhref(locale, "/privacy")),
  };
}
