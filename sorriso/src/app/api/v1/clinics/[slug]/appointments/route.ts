import { eq } from "drizzle-orm";
import { db } from "@/db";
import { organizations } from "@/db/schema";
import { apiError, apiKeyError, auditApiRequest, checkApiKey, handleApiError, json, limitByIp, limitByKey, preflight, requireScope } from "@/lib/api";
import { bookingRuleMessage, createAppointment } from "@/lib/booking";
import { processingContextFor } from "@/lib/privacy/context";
import { canAcceptOnlineBookings } from "@/lib/privacy/gates";
import { publicAppointment } from "@/lib/serializers";
import { bookingInputSchema } from "@/lib/validation";

export const OPTIONS = preflight;

/**
 * POST /api/v1/clinics/:slug/appointments — book a slot as a patient.
 * Used by the website, the embeddable widget and third-party integrations
 * (send `Authorization: Bearer sk_…` to mark the booking as coming from your app).
 *
 * Calls without an API key must send `privacy` (422 privacy_required). Who is controller is decided
 * here, never by the client: 'practice' with an API key or a valid practice ref (`practiceRef`, from
 * a practice-published link or the embed), 'marketplace' otherwise. A failed privacy or relation
 * rule answers 422 with the rule's code (e.g. guardian_required) and the form field it is about.
 * An Authorization header that isn't a valid key for this practice is refused (401/403), never
 * silently treated as a public call. Public calls are rate-limited per network (10 per 10 minutes).
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
        await auditApiRequest(req, key.auth, "clinics.appointments", refused.status);
        return refused;
      }
    } else {
      const limited = await limitByIp(req, "book", 10, 10 * 60_000);
      if (limited) return limited;
    }
    if (!(await canAcceptOnlineBookings(org))) return apiError(403, "not_accepting", bookingRuleMessage("not_accepting"));

    const input = bookingInputSchema.parse(await req.json());
    if (input.website) return apiError(422, "validation_error", "Invalid submission.");
    if (!partner && !input.privacy) {
      return apiError(422, "privacy_required", bookingRuleMessage("privacy_required"), { field: "privacy" });
    }

    const source = partner ? "api" : input.waitlistEntryId ? "waitlist" : (input.source ?? "online");
    const processingContext = processingContextFor({
      source,
      viaApiKey: Boolean(partner),
      embedded: false,
      practiceRef: input.practiceRef,
      orgId: org.id,
    });
    const { privacy } = input;

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
      source,
      online: true,
      processingContext,
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
            source: partner ? "api" : input.source === "widget" ? "widget" : "booking",
            headers: req.headers,
          }
        : undefined,
      relation: input.relation,
      fundId: input.fundId,
    });
    if (key.ok) await auditApiRequest(req, key.auth, "clinics.appointments", 201, { appointmentId: details.appointment.id });
    return json({ appointment: publicAppointment(details) }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
