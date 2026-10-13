import { getAppointmentDetails } from "@/lib/appointments";
import { absoluteUrl } from "@/lib/config";
import { practitionerName } from "@/lib/format";
import { buildIcs } from "@/lib/ics";

/** Single appointment as an .ics file ("Add to calendar"). */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const d = await getAppointmentDetails({ token });
  if (!d) return new Response("Not found", { status: 404 });
  const ics = buildIcs({
    name: d.org.name,
    events: [
      {
        uid: `${d.appointment.id}@sorriso`,
        start: d.appointment.startsAt,
        end: d.appointment.endsAt,
        summary: `${d.service.name} — ${d.org.name}`,
        description: `${practitionerName(d.practitioner)}\n${absoluteUrl(`/a/${token}`)}`,
        location: `${d.location.name}, ${d.location.address}, ${d.location.city}`,
        status: d.appointment.status === "cancelled" ? "CANCELLED" : "CONFIRMED",
        alarmsMinutesBefore: [24 * 60, 60],
      },
    ],
  });
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="appointment.ics"`,
    },
  });
}
