import { z } from "zod";
import { apiError, authenticateApiKey, handleApiError, json, preflight } from "@/lib/api";
import { getOrgAppointmentDetails } from "@/lib/appointments";
import { cancelAppointment, confirmAttendance, rescheduleAppointment, setOutcome } from "@/lib/booking";
import { partnerAppointment } from "@/lib/serializers";

export const OPTIONS = preflight;

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const org = (await authenticateApiKey(req))?.org ?? null;
  if (!org) return apiError(401, "unauthorized", "Missing or invalid API key.");
  const { id } = await params;
  const d = await getOrgAppointmentDetails(org.id, id);
  if (!d) return apiError(404, "not_found", "Appointment not found.");
  return json({ appointment: partnerAppointment(d) });
}

const patchSchema = z.object({
  status: z.enum(["cancelled", "completed", "no_show", "scheduled"]).optional(),
  confirmation: z.literal("confirmed").optional(),
  start: z.iso.datetime({ offset: true }).optional(),
  practitionerId: z.string().optional(),
  locationId: z.string().optional(),
  reason: z.string().max(300).optional(),
  force: z.boolean().optional(),
  notifyPatient: z.boolean().optional(),
});

/**
 * PATCH /api/v1/partner/appointments/:id
 *   { "start": "…" }                       reschedule
 *   { "status": "cancelled", "reason": … }  cancel (frees the slot for the waitlist)
 *   { "status": "completed" | "no_show" }   record the outcome
 *   { "confirmation": "confirmed" }         patient confirmed by phone
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const org = (await authenticateApiKey(req))?.org ?? null;
    if (!org) return apiError(401, "unauthorized", "Missing or invalid API key.");
    const { id } = await params;
    const d = await getOrgAppointmentDetails(org.id, id);
    if (!d) return apiError(404, "not_found", "Appointment not found.");
    const input = patchSchema.parse(await req.json());

    if (input.start || input.practitionerId || input.locationId) {
      await rescheduleAppointment(id, {
        startsAt: input.start ? new Date(input.start) : d.appointment.startsAt,
        practitionerId: input.practitionerId,
        locationId: input.locationId,
        by: "staff",
        force: input.force,
        notifyPatient: input.notifyPatient,
      });
    }
    if (input.status === "cancelled") {
      await cancelAppointment(id, { by: "staff", reason: input.reason, notifyPatient: input.notifyPatient });
    } else if (input.status) {
      await setOutcome(id, input.status);
    }
    if (input.confirmation === "confirmed") await confirmAttendance(id, "staff");

    return json({ appointment: partnerAppointment((await getOrgAppointmentDetails(org.id, id))!) });
  } catch (err) {
    return handleApiError(err);
  }
}
