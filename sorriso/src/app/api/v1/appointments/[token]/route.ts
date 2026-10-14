import { apiError, json, limitByIp, preflight } from "@/lib/api";
import { getAppointmentDetails } from "@/lib/appointments";
import { publicAppointment } from "@/lib/serializers";

export const OPTIONS = preflight;

/**
 * GET /api/v1/appointments/:token — the patient's own appointment (token from their link).
 * Rate-limited per network, so tokens can't be guessed at volume (they are 256-bit anyway).
 */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const limited = await limitByIp(req, "manage-read", 60, 10 * 60_000);
  if (limited) return limited;
  const { token } = await params;
  const details = await getAppointmentDetails({ token });
  if (!details) return apiError(404, "not_found", "Appointment not found.");
  return json({ appointment: publicAppointment(details) });
}
