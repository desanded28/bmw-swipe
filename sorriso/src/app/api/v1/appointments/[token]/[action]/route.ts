import { apiError, handleApiError, json, limitByIp, preflight } from "@/lib/api";
import { canPatientCancel, canPatientReschedule, getAppointmentDetails } from "@/lib/appointments";
import { cancelAppointment, confirmAttendance, rescheduleAppointment } from "@/lib/booking";
import { markContactVerified } from "@/lib/contact";
import { logError } from "@/lib/log";
import { manageLinkContact } from "@/lib/security/link-contact";
import { linkRebook } from "@/lib/rebooking";
import { publicAppointment } from "@/lib/serializers";
import { rescheduleInputSchema } from "@/lib/validation";

export const OPTIONS = preflight;

/**
 * POST /api/v1/appointments/:token/confirm
 * POST /api/v1/appointments/:token/cancel       { reason? }
 * POST /api/v1/appointments/:token/reschedule   { start, practitionerId?, locationId? }
 * Rate-limited per network (20 changes per 10 minutes).
 *
 * Each is an explicit act through the link, so afterwards the contact the link was delivered to is
 * recorded as proven for the patient, when exactly one contact can hold it (manageLinkContact).
 */
export async function POST(req: Request, { params }: { params: Promise<{ token: string; action: string }> }) {
  try {
    const limited = await limitByIp(req, "manage-write", 20, 10 * 60_000);
    if (limited) return limited;
    const { token, action } = await params;
    const details = await getAppointmentDetails({ token });
    if (!details) return apiError(404, "not_found", "Appointment not found.");
    const id = details.appointment.id;
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    switch (action) {
      case "confirm": {
        if (details.appointment.status !== "scheduled")
          return apiError(409, "not_allowed", "Only scheduled appointments can be confirmed.");
        // The practice closed and offered new times: this time can't be kept, so it can't be confirmed.
        if ((await linkRebook(details, new Date())).open)
          return apiError(409, "rebook_needed", "The practice needs to move this appointment. Please pick a new time.");
        await confirmAttendance(id, "web");
        break;
      }
      case "cancel": {
        if (!canPatientCancel(details)) return apiError(409, "not_allowed", "This appointment can no longer be cancelled.");
        const reason = typeof body.reason === "string" ? body.reason.slice(0, 300) : null;
        await cancelAppointment(id, { by: "patient", reason, via: "web" });
        break;
      }
      case "reschedule": {
        if (!canPatientReschedule(details))
          return apiError(409, "not_allowed", "It's too late to reschedule online. Please call the practice.");
        const input = rescheduleInputSchema.parse(body);
        await rescheduleAppointment(id, {
          startsAt: new Date(input.start),
          practitionerId: input.practitionerId,
          locationId: input.locationId,
          by: "patient",
        });
        break;
      }
      default:
        return apiError(404, "not_found", `Unknown action "${action}".`);
    }
    try {
      const contact = await manageLinkContact(details, token);
      if (contact) await markContactVerified(details.patient.id, contact);
    } catch (err) {
      logError("manage-link", err, { step: "verify-contact", appointmentId: id });
    }
    const updated = await getAppointmentDetails({ id });
    return json({ appointment: publicAppointment(updated!) });
  } catch (err) {
    return handleApiError(err);
  }
}
