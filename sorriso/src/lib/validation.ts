import { z } from "zod";

const trimmed = (max: number) => z.string().trim().max(max);

export const patientInputSchema = z
  .object({
    firstName: trimmed(80).min(1, "First name is required"),
    lastName: trimmed(80).min(1, "Last name is required"),
    email: z.union([z.literal(""), z.email("Invalid email").max(200)]).optional().nullable(),
    phone: trimmed(40).optional().nullable(),
    birthDate: z.union([z.literal(""), z.iso.date()]).optional().nullable(),
    locale: z.enum(["it", "en"]).optional(),
    preferredChannel: z.enum(["sms", "whatsapp", "email"]).optional(),
    smsOptIn: z.boolean().optional(),
    emailOptIn: z.boolean().optional(),
  })
  .refine((p) => Boolean(p.email) || Boolean(p.phone), {
    message: "Provide an email address or a mobile number",
    path: ["email"],
  });

export const bookingInputSchema = z.object({
  serviceId: z.string().min(1),
  practitionerId: z.string().min(1),
  locationId: z.string().min(1),
  start: z.iso.datetime({ offset: true }),
  patient: patientInputSchema,
  note: trimmed(1000).optional().nullable(),
  isNewPatient: z.boolean().optional(),
  waitlistEntryId: z.string().max(40).optional().nullable(),
  source: z.enum(["online", "widget"]).optional(),
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
  website: z.string().optional(),
});

export const rescheduleInputSchema = z.object({
  start: z.iso.datetime({ offset: true }),
  practitionerId: z.string().optional(),
  locationId: z.string().optional(),
});
