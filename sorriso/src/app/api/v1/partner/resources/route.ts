import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { locations, practitionerServices, practitioners, rooms, schedules, services } from "@/db/schema";
import { apiError, authenticateApiKey, json, preflight } from "@/lib/api";

export const OPTIONS = preflight;

/** GET /api/v1/partner/resources — everything needed to map your system to ours. */
export async function GET(req: Request) {
  const org = (await authenticateApiKey(req))?.org ?? null;
  if (!org) return apiError(401, "unauthorized", "Missing or invalid API key.");
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
    practitioners: pracs.map(({ icsToken, userId, ...p }) => ({
      ...p,
      serviceIds: links.filter((l) => l.practitionerId === p.id).map((l) => l.serviceId),
      schedules: sched.filter((s) => s.practitionerId === p.id),
    })),
    services: svc,
  });
}
