import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { locations, practitionerServices, practitioners, rooms, schedules, services } from "@/db/schema";
import { json, partnerRoute } from "@/lib/api";

/** GET /api/v1/partner/resources — everything needed to map your system to ours. Scope appointments:read. */
export function GET(req: Request) {
  return partnerRoute(req, "appointments:read", "resources.list", async ({ org }) => {
    const locs = await db.select().from(locations).where(eq(locations.orgId, org.id));
    const locIds = locs.map((l) => l.id);
    const pracs = await db.select().from(practitioners).where(eq(practitioners.orgId, org.id));
    const pIds = pracs.map((p) => p.id);
    const [roomRows, svc, links, sched] = await Promise.all([
      locIds.length ? db.select().from(rooms).where(inArray(rooms.locationId, locIds)) : [],
      db.select().from(services).where(eq(services.orgId, org.id)),
      pIds.length ? db.select().from(practitionerServices).where(inArray(practitionerServices.practitionerId, pIds)) : [],
      pIds.length ? db.select().from(schedules).where(inArray(schedules.practitionerId, pIds)) : [],
    ]);
    return json({
      organization: { id: org.id, slug: org.slug, name: org.name, timezone: org.timezone },
      locations: locs.map((l) => ({ ...l, rooms: roomRows.filter((r) => r.locationId === l.id) })),
      // Everything about a practitioner except the calendar-feed secret's hash and who approved what.
      practitioners: pracs.map(
        ({ icsToken, icsTokenHash, icsTokenExpiresAt, userId, profileApprovedByUserId, alboVerifiedByUserId, ...p }) => ({
          ...p,
          serviceIds: links.filter((l) => l.practitionerId === p.id).map((l) => l.serviceId),
          schedules: sched.filter((s) => s.practitionerId === p.id),
        }),
      ),
      services: svc,
    });
  });
}
