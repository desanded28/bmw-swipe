import type { ConsentPurpose } from "@/db/enums";
import type { RetentionSettings } from "@/db/schema";
import type { SubprocessorId } from "./subprocessors";

/**
 * Who controls what (the hybrid role model) — the single source for the patient notices,
 * the Art. 30 registers, the DPA annex and the cookie list.
 *
 * - The practice is the controller for everything that reaches it through its own channels
 *   (practice page reached by its own link, widget, staff, partner API, waitlist). Sorriso is
 *   its Art. 28 processor and acts only on the documented instructions in the DPA.
 * - Sorriso is an independent controller for its marketplace: bookings started on Sorriso's
 *   pages (explicit Art. 9(2)(a) consent), the directory, published reviews, ranking, and the
 *   cross-practice privacy center.
 *
 * Art. 28(10): a processor that decides purposes of its own becomes a controller for them.
 * Anything Sorriso does with practice data for its own ends is therefore listed here with
 * controller 'sorriso' (ranking metrics, the privacy-center lookup across practices, review
 * publication), and anything it does for the practice beyond running the agenda is marked
 * `dpaInstruction` so the DPA lists it as an instruction (review invitations).
 */

export type ProcessingPurpose =
  | "booking_practice"
  | "booking_marketplace"
  | "appointment_management"
  | "reminders"
  | "waitlist"
  | "recalls"
  | "feedback_requests"
  | "reviews"
  | "marketing"
  | "no_show_tracking"
  | "adaptive_reminders"
  | "anamnesis"
  | "partner_api"
  | "directory"
  | "ranking"
  | "privacy_center"
  | "staff_accounts"
  | "security_logs"
  | "privacy_requests";

/** GDPR Art. 6(1) and Art. 9(2) conditions, as stable codes (labels live in the legal namespaces). */
export type LegalBasis =
  | "art6_1_a" // consent
  | "art6_1_b" // contract, or steps at the data subject's request before one
  | "art6_1_c" // legal obligation
  | "art6_1_f" // legitimate interests
  | "art9_2_a" // explicit consent
  | "art9_2_f" // legal claims
  | "art9_2_h"; // health care, under professional secrecy (Art. 9(3))

export type DataCategory =
  | "identity"
  | "contact"
  | "appointment"
  /** Booking data that reveals that a person receives dental care, or which treatment. */
  | "health_inferred"
  | "health"
  | "minor"
  | "guardian"
  | "message_content"
  | "consent_record"
  | "review"
  | "professional"
  | "account"
  | "technical"
  | "aggregated_metrics";

export type DataSubject = "patients" | "guardians" | "bookers" | "practitioners" | "staff" | "reviewers";

export type PurposeInfo = {
  controller: "practice" | "sorriso";
  sorrisoRole: "processor" | "controller";
  legalBases: LegalBasis[];
  /** The consent-ledger purpose that records consent to, or objection against, this processing. */
  consentPurpose?: ConsentPurpose;
  /** The patient can object (Art. 21) or opt out, and is told so in the notice. */
  objectable?: boolean;
  /** Profiling (Art. 4(4)): disclosed in the notice together with the right to object. */
  profiling?: boolean;
  /** Processor work beyond running the agenda, listed in the DPA as a documented instruction. */
  dpaInstruction?: boolean;
  dataCategories: DataCategory[];
  subjects: DataSubject[];
  retentionKey?: keyof RetentionSettings;
  recipients: SubprocessorId[];
  /** Key in the legal namespaces (legalPatient / legalPractice): purposes.<id>. */
  i18nKey: string;
};

const CORE: SubprocessorId[] = ["vercel", "turso", "backups"];
const MESSAGING: SubprocessorId[] = [...CORE, "smtp", "twilio", "meta_whatsapp"];

const practice = { controller: "practice", sorrisoRole: "processor" } as const;
const sorriso = { controller: "sorriso", sorrisoRole: "controller" } as const;

export const PURPOSES: Record<ProcessingPurpose, PurposeInfo> = {
  booking_practice: {
    ...practice,
    legalBases: ["art6_1_b", "art9_2_h"],
    dataCategories: ["identity", "contact", "appointment", "health_inferred", "minor", "guardian"],
    subjects: ["patients", "guardians", "bookers"],
    retentionKey: "patientInactiveMonths",
    recipients: MESSAGING,
    i18nKey: "purposes.booking_practice",
  },
  /**
   * Withdrawing platform_booking_art9 ends this purpose only: Sorriso stops its own processing
   * (no marketplace history, no Sorriso-controlled messages or review invitations), while the
   * practice keeps its copy as controller under Art. 9(2)(h) with Sorriso as its processor.
   * See WITHDRAWAL_EFFECTS.
   */
  booking_marketplace: {
    ...sorriso,
    legalBases: ["art6_1_a", "art9_2_a"],
    consentPurpose: "platform_booking_art9",
    dataCategories: ["identity", "contact", "appointment", "health_inferred", "consent_record"],
    subjects: ["patients", "guardians"],
    recipients: MESSAGING,
    i18nKey: "purposes.booking_marketplace",
  },
  appointment_management: {
    ...practice,
    legalBases: ["art6_1_b", "art9_2_h"],
    dataCategories: ["identity", "contact", "appointment", "health_inferred", "health"],
    subjects: ["patients", "guardians"],
    retentionKey: "patientInactiveMonths",
    recipients: CORE,
    i18nKey: "purposes.appointment_management",
  },
  reminders: {
    ...practice,
    legalBases: ["art6_1_b", "art9_2_h"],
    objectable: true,
    dataCategories: ["contact", "appointment", "message_content"],
    subjects: ["patients", "guardians"],
    retentionKey: "messageBodyMonths",
    recipients: MESSAGING,
    i18nKey: "purposes.reminders",
  },
  waitlist: {
    ...practice,
    legalBases: ["art6_1_b", "art9_2_h"],
    dataCategories: ["identity", "contact", "appointment", "health_inferred"],
    subjects: ["patients", "guardians"],
    retentionKey: "waitlistDays",
    recipients: MESSAGING,
    i18nKey: "purposes.waitlist",
  },
  /** Only when a clinician set the interval for this patient: care, not "fidelizzazione". */
  recalls: {
    ...practice,
    legalBases: ["art6_1_b", "art9_2_h"],
    consentPurpose: "recalls",
    objectable: true,
    dataCategories: ["identity", "contact", "health"],
    subjects: ["patients", "guardians"],
    retentionKey: "patientInactiveMonths",
    recipients: MESSAGING,
    i18nKey: "purposes.recalls",
  },
  feedback_requests: {
    ...practice,
    legalBases: ["art6_1_a", "art9_2_a"],
    consentPurpose: "feedback_request",
    dpaInstruction: true,
    dataCategories: ["contact", "appointment"],
    subjects: ["patients"],
    retentionKey: "messageBodyMonths",
    recipients: [...CORE, "smtp"],
    i18nKey: "purposes.feedback_requests",
  },
  reviews: {
    ...sorriso,
    legalBases: ["art6_1_a", "art9_2_a"],
    consentPurpose: "review_publication",
    dataCategories: ["review", "health_inferred", "consent_record"],
    subjects: ["reviewers", "practitioners"],
    recipients: CORE,
    i18nKey: "purposes.reviews",
  },
  marketing: {
    ...practice,
    legalBases: ["art6_1_a"],
    consentPurpose: "marketing",
    dataCategories: ["identity", "contact"],
    subjects: ["patients"],
    recipients: [...CORE, "smtp", "twilio"],
    i18nKey: "purposes.marketing",
  },
  /** No-show history is health data: legitimate interest paired with 9(2)(h), objectable. */
  no_show_tracking: {
    ...practice,
    legalBases: ["art6_1_f", "art9_2_h"],
    consentPurpose: "no_show_tracking",
    objectable: true,
    dataCategories: ["appointment", "health_inferred"],
    subjects: ["patients"],
    retentionKey: "patientInactiveMonths",
    recipients: CORE,
    i18nKey: "purposes.no_show_tracking",
  },
  /** Risk scoring is profiling: disclosed, objectable, never blocks a booking; DPIA required. */
  adaptive_reminders: {
    ...practice,
    legalBases: ["art6_1_f", "art9_2_h"],
    consentPurpose: "adaptive_reminders",
    objectable: true,
    profiling: true,
    dataCategories: ["appointment", "health_inferred"],
    subjects: ["patients"],
    retentionKey: "messageBodyMonths",
    recipients: MESSAGING,
    i18nKey: "purposes.adaptive_reminders",
  },
  anamnesis: {
    ...practice,
    legalBases: ["art6_1_b", "art9_2_h"],
    dataCategories: ["identity", "health", "minor"],
    subjects: ["patients", "guardians"],
    retentionKey: "formSubmissionMonths",
    recipients: [...CORE, "smtp", "twilio"],
    i18nKey: "purposes.anamnesis",
  },
  /** Integrations the practice chooses; their providers are the practice's own recipients. */
  partner_api: {
    ...practice,
    legalBases: ["art6_1_b", "art9_2_h"],
    dataCategories: ["identity", "contact", "appointment", "health_inferred"],
    subjects: ["patients"],
    recipients: CORE,
    i18nKey: "purposes.partner_api",
  },
  directory: {
    ...sorriso,
    legalBases: ["art6_1_b", "art6_1_f"],
    dataCategories: ["professional"],
    subjects: ["practitioners"],
    recipients: CORE,
    i18nKey: "purposes.directory",
  },
  /** Ranking inputs taken from practice data (staff cancellations, completeness): Sorriso's own purpose. */
  ranking: {
    ...sorriso,
    legalBases: ["art6_1_f"],
    dataCategories: ["aggregated_metrics", "professional"],
    subjects: ["practitioners"],
    recipients: CORE,
    i18nKey: "purposes.ranking",
  },
  /**
   * Finding a verified contact's records across practices so they can exercise their rights.
   * The history it shows reveals dental care, so it needs an Art. 9(2) condition too: 9(2)(f),
   * as for privacy_requests (to be confirmed by the DPO with the rest of the register).
   */
  privacy_center: {
    ...sorriso,
    legalBases: ["art6_1_c", "art6_1_f", "art9_2_f"],
    dataCategories: ["identity", "contact", "appointment", "health_inferred", "technical"],
    subjects: ["patients", "guardians"],
    retentionKey: "privacyRequestMonths",
    recipients: [...CORE, "smtp", "twilio"],
    i18nKey: "purposes.privacy_center",
  },
  staff_accounts: {
    ...sorriso,
    legalBases: ["art6_1_b", "art6_1_f"],
    dataCategories: ["identity", "account", "technical"],
    subjects: ["staff", "practitioners"],
    recipients: [...CORE, "smtp"],
    i18nKey: "purposes.staff_accounts",
  },
  /** Access log of patient records, kept for the practice (staff are informed: Art. 4 L. 300/1970). */
  security_logs: {
    ...practice,
    legalBases: ["art6_1_c", "art6_1_f"],
    dataCategories: ["technical", "account"],
    subjects: ["staff", "patients"],
    retentionKey: "auditMonths",
    recipients: CORE,
    i18nKey: "purposes.security_logs",
  },
  /** Requests to Sorriso as controller (org null) follow the same rules in Sorriso's own register. */
  privacy_requests: {
    ...practice,
    legalBases: ["art6_1_c", "art9_2_f"],
    dataCategories: ["identity", "contact", "technical"],
    subjects: ["patients", "guardians"],
    retentionKey: "privacyRequestMonths",
    recipients: [...CORE, "smtp", "twilio"],
    i18nKey: "purposes.privacy_requests",
  },
};

export const PROCESSING_PURPOSES = Object.keys(PURPOSES) as ProcessingPurpose[];

/** Processing for which Sorriso is controller (Sorriso's own register and notice). */
export const SORRISO_CONTROLLER_PURPOSES = PROCESSING_PURPOSES.filter((p) => PURPOSES[p].controller === "sorriso");

/**
 * Consent purposes recorded with org_id NULL: Sorriso, not the practice, is the controller
 * that must prove them (platform_booking_art9 and review_publication).
 */
export const PLATFORM_CONSENT_PURPOSES: readonly ConsentPurpose[] = SORRISO_CONTROLLER_PURPOSES.flatMap((p) => {
  const c = PURPOSES[p].consentPurpose;
  return c ? [c] : [];
});

export function isPlatformConsentPurpose(p: ConsentPurpose): boolean {
  return PLATFORM_CONSENT_PURPOSES.includes(p);
}

/**
 * What a withdrawal (consent purposes) or an objection (legitimate interest and care) stops,
 * and what lawfully continues on another basis. Not retroactive: processing before it stays
 * lawful (Art. 7(3)). Notices and the privacy center explain exactly this.
 */
export const WITHDRAWAL_EFFECTS: Record<ConsentPurpose, { stops: ProcessingPurpose[]; continues: ProcessingPurpose[] }> = {
  // Sorriso stops its own processing; the practice's copy continues under Art. 9(2)(h).
  platform_booking_art9: {
    stops: ["booking_marketplace"],
    continues: ["booking_practice", "appointment_management", "reminders"],
  },
  // Channel choices: messages continue on another channel.
  whatsapp_channel: { stops: [], continues: ["reminders"] },
  sms_channel: { stops: [], continues: ["reminders"] },
  email_channel: { stops: [], continues: ["reminders"] },
  feedback_request: { stops: ["feedback_requests"], continues: [] },
  // The review is unpublished.
  review_publication: { stops: ["reviews"], continues: [] },
  marketing: { stops: ["marketing"], continues: [] },
  adaptive_reminders: { stops: ["adaptive_reminders"], continues: ["reminders"] },
  // Without the history there is nothing to adapt reminders to.
  no_show_tracking: { stops: ["no_show_tracking", "adaptive_reminders"], continues: ["appointment_management"] },
  recalls: { stops: ["recalls"], continues: ["appointment_management"] },
};
