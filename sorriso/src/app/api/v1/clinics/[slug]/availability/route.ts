import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { organizations } from "@/db/schema";
import { apiError, handleApiError, json, preflight } from "@/lib/api";
import { collapseAnyPractitioner, getAvailability, type Slot } from "@/lib/availability";
import { addDays, isDateString, todayIn, zonedParts, minutesToHHMM } from "@/lib/time";

export const OPTIONS = preflight;

/**
 * GET /api/v1/clinics/:slug/availability
 *   ?serviceId=…            required
 *   &from=YYYY-MM-DD        default: today (practice time zone)
 *   &days=7                 1–31
 *   &practitionerId=…       optional; omit for "any available practitioner"
 *   &locationId=…           optional
 */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const url = new URL(req.url);
    const serviceId = url.searchParams.get("serviceId");
    if (!serviceId) return apiError(422, "validation_error", "serviceId is required.");
    const [org] = await db.select().from(organizations).where(and(eq(organizations.slug, slug)));
    if (!org) return apiError(404, "not_found", "Clinic not found.");

    const today = todayIn(org.timezone);
    const fromParam = url.searchParams.get("from");
    const from = isDateString(fromParam) && fromParam >= today ? fromParam : today;
    const days = Math.min(Math.max(Number(url.searchParams.get("days") ?? 7) || 7, 1), 31);
    const practitionerId = url.searchParams.get("practitionerId") || undefined;
    const locationId = url.searchParams.get("locationId") || undefined;

    const query = {
      orgId: org.id,
      serviceId,
      practitionerIds: practitionerId ? [practitionerId] : undefined,
      locationId,
      timezone: org.timezone,
    };
    const result = await getAvailability({ ...query, fromDate: from, days });
    if (!result) return apiError(404, "not_found", "Service not found.");

    const slots = practitionerId ? result.slots : collapseAnyPractitioner(result.ctx, result.slots);
    const tzOf = (s: Slot) => result.ctx.locations.get(s.locationId)?.timezone ?? org.timezone;

    const dates = Array.from({ length: days }, (_, i) => ({ date: addDays(from, i), slots: [] as unknown[] }));
    for (const s of slots) {
      const local = zonedParts(s.start, tzOf(s));
      dates
        .find((d) => d.date === local.date)
        ?.slots.push({
          start: s.start.toISOString(),
          end: s.end.toISOString(),
          time: minutesToHHMM(local.minutes),
          practitionerId: s.practitionerId,
          locationId: s.locationId,
        });
    }

    // Nothing in this window? Tell the patient when the next opening is.
    let nextAvailable: string | null = null;
    if (!slots.length) {
      const ahead = await getAvailability({ ...query, fromDate: addDays(from, days), days: 60 });
      nextAvailable = ahead?.slots[0]?.start.toISOString() ?? null;
    }

    return json(
      { timezone: org.timezone, serviceId, from, days, dates, nextAvailable },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    return handleApiError(err);
  }
}
