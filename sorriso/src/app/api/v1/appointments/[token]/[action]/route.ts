import { apiError, handleApiError, json, limitByIp, preflight } from "@/lib/api";
import { canPatientCancel, canPatientReschedule, getAppointmentDetails } from "@/lib/appointments";
import { audit } from "@/lib/audit";
import { getAvailability, slotsByDate } from "@/lib/availability";
import { cancelAppointment, confirmAttendance, rescheduleAppointment } from "@/lib/booking";
import { markContactVerified } from "@/lib/contact";
import { logError } from "@/lib/log";
import { manageLinkContact } from "@/lib/security/link-contact";
import { linkRebook } from "@/lib/rebooking";
import { publicAppointment } from "@/lib/serializers";
import { addDays, isDateString, todayIn } from "@/lib/time";
import { rescheduleInputSchema } from "@/lib/validation";

export const OPTIONS = preflight;

/**
 * GET /api/v1/appointments/:token/availability?from=YYYY-MM-DD&days=7
 * The times this visit can move to, for the manage page's reschedule picker: the visit's own
 * practitioner, service and length, with its current time not counted as busy (so it can move
 * by a quarter of an hour). Same answer shape as GET /api/v1/clinics/:slug/availability.
 */
export async function GET(req: Request, { params }: { params: Promise<{ token: string; action: string }> }) {
  try {
    const limited = await limitByIp(req, "availability", 120, 60_000);
    if (limited) return limited;
    const { token, action } = await params;
    if (action !== "availability") return apiError(404, "not_found", `Unknown action "${action}".`);
    const details = await getAppointmentDetails({ token });
    if (!details) return apiError(404, "not_found", "Appointment not found.");
    if (!canPatientReschedule(details))
      return apiError(409, "not_allowed", "It's too late to reschedule online. Please call the practice.");
    const { appointment: a, org } = details;
    const url = new URL(req.url);
    const today = todayIn(org.timezone);
    const fromParam = url.searchParams.get("from");
    const from = isDateString(fromParam) && fromParam >= today ? fromParam : today;
    const days = Math.min(Math.max(Number(url.searchParams.get("days") ?? 7) || 7, 1), 31);
    const query = {
      orgId: org.id,
      serviceId: a.serviceId,
      practitionerIds: [a.practitionerId],
      timezone: org.timezone,
      durationMinutes: Math.round((a.endsAt.getTime() - a.startsAt.getTime()) / 60_000),
      ignoreAppointmentId: a.id,
    };
    const result = await getAvailability({ ...query, fromDate: from, days });
    if (!result) return apiError(404, "not_found", "Service not found.");
    let nextAvailable: string | null = null;
    if (!result.slots.length) {
      const ahead = await getAvailability({ ...query, fromDate: addDays(from, days), days: 60 });
      nextAvailable = ahead?.slots[0]?.start.toISOString() ?? null;
    }
    return json(
      { timezone: org.timezone, serviceId: a.serviceId, from, days, dates: slotsByDate(result.ctx, result.slots, from, days, org.timezone), nextAvailable },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    return handleApiError(err);
  }
}

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
    // The access log (F9.4): the patient changed the visit through their link.
    await audit({
      orgId: details.org.id,
      actor: { type: "patient_link", id },
      action: action === "cancel" ? "appointment.cancel" : "appointment.update",
      entity: { type: "appointment", id },
      metadata: { change: action, via: "manage_link" },
      headers: req.headers,
    });
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
