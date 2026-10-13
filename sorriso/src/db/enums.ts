/**
 * Enumerations shared by the database schema, server code and client components.
 * Pure constants: no drizzle or Node imports, so client components can import from here
 * (never import values from "@/db/schema" in client code).
 */
export { LOCALES, type Locale } from "@/i18n/config";

export const SERVICE_CATEGORIES = [
  "checkup",
  "hygiene",
  "orthodontics",
  "implants",
  "aesthetic",
  "endodontics",
  "pediatric",
  "surgery",
  "emergency",
  "prosthetics",
] as const;
export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];

export const APPOINTMENT_STATUSES = ["requested", "scheduled", "completed", "no_show", "cancelled"] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];
export const CONFIRMATION_STATUSES = ["pending", "confirmed", "declined"] as const;
export type ConfirmationStatus = (typeof CONFIRMATION_STATUSES)[number];
export const CHANNELS = ["email", "sms", "whatsapp"] as const;
export type Channel = (typeof CHANNELS)[number];
export const MEMBERSHIP_ROLES = ["owner", "admin", "reception", "practitioner"] as const;
export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];

/**
 * Who decides why and how data is processed for a booking:
 *  - practice:    booked through the practice's own channels (widget, staff, partner API, direct link).
 *                 The practice is controller, Sorriso its Art. 28 processor; care basis Art. 9(2)(h).
 *  - marketplace: booking started on Sorriso's own marketplace pages. Sorriso is an independent
 *                 controller for that intermediation and needs explicit Art. 9(2)(a) consent.
 */
export const PROCESSING_CONTEXTS = ["practice", "marketplace"] as const;
export type ProcessingContext = (typeof PROCESSING_CONTEXTS)[number];

export const BOOKED_FOR = ["self", "minor", "other_adult"] as const;
export type BookedFor = (typeof BOOKED_FOR)[number];
export const GUARDIAN_RELATIONS = ["parent", "legal_guardian"] as const;
export type GuardianRelation = (typeof GUARDIAN_RELATIONS)[number];

/**
 * Consent-ledger purposes. Some are consent-based (opt-in), others are recorded only to log an
 * objection or a channel choice (see PURPOSE_BASIS in src/lib/privacy/consent.ts).
 */
export const CONSENT_PURPOSES = [
  "platform_booking_art9",
  "whatsapp_channel",
  "sms_channel",
  "email_channel",
  "feedback_request",
  "review_publication",
  "marketing",
  "adaptive_reminders",
  "no_show_tracking",
  "recalls",
] as const;
export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number];
export const CONSENT_METHODS = ["web_checkbox", "sms_reply", "email_link", "staff_recorded", "api", "system"] as const;
export type ConsentMethod = (typeof CONSENT_METHODS)[number];
export const CONSENT_SOURCES = [
  "booking",
  "widget",
  "waitlist",
  "manage_link",
  "privacy_center",
  "sms_reply",
  "staff",
  "api",
  "review",
  "retention",
] as const;
export type ConsentSource = (typeof CONSENT_SOURCES)[number];
export const ACTOR_RELATIONS = ["self", "parent", "legal_guardian", "staff", "system"] as const;
export type ActorRelation = (typeof ACTOR_RELATIONS)[number];

export const PRIVACY_REQUEST_TYPES = [
  "access",
  "rectification",
  "erasure",
  "restriction",
  "portability",
  "objection",
  "consent_withdrawal",
] as const;
export type PrivacyRequestType = (typeof PRIVACY_REQUEST_TYPES)[number];
export const PRIVACY_REQUEST_CHANNELS = ["privacy_center", "manage_link", "email", "phone", "in_person", "support", "api"] as const;
export type PrivacyRequestChannel = (typeof PRIVACY_REQUEST_CHANNELS)[number];
export const PRIVACY_REQUEST_STATUSES = ["open", "in_progress", "extended", "completed", "rejected"] as const;
export type PrivacyRequestStatus = (typeof PRIVACY_REQUEST_STATUSES)[number];
export const PRIVACY_REQUEST_DECISIONS = ["granted", "partially_granted", "refused"] as const;
export type PrivacyRequestDecision = (typeof PRIVACY_REQUEST_DECISIONS)[number];

export const AUDIT_ACTOR_TYPES = ["user", "api_key", "patient_link", "patient_session", "system", "platform_admin", "webhook"] as const;
export type AuditActorType = (typeof AUDIT_ACTOR_TYPES)[number];

export const LEGAL_DOCS = ["dpa", "terms", "subprocessors", "staff_instructions"] as const;
export type LegalDoc = (typeof LEGAL_DOCS)[number];
export const NOTICE_KINDS = ["practice_patient", "platform_patient", "minor", "cookies", "staff", "practitioner"] as const;
export type NoticeKind = (typeof NOTICE_KINDS)[number];

export const REVIEW_STATUSES = ["pending", "published", "under_review", "removed", "withdrawn"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];
export const REVIEW_AUTHOR_DISPLAY = ["pseudonym", "first_initial"] as const;
export type ReviewAuthorDisplay = (typeof REVIEW_AUTHOR_DISPLAY)[number];
export const REVIEW_REPORT_GROUNDS = [
  "defamation",
  "third_party_health_data",
  "reviewer_health_data",
  "offensive",
  "not_about_visit",
  "conflict_of_interest",
  "other",
] as const;
export type ReviewReportGround = (typeof REVIEW_REPORT_GROUNDS)[number];
export const REVIEW_REPORT_STATUSES = ["open", "awaiting_patient", "decided", "appealed", "closed"] as const;
export type ReviewReportStatus = (typeof REVIEW_REPORT_STATUSES)[number];

export const RISK_LEVELS = ["low", "medium", "high"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];
export const RECALL_STATUSES = ["due", "sent", "booked", "dismissed", "call"] as const;
export type RecallStatus = (typeof RECALL_STATUSES)[number];

export const PRICE_TYPES = ["fixed", "from", "quote"] as const;
export type PriceType = (typeof PRICE_TYPES)[number];
export const FUND_KINDS = ["fund", "insurer"] as const;
export type FundKind = (typeof FUND_KINDS)[number];
export const FUND_MODES = ["direct", "indirect"] as const;
export type FundMode = (typeof FUND_MODES)[number];
/** Legally recognised dental specialisations in Italy (shown only once Albo-verified). */
export const LEGAL_SPECIALIZATIONS = ["orthodontics", "oral_surgery", "pediatric_dentistry"] as const;
export type LegalSpecialization = (typeof LEGAL_SPECIALIZATIONS)[number];

export const OTP_PURPOSES = ["privacy_center", "contact_change", "form_signature", "link_reissue", "adult_confirmation"] as const;
export type OtpPurpose = (typeof OTP_PURPOSES)[number];
export const AUTH_TOKEN_KINDS = ["password_reset", "email_verify", "invite"] as const;
export type AuthTokenKind = (typeof AUTH_TOKEN_KINDS)[number];
export const FORM_KINDS = ["anamnesis"] as const;
export type FormKind = (typeof FORM_KINDS)[number];
export const SIGNED_VIA = ["otp_sms", "otp_email", "staff"] as const;
export type SignedVia = (typeof SIGNED_VIA)[number];

export const API_SCOPES = [
  "appointments:read",
  "appointments:write",
  "patients:read",
  "patients:write",
  "notes:read",
  "patients:erase",
] as const;
export type ApiScope = (typeof API_SCOPES)[number];

export const MESSAGE_INTENTS = ["confirm", "cancel", "reschedule", "unknown", "stop", "start"] as const;
export type MessageIntent = (typeof MESSAGE_INTENTS)[number];

/** Spoken languages a practitioner can list (ISO 639-1), beyond the UI locales. */
export const SPOKEN_LANGUAGES = [
  "it", "en", "de", "fr", "es", "pt", "ro", "pl", "sq", "uk", "ru", "ar", "zh", "hi", "bn", "ur", "tl", "nl", "el", "hr", "sr", "sl", "hu", "cs", "sk", "bg", "tr", "fa", "he", "ja",
] as const;
export type SpokenLanguage = (typeof SPOKEN_LANGUAGES)[number];
