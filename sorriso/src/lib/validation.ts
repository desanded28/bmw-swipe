import { z } from "zod";
import { BOOKED_FOR, GUARDIAN_RELATIONS, LOCALES } from "@/db/enums";

const trimmed = (max: number) => z.string().trim().max(max);
const optionalEmail = z.union([z.literal(""), z.email("Invalid email").max(200)]);

export const patientInputSchema = z
  .object({
    firstName: trimmed(80).min(1, "First name is required"),
    lastName: trimmed(80).min(1, "Last name is required"),
    email: optionalEmail.optional().nullable(),
    phone: trimmed(40).optional().nullable(),
    /** Dial code for a number typed without an international prefix ("39", "49"); the server's default otherwise. */
    phoneCountry: z
      .string()
      .trim()
      .regex(/^\+?[1-9]\d{0,2}$/, "Invalid country code")
      .transform((v) => v.replace(/^\+/, ""))
      .optional()
      .nullable(),
    birthDate: z.union([z.literal(""), z.iso.date()]).optional().nullable(),
    locale: z.enum(LOCALES).optional(),
    preferredChannel: z.enum(["sms", "whatsapp", "email"]).optional(),
    /** Ignored for patient-facing bookings: the opt-ins follow the contacts given (see upsertPatient). */
    smsOptIn: z.boolean().optional(),
    emailOptIn: z.boolean().optional(),
  })
  .refine((p) => Boolean(p.email) || Boolean(p.phone), {
    message: "Provide an email address or a mobile number",
    path: ["email"],
  });

/**
 * What the patient saw and ticked in the privacy part of the booking or waitlist form.
 * The server records the notice version it displays for the booking's context and validates
 * the choices (src/lib/privacy/booking-rules.ts); unticked boxes record nothing.
 */
export const bookingPrivacySchema = z.object({
  /** The notice version the form displayed (noticeVersionFor(context)). */
  noticeVersion: trimmed(20).min(1),
  /**
   * The notice acknowledgement box. Accepted but never required or stored: the server records the
   * notice version instead (an acknowledgement next to consent boxes reads as bundling).
   */
  noticeAck: z.boolean().optional(),
  /** The language the notice and consent texts were shown in; defaults to the patient's message language. */
  locale: z.enum(LOCALES).optional(),
  /** Art. 9(2)(a) consent to Sorriso; required (and only recorded) for marketplace bookings. */
  platformConsent: z.boolean().optional(),
  whatsapp: z.boolean().optional(),
  feedback: z.boolean().optional(),
  marketing: z.boolean().optional(),
});
export type BookingPrivacyPayload = z.infer<typeof bookingPrivacySchema>;

const contactPerson = {
  name: trimmed(120).min(2, "Enter a name"),
  phone: trimmed(40).nullish(),
  email: optionalEmail.nullish(),
};

/** Who the appointment is for. Checked on the server by validateBookingRelation (src/lib/privacy/minors.ts). */
export const bookingRelationSchema = z.object({
  bookedFor: z.enum(BOOKED_FOR).default("self"),
  /** For a minor: the parent or legal guardian booking (stored on the patient record). */
  guardian: z
    .object({ ...contactPerson, relation: z.enum(GUARDIAN_RELATIONS) })
    .nullish()
    .transform((v) => v ?? undefined),
  /** For another adult: who booked. Stored on the appointment (booked_by_*), never as the patient's contacts. */
  bookedBy: z
    .object(contactPerson)
    .nullish()
    .transform((v) => v ?? undefined),
});
export type BookingRelationPayload = z.infer<typeof bookingRelationSchema>;

/** Practice-signed marker from a practice-published link (?ref=). Verified with verifyPracticeRef, never trusted as is. */
const practiceRef = z.string().max(32).nullish();

export const bookingInputSchema = z.object({
  serviceId: z.string().min(1),
  practitionerId: z.string().min(1),
  locationId: z.string().min(1),
  start: z.iso.datetime({ offset: true }),
  patient: patientInputSchema,
  note: trimmed(500).optional().nullable(),
  isNewPatient: z.boolean().optional(),
  waitlistEntryId: z.string().max(40).optional().nullable(),
  source: z.enum(["online", "widget"]).optional(),
  /** Optional in the schema; the route requires it for calls without an API key (422 privacy_required). */
  privacy: bookingPrivacySchema.optional(),
  relation: bookingRelationSchema.optional(),
  /** "I will use fund X": stored only if the practice lists that fund (org_funds). */
  fundId: z.string().max(40).nullish(),
  practiceRef,
  /** Honeypot: real users never fill this in. */
  website: z.string().optional(),
});
export type BookingInput = z.infer<typeof bookingInputSchema>;

export const waitlistInputSchema = z.object({
  serviceId: z.string().min(1),
  practitionerId: z.string().optional().nullable(),
  locationId: z.string().optional().nullable(),
  earliestDate: z.iso.date(),
  latestDate: z.iso.date(),
  partOfDay: z.enum(["any", "morning", "afternoon"]).default("any"),
  patient: patientInputSchema,
  note: trimmed(500).optional().nullable(),
  privacy: bookingPrivacySchema.optional(),
  relation: bookingRelationSchema.optional(),
  practiceRef,
  website: z.string().optional(),
});
export type WaitlistInput = z.infer<typeof waitlistInputSchema>;

export const rescheduleInputSchema = z.object({
  start: z.iso.datetime({ offset: true }),
  practitionerId: z.string().optional(),
  locationId: z.string().optional(),
});
