import { eq } from "drizzle-orm";
import { db } from "@/db";
import { organizations, waitlist } from "@/db/schema";
import { apiError, handleApiError, json, preflight, rateLimit } from "@/lib/api";
import { upsertPatient } from "@/lib/booking";
import { newId } from "@/lib/ids";
import { waitlistInputSchema } from "@/lib/validation";

export const OPTIONS = preflight;

/** POST /api/v1/clinics/:slug/waitlist — get notified when a matching slot frees up. */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const [org] = await db.select().from(organizations).where(eq(organizations.slug, slug));
    if (!org) return apiError(404, "not_found", "Clinic not found.");
    if (!rateLimit(req, "waitlist", 5, 10 * 60_000)) return apiError(429, "rate_limited", "Too many requests.");

    const input = waitlistInputSchema.parse(await req.json());
    if (input.website) return apiError(422, "validation_error", "Invalid submission.");
    if (input.latestDate < input.earliestDate) return apiError(422, "validation_error", "The date range is reversed.");

    const id = newId();
    await db.transaction(async (tx) => {
      const { patient } = await upsertPatient(tx, org.id, {
        ...input.patient,
        email: input.patient.email || null,
        phone: input.patient.phone || null,
        birthDate: input.patient.birthDate || null,
      });
      await tx.insert(waitlist).values({
        id,
        orgId: org.id,
        patientId: patient.id,
        serviceId: input.serviceId,
        practitionerId: input.practitionerId || null,
        locationId: input.locationId || null,
        earliestDate: input.earliestDate,
        latestDate: input.latestDate,
        partOfDay: input.partOfDay,
        note: input.note || null,
      });
    });
    return json({ waitlistEntry: { id } }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
