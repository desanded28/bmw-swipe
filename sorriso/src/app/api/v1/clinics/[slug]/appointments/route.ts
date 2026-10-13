import { eq } from "drizzle-orm";
import { db } from "@/db";
import { organizations } from "@/db/schema";
import { apiError, authenticateApiKey, handleApiError, json, preflight, rateLimit } from "@/lib/api";
import { createAppointment } from "@/lib/booking";
import { publicAppointment } from "@/lib/serializers";
import { bookingInputSchema } from "@/lib/validation";

export const OPTIONS = preflight;

/**
 * POST /api/v1/clinics/:slug/appointments — book a slot as a patient.
 * Used by the website, the embeddable widget and third-party integrations
 * (send `Authorization: Bearer sk_…` to mark the booking as coming from your app).
 */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const [org] = await db.select().from(organizations).where(eq(organizations.slug, slug));
    if (!org) return apiError(404, "not_found", "Clinic not found.");

    const partner = await authenticateApiKey(req);
    if (partner && partner.id !== org.id) return apiError(403, "forbidden", "This API key belongs to another practice.");
    if (!partner && !rateLimit(req, "book", 10, 10 * 60_000))
      return apiError(429, "rate_limited", "Too many booking attempts. Please try again in a few minutes.");

    const input = bookingInputSchema.parse(await req.json());
    if (input.website) return apiError(422, "validation_error", "Invalid submission.");

    const details = await createAppointment({
      orgId: org.id,
      serviceId: input.serviceId,
      practitionerId: input.practitionerId,
      locationId: input.locationId,
      startsAt: new Date(input.start),
      patient: {
        ...input.patient,
        email: input.patient.email || null,
        phone: input.patient.phone || null,
        birthDate: input.patient.birthDate || null,
      },
      patientNote: input.note,
      isNewPatient: input.isNewPatient,
      waitlistEntryId: input.waitlistEntryId,
      source: partner ? "api" : input.waitlistEntryId ? "waitlist" : (input.source ?? "online"),
      online: true,
    });
    return json({ appointment: publicAppointment(details) }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
