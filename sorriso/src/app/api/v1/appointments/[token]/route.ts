import { apiError, json, preflight } from "@/lib/api";
import { getAppointmentDetails } from "@/lib/appointments";
import { publicAppointment } from "@/lib/serializers";

export const OPTIONS = preflight;

/** GET /api/v1/appointments/:token — the patient's own appointment (token from their link). */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const details = await getAppointmentDetails({ token });
  if (!details) return apiError(404, "not_found", "Appointment not found.");
  return json({ appointment: publicAppointment(details) });
}
