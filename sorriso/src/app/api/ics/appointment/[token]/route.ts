import { getAppointmentDetails } from "@/lib/appointments";
import { isManageLinkValid } from "@/lib/links";
import { rateLimitByIp } from "@/lib/rate-limit";
import { appointmentIcs } from "@/lib/reminders";

const HEADERS = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
};

/**
 * Single appointment as an .ics file ("Add to calendar"). Discreet like every patient message:
 * "Appointment – {clinic}" in the patient's language, the address and the practice's phone; no
 * treatment, practitioner, note or link (calendars sync to other devices and accounts). The token
 * is checked through links.ts (hash lookup, expiry 60 days after the visit), and lookups are
 * rate-limited per network so tokens can't be guessed at scale.
 */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const limit = await rateLimitByIp(req.headers, "ics-appointment", 30, 10 * 60_000);
  if (!limit.ok) {
    return new Response("Too many requests", { status: 429, headers: { ...HEADERS, "Retry-After": String(limit.retryAfterSec) } });
  }
  const { token } = await params;
  const d = token && token.length <= 128 ? await getAppointmentDetails({ token }) : null;
  if (!d || !isManageLinkValid(d.appointment)) return new Response("Not found", { status: 404, headers: HEADERS });
  // A request the practice still has to accept, or a booking held for the adult's own
  // confirmation, may be declined or expire: tentative until it is a firm appointment.
  const status = d.appointment.status;
  const ics = appointmentIcs(d, status === "cancelled" ? "CANCELLED" : status === "requested" ? "TENTATIVE" : "CONFIRMED");
  return new Response(ics, {
    headers: {
      ...HEADERS,
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="appointment.ics"',
    },
  });
}
