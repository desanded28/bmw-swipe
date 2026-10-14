import { apiError, handleApiError, json, limitByIp, preflight } from "@/lib/api";
import { canPatientCancel, canPatientReschedule, getAppointmentDetails } from "@/lib/appointments";
import { cancelAppointment, confirmAttendance, rescheduleAppointment } from "@/lib/booking";
import { publicAppointment } from "@/lib/serializers";
import { rescheduleInputSchema } from "@/lib/validation";

export const OPTIONS = preflight;

/**
 * POST /api/v1/appointments/:token/confirm
 * POST /api/v1/appointments/:token/cancel       { reason? }
 * POST /api/v1/appointments/:token/reschedule   { start, practitionerId?, locationId? }
 * Rate-limited per network (20 changes per 10 minutes).
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
    const updated = await getAppointmentDetails({ id });
    return json({ appointment: publicAppointment(updated!) });
  } catch (err) {
    return handleApiError(err);
  }
}
