import { sql } from "drizzle-orm";
import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import type { Locale } from "@/i18n/config";
import { encryptedText } from "./encrypted";
import {
  ACTOR_RELATIONS,
  APPOINTMENT_STATUSES,
  AUDIT_ACTOR_TYPES,
  AUTH_TOKEN_KINDS,
  BOOKED_FOR,
  CHANNELS,
  CONFIRMATION_STATUSES,
  CONSENT_METHODS,
  CONSENT_PURPOSES,
  CONSENT_SOURCES,
  FORM_KINDS,
  FUND_KINDS,
  FUND_MODES,
  GUARDIAN_RELATIONS,
  LEGAL_DOCS,
  LOCALES,
  MEMBERSHIP_ROLES,
  MESSAGE_INTENTS,
  NOTICE_KINDS,
  OTP_PURPOSES,
  PRICE_TYPES,
  PRIVACY_REQUEST_CHANNELS,
  PRIVACY_REQUEST_DECISIONS,
  PRIVACY_REQUEST_STATUSES,
  PRIVACY_REQUEST_TYPES,
  PROCESSING_CONTEXTS,
  RECALL_STATUSES,
  REVIEW_AUTHOR_DISPLAY,
  REVIEW_REPORT_GROUNDS,
  REVIEW_REPORT_STATUSES,
  REVIEW_STATUSES,
  RISK_LEVELS,
  SERVICE_CATEGORIES,
  SIGNED_VIA,
  type ApiScope,
  type LegalSpecialization,
  type SpokenLanguage,
} from "./enums";

export * from "./enums";

/**
 * Data model
 *
 *   organization (a practice / clinic brand)
 *     ├── locations (offices)            ── rooms (chairs / operatories)
 *     ├── practitioners ── schedules (weekly hours, per location)
 *     │                 └─ practitioner_services
 *     ├── services
 *     ├── patients ── appointments ── reminders
 *     ├── time_off (practitioner, room, location or whole-org closures)
 *     ├── waitlist, reviews, messages (email/SMS/WhatsApp log), recalls, form_submissions
 *     ├── consents (append-only ledger), privacy_requests, audit_log (hash-chained)
 *     └── memberships (staff users) / api_keys / legal_acceptances
 *
 * All instants are stored as UTC epoch milliseconds. Weekly schedules are stored
 * as wall-clock minutes in the location's time zone so they survive DST changes.
 *
 * Free text that may contain health data uses encryptedText (AES-256-GCM, src/lib/crypto.ts).
 *
 * Migration rules (SQLite): columns added to existing tables use constant defaults only
 * (ALTER TABLE … ADD COLUMN can't take an expression default) and nothing is made nullable
 * or dropped (that would rebuild tables with ON DELETE CASCADE children). Deprecated columns
 * are kept and marked below.
 */

const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`);

/** For timestamps added to existing tables: nullable, filled by the app on insert. */
const addedTimestamp = (name: string) => integer(name, { mode: "timestamp_ms" }).$defaultFn(() => new Date());

export type LocalizedText = Partial<Record<Locale, string>>;

export type ReminderRule = {
  id: string;
  channel: "email" | "sms" | "whatsapp";
  /** Minutes before the appointment start. */
  offsetMinutes: number;
  /** Ask the patient to confirm (reply YES/NO or click a link). */
  askConfirmation: boolean;
  /** If the channel can't reach the patient (no phone / opted out), fall back to email. */
  fallbackToEmail: boolean;
  /** Only send this rule for appointments at (at least) this no-show risk level. */
  onlyIfRisk?: "medium" | "high";
};

export type RetentionSettings = {
  /** Patients with no visit for this long are pseudonymised (clinical-record obligations permitting). */
  patientInactiveMonths: number;
  /** Patients created but never seen (no completed visit). */
  neverSeenPatientMonths: number;
  /** Message bodies are redacted after this. */
  messageBodyMonths: number;
  /** Message metadata (who/when/channel) is deleted after this. */
  messageMetaMonths: number;
  /** Sent/skipped reminder rows. */
  reminderDays: number;
  /** Waitlist entries after they close. */
  waitlistDays: number;
  /** Free-text patient notes on past appointments. */
  patientNoteDays: number;
  /** Staff access log. */
  auditMonths: number;
  /** Ask the SMS/WhatsApp provider to delete its copy after this. */
  providerMessageDays: number;
  /** Anamnesis forms (only once exported to the clinical record). */
  formSubmissionMonths: number;
  /** Consent ledger rows after the patient is gone (proof of consent + limitation period). */
  consentMonths: number;
  /** Closed privacy requests (accountability). */
  privacyRequestMonths: number;
};

export type PrivacySettings = {
  /** discreet = no treatment / practitioner / notes in SMS, WhatsApp, email subjects, calendars. */
  messageContentLevel: "discreet" | "detailed";
  whatsappEnabled: boolean;
  marketingEnabled: boolean;
  icsFeedsEnabled: boolean;
  icsDetail: "none" | "initials";
  /** Websites allowed to frame the booking widget (CSP frame-ancestors). Empty = any. */
  embedOrigins: string[];
  requireMfa: boolean;
  sessionHours: number;
  riskBasedReminders: boolean;
  staffWaLinks: boolean;
  erasureDefault: "restrict" | "anonymise";
  retention: RetentionSettings;
};

export type CareSettings = {
  recallsEnabled: boolean;
  recallMaxAttempts: number;
  anamnesisEnabled: boolean;
  anamnesisRefreshMonths: number;
};

export type OrgSettings = {
  booking: {
    /** Shortest lead time for online bookings. */
    minNoticeMinutes: number;
    /** How far ahead patients can book online. */
    maxAdvanceDays: number;
    /** Slot grid granularity. */
    slotStepMinutes: number;
    /** Patients can reschedule online until this many hours before. */
    cancelUntilHours: number;
    /** If true, online bookings arrive as requests the front desk must approve. */
    requireApproval: boolean;
  };
  reminders: {
    rules: ReminderRule[];
    /** Send a booking confirmation email right after booking. */
    sendBookingConfirmation: boolean;
    /** Ask for a review after the visit is marked completed. */
    requestReviews: boolean;
    /** Offer freed-up slots to the waitlist automatically. */
    autoOfferToWaitlist: boolean;
    /** Transliterate SMS to GSM-7 to keep them to one segment. */
    smsAsciiFallback: boolean;
  };
  privacy: PrivacySettings;
  care: CareSettings;
};

/** Stored shape may be partial (older rows); always read through resolveSettings(). */
export type StoredOrgSettings = {
  booking?: Partial<OrgSettings["booking"]>;
  reminders?: Partial<OrgSettings["reminders"]>;
  privacy?: Partial<Omit<PrivacySettings, "retention">> & { retention?: Partial<RetentionSettings> };
  care?: Partial<CareSettings>;
};

export type LocationAccessibility = {
  stepFree?: boolean;
  lift?: boolean;
  accessibleWc?: boolean;
  disabledParking?: boolean;
  hearingLoop?: boolean;
  wheelchairTransferChair?: boolean;
  transit?: string;
};

export type PractitionerCareOptions = {
  specialNeeds?: boolean;
  anxiousPatients?: boolean;
  sedation?: boolean;
  children?: boolean;
};

export type FormField = {
  id: string;
  type: "yesno" | "text" | "select" | "multiselect" | "date";
  /** i18n key in the "care" namespace */
  labelKey: string;
  options?: string[];
  required?: boolean;
  /** Answer that raises a clinical red flag (e.g. "yes" to anticoagulants). */
  redFlagIf?: string | boolean;
};
export type FormSchema = { version: string; sections: { id: string; titleKey: string; fields: FormField[] }[] };

export const organizations = sqliteTable("organizations", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  phone: text("phone"),
  email: text("email"),
  website: text("website"),
  brandColor: text("brand_color").notNull().default("#0d9488"),
  timezone: text("timezone").notNull().default("Europe/Rome"),
  settings: text("settings", { mode: "json" }).$type<StoredOrgSettings>().notNull(),
  listed: integer("listed", { mode: "boolean" }).notNull().default(true),
  createdAt: createdAt(),
  // --- controller identity (privacy notices, DPA, Art. 30 register)
  legalName: text("legal_name"),
  vatNumber: text("vat_number"),
  registeredAddress: text("registered_address"),
  privacyEmail: text("privacy_email"),
  dpoName: text("dpo_name"),
  dpoEmail: text("dpo_email"),
  medicalDirector: text("medical_director"),
  /** Language staff see by default and practice content is written in. */
  defaultLocale: text("default_locale", { enum: LOCALES }).notNull().default("it"),
  contentLocale: text("content_locale", { enum: LOCALES }).notNull().default("it"),
  /** E.164 number or Messaging Service SID on which this practice receives SMS replies. */
  inboundNumber: text("inbound_number").unique(),
  emailVerifiedAt: integer("email_verified_at", { mode: "timestamp_ms" }),
  closureRequestedAt: integer("closure_requested_at", { mode: "timestamp_ms" }),
  purgeAfter: integer("purge_after", { mode: "timestamp_ms" }),
  /** Demo/seed practice: never sends to real numbers, MFA optional. */
  isDemo: integer("is_demo", { mode: "boolean" }).notNull().default(false),
});

export const locations = sqliteTable(
  "locations",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    address: text("address").notNull(),
    city: text("city").notNull(),
    postalCode: text("postal_code"),
    phone: text("phone"),
    lat: real("lat"),
    lng: real("lng"),
    timezone: text("timezone").notNull().default("Europe/Rome"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: createdAt(),
    accessibility: text("accessibility", { mode: "json" }).$type<LocationAccessibility>().notNull().default({}),
  },
  (t) => [index("locations_org_idx").on(t.orgId), index("locations_city_idx").on(t.city)],
);

export const rooms = sqliteTable(
  "rooms",
  {
    id: text("id").primaryKey(),
    locationId: text("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
  },
  (t) => [index("rooms_location_idx").on(t.locationId)],
);

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: createdAt(),
  /** Dashboard language (null = automatic). */
  locale: text("locale", { enum: LOCALES }),
  totpSecretEnc: encryptedText("totp_secret_enc", "users.totp_secret"),
  totpEnabledAt: integer("totp_enabled_at", { mode: "timestamp_ms" }),
  recoveryCodeHashes: text("recovery_code_hashes", { mode: "json" }).$type<string[]>().notNull().default([]),
  emailVerifiedAt: integer("email_verified_at", { mode: "timestamp_ms" }),
  passwordChangedAt: integer("password_changed_at", { mode: "timestamp_ms" }),
  isPlatformAdmin: integer("is_platform_admin", { mode: "boolean" }).notNull().default(false),
});

export const memberships = sqliteTable(
  "memberships",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    role: text("role", { enum: MEMBERSHIP_ROLES }).notNull(),
    /** Version of the staff data-protection instructions (Art. 29 / 2-quaterdecies) accepted. */
    instructionsVersion: text("instructions_version"),
    instructionsAcceptedAt: integer("instructions_accepted_at", { mode: "timestamp_ms" }),
    invitedByUserId: text("invited_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: addedTimestamp("created_at"),
  },
  (t) => [primaryKey({ columns: [t.userId, t.orgId] })],
);

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(), // sha256 of the cookie token
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  orgId: text("org_id").references(() => organizations.id, { onDelete: "set null" }),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: createdAt(),
  lastSeenAt: addedTimestamp("last_seen_at"),
  mfaVerifiedAt: integer("mfa_verified_at", { mode: "timestamp_ms" }),
  ipHash: text("ip_hash"),
  userAgent: text("user_agent"),
});

export const practitioners = sqliteTable(
  "practitioners",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    slug: text("slug").notNull(),
    title: text("title").notNull().default("Dr."),
    name: text("name").notNull(),
    specialty: text("specialty").notNull(),
    bio: text("bio"),
    /** @deprecated free text; use spokenLanguages. */
    languages: text("languages").notNull().default("Italiano, English"),
    color: text("color").notNull().default("#0d9488"),
    licenseNumber: text("license_number"),
    acceptsNewPatients: integer("accepts_new_patients", { mode: "boolean" }).notNull().default(true),
    /** @deprecated the raw feed token is never stored any more; holds a non-secret placeholder. */
    icsToken: text("ics_token").notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: createdAt(),
    icsTokenHash: text("ics_token_hash").unique(),
    icsEnabled: integer("ics_enabled", { mode: "boolean" }).notNull().default(false),
    icsTokenExpiresAt: integer("ics_token_expires_at", { mode: "timestamp_ms" }),
    spokenLanguages: text("spoken_languages", { mode: "json" }).$type<SpokenLanguage[]>().notNull().default([]),
    /** Listed on the marketplace (the practitioner approved their public profile). */
    publicProfile: integer("public_profile", { mode: "boolean" }).notNull().default(false),
    profileApprovedAt: integer("profile_approved_at", { mode: "timestamp_ms" }),
    profileApprovedByUserId: text("profile_approved_by_user_id").references(() => users.id, { onDelete: "set null" }),
    marketplaceOptOutAt: integer("marketplace_opt_out_at", { mode: "timestamp_ms" }),
    alboProvince: text("albo_province"),
    alboNumber: text("albo_number"),
    alboVerifiedAt: integer("albo_verified_at", { mode: "timestamp_ms" }),
    alboVerifiedByUserId: text("albo_verified_by_user_id").references(() => users.id, { onDelete: "set null" }),
    specializations: text("specializations", { mode: "json" }).$type<LegalSpecialization[]>().notNull().default([]),
    careOptions: text("care_options", { mode: "json" }).$type<PractitionerCareOptions>().notNull().default({}),
    /** Translations of bio / specialty written by the practice (fallback: base columns). */
    bioI18n: text("bio_i18n", { mode: "json" }).$type<LocalizedText>().notNull().default({}),
    specialtyI18n: text("specialty_i18n", { mode: "json" }).$type<LocalizedText>().notNull().default({}),
  },
  (t) => [uniqueIndex("practitioners_org_slug_idx").on(t.orgId, t.slug)],
);

export const services = sqliteTable(
  "services",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    category: text("category", { enum: SERVICE_CATEGORIES }).notNull(),
    description: text("description"),
    durationMinutes: integer("duration_minutes").notNull(),
    bufferMinutes: integer("buffer_minutes").notNull().default(0),
    /** null = price on request */
    priceCents: integer("price_cents"),
    onlineBookable: integer("online_bookable", { mode: "boolean" }).notNull().default(true),
    /** Needs a chair (room) at the location. Consultations by video wouldn't. */
    requiresRoom: integer("requires_room", { mode: "boolean" }).notNull().default(true),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    priceType: text("price_type", { enum: PRICE_TYPES }).notNull().default("fixed"),
    priceMaxCents: integer("price_max_cents"),
    priceIncludes: text("price_includes"),
    /** Suggested recall interval after this treatment (the clinician confirms it per patient). */
    recallMonths: integer("recall_months"),
    /** Reveals sensitive information by its name alone: never shown outside the dashboard. */
    sensitive: integer("sensitive", { mode: "boolean" }).notNull().default(false),
    nameI18n: text("name_i18n", { mode: "json" }).$type<LocalizedText>().notNull().default({}),
    descriptionI18n: text("description_i18n", { mode: "json" }).$type<LocalizedText>().notNull().default({}),
  },
  (t) => [index("services_org_idx").on(t.orgId)],
);

export const practitionerServices = sqliteTable(
  "practitioner_services",
  {
    practitionerId: text("practitioner_id")
      .notNull()
      .references(() => practitioners.id, { onDelete: "cascade" }),
    serviceId: text("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.practitionerId, t.serviceId] })],
);

export const schedules = sqliteTable(
  "schedules",
  {
    id: text("id").primaryKey(),
    practitionerId: text("practitioner_id")
      .notNull()
      .references(() => practitioners.id, { onDelete: "cascade" }),
    locationId: text("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
    /** 0 = Sunday … 6 = Saturday */
    weekday: integer("weekday").notNull(),
    /** Minutes after local midnight. */
    startMinute: integer("start_minute").notNull(),
    endMinute: integer("end_minute").notNull(),
    /** Optional validity window, YYYY-MM-DD (inclusive). */
    validFrom: text("valid_from"),
    validUntil: text("valid_until"),
  },
  (t) => [index("schedules_practitioner_idx").on(t.practitionerId)],
);

export const timeOff = sqliteTable(
  "time_off",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    /** Scope: practitioner, room, location, or (all null) the whole organization. */
    practitionerId: text("practitioner_id").references(() => practitioners.id, { onDelete: "cascade" }),
    locationId: text("location_id").references(() => locations.id, { onDelete: "cascade" }),
    roomId: text("room_id").references(() => rooms.id, { onDelete: "cascade" }),
    startsAt: integer("starts_at", { mode: "timestamp_ms" }).notNull(),
    endsAt: integer("ends_at", { mode: "timestamp_ms" }).notNull(),
    reason: text("reason"),
  },
  (t) => [index("time_off_org_range_idx").on(t.orgId, t.startsAt)],
);

export const patients = sqliteTable(
  "patients",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    email: text("email"),
    /** E.164, e.g. +393331234567 */
    phone: text("phone"),
    birthDate: text("birth_date"),
    locale: text("locale", { enum: LOCALES }).notNull().default("it"),
    emailOptIn: integer("email_opt_in", { mode: "boolean" }).notNull().default(true),
    smsOptIn: integer("sms_opt_in", { mode: "boolean" }).notNull().default(true),
    preferredChannel: text("preferred_channel", { enum: ["sms", "whatsapp", "email"] })
      .notNull()
      .default("sms"),
    notes: encryptedText("notes", "patients.notes"),
    noShowCount: integer("no_show_count").notNull().default(0),
    createdAt: createdAt(),
    /** For minors: who books and receives messages (under 14 in Italy, art. 2-quinquies). */
    guardianName: text("guardian_name"),
    guardianRelation: text("guardian_relation", { enum: GUARDIAN_RELATIONS }),
    guardianPhone: text("guardian_phone"),
    guardianEmail: text("guardian_email"),
    /** Last time any contact was proven (OTP, explicit action on the manage page, SMS reply). */
    contactVerifiedAt: integer("contact_verified_at", { mode: "timestamp_ms" }),
    /** HMACs of the specific contacts proven (contactHash): proof is per contact, not per patient. */
    verifiedContacts: text("verified_contacts", { mode: "json" }).$type<string[]>().notNull().default([]),
    /** Art. 18 restriction: data kept but not used (no messages, no new bookings without reason). */
    restrictedAt: integer("restricted_at", { mode: "timestamp_ms" }),
    restrictionReason: text("restriction_reason"),
    /** Clinical-record retention end (YYYY-MM-DD); erasure is deferred until then. */
    retainUntil: text("retain_until"),
    /** Pseudonymised: identifying fields replaced, appointments kept for statistics/records. */
    erasedAt: integer("erased_at", { mode: "timestamp_ms" }),
    /** Suspected duplicate of another patient (never merged silently). */
    possibleDuplicateOfId: text("possible_duplicate_of_id"),
    /** Tombstone after a staff-confirmed merge: lookups follow this pointer. */
    mergedIntoId: text("merged_into_id"),
  },
  (t) => [
    index("patients_org_email_idx").on(t.orgId, t.email),
    index("patients_org_phone_idx").on(t.orgId, t.phone),
    index("patients_phone_idx").on(t.phone),
    index("patients_org_guardian_phone_idx").on(t.orgId, t.guardianPhone),
    index("patients_org_guardian_email_idx").on(t.orgId, t.guardianEmail),
  ],
);

export const funds = sqliteTable("funds", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  kind: text("kind", { enum: FUND_KINDS }).notNull().default("fund"),
  website: text("website"),
});

export const orgFunds = sqliteTable(
  "org_funds",
  {
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    fundId: text("fund_id")
      .notNull()
      .references(() => funds.id, { onDelete: "cascade" }),
    /** As declared by the practice. */
    mode: text("mode", { enum: FUND_MODES }).notNull(),
    /** null = all services */
    serviceIds: text("service_ids", { mode: "json" }).$type<string[] | null>(),
    note: text("note"),
  },
  (t) => [primaryKey({ columns: [t.orgId, t.fundId] })],
);

export const appointments = sqliteTable(
  "appointments",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    locationId: text("location_id")
      .notNull()
      .references(() => locations.id),
    practitionerId: text("practitioner_id")
      .notNull()
      .references(() => practitioners.id),
    roomId: text("room_id").references(() => rooms.id, { onDelete: "set null" }),
    serviceId: text("service_id")
      .notNull()
      .references(() => services.id),
    patientId: text("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    startsAt: integer("starts_at", { mode: "timestamp_ms" }).notNull(),
    endsAt: integer("ends_at", { mode: "timestamp_ms" }).notNull(),
    /** endsAt + cleanup buffer: the chair/practitioner is busy until then. */
    blockedUntil: integer("blocked_until", { mode: "timestamp_ms" }).notNull(),
    status: text("status", { enum: APPOINTMENT_STATUSES }).notNull().default("scheduled"),
    confirmation: text("confirmation", { enum: CONFIRMATION_STATUSES }).notNull().default("pending"),
    confirmedAt: integer("confirmed_at", { mode: "timestamp_ms" }),
    confirmedVia: text("confirmed_via"),
    source: text("source", { enum: ["online", "widget", "api", "staff", "waitlist"] }).notNull(),
    isNewPatient: integer("is_new_patient", { mode: "boolean" }).notNull().default(false),
    patientNote: encryptedText("patient_note", "appointments.patient_note"),
    internalNote: encryptedText("internal_note", "appointments.internal_note"),
    /** @deprecated never stores the raw token any more: holds a non-secret placeholder ("h:<id>"). */
    manageToken: text("manage_token").notNull().unique(),
    cancelledAt: integer("cancelled_at", { mode: "timestamp_ms" }),
    cancelledBy: text("cancelled_by", { enum: ["patient", "staff"] }),
    cancelReason: encryptedText("cancel_reason", "appointments.cancel_reason"),
    rescheduledFromId: text("rescheduled_from_id"),
    /** Staff should look at this (e.g. patient replied something we couldn't parse). */
    needsAttention: integer("needs_attention", { mode: "boolean" }).notNull().default(false),
    createdAt: createdAt(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    /** sha256 of the patient's self-service token (lookups never use the raw token). */
    manageTokenHash: text("manage_token_hash").unique(),
    /** The token itself, encrypted, so reminders can re-send the link. */
    manageTokenEnc: encryptedText("manage_token_enc", "appointments.manage_token"),
    processingContext: text("processing_context", { enum: PROCESSING_CONTEXTS }).notNull().default("practice"),
    bookedFor: text("booked_for", { enum: BOOKED_FOR }).notNull().default("self"),
    /** Who booked, when it wasn't the patient (other adult): never mixed into the patient's own contacts. */
    bookedByName: text("booked_by_name"),
    bookedByPhone: text("booked_by_phone"),
    bookedByEmail: text("booked_by_email"),
    noticeVersion: text("notice_version"),
    noticeLocale: text("notice_locale"),
    minorFlag: integer("minor_flag", { mode: "boolean" }).notNull().default(false),
    riskLevel: text("risk_level", { enum: RISK_LEVELS }),
    riskReasons: text("risk_reasons", { mode: "json" }).$type<string[]>().notNull().default([]),
    riskComputedAt: integer("risk_computed_at", { mode: "timestamp_ms" }),
    fundId: text("fund_id").references(() => funds.id, { onDelete: "set null" }),
  },
  (t) => [
    index("appointments_org_start_idx").on(t.orgId, t.startsAt),
    index("appointments_practitioner_start_idx").on(t.practitionerId, t.startsAt),
    index("appointments_location_start_idx").on(t.locationId, t.startsAt),
    index("appointments_patient_idx").on(t.patientId),
  ],
);

export const reminders = sqliteTable(
  "reminders",
  {
    id: text("id").primaryKey(),
    appointmentId: text("appointment_id")
      .notNull()
      .references(() => appointments.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["booking_confirmation", "reminder", "review_request", "approval"] }).notNull(),
    channel: text("channel", { enum: CHANNELS }).notNull(),
    askConfirmation: integer("ask_confirmation", { mode: "boolean" }).notNull().default(false),
    fallbackToEmail: integer("fallback_to_email", { mode: "boolean" }).notNull().default(true),
    sendAt: integer("send_at", { mode: "timestamp_ms" }).notNull(),
    status: text("status", { enum: ["pending", "sent", "failed", "skipped", "cancelled"] })
      .notNull()
      .default("pending"),
    attempts: integer("attempts").notNull().default(0),
    sentAt: integer("sent_at", { mode: "timestamp_ms" }),
    error: text("error"),
    messageId: text("message_id"),
  },
  (t) => [index("reminders_due_idx").on(t.status, t.sendAt), index("reminders_appointment_idx").on(t.appointmentId)],
);

export const messages = sqliteTable(
  "messages",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").references(() => organizations.id, { onDelete: "cascade" }),
    appointmentId: text("appointment_id").references(() => appointments.id, { onDelete: "set null" }),
    patientId: text("patient_id").references(() => patients.id, { onDelete: "set null" }),
    channel: text("channel", { enum: CHANNELS }).notNull(),
    direction: text("direction", { enum: ["outbound", "inbound"] }).notNull(),
    to: text("to").notNull(),
    from: text("from"),
    subject: encryptedText("subject", "messages.subject"),
    body: encryptedText("body", "messages.body").notNull(),
    html: encryptedText("html", "messages.html"),
    /** captured = not actually delivered because no provider is configured (dev mode). */
    status: text("status", { enum: ["sent", "delivered", "failed", "received", "captured"] }).notNull(),
    provider: text("provider").notNull(),
    providerId: text("provider_id"),
    error: text("error"),
    /** For inbound: what we understood from the reply. */
    intent: text("intent", { enum: MESSAGE_INTENTS }),
    createdAt: createdAt(),
    /** Body/subject/html replaced by "[redacted]" by retention. */
    redactedAt: integer("redacted_at", { mode: "timestamp_ms" }),
    /** The provider was asked to delete its copy. */
    providerDeletedAt: integer("provider_deleted_at", { mode: "timestamp_ms" }),
    finalStatusAt: integer("final_status_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    index("messages_org_created_idx").on(t.orgId, t.createdAt),
    index("messages_provider_id_idx").on(t.providerId),
    index("messages_to_created_idx").on(t.to, t.createdAt),
  ],
);

export const waitlist = sqliteTable(
  "waitlist",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    patientId: text("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    serviceId: text("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    practitionerId: text("practitioner_id").references(() => practitioners.id, { onDelete: "set null" }),
    locationId: text("location_id").references(() => locations.id, { onDelete: "set null" }),
    /** YYYY-MM-DD, inclusive */
    earliestDate: text("earliest_date").notNull(),
    latestDate: text("latest_date").notNull(),
    /** Preferred part of day */
    partOfDay: text("part_of_day", { enum: ["any", "morning", "afternoon"] }).notNull().default("any"),
    status: text("status", { enum: ["active", "booked", "removed"] }).notNull().default("active"),
    offersSent: integer("offers_sent").notNull().default(0),
    lastOfferedAt: integer("last_offered_at", { mode: "timestamp_ms" }),
    note: encryptedText("note", "waitlist.note"),
    createdAt: createdAt(),
    processingContext: text("processing_context", { enum: PROCESSING_CONTEXTS }).notNull().default("practice"),
    bookedFor: text("booked_for", { enum: BOOKED_FOR }).notNull().default("self"),
    noticeVersion: text("notice_version"),
  },
  (t) => [index("waitlist_org_status_idx").on(t.orgId, t.status)],
);

export const reviews = sqliteTable(
  "reviews",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    practitionerId: text("practitioner_id")
      .notNull()
      .references(() => practitioners.id, { onDelete: "cascade" }),
    /** Only patients with a completed visit can review: verified by construction. */
    appointmentId: text("appointment_id")
      .notNull()
      .unique()
      .references(() => appointments.id, { onDelete: "cascade" }),
    rating: integer("rating").notNull(),
    comment: text("comment"),
    authorName: text("author_name").notNull(),
    /** @deprecated use status. */
    published: integer("published", { mode: "boolean" }).notNull().default(true),
    reply: text("reply"),
    createdAt: createdAt(),
    status: text("status", { enum: REVIEW_STATUSES }).notNull().default("pending"),
    authorDisplay: text("author_display", { enum: REVIEW_AUTHOR_DISPLAY }).notNull().default("pseudonym"),
    locale: text("locale", { enum: LOCALES }),
    /** Automatic checks, e.g. "possible_health_data". */
    flags: text("flags", { mode: "json" }).$type<string[]>().notNull().default([]),
    consentId: text("consent_id"),
    publishedAt: integer("published_at", { mode: "timestamp_ms" }),
    editedAt: integer("edited_at", { mode: "timestamp_ms" }),
    removedReason: text("removed_reason"),
    decidedAt: integer("decided_at", { mode: "timestamp_ms" }),
    replyUpdatedAt: integer("reply_updated_at", { mode: "timestamp_ms" }),
    replyByUserId: text("reply_by_user_id").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [index("reviews_practitioner_idx").on(t.practitionerId), index("reviews_practitioner_status_idx").on(t.practitionerId, t.status)],
);

export const apiKeys = sqliteTable("api_keys", {
  id: text("id").primaryKey(),
  orgId: text("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  prefix: text("prefix").notNull(),
  keyHash: text("key_hash").notNull().unique(),
  lastUsedAt: integer("last_used_at", { mode: "timestamp_ms" }),
  revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
  createdAt: createdAt(),
  scopes: text("scopes", { mode: "json" })
    .$type<ApiScope[]>()
    .notNull()
    .default(["appointments:read", "appointments:write", "patients:read"]),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
  allowedIps: text("allowed_ips", { mode: "json" }).$type<string[] | null>(),
  createdByUserId: text("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
});

// ---------------------------------------------------------------- GDPR

/** Append-only consent ledger (Art. 7(1): the controller must be able to demonstrate consent). */
export const consents = sqliteTable(
  "consents",
  {
    id: text("id").primaryKey(),
    /** null = platform-level consent (Sorriso as controller, e.g. marketplace Art. 9 consent). */
    orgId: text("org_id").references(() => organizations.id, { onDelete: "cascade" }),
    patientId: text("patient_id").references(() => patients.id, { onDelete: "set null" }),
    /** Kept as proof even after the appointment is deleted. */
    appointmentId: text("appointment_id"),
    waitlistId: text("waitlist_id"),
    purpose: text("purpose", { enum: CONSENT_PURPOSES }).notNull(),
    granted: integer("granted", { mode: "boolean" }).notNull(),
    /** i18n key of the exact text shown + its version and language. */
    textKey: text("text_key").notNull(),
    textVersion: text("text_version").notNull(),
    locale: text("locale", { enum: LOCALES }).notNull(),
    method: text("method", { enum: CONSENT_METHODS }).notNull(),
    source: text("source", { enum: CONSENT_SOURCES }).notNull(),
    actorRelation: text("actor_relation", { enum: ACTOR_RELATIONS }).notNull().default("self"),
    actorUserId: text("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    /** HMAC of the IP, never the raw address. */
    ipHash: text("ip_hash"),
    createdAt: createdAt(),
  },
  (t) => [index("consents_patient_purpose_idx").on(t.patientId, t.purpose, t.createdAt), index("consents_org_created_idx").on(t.orgId, t.createdAt)],
);

export const privacyRequests = sqliteTable(
  "privacy_requests",
  {
    id: text("id").primaryKey(),
    /** null = request addressed to Sorriso as controller (marketplace, reviews, privacy center). */
    orgId: text("org_id").references(() => organizations.id, { onDelete: "cascade" }),
    patientId: text("patient_id").references(() => patients.id, { onDelete: "set null" }),
    type: text("type", { enum: PRIVACY_REQUEST_TYPES }).notNull(),
    channel: text("channel", { enum: PRIVACY_REQUEST_CHANNELS }).notNull(),
    status: text("status", { enum: PRIVACY_REQUEST_STATUSES }).notNull().default("open"),
    details: encryptedText("details", "privacy_requests.details"),
    /** HMAC of the verified contact that filed it. */
    contactHash: text("contact_hash"),
    requesterLocale: text("requester_locale", { enum: LOCALES }).notNull().default("it"),
    receivedAt: integer("received_at", { mode: "timestamp_ms" }).notNull(),
    /** One month (Art. 12(3)). */
    dueAt: integer("due_at", { mode: "timestamp_ms" }).notNull(),
    extendedUntil: integer("extended_until", { mode: "timestamp_ms" }),
    extensionReason: text("extension_reason"),
    decision: text("decision", { enum: PRIVACY_REQUEST_DECISIONS }),
    decisionReason: text("decision_reason"),
    closedAt: integer("closed_at", { mode: "timestamp_ms" }),
    handledByUserId: text("handled_by_user_id").references(() => users.id, { onDelete: "set null" }),
    remindersSent: text("reminders_sent", { mode: "json" }).$type<string[]>().notNull().default([]),
    createdAt: createdAt(),
  },
  (t) => [index("privacy_requests_org_status_due_idx").on(t.orgId, t.status, t.dueAt)],
);

/** Tamper-evident access log: each row's hash chains the previous row of the same org. */
export const auditLog = sqliteTable(
  "audit_log",
  {
    id: text("id").primaryKey(),
    /** No FK: the log outlives the organization. */
    orgId: text("org_id"),
    /** Position in the org's chain (unique: two writers can't fork the chain). */
    seq: integer("seq").notNull(),
    at: integer("at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    actorType: text("actor_type", { enum: AUDIT_ACTOR_TYPES }).notNull(),
    actorId: text("actor_id"),
    action: text("action").notNull(),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    /** Staff free text (e.g. why restricted data was accessed): may contain personal data. */
    reason: encryptedText("reason", "audit_log.reason"),
    ipHash: text("ip_hash"),
    uaHash: text("ua_hash"),
    metadata: text("metadata", { mode: "json" }).$type<Record<string, string | number | boolean | null>>(),
    prevHash: text("prev_hash"),
    hash: text("hash").notNull(),
  },
  (t) => [
    index("audit_org_at_idx").on(t.orgId, t.at),
    index("audit_entity_idx").on(t.entityType, t.entityId),
    uniqueIndex("audit_org_seq_idx").on(t.orgId, t.seq),
  ],
);

/** When retention deletes old audit rows, the last deleted hash is kept here so the chain stays verifiable. */
export const auditAnchors = sqliteTable("audit_anchors", {
  orgKey: text("org_key").primaryKey(), // orgId or "platform"
  seq: integer("seq").notNull(),
  hash: text("hash").notNull(),
  at: integer("at", { mode: "timestamp_ms" }).notNull(),
});

export const legalAcceptances = sqliteTable(
  "legal_acceptances",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    documentType: text("document_type", { enum: LEGAL_DOCS }).notNull(),
    version: text("version").notNull(),
    locale: text("locale", { enum: LOCALES }).notNull(),
    acceptedAt: integer("accepted_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    ipHash: text("ip_hash"),
    uaHash: text("ua_hash"),
  },
  (t) => [index("legal_acceptances_org_doc_idx").on(t.orgId, t.documentType, t.acceptedAt)],
);

export const noticeVersions = sqliteTable(
  "notice_versions",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").references(() => organizations.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: NOTICE_KINDS }).notNull(),
    locale: text("locale", { enum: LOCALES }).notNull(),
    version: text("version").notNull(),
    contentHash: text("content_hash").notNull(),
    publishedAt: integer("published_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [uniqueIndex("notice_versions_unique_idx").on(t.orgId, t.kind, t.locale, t.contentHash)],
);

export const verificationCodes = sqliteTable(
  "verification_codes",
  {
    id: text("id").primaryKey(),
    purpose: text("purpose", { enum: OTP_PURPOSES }).notNull(),
    channel: text("channel", { enum: ["sms", "email"] }).notNull(),
    targetHash: text("target_hash").notNull(),
    codeHash: text("code_hash").notNull(),
    attempts: integer("attempts").notNull().default(0),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    consumedAt: integer("consumed_at", { mode: "timestamp_ms" }),
    ipHash: text("ip_hash"),
    createdAt: createdAt(),
  },
  (t) => [index("verification_codes_target_idx").on(t.targetHash, t.createdAt)],
);

/** Account-less patient sessions for the privacy center, opened with an OTP. */
export const patientSessions = sqliteTable("patient_sessions", {
  id: text("id").primaryKey(), // sha256 of the cookie token
  contactHash: text("contact_hash").notNull(),
  contactType: text("contact_type", { enum: ["email", "phone"] }).notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  ipHash: text("ip_hash"),
  createdAt: createdAt(),
});

export const rateLimits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  resetAt: integer("reset_at", { mode: "timestamp_ms" }).notNull(),
});

export const loginAttempts = sqliteTable(
  "login_attempts",
  {
    id: text("id").primaryKey(),
    emailHash: text("email_hash").notNull(),
    ipHash: text("ip_hash").notNull(),
    success: integer("success", { mode: "boolean" }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("login_attempts_email_idx").on(t.emailHash, t.createdAt), index("login_attempts_ip_idx").on(t.ipHash, t.createdAt)],
);

export const authTokens = sqliteTable("auth_tokens", {
  id: text("id").primaryKey(), // sha256 of the token
  kind: text("kind", { enum: AUTH_TOKEN_KINDS }).notNull(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  email: text("email"),
  orgId: text("org_id").references(() => organizations.id, { onDelete: "cascade" }),
  role: text("role", { enum: MEMBERSHIP_ROLES }),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  usedAt: integer("used_at", { mode: "timestamp_ms" }),
  createdByUserId: text("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: createdAt(),
});

// ---------------------------------------------------------------- care

export const recalls = sqliteTable(
  "recalls",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    patientId: text("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    serviceId: text("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    practitionerId: text("practitioner_id").references(() => practitioners.id, { onDelete: "set null" }),
    sourceAppointmentId: text("source_appointment_id").references(() => appointments.id, { onDelete: "set null" }),
    bookedAppointmentId: text("booked_appointment_id").references(() => appointments.id, { onDelete: "set null" }),
    /** YYYY-MM-DD */
    dueDate: text("due_date").notNull(),
    intervalMonths: integer("interval_months").notNull(),
    status: text("status", { enum: RECALL_STATUSES }).notNull().default("due"),
    attempts: integer("attempts").notNull().default(0),
    lastSentAt: integer("last_sent_at", { mode: "timestamp_ms" }),
    leaseUntil: integer("lease_until", { mode: "timestamp_ms" }),
    /** Internal only: never put in a message. */
    reasonCode: text("reason_code"),
    /** Clinician who set the interval for this patient (recall basis: Art. 9(2)(h)). */
    setByUserId: text("set_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("recalls_org_status_due_idx").on(t.orgId, t.status, t.dueDate), index("recalls_patient_idx").on(t.patientId)],
);

export const reviewReports = sqliteTable(
  "review_reports",
  {
    id: text("id").primaryKey(),
    reviewId: text("review_id")
      .notNull()
      .references(() => reviews.id, { onDelete: "cascade" }),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    /** null when reported by a member of the public (DSA Art. 16 notice). */
    reporterUserId: text("reporter_user_id").references(() => users.id, { onDelete: "set null" }),
    reporterContactHash: text("reporter_contact_hash"),
    ground: text("ground", { enum: REVIEW_REPORT_GROUNDS }).notNull(),
    details: text("details"),
    status: text("status", { enum: REVIEW_REPORT_STATUSES }).notNull().default("open"),
    patientAskedAt: integer("patient_asked_at", { mode: "timestamp_ms" }),
    patientResponse: text("patient_response"),
    decision: text("decision", { enum: ["keep", "remove"] }),
    /** Statement of reasons (DSA Art. 17). */
    decisionReason: text("decision_reason"),
    decidedByUserId: text("decided_by_user_id").references(() => users.id, { onDelete: "set null" }),
    decidedAt: integer("decided_at", { mode: "timestamp_ms" }),
    appealOfId: text("appeal_of_id"),
    createdAt: createdAt(),
  },
  (t) => [index("review_reports_status_idx").on(t.status, t.createdAt), index("review_reports_review_idx").on(t.reviewId)],
);

export const profileStats = sqliteTable(
  "profile_stats",
  {
    practitionerId: text("practitioner_id")
      .notNull()
      .references(() => practitioners.id, { onDelete: "cascade" }),
    /** YYYY-MM-DD */
    day: text("day").notNull(),
    views: integer("views").notNull().default(0),
    searchImpressions: integer("search_impressions").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.practitionerId, t.day] })],
);

export const formTemplates = sqliteTable(
  "form_templates",
  {
    id: text("id").primaryKey(),
    /** null = Sorriso default template */
    orgId: text("org_id").references(() => organizations.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: FORM_KINDS }).notNull(),
    version: text("version").notNull(),
    schema: text("schema", { mode: "json" }).$type<FormSchema>().notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("form_templates_unique_idx").on(t.orgId, t.kind, t.version)],
);

export const formSubmissions = sqliteTable(
  "form_submissions",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    patientId: text("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    appointmentId: text("appointment_id").references(() => appointments.id, { onDelete: "set null" }),
    templateId: text("template_id")
      .notNull()
      .references(() => formTemplates.id),
    version: text("version").notNull(),
    /** Language the form was shown in (proof of what was signed). */
    locale: text("locale", { enum: LOCALES }).notNull(),
    /** JSON answers, encrypted. */
    answers: encryptedText("answers", "form_submissions.answers").notNull(),
    redFlags: text("red_flags", { mode: "json" }).$type<string[]>().notNull().default([]),
    signerName: text("signer_name"),
    signedAt: integer("signed_at", { mode: "timestamp_ms" }),
    signedVia: text("signed_via", { enum: SIGNED_VIA }),
    otpChallengeId: text("otp_challenge_id"),
    /** Exported to the practice's clinical record (required before retention may delete it). */
    exportedAt: integer("exported_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (t) => [index("form_submissions_patient_idx").on(t.patientId, t.createdAt)],
);

export type Organization = typeof organizations.$inferSelect;
export type Location = typeof locations.$inferSelect;
export type Room = typeof rooms.$inferSelect;
export type Practitioner = typeof practitioners.$inferSelect;
export type Service = typeof services.$inferSelect;
export type Schedule = typeof schedules.$inferSelect;
export type TimeOff = typeof timeOff.$inferSelect;
export type Patient = typeof patients.$inferSelect;
export type Appointment = typeof appointments.$inferSelect;
export type Reminder = typeof reminders.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type WaitlistEntry = typeof waitlist.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type User = typeof users.$inferSelect;
export type Membership = typeof memberships.$inferSelect;
export type Consent = typeof consents.$inferSelect;
export type PrivacyRequest = typeof privacyRequests.$inferSelect;
export type AuditLogRow = typeof auditLog.$inferSelect;
export type LegalAcceptance = typeof legalAcceptances.$inferSelect;
export type NoticeVersion = typeof noticeVersions.$inferSelect;
export type VerificationCode = typeof verificationCodes.$inferSelect;
export type PatientSession = typeof patientSessions.$inferSelect;
export type AuthToken = typeof authTokens.$inferSelect;
export type Recall = typeof recalls.$inferSelect;
export type ReviewReport = typeof reviewReports.$inferSelect;
export type Fund = typeof funds.$inferSelect;
export type OrgFund = typeof orgFunds.$inferSelect;
export type ProfileStat = typeof profileStats.$inferSelect;
export type FormTemplate = typeof formTemplates.$inferSelect;
export type FormSubmission = typeof formSubmissions.$inferSelect;
export type ApiKey = typeof apiKeys.$inferSelect;
