import type { ConsentPurpose, LegalDoc, NoticeKind } from "@/db/enums";

/**
 * Versions of every text whose acceptance or display we must be able to prove.
 *
 * Bump a version whenever the meaning of its text changes (in Italian, the authoritative
 * language): consent rows store CONSENT_TEXT_VERSION, appointments store the notice version
 * shown, and legal_acceptances store the document version, so old proofs stay tied to the
 * wording that was actually in force.
 */

export const NOTICE_VERSIONS: Record<NoticeKind, string> = {
  practice_patient: "2026-10",
  platform_patient: "2026-10",
  minor: "2026-10",
  cookies: "2026-10",
  staff: "2026-10",
  practitioner: "2026-10",
};

/** One version per text in the 'consents' namespace (see consentTextKey). */
export const CONSENT_TEXT_VERSION: Record<ConsentPurpose, string> = {
  platform_booking_art9: "2026-10",
  whatsapp_channel: "2026-10",
  sms_channel: "2026-10",
  email_channel: "2026-10",
  feedback_request: "2026-10",
  review_publication: "2026-10",
  marketing: "2026-10",
  adaptive_reminders: "2026-10",
  no_show_tracking: "2026-10",
  recalls: "2026-10",
};

export const LEGAL_VERSIONS: Record<LegalDoc, string> = {
  dpa: "2026-10",
  terms: "2026-10",
  subprocessors: "2026-10",
  staff_instructions: "2026-10",
};
