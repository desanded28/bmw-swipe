import { and, asc, avg, count, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  locations,
  organizations,
  patients,
  practitionerServices,
  practitioners,
  reviews,
  schedules,
  services,
  type Location,
  type Organization,
  type Practitioner,
  type Service,
  type ServiceCategory,
} from "@/db/schema";
import { getAvailability, type Slot } from "./availability";
import { resolveSettings } from "./settings";
import { todayIn } from "./time";

export type Rating = { average: number; count: number };

export async function getRatings(practitionerIds: string[]): Promise<Map<string, Rating>> {
  if (!practitionerIds.length) return new Map();
  const rows = await db
    .select({ practitionerId: reviews.practitionerId, average: avg(reviews.rating), count: count() })
    .from(reviews)
    .where(and(inArray(reviews.practitionerId, practitionerIds), eq(reviews.published, true)))
    .groupBy(reviews.practitionerId);
  return new Map(rows.map((r) => [r.practitionerId, { average: Number(r.average ?? 0), count: r.count }]));
}

export async function listCities() {
  return db
    .select({ city: locations.city, count: sql<number>`count(distinct ${locations.orgId})` })
    .from(locations)
    .innerJoin(organizations, eq(organizations.id, locations.orgId))
    .where(and(eq(locations.active, true), eq(organizations.listed, true)))
    .groupBy(locations.city)
    .orderBy(desc(sql`count(distinct ${locations.orgId})`), asc(locations.city));
}

export type PublicClinic = {
  org: Pick<Organization, "id" | "slug" | "name" | "description" | "phone" | "email" | "website" | "brandColor" | "timezone">;
  booking: { requireApproval: boolean; maxAdvanceDays: number; cancelUntilHours: number };
  locations: Pick<Location, "id" | "name" | "address" | "city" | "postalCode" | "phone" | "lat" | "lng" | "timezone">[];
  practitioners: (Pick<
    Practitioner,
    "id" | "slug" | "title" | "name" | "specialty" | "bio" | "languages" | "color" | "acceptsNewPatients"
  > & { serviceIds: string[]; locationIds: string[]; rating: Rating | null })[];
  services: Pick<Service, "id" | "name" | "category" | "description" | "durationMinutes" | "priceCents">[];
};

/** Everything the public pages and the booking widget need about a practice. */
export async function getPublicClinic(slug: string): Promise<PublicClinic | null> {
  const [org] = await db.select().from(organizations).where(eq(organizations.slug, slug));
  if (!org) return null;
  const settings = resolveSettings(org.settings);

  const [locationRows, practitionerRows, serviceRows] = await Promise.all([
    db
      .select()
      .from(locations)
      .where(and(eq(locations.orgId, org.id), eq(locations.active, true)))
      .orderBy(asc(locations.name)),
    db
      .select()
      .from(practitioners)
      .where(and(eq(practitioners.orgId, org.id), eq(practitioners.active, true)))
      .orderBy(asc(practitioners.name)),
    db
      .select()
      .from(services)
      .where(and(eq(services.orgId, org.id), eq(services.active, true), eq(services.onlineBookable, true)))
      .orderBy(asc(services.sortOrder), asc(services.name)),
  ]);
  const pIds = practitionerRows.map((p) => p.id);
  const [links, scheduleRows, ratings] = await Promise.all([
    pIds.length ? db.select().from(practitionerServices).where(inArray(practitionerServices.practitionerId, pIds)) : [],
    pIds.length
      ? db
          .selectDistinct({ practitionerId: schedules.practitionerId, locationId: schedules.locationId })
          .from(schedules)
          .where(inArray(schedules.practitionerId, pIds))
      : [],
    getRatings(pIds),
  ]);
  const bookable = new Set(serviceRows.map((s) => s.id));
  const activeLocations = new Set(locationRows.map((l) => l.id));

  return {
    org: {
      id: org.id,
      slug: org.slug,
      name: org.name,
      description: org.description,
      phone: org.phone,
      email: org.email,
      website: org.website,
      brandColor: org.brandColor,
      timezone: org.timezone,
    },
    booking: {
      requireApproval: settings.booking.requireApproval,
      maxAdvanceDays: settings.booking.maxAdvanceDays,
      cancelUntilHours: settings.booking.cancelUntilHours,
    },
    locations: locationRows.map((l) => ({
      id: l.id,
      name: l.name,
      address: l.address,
      city: l.city,
      postalCode: l.postalCode,
      phone: l.phone,
      lat: l.lat,
      lng: l.lng,
      timezone: l.timezone,
    })),
    practitioners: practitionerRows.map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      name: p.name,
      specialty: p.specialty,
      bio: p.bio,
      languages: p.languages,
      color: p.color,
      acceptsNewPatients: p.acceptsNewPatients,
      serviceIds: links.filter((l) => l.practitionerId === p.id && bookable.has(l.serviceId)).map((l) => l.serviceId),
      locationIds: [
        ...new Set(
          scheduleRows.filter((s) => s.practitionerId === p.id && activeLocations.has(s.locationId)).map((s) => s.locationId),
        ),
      ],
      rating: ratings.get(p.id) ?? null,
    })),
    services: serviceRows.map((s) => ({
      id: s.id,
      name: s.name,
      category: s.category,
      description: s.description,
      durationMinutes: s.durationMinutes,
      priceCents: s.priceCents,
    })),
  };
}

export async function getPublicReviews(orgId: string, practitionerId?: string, limit = 20) {
  return db
    .select({
      id: reviews.id,
      rating: reviews.rating,
      comment: reviews.comment,
      authorName: reviews.authorName,
      reply: reviews.reply,
      createdAt: reviews.createdAt,
      practitionerId: reviews.practitionerId,
      practitionerName: practitioners.name,
      practitionerTitle: practitioners.title,
    })
    .from(reviews)
    .innerJoin(practitioners, eq(practitioners.id, reviews.practitionerId))
    .where(
      and(
        eq(reviews.orgId, orgId),
        eq(reviews.published, true),
        practitionerId ? eq(reviews.practitionerId, practitionerId) : undefined,
      ),
    )
    .orderBy(desc(reviews.createdAt))
    .limit(limit);
}

export type SearchResult = {
  org: Organization;
  practitioner: Practitioner;
  locations: Location[];
  featuredService: Service;
  priceFrom: number | null;
  rating: Rating | null;
  slots: Slot[];
};

/**
 * Marketplace search: practitioners (not just clinics) matching city / category / text,
 * each with real next-available slots so patients can book straight from the results.
 */
export async function searchPractitioners(params: {
  city?: string;
  category?: ServiceCategory;
  q?: string;
  days?: number;
}): Promise<SearchResult[]> {
  const q = params.q?.trim().toLowerCase();
  const city = params.city?.trim().toLowerCase();

  const rows = await db
    .select({ practitioner: practitioners, org: organizations })
    .from(practitioners)
    .innerJoin(organizations, eq(organizations.id, practitioners.orgId))
    .where(and(eq(practitioners.active, true), eq(organizations.listed, true)));

  const pIds = rows.map((r) => r.practitioner.id);
  if (!pIds.length) return [];
  const [links, scheduleLocs, allServices, ratings] = await Promise.all([
    db.select().from(practitionerServices).where(inArray(practitionerServices.practitionerId, pIds)),
    db
      .selectDistinct({ practitionerId: schedules.practitionerId, location: locations })
      .from(schedules)
      .innerJoin(locations, eq(locations.id, schedules.locationId))
      .where(and(inArray(schedules.practitionerId, pIds), eq(locations.active, true))),
    db
      .select()
      .from(services)
      .where(and(eq(services.active, true), eq(services.onlineBookable, true)))
      .orderBy(asc(services.sortOrder)),
    getRatings(pIds),
  ]);
  const serviceById = new Map(allServices.map((s) => [s.id, s]));

  const candidates = rows
    .map(({ practitioner, org }) => {
      const offered = links
        .filter((l) => l.practitionerId === practitioner.id)
        .map((l) => serviceById.get(l.serviceId))
        .filter((s): s is Service => Boolean(s));
      const locs = scheduleLocs
        .filter((s) => s.practitionerId === practitioner.id)
        .map((s) => s.location)
        .filter((l, i, arr) => arr.findIndex((x) => x.id === l.id) === i);
      return { practitioner, org, offered, locs };
    })
    .filter(({ offered, locs }) => offered.length > 0 && locs.length > 0)
    .filter(({ locs }) => !city || locs.some((l) => l.city.toLowerCase() === city))
    .filter(({ offered }) => !params.category || offered.some((s) => s.category === params.category))
    .filter(({ practitioner, org, offered }) => {
      if (!q) return true;
      const haystack = [practitioner.name, practitioner.specialty, org.name, ...offered.map((s) => s.name)]
        .join(" ")
        .toLowerCase();
      return q.split(/\s+/).every((word) => haystack.includes(word));
    });

  const results = await Promise.all(
    candidates.map(async ({ practitioner, org, offered, locs }) => {
      const inCategory = params.category ? offered.filter((s) => s.category === params.category) : offered;
      const matchingText = q ? inCategory.filter((s) => s.name.toLowerCase().includes(q)) : [];
      const featuredService =
        matchingText[0] ?? inCategory.find((s) => s.category === "checkup") ?? inCategory[0] ?? offered[0];
      const cityLocations = city ? locs.filter((l) => l.city.toLowerCase() === city) : locs;
      const avail = await getAvailability({
        orgId: org.id,
        serviceId: featuredService.id,
        practitionerIds: [practitioner.id],
        locationId: cityLocations.length === 1 ? cityLocations[0].id : undefined,
        fromDate: todayIn(org.timezone),
        days: params.days ?? 7,
        timezone: org.timezone,
      });
      const slots = (avail?.slots ?? []).filter((s) => !city || cityLocations.some((l) => l.id === s.locationId));
      const prices = inCategory.map((s) => s.priceCents).filter((p): p is number => p != null);
      return {
        org,
        practitioner,
        locations: cityLocations,
        featuredService,
        priceFrom: prices.length ? Math.min(...prices) : null,
        rating: ratings.get(practitioner.id) ?? null,
        slots,
      } satisfies SearchResult;
    }),
  );

  // Soonest availability first, then rating.
  return results.sort((a, b) => {
    const as = a.slots[0]?.start.getTime() ?? Infinity;
    const bs = b.slots[0]?.start.getTime() ?? Infinity;
    if (as !== bs) return as - bs;
    return (b.rating?.average ?? 0) - (a.rating?.average ?? 0);
  });
}

export async function countPatients(orgId: string) {
  const [row] = await db.select({ n: count() }).from(patients).where(eq(patients.orgId, orgId));
  return row?.n ?? 0;
}
