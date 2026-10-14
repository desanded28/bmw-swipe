/**
 * Shared contracts of the booking and manage forms (frozen: packages only add fields).
 *
 * The booking flow (WP1) owns the form state and posts it; the sections below are filled in by
 * other packages and see only these props:
 *   PrivacySection          WP4  notice, Art. 9 consent, WhatsApp confirmation, opt-ins
 *   PatientRelationSection  WP4  who the appointment is for (self, a minor, another adult)
 *   BookingExtrasSection    WP7  the health fund the patient will use
 *   ManagePrivacyCard       WP4  privacy links on the manage page
 *   ManageFormsCard         WP8  anamnesis form status on the manage page
 *
 * Pure types and helpers: safe in client components (type imports only from server modules).
 */
import type { AppointmentStatus, BookedFor, Channel, GuardianRelation, Locale, ProcessingContext } from "@/db/enums";
import type { PublicClinic } from "@/lib/directory";

/** The privacy part of the booking and waitlist forms; posted as `privacy` with the notice version. */
export type BookingPrivacyState = {
  /**
   * Legacy, always false: there is no notice-acknowledgement box (it isn't needed, and next to the
   * consent boxes it reads as bundled consent). The server records the notice version it displayed.
   */
  noticeAck: boolean;
  /** Sorriso's Art. 9(2)(a) consent; required for marketplace bookings, never shown otherwise. */
  platformConsent: boolean;
  /** Confirms WhatsApp as the channel; required when WhatsApp is chosen. */
  whatsapp: boolean;
  feedback: boolean;
  /** Shown only when clinic.privacy.marketingEnabled. */
  marketing: boolean;
};

/** Who the appointment is for; posted as `relation`. */
export type RelationState = {
  bookedFor: BookedFor;
  /** For a minor: the parent or legal guardian (stored on the patient record). */
  guardian: { name: string; relation: GuardianRelation; phone: string; email: string };
  /** For another adult: who is booking (stored on the appointment, never as the patient's contacts). */
  bookedBy: { name: string; phone: string; email: string };
};

/** Extra booking details; `fundId` is posted as is and kept only if the practice lists that fund. */
export type ExtrasState = { fundId: string | null };

export type PrivacySectionProps = {
  clinic: PublicClinic;
  context: ProcessingContext;
  variant: "booking" | "waitlist";
  preferredChannel: Channel;
  relation: RelationState;
  value: BookingPrivacyState;
  onChange(v: BookingPrivacyState): void;
  /** Keyed by field: platformConsent, whatsapp, feedback, marketing. */
  errors: Record<string, string>;
};

/**
 * The booking and waitlist forms post `relation` only once this section has called onChange (it
 * asked who the appointment is for); until then they post none and the API checks no relation, so a
 * parent booking for a child isn't refused as a child "booking alone". A section that preselects an
 * answer must report it through onChange.
 */
export type PatientRelationSectionProps = {
  value: RelationState;
  onChange(v: RelationState): void;
  /** The patient's birth date as typed (YYYY-MM-DD or ""). */
  birthDate: string;
  /** Keyed by field: bookedFor, birthDate, guardian.name, guardian.relation, guardian.phone, bookedBy.name... */
  errors: Record<string, string>;
};

export type BookingExtrasSectionProps = {
  clinic: PublicClinic;
  serviceId: string;
  value: ExtrasState;
  onChange(v: ExtrasState): void;
};

/** Props of the cards the manage page (/[locale]/a/[token]) renders for other packages. */
export type ManageSlotProps = {
  token: string;
  locale: Locale;
  orgSlug: string;
  appointmentId: string;
  status: AppointmentStatus;
};

export const INITIAL_PRIVACY: BookingPrivacyState = {
  noticeAck: false,
  platformConsent: false,
  whatsapp: false,
  feedback: false,
  marketing: false,
};

export const INITIAL_RELATION: RelationState = {
  bookedFor: "self",
  guardian: { name: "", relation: "parent", phone: "", email: "" },
  bookedBy: { name: "", phone: "", email: "" },
};

export const INITIAL_EXTRAS: ExtrasState = { fundId: null };

/**
 * The dial code the phone fields start on: the practices' country (Italy, DEFAULT_COUNTRY_CODE on the
 * server), never the page language. An Italian mobile typed as "333 123 4567" on /en or /de must not
 * become +44 or +49; patients with a foreign number pick its code or type it with "+".
 */
export const PRACTICE_DIAL_CODE = "39";

/**
 * The `privacy` field of the booking and waitlist APIs. `noticeVersion` is the version of the notice
 * the form showed (noticeVersionFor(context) in src/lib/privacy/booking-rules.ts), `locale` the
 * language it was shown in. Options the context or the practice don't offer are sent as false.
 */
export function privacyPayload(
  v: BookingPrivacyState,
  o: { clinic: PublicClinic; context: ProcessingContext; preferredChannel: Channel; noticeVersion: string; locale: Locale },
) {
  return {
    noticeVersion: o.noticeVersion,
    locale: o.locale,
    noticeAck: v.noticeAck,
    platformConsent: o.context === "marketplace" && v.platformConsent,
    whatsapp: o.clinic.privacy.whatsappEnabled && o.preferredChannel === "whatsapp" && v.whatsapp,
    feedback: v.feedback,
    marketing: o.clinic.privacy.marketingEnabled && v.marketing,
  };
}

/** The `relation` field of the booking and waitlist APIs: only the part that applies to `bookedFor`. */
export function relationPayload(r: RelationState) {
  const orNull = (s: string) => s.trim() || null;
  return {
    bookedFor: r.bookedFor,
    guardian:
      r.bookedFor === "minor"
        ? { name: r.guardian.name, relation: r.guardian.relation, phone: orNull(r.guardian.phone), email: orNull(r.guardian.email) }
        : null,
    bookedBy:
      r.bookedFor === "other_adult" ? { name: r.bookedBy.name, phone: orNull(r.bookedBy.phone), email: orNull(r.bookedBy.email) } : null,
  };
}

/** Map an API error to form errors: zod issues by path (without the patient. or privacy. prefix), or a rule's field. */
export function fieldErrors(error: { issues?: { path: string; message: string }[]; field?: string; message?: string } | undefined) {
  const out: Record<string, string> = {};
  for (const issue of error?.issues ?? []) out[issue.path.replace(/^(patient|privacy|relation)\./, "")] = issue.message;
  if (error?.field && error.message) out[error.field.replace(/^(patient|relation)\./, "")] = error.message;
  return out;
}
