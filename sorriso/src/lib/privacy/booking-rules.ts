import type { Channel, ProcessingContext } from "@/db/enums";
import type { BookingPrivacyChoices } from "./consent";
import { NOTICE_VERSIONS } from "./versions";

/**
 * Server-side checks on the privacy part of a booking or waitlist form. The browser runs the
 * same checks for friendly errors; these are the ones that count.
 */

/** Shared by the booking privacy and relation checks: `field` names the form field to flag. */
export type RuleResult<C extends string = string> = { ok: true } | { ok: false; code: C; field: string };

export type BookingPrivacyCode = "platform_consent_required" | "whatsapp_consent_required" | "whatsapp_unavailable";

export type BookingPrivacyInput = {
  context: ProcessingContext;
  preferredChannel: Channel;
  choices: BookingPrivacyChoices;
  /** Informational: the server records the version it displayed (noticeVersionFor), not this. */
  noticeVersion?: string | null;
  org: { whatsappEnabled: boolean; marketingEnabled: boolean };
};

export function validateBookingPrivacy(i: BookingPrivacyInput): RuleResult<BookingPrivacyCode> {
  if (i.context === "marketplace" && i.choices.platformConsent !== true) {
    return { ok: false, code: "platform_consent_required", field: "platformConsent" };
  }
  if (i.preferredChannel === "whatsapp") {
    if (!i.org.whatsappEnabled) return { ok: false, code: "whatsapp_unavailable", field: "preferredChannel" };
    if (i.choices.whatsapp !== true) return { ok: false, code: "whatsapp_consent_required", field: "whatsapp" };
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
 * The notice version to store on the appointment: the version the server displayed (no
 * acknowledgement checkbox — it isn't needed and next to consent boxes it reads as bundling).
 * Marketplace bookings also show Sorriso's notice; both are versioned together today.
 */
export function noticeVersionFor(context: ProcessingContext): string {
  return context === "marketplace" ? NOTICE_VERSIONS.platform_patient : NOTICE_VERSIONS.practice_patient;
}
