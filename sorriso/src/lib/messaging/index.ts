import { eq } from "drizzle-orm";
import { db, type Tx } from "@/db";
import type { ConsentPurpose } from "@/db/enums";
import { messages, organizations, type Channel, type Message, type Patient } from "@/db/schema";
import { getT } from "@/i18n/t";
import type { SourceMessages } from "@/i18n/types";
import { canReachByEmail, isRestricted, pickTextChannel, recipientFor, type ContactPatient } from "../contact";
import { newId } from "../ids";
import { logError, logInfo } from "../log";
import { isAllowed } from "../privacy/consent";
import { getPrivacy } from "../privacy/settings";
import { renderEmailLayout } from "./layout";
import { sendEmail, sendSms, sendWhatsApp, type Attachment, type SendResult } from "./providers";

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
};

/**
 * Send a message through the right provider and record it in the message log.
 * Never throws: failures are logged with status "failed" and returned.
 */
export async function deliver(msg: OutboundMessage, tx: Tx = db): Promise<Message> {
  let result: SendResult | null = null;
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
      });
    } else if (msg.channel === "sms") {
      result = await sendSms({ to: msg.to, text: msg.text });
    } else {
      result = await sendWhatsApp({ to: msg.to, text: msg.text, variables: msg.whatsappVariables });
    }
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  const row = {
    id: newId(),
    orgId: msg.orgId,
    appointmentId: msg.appointmentId ?? null,
    patientId: msg.patientId ?? null,
    channel: msg.channel,
    direction: "outbound" as const,
    to: msg.to,
    from: result?.from ?? null,
    subject: msg.subject ?? null,
    body: msg.logBody ?? msg.text,
    html: msg.logBody === undefined ? (msg.html ?? null) : null,
    status: result ? result.status : ("failed" as const),
    provider: result?.provider ?? (msg.channel === "email" ? "smtp" : "twilio"),
    providerId: result?.providerId ?? null,
    error,
  };
  const [saved] = await tx.insert(messages).values(row).returning();
  if (error) logError("messaging", error, { channel: msg.channel, messageId: saved.id });
  else if (result?.status === "captured") logInfo("messaging", "captured", { channel: msg.channel, messageId: saved.id });
  return saved;
}

export { providerStatus } from "./providers";

// ---------------------------------------------------------------- patient messages (frozen signature)

/** Server-only namespaces whose texts go to patients (or, for children, their guardians). */
export type PatientMessageNamespace = "patientMessages" | "careMessages" | "privacyMessages" | "privacyAdminEmails" | "reviewEmails";

/**
 * A message kind is a top-level key of its namespace holding a group of texts:
 *   subject  the email subject                                  (required)
 *   body     the email's main paragraph                          (required)
 *   sms      the SMS text (straight quotes, short: GSM-7 budget)  (optional: without it, email only)
 *   cta      the email button's label; the button opens vars.url (optional)
 * All texts of a kind take the same {placeholders}. Discreet by default: no service, category,
 * practitioner or note in sms or subject (see docs/messaging.md, WP3).
 */
type MessageKindTexts = { readonly subject: string; readonly body: string };

/** The kinds declared in namespace N's English file (e.g. careMessages.recall). */
export type PatientMessageKind<N extends PatientMessageNamespace> = {
  [K in keyof SourceMessages[N] & string]: SourceMessages[N][K] extends MessageKindTexts ? K : never;
}[keyof SourceMessages[N] & string];

export type PatientMessageInput<N extends PatientMessageNamespace> = {
  orgId: string;
  /** Must belong to orgId. Guardian routing, opt-ins and restriction are read from it. */
  patient: ContactPatient & Pick<Patient, "id" | "orgId">;
  ns: N;
  kind: PatientMessageKind<N>;
  /** Placeholder values, already formatted in the recipient's locale (fmtWhen, absolute links). */
  vars: Record<string, string | number>;
  appointmentId?: string | null;
  /** Checked with isAllowed() first: a withdrawal or objection skips the message (not_allowed). */
  purpose?: ConsentPurpose;
  now?: Date;
};

/**
 * restricted:  the patient is restricted (Art. 18) or erased;
 * unreachable: no contact on any channel the patient accepts;
 * not_allowed: `purpose` was withdrawn or objected to;
 * no_template: a usable channel exists but the kind has no text for it.
 */
export type PatientMessageSkip = "restricted" | "unreachable" | "not_allowed" | "no_template";

export type SendPatientMessageResult = { ok: true; message: Message } | { ok: false; reason: PatientMessageSkip };

type LooseTranslator = { (key: string, vars?: Record<string, string | number>): string; has(key: string): boolean };

/**
 * Send a patient-facing message of another package (recalls, practice-moved notices, privacy
 * receipts, OTP-free notifications) on the right channel, in the recipient's language, and log
 * it through deliver(). Never throws for delivery problems (see deliver()); throws only when the
 * patient belongs to another practice or the practice doesn't exist.
 *
 * Frozen signature, owned by WP3. This is the minimal version: it picks SMS, then email
 * (email first when the patient prefers it), and sends the namespace's texts as they are.
 * WP3 adds, behind the same signature: the SMS ASCII fallback (settings.reminders.smsAsciiFallback)
 * and the segment budget, WhatsApp routing through approved per-locale templates (until then a
 * WhatsApp patient gets SMS when they accept SMS), the privacy footer and List-Unsubscribe
 * headers, and the discreet/detailed content level.
 */
export async function sendPatientMessage<N extends PatientMessageNamespace>(
  input: PatientMessageInput<N>,
  tx: Tx = db,
): Promise<SendPatientMessageResult> {
  const { patient, orgId, now = new Date() } = input;
  if (patient.orgId !== orgId) throw new Error("sendPatientMessage: the patient belongs to another practice");
  if (isRestricted(patient)) return { ok: false, reason: "restricted" };
  if (input.purpose && !(await isAllowed(patient.id, input.purpose, tx))) return { ok: false, reason: "not_allowed" };
  const [org] = await tx.select().from(organizations).where(eq(organizations.id, orgId));
  if (!org) throw new Error("sendPatientMessage: unknown practice");

  const to = recipientFor(patient, now);
  // The kind's keys are checked by PatientMessageKind; the leaves under it are read by name.
  const t = getT(to.locale, input.ns) as unknown as LooseTranslator;
  const key = (leaf: "subject" | "body" | "sms" | "cta") => `${input.kind}.${leaf}`;
  const text = pickTextChannel(patient, getPrivacy(org), now);
  const sms = (text === "whatsapp" ? (patient.smsOptIn ? "sms" : null) : text) && to.phone && t.has(key("sms"));
  const email = canReachByEmail(patient, now) && to.email;
  const base = { orgId, appointmentId: input.appointmentId ?? null, patientId: patient.id };

  if (email && (patient.preferredChannel === "email" || !sms)) {
    const url = input.vars.url;
    const { html, text: plain } = renderEmailLayout({
      locale: to.locale,
      brandColor: org.brandColor,
      brandName: org.name,
      intro: t(key("body"), input.vars),
      buttons: typeof url === "string" && t.has(key("cta")) ? [{ label: t(key("cta"), input.vars), url }] : [],
      footerLines: [org.legalName ?? org.name],
    });
    const subject = t(key("subject"), input.vars);
    const message = await deliver({ ...base, channel: "email", to: email, subject, text: plain, html, fromName: org.name, replyTo: org.email }, tx);
    return { ok: true, message };
  }
  if (sms && to.phone) {
    return { ok: true, message: await deliver({ ...base, channel: "sms", to: to.phone, text: t(key("sms"), input.vars) }, tx) };
  }
  return { ok: false, reason: text && to.phone && !t.has(key("sms")) ? "no_template" : "unreachable" };
}
