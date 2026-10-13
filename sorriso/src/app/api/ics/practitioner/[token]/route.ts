import { and, eq, gte, ne } from "drizzle-orm";
import { db } from "@/db";
import { appointments, locations, organizations, patients, practitioners, services } from "@/db/schema";
import { practitionerName } from "@/lib/format";
import { buildIcs } from "@/lib/ics";

/**
 * Subscribable calendar feed for one practitioner (Google Calendar, Apple
 * Calendar, Outlook: "subscribe from URL"). Read-only, refreshed by the client.
 * Patient names are shortened to "First L." to limit what lands in personal calendars.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const cleanToken = token.replace(/\.ics$/, "");
  const [p] = await db.select().from(practitioners).where(eq(practitioners.icsToken, cleanToken));
  if (!p) return new Response("Not found", { status: 404 });
  const [org] = await db.select().from(organizations).where(eq(organizations.id, p.orgId));

  const since = new Date(Date.now() - 30 * 86_400_000);
  const rows = await db
    .select({ a: appointments, patient: patients, service: services, location: locations })
    .from(appointments)
    .innerJoin(patients, eq(patients.id, appointments.patientId))
    .innerJoin(services, eq(services.id, appointments.serviceId))
    .innerJoin(locations, eq(locations.id, appointments.locationId))
    .where(
      and(
        eq(appointments.orgId, p.orgId),
        eq(appointments.practitionerId, p.id),
        gte(appointments.startsAt, since),
        ne(appointments.status, "cancelled"),
      ),
    );

  const ics = buildIcs({
    name: `${practitionerName(p)} — ${org?.name ?? ""}`,
    events: rows.map(({ a, patient, service, location }) => ({
      uid: `${a.id}@sorriso`,
      start: a.startsAt,
      end: a.endsAt,
      summary: `${service.name}: ${patient.firstName} ${patient.lastName.charAt(0)}.${a.confirmation === "confirmed" ? " ✓" : ""}`,
      description: [a.status === "requested" ? "REQUEST — awaiting approval" : null, a.patientNote].filter(Boolean).join("\n"),
      location: location.name,
      status: a.status === "requested" ? "TENTATIVE" : "CONFIRMED",
      sequence: Math.floor(a.updatedAt.getTime() / 1000),
    })),
  });
  return new Response(ics, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "no-store" } });
}
