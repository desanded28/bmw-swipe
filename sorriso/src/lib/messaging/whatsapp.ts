import type { Tx } from "@/db";
import type { Patient, PrivacySettings } from "@/db/schema";
import type { Locale } from "@/i18n/config";
import { pickTextChannel, type ContactPatient } from "../contact";
import { isAllowedRecipient } from "../demo";
import { logError } from "../log";
import { isAllowed } from "../privacy/consent";
import { twilioCreateMessage, whatsappConfigured, type SendResult } from "./providers";

/**
 * WhatsApp through Twilio.
 *
 * Business-initiated WhatsApp messages (reminders, confirmations, offers) must use a template that
 * Meta approved, one per language. TWILIO_WHATSAPP_CONTENT_SIDS maps each message kind to its
 * Content SIDs by locale:
 *
 *   TWILIO_WHATSAPP_CONTENT_SIDS={"reminder":{"it":"HX…","en":"HX…"},"booked":{"it":"HX…"}}
 *
 * A kind without an approved template in the patient's language is not sent on WhatsApp at all:
 * the caller falls back to SMS or email (chooseTextChannel), so nobody gets a message in the wrong
 * language. Templates take only discreet variables, numbered as Twilio expects:
 * {{1}} the patient's first name, {{2}} the date and time, {{3}} the practice, {{4}} the link.
 * Free-form text (no template) is allowed only as a reply within 24 hours of the patient's own
 * message; that is the only use of `text` here.
 *
 * Kinds are the patientMessages kinds (booked, approved, reminder, reminderAsk, cancelled,
 * rescheduled, waitlist) and, for other namespaces' messages sent through sendPatientMessage,
 * "<namespace>.<kind>" (e.g. "careMessages.recall").
 *
 * Development convenience: when TWILIO_WHATSAPP_CONTENT_SIDS is not set and WhatsApp is not
 * configured (every message is captured anyway), every kind counts as having a template, so the
 * WhatsApp path shows up in the message log. Once either is set, only listed templates are used.
 */

export type WhatsAppTemplates = Record<string, Partial<Record<Locale, string>>>;

const CONTENT_SID = /^HX[0-9a-fA-F]{32}$/;

let cache: { raw: string; map: WhatsAppTemplates } | null = null;

/** The parsed TWILIO_WHATSAPP_CONTENT_SIDS (invalid JSON or SIDs are ignored and logged once). */
export function whatsappTemplates(): WhatsAppTemplates {
  const raw = process.env.TWILIO_WHATSAPP_CONTENT_SIDS?.trim() ?? "";
  if (cache?.raw === raw) return cache.map;
  const map: WhatsAppTemplates = {};
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("not an object");
      for (const [kind, byLocale] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof byLocale !== "object" || byLocale === null) continue;
        for (const [locale, sid] of Object.entries(byLocale as Record<string, unknown>)) {
          if (typeof sid === "string" && CONTENT_SID.test(sid)) (map[kind] ??= {})[locale as Locale] = sid;
        }
      }
    } catch (err) {
      logError("whatsapp", err, { step: "TWILIO_WHATSAPP_CONTENT_SIDS" });
    }
  }
  cache = { raw, map };
  return map;
}

/** The approved template for a kind in a language, or null. */
export function whatsappTemplateSid(kind: string, locale: Locale): string | null {
  return whatsappTemplates()[kind]?.[locale] ?? null;
}

/** May a message of this kind go to a patient in this language on WhatsApp? */
export function hasWhatsAppTemplate(kind: string, locale: Locale): boolean {
  if (!process.env.TWILIO_WHATSAPP_CONTENT_SIDS?.trim() && !whatsappConfigured()) return true;
  return whatsappTemplateSid(kind, locale) !== null;
}

/**
 * The text channel for a message of `kind` to this patient, or null when they can't be texted.
 * Every text sender decides through here. WhatsApp only when all of these hold, otherwise SMS
 * (if the patient accepts SMS):
 * - the practice enabled WhatsApp and the patient chose it (pickTextChannel);
 * - the consent ledger holds a current whatsapp_channel grant: a bare preference (a record from
 *   before the ledger, or one set by staff without the patient's consent) never reaches Meta;
 * - an approved template exists for the kind in the patient's language. Without a `kind` the
 *   message has no template, so it goes by SMS.
 */
export async function chooseTextChannel(
  patient: ContactPatient & Pick<Patient, "id">,
  privacy: Pick<PrivacySettings, "whatsappEnabled">,
  opts: { kind?: string | null; now?: Date; tx?: Tx } = {},
): Promise<"sms" | "whatsapp" | null> {
  const now = opts.now ?? new Date();
  const wanted = privacy.whatsappEnabled && patient.preferredChannel === "whatsapp" && Boolean(opts.kind);
  const whatsapp =
    wanted && hasWhatsAppTemplate(opts.kind!, patient.locale) && (await isAllowed(patient.id, "whatsapp_channel", opts.tx));
  return pickTextChannel(patient, { whatsappEnabled: whatsapp }, now);
}

export type WhatsAppVariables = { name: string; date?: string | null; clinic: string; link?: string | null };

/**
 * Template variables, discreet by construction: there is no slot for a treatment, a
 * practitioner or a note. WhatsApp refuses newlines, tabs and long runs of spaces in variables.
 */
export function whatsappVariables(v: WhatsAppVariables): Record<string, string> {
  const clean = (s: string) => s.replace(/\s+/g, " ").trim().slice(0, 300);
  const out: Record<string, string> = { "1": clean(v.name), "3": clean(v.clinic) };
  if (v.date) out["2"] = clean(v.date);
  if (v.link) out["4"] = v.link.trim();
  return out;
}

export type WhatsAppSkip = { status: "skipped"; reason: "no_template" };

/**
 * Send a WhatsApp message. With `kind`, through that kind's approved template in `locale`
 * (skipped with no_template when there is none); without `kind`, `text` as a free-form reply,
 * valid only within 24 hours of the patient's last message.
 */
export async function sendWhatsApp(input: {
  to: string;
  kind?: string;
  locale?: Locale;
  variables?: Record<string, string>;
  text?: string;
}): Promise<SendResult | WhatsAppSkip> {
  const from = process.env.TWILIO_WHATSAPP_FROM?.trim() || null;
  let template: string | null = null;
  if (input.kind) {
    if (!input.locale || !hasWhatsAppTemplate(input.kind, input.locale)) return { status: "skipped", reason: "no_template" };
    template = whatsappTemplateSid(input.kind, input.locale);
  }
  if (!whatsappConfigured()) return { status: "captured", provider: "dev", providerId: null, from };
  if (!isAllowedRecipient(input.to)) return { status: "captured", provider: "allowlist", providerId: null, from };
  if (input.kind && !template) return { status: "skipped", reason: "no_template" };
  const to = `whatsapp:${input.to.replace(/^whatsapp:/i, "")}`;
  const { sid, provider } = await twilioCreateMessage("whatsapp", {
    To: to,
    From: `whatsapp:${from!.replace(/^whatsapp:/i, "")}`,
    ...(template
      ? { ContentSid: template, ContentVariables: JSON.stringify(input.variables ?? {}) }
      : { Body: input.text ?? "" }),
  });
  return { status: "sent", provider, providerId: sid, from };
}
