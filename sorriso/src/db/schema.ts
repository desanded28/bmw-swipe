import { sql } from "drizzle-orm";
import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

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
 *     ├── waitlist, reviews, messages (email/SMS/WhatsApp log)
 *     └── memberships (staff users) / api_keys
 *
 * All instants are stored as UTC epoch milliseconds. Weekly schedules are stored
 * as wall-clock minutes in the location's time zone so they survive DST changes.
 */

const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`);

export type ReminderRule = {
  id: string;
  channel: "email" | "sms" | "whatsapp";
  /** Minutes before the appointment start. */
  offsetMinutes: number;
  /** Ask the patient to confirm (reply YES/NO or click a link). */
  askConfirmation: boolean;
  /** If the channel can't reach the patient (no phone / opted out), fall back to email. */
  fallbackToEmail: boolean;
};

export type OrgSettings = {
  booking: {
    /** Shortest lead time for online bookings. */
    minNoticeMinutes: number;
    /** How far ahead patients can book online. */
    maxAdvanceDays: number;
    /** Slot grid granularity. */
    slotStepMinutes: number;
    /** Patients can cancel/reschedule online until this many hours before. */
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
  };
};

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
  settings: text("settings", { mode: "json" }).$type<OrgSettings>().notNull(),
  listed: integer("listed", { mode: "boolean" }).notNull().default(true),
  createdAt: createdAt(),
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
    role: text("role", { enum: ["owner", "admin", "reception", "practitioner"] }).notNull(),
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
    languages: text("languages").notNull().default("Italiano, English"),
    color: text("color").notNull().default("#0d9488"),
    licenseNumber: text("license_number"),
    acceptsNewPatients: integer("accepts_new_patients", { mode: "boolean" }).notNull().default(true),
    /** Secret for the subscribable ICS calendar feed. */
    icsToken: text("ics_token").notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("practitioners_org_slug_idx").on(t.orgId, t.slug)],
);

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
    locale: text("locale", { enum: ["it", "en"] }).notNull().default("it"),
    emailOptIn: integer("email_opt_in", { mode: "boolean" }).notNull().default(true),
    smsOptIn: integer("sms_opt_in", { mode: "boolean" }).notNull().default(true),
    preferredChannel: text("preferred_channel", { enum: ["sms", "whatsapp", "email"] })
      .notNull()
      .default("sms"),
    notes: text("notes"),
    noShowCount: integer("no_show_count").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    index("patients_org_email_idx").on(t.orgId, t.email),
    index("patients_org_phone_idx").on(t.orgId, t.phone),
    index("patients_phone_idx").on(t.phone),
  ],
);

export const APPOINTMENT_STATUSES = ["requested", "scheduled", "completed", "no_show", "cancelled"] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];
export const CONFIRMATION_STATUSES = ["pending", "confirmed", "declined"] as const;
export type ConfirmationStatus = (typeof CONFIRMATION_STATUSES)[number];
export const CHANNELS = ["email", "sms", "whatsapp"] as const;
export type Channel = (typeof CHANNELS)[number];

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
    patientNote: text("patient_note"),
    internalNote: text("internal_note"),
    /** Secret for the patient's self-service link (/a/[token]). */
    manageToken: text("manage_token").notNull().unique(),
    cancelledAt: integer("cancelled_at", { mode: "timestamp_ms" }),
    cancelledBy: text("cancelled_by", { enum: ["patient", "staff"] }),
    cancelReason: text("cancel_reason"),
    rescheduledFromId: text("rescheduled_from_id"),
    /** Staff should look at this (e.g. patient replied something we couldn't parse). */
    needsAttention: integer("needs_attention", { mode: "boolean" }).notNull().default(false),
    createdAt: createdAt(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
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
    subject: text("subject"),
    body: text("body").notNull(),
    html: text("html"),
    /** captured = not actually delivered because no provider is configured (dev mode). */
    status: text("status", { enum: ["sent", "delivered", "failed", "received", "captured"] }).notNull(),
    provider: text("provider").notNull(),
    providerId: text("provider_id"),
    error: text("error"),
    /** For inbound: what we understood from the reply. */
    intent: text("intent", { enum: ["confirm", "cancel", "reschedule", "unknown", "stop"] }),
    createdAt: createdAt(),
  },
  (t) => [index("messages_org_created_idx").on(t.orgId, t.createdAt)],
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
    note: text("note"),
    createdAt: createdAt(),
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
    published: integer("published", { mode: "boolean" }).notNull().default(true),
    reply: text("reply"),
    createdAt: createdAt(),
  },
  (t) => [index("reviews_practitioner_idx").on(t.practitionerId)],
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
});

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
