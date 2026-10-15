import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { locations, organizations, practitioners, services } from "@/db/schema";
import { apiError, apiKeyError, auditApiRequest, checkApiKey, handleApiError, json, limitByIp, limitByKey, preflight, readJson, requireScope } from "@/lib/api";
import { bookingRuleMessage } from "@/lib/booking";
import { processingContextFor } from "@/lib/privacy/context";
import { canAcceptOnlineBookings } from "@/lib/privacy/gates";
import { waitlistInputSchema } from "@/lib/validation";
import { joinWaitlist } from "@/lib/waitlist";

export const OPTIONS = preflight;

/**
 * POST /api/v1/clinics/:slug/waitlist — get notified when a matching slot frees up.
 * Like booking: calls without an API key must send `privacy` (422 privacy_required), and the
 * processing context is decided here (API key or valid practice ref: 'practice'; else 'marketplace').
 * With an API key, like the booking route: the key needs appointments:write, counts against its
 * per-key rate limit, and the call is audited as api.request.
 */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const [org] = await db.select().from(organizations).where(eq(organizations.slug, slug));
    if (!org) return apiError(404, "not_found", "Clinic not found.");

    const key = await checkApiKey(req);
    if (!key.ok && key.code !== "none") return apiKeyError(key);
    const partner = key.ok ? key.auth.org : null;
    if (partner && partner.id !== org.id) return apiError(403, "forbidden", "This API key belongs to another practice.");
    if (key.ok) {
      const refused = (await limitByKey(key.auth)) ?? requireScope(key.auth, "appointments:write");
      if (refused) {
        await auditApiRequest(req, key.auth, "clinics.waitlist", refused.status);
        return refused;
      }
    } else {
      const limited = await limitByIp(req, "waitlist", 5, 10 * 60_000);
      if (limited) return limited;
    }
    if (!(await canAcceptOnlineBookings(org))) return apiError(403, "not_accepting", bookingRuleMessage("not_accepting"));

    const input = waitlistInputSchema.parse(await readJson(req));
    if (input.website) return apiError(422, "validation_error", "Invalid submission.");
    if (input.latestDate < input.earliestDate) return apiError(422, "validation_error", "The date range is reversed.");
    if (!partner && !input.privacy) {
      return apiError(422, "privacy_required", bookingRuleMessage("privacy_required"), { field: "privacy" });
    }

    const [service] = await db
      .select({ id: services.id })
      .from(services)
      .where(and(eq(services.id, input.serviceId), eq(services.orgId, org.id), eq(services.active, true), eq(services.onlineBookable, true)));
    if (!service) return apiError(422, "validation_error", "Unknown service.");
    if (input.practitionerId) {
      const [p] = await db
        .select({ id: practitioners.id })
        .from(practitioners)
        .where(and(eq(practitioners.id, input.practitionerId), eq(practitioners.orgId, org.id)));
      if (!p) return apiError(422, "validation_error", "Unknown practitioner.");
    }
    if (input.locationId) {
      const [l] = await db.select({ id: locations.id }).from(locations).where(and(eq(locations.id, input.locationId), eq(locations.orgId, org.id)));
      if (!l) return apiError(422, "validation_error", "Unknown office.");
    }

    const processingContext = processingContextFor({
      source: partner ? "api" : "waitlist",
      viaApiKey: Boolean(partner),
      embedded: false,
      practiceRef: input.practiceRef,
      orgId: org.id,
    });
    const { privacy } = input;
    const { id } = await joinWaitlist({
      orgId: org.id,
      serviceId: input.serviceId,
      practitionerId: input.practitionerId,
      locationId: input.locationId,
      earliestDate: input.earliestDate,
      latestDate: input.latestDate,
      partOfDay: input.partOfDay,
      note: input.note,
      patient: {
        ...input.patient,
        email: input.patient.email || null,
        phone: input.patient.phone || null,
        birthDate: input.patient.birthDate || null,
      },
      processingContext,
      relation: input.relation,
      privacy: privacy
        ? {
            choices: {
              platformConsent: privacy.platformConsent,
              whatsapp: privacy.whatsapp,
              feedback: privacy.feedback,
              marketing: privacy.marketing,
            },
            noticeVersion: privacy.noticeVersion,
            locale: privacy.locale ?? input.patient.locale ?? "it",
            source: partner ? "api" : "waitlist",
            headers: req.headers,
          }
        : undefined,
      actor: key.ok ? { type: "api_key", id: key.auth.key.id } : undefined,
      headers: req.headers,
    });
    if (key.ok) await auditApiRequest(req, key.auth, "clinics.waitlist", 201, { waitlistEntryId: id });
    return json({ waitlistEntry: { id } }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
