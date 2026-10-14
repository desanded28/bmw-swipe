import type { Channel, ProcessingContext } from "@/db/enums";
import type { BookingPrivacyChoices } from "./consent";
import { NOTICE_VERSIONS } from "./versions";

/**
 * Server-side checks on the privacy part of a booking or waitlist form. The browser runs the
 * same checks for friendly errors (bookingPrivacyFormErrors); these are the ones that count.
 *
 * Client-safe: the booking form imports this module (type-only imports from server modules).
 *
 * There is no notice-acknowledgement box (critique 21: it isn't needed, and next to the consent
 * boxes it reads as bundled consent). The server records the notice version it displayed for the
 * booking's context (noticeVersionFor) on the appointment; a form that showed an older version
 * is refused (notice_outdated) so the stored version is always the one the patient saw.
 */

/** Shared by the booking privacy and relation checks: `field` names the form field to flag ("" for none). */
export type RuleResult<C extends string = string> = { ok: true } | { ok: false; code: C; field: string };

export type BookingPrivacyCode =
  | "platform_consent_required"
  | "whatsapp_consent_required"
  | "whatsapp_unavailable"
  | "notice_outdated";

export type BookingPrivacyInput = {
  context: ProcessingContext;
  preferredChannel: Channel;
  choices: BookingPrivacyChoices;
  /**
   * The version of the notice the form displayed (noticeVersionFor(context) in the browser). When
   * given it must be the current one; the server stores noticeVersionFor(context) either way.
   */
  noticeVersion?: string | null;
  org: { whatsappEnabled: boolean; marketingEnabled: boolean };
};

/**
 * - marketplace bookings need Sorriso's Art. 9(2)(a) consent (platform_consent_required);
 * - WhatsApp needs the practice to offer it (whatsapp_unavailable) and the patient's own
 *   confirmation after the just-in-time notice (whatsapp_consent_required);
 * - the notice shown must be the current one (notice_outdated);
 * - marketing and feedback are optional: never required, and marketing is ignored where the
 *   practice doesn't run it (effectiveBookingChoices).
 */
export function validateBookingPrivacy(i: BookingPrivacyInput): RuleResult<BookingPrivacyCode> {
  if (i.context === "marketplace" && i.choices.platformConsent !== true) {
    return { ok: false, code: "platform_consent_required", field: "platformConsent" };
  }
  if (i.preferredChannel === "whatsapp") {
    if (!i.org.whatsappEnabled) return { ok: false, code: "whatsapp_unavailable", field: "preferredChannel" };
    if (i.choices.whatsapp !== true) return { ok: false, code: "whatsapp_consent_required", field: "whatsapp" };
  }
  if (i.noticeVersion != null && i.noticeVersion !== noticeVersionFor(i.context)) {
    return { ok: false, code: "notice_outdated", field: "" };
  }
  return { ok: true };
}

/**
 * The choices that may actually be recorded: the platform consent only on the marketplace,
 * WhatsApp only where the practice offers it, marketing only where the practice runs it.
 * Anything else a client sends is ignored rather than stored as a consent nobody was shown.
 */
export function effectiveBookingChoices(i: Omit<BookingPrivacyInput, "preferredChannel" | "noticeVersion">): BookingPrivacyChoices {
  return {
    platformConsent: i.context === "marketplace" && i.choices.platformConsent === true,
    whatsapp: i.org.whatsappEnabled && i.choices.whatsapp === true,
    feedback: i.choices.feedback === true,
    marketing: i.org.marketingEnabled && i.choices.marketing === true,
  };
}

/**
 * The notice version to store on the appointment: the version the server displayed.
 * Marketplace bookings also show Sorriso's notice; both are versioned together today.
 */
export function noticeVersionFor(context: ProcessingContext): string {
  return context === "marketplace" ? NOTICE_VERSIONS.platform_patient : NOTICE_VERSIONS.practice_patient;
}

/**
 * The same rules for the form in the browser, before posting: the fields to flag, each with its
 * rule code (the forms map codes to texts: errors.api.<code>). Empty when the form may be sent.
 */
export function bookingPrivacyFormErrors(i: Omit<BookingPrivacyInput, "noticeVersion">): Record<string, BookingPrivacyCode> {
  const out: Record<string, BookingPrivacyCode> = {};
  if (i.context === "marketplace" && i.choices.platformConsent !== true) out.platformConsent = "platform_consent_required";
  if (i.preferredChannel === "whatsapp") {
    if (!i.org.whatsappEnabled) out.preferredChannel = "whatsapp_unavailable";
    else if (i.choices.whatsapp !== true) out.whatsapp = "whatsapp_consent_required";
  }
  return out;
}
