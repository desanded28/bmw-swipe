import { and, asc, avg, count, desc, eq, inArray, isNotNull, isNull, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  funds,
  locations,
  orgFunds,
  organizations,
  patients,
  practitionerServices,
  practitioners,
  profileStats,
  reviews,
  schedules,
  services,
  type FundKind,
  type FundMode,
  type LegalSpecialization,
  type LocalizedText,
  type Location,
  type LocationAccessibility,
  type Locale,
  type Organization,
  type Practitioner,
  type PractitionerCareOptions,
  type PriceType,
  type ReviewAuthorDisplay,
  type Service,
  type ServiceCategory,
  type SpokenLanguage,
} from "@/db/schema";
import { getAvailability, type Slot } from "./availability";
import { logError } from "./log";
import { getPrivacy } from "./privacy/settings";
import {
  bayesianRating,
  daySeed,
  globalMeanRating,
  profileCompleteness,
  rankResults,
  reliabilitySignals,
  type RankInput,
  type RankReason,
  type RankResult,
} from "./ranking";
import { resolveSettings } from "./settings";
import { todayIn } from "./time";

/**
 * The public directory (WP7): what the marketplace pages, the booking widget and the public API
 * show about practices and practitioners.
 *
 * Listing rule: a practitioner appears on the marketplace (search, their profile page, the team
 * on the practice page, ratings and reviews) only with an approved public profile and without a
 * marketplace opt-out: publicProfile, profileApprovedAt set, marketplaceOptOutAt null. The booking
 * form still offers every active practitioner, because booking through the practice's own
 * channels doesn't depend on the marketplace listing.
 */

// ---------------------------------------------------------------- listing rules

/** SQL condition: the practitioner is listed on the marketplace. */
export function listedPractitioner(): SQL {
  return and(
    eq(practitioners.active, true),
    eq(practitioners.publicProfile, true),
    isNotNull(practitioners.profileApprovedAt),
    isNull(practitioners.marketplaceOptOutAt),
  )!;
}

export function isListed(
  p: Pick<Practitioner, "active" | "publicProfile" | "profileApprovedAt" | "marketplaceOptOutAt">,
): boolean {
  return p.active && p.publicProfile && p.profileApprovedAt != null && p.marketplaceOptOutAt == null;
}

/**
 * Practitioner slugs that would collide with static routes under /c/<org>/ (critique 38: WP4's
 * /c/<org>/privacy) or read like one. New practitioners never get them.
 */
export const RESERVED_PRACTITIONER_SLUGS = ["privacy", "book", "booking", "reviews", "review", "legal", "embed", "api", "a", "new", "edit", "admin", "notice", "terms", "contact", "map"] as const;

export function isReservedSlug(slug: string): boolean {
  return (RESERVED_PRACTITIONER_SLUGS as readonly string[]).includes(slug);
}

// ---------------------------------------------------------------- ratings

export type Rating = { average: number; count: number };

/** Published reviews only. */
export async function getRatings(practitionerIds: string[]): Promise<Map<string, Rating>> {
  if (!practitionerIds.length) return new Map();
  const rows = await db
    .select({ practitionerId: reviews.practitionerId, average: avg(reviews.rating), count: count() })
    .from(reviews)
    .where(and(inArray(reviews.practitionerId, practitionerIds), eq(reviews.status, "published")))
    .groupBy(reviews.practitionerId);
  return new Map(rows.map((r) => [r.practitionerId, { average: Number(r.average ?? 0), count: r.count }]));
}

export type RatingBreakdown = {
  count: number;
  /** Simple average of published ratings (0 without reviews). */
  average: number;
  /** Bayesian average used by ranking: (C*m + sum) / (C + n). */
  weighted: number;
  /** Number of published reviews with 5, 4, 3, 2 and 1 stars, in that order. */
  distribution: [number, number, number, number, number];
};

/** Distribution and averages of the published reviews of a practice (its listed practitioners) or one practitioner. */
export async function getRatingBreakdown(where: { orgId: string; practitionerId?: string }): Promise<RatingBreakdown> {
  const [rows, mean] = await Promise.all([
    db
      .select({ rating: reviews.rating, n: count() })
      .from(reviews)
      .innerJoin(practitioners, eq(practitioners.id, reviews.practitionerId))
      .where(
        and(
          eq(reviews.orgId, where.orgId),
          eq(reviews.status, "published"),
          listedPractitioner(),
          where.practitionerId ? eq(reviews.practitionerId, where.practitionerId) : undefined,
        ),
      )
      .groupBy(reviews.rating),
    globalMeanRating(),
  ]);
  const distribution: RatingBreakdown["distribution"] = [0, 0, 0, 0, 0];
  let sum = 0;
  let n = 0;
  for (const r of rows) {
    if (r.rating < 1 || r.rating > 5) continue;
    distribution[5 - r.rating] += r.n;
    sum += r.rating * r.n;
    n += r.n;
  }
  return { count: n, average: n ? sum / n : 0, weighted: bayesianRating(sum, n, mean), distribution };
}

// ---------------------------------------------------------------- cities and funds

export async function listCities() {
  return db
    .select({ city: locations.city, count: sql<number>`count(distinct ${locations.orgId})` })
    .from(locations)
    .innerJoin(organizations, eq(organizations.id, locations.orgId))
    .where(and(eq(locations.active, true), eq(organizations.listed, true), isNull(organizations.closureRequestedAt)))
    .groupBy(locations.city)
    .orderBy(desc(sql`count(distinct ${locations.orgId})`), asc(locations.city));
}

export type FundOption = { id: string; slug: string; name: string; kind: FundKind };

/** Every health fund and insurer known to the platform (the search filter, the practice settings). */
export async function listFunds(): Promise<FundOption[]> {
  return db.select({ id: funds.id, slug: funds.slug, name: funds.name, kind: funds.kind }).from(funds).orderBy(asc(funds.name));
}

// ---------------------------------------------------------------- practice pages

/** What the marketplace shows about a listed practitioner beyond the booking basics. */
export type PublicProfile = {
  spokenLanguages: SpokenLanguage[];
  careOptions: PractitionerCareOptions;
  /** Legal specialisations: only once the Albo registration is verified (empty otherwise). */
  specializations: LegalSpecialization[];
  /** The verified Albo degli Odontoiatri registration (the number itself is not published). */
  albo: { province: string; verifiedAt: Date } | null;
  bioI18n: LocalizedText;
  specialtyI18n: LocalizedText;
};

export type PublicFund = { id: string; slug: string; name: string; kind: FundKind; mode: FundMode; serviceIds: string[] | null; note: string | null };

export type PublicClinic = {
  /** Fields added by WP7 are optional so existing PublicClinic literals (tests, fixtures) keep compiling. */
  org: Pick<Organization, "id" | "slug" | "name" | "description" | "phone" | "email" | "website" | "brandColor" | "timezone"> & {
    medicalDirector?: string | null;
    /** The language the practice writes its own texts in (descriptions, bios, service names). */
    contentLocale?: Locale;
    /** On the marketplace (organizations.listed) and not closing. */
    listed?: boolean;
  };
  booking: { requireApproval: boolean; maxAdvanceDays: number; cancelUntilHours: number };
  locations: (Pick<Location, "id" | "name" | "address" | "city" | "postalCode" | "phone" | "lat" | "lng" | "timezone"> & {
    accessibility?: LocationAccessibility;
  })[];
  practitioners: (Pick<
    Practitioner,
    "id" | "slug" | "title" | "name" | "specialty" | "bio" | "languages" | "color" | "acceptsNewPatients"
  > & {
    serviceIds: string[];
    locationIds: string[];
    rating: Rating | null;
    /** Listed on the marketplace (approved, not opted out). Unlisted ones are bookable but have no profile, bio or rating. */
    listed?: boolean;
    profile?: PublicProfile | null;
  })[];
  services: (Pick<Service, "id" | "name" | "category" | "description" | "durationMinutes" | "priceCents"> & {
    priceType?: PriceType;
    priceMaxCents?: number | null;
    priceIncludes?: string | null;
    nameI18n?: LocalizedText;
    descriptionI18n?: LocalizedText;
  })[];
  /** Health funds and insurers the practice works with, as it declared them. */
  funds?: PublicFund[];
  /** What the booking form may offer: the WhatsApp channel and the marketing opt-in are off unless the practice enabled them. */
  privacy: { whatsappEnabled: boolean; marketingEnabled: boolean };
  /** The practice as data controller, for the first-layer privacy notice. */
  legal: { controllerName: string; hasDpo: boolean };
};

/** Everything the public pages and the booking widget need about a practice. */
export async function getPublicClinic(slug: string): Promise<PublicClinic | null> {
  const [org] = await db.select().from(organizations).where(eq(organizations.slug, slug));
  if (!org) return null;
  const settings = resolveSettings(org.settings);
  const privacy = getPrivacy(org);

  const [locationRows, practitionerRows, serviceRows, fundRows] = await Promise.all([
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
    db
      .select({ fund: funds, link: orgFunds })
      .from(orgFunds)
      .innerJoin(funds, eq(funds.id, orgFunds.fundId))
      .where(eq(orgFunds.orgId, org.id))
      .orderBy(asc(funds.name)),
  ]);
  const pIds = practitionerRows.map((p) => p.id);
  const listedIds = practitionerRows.filter(isListed).map((p) => p.id);
  const [links, scheduleRows, ratings] = await Promise.all([
    pIds.length ? db.select().from(practitionerServices).where(inArray(practitionerServices.practitionerId, pIds)) : [],
    pIds.length
      ? db
          .selectDistinct({ practitionerId: schedules.practitionerId, locationId: schedules.locationId })
          .from(schedules)
          .where(inArray(schedules.practitionerId, pIds))
      : [],
    getRatings(listedIds),
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
      medicalDirector: org.medicalDirector,
      contentLocale: org.contentLocale,
      listed: org.listed && !org.closureRequestedAt,
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
      accessibility: l.accessibility ?? {},
    })),
    practitioners: practitionerRows.map((p) => {
      const listed = isListed(p);
      return {
        id: p.id,
        slug: p.slug,
        title: p.title,
        name: p.name,
        specialty: p.specialty,
        // Unlisted practitioners are bookable through the practice, nothing more.
        bio: listed ? p.bio : null,
        languages: p.languages,
        color: p.color,
        acceptsNewPatients: p.acceptsNewPatients,
        serviceIds: links.filter((l) => l.practitionerId === p.id && bookable.has(l.serviceId)).map((l) => l.serviceId),
        locationIds: [
          ...new Set(
            scheduleRows.filter((s) => s.practitionerId === p.id && activeLocations.has(s.locationId)).map((s) => s.locationId),
          ),
        ],
        rating: listed ? (ratings.get(p.id) ?? null) : null,
        listed,
        profile: listed ? publicProfileOf(p) : null,
      };
    }),
    services: serviceRows.map((s) => ({
      id: s.id,
      name: s.name,
      category: s.category,
      description: s.description,
      durationMinutes: s.durationMinutes,
      priceCents: s.priceCents,
      priceType: s.priceType,
      priceMaxCents: s.priceMaxCents,
      priceIncludes: s.priceIncludes,
      nameI18n: s.nameI18n ?? {},
      descriptionI18n: s.descriptionI18n ?? {},
    })),
    funds: fundRows.map(({ fund, link }) => ({
      id: fund.id,
      slug: fund.slug,
      name: fund.name,
      kind: fund.kind,
      mode: link.mode,
      serviceIds: link.serviceIds ?? null,
      note: link.note,
    })),
    privacy: { whatsappEnabled: privacy.whatsappEnabled, marketingEnabled: privacy.marketingEnabled },
    legal: { controllerName: org.legalName ?? org.name, hasDpo: Boolean(org.dpoName || org.dpoEmail) },
  };
}

function publicProfileOf(p: Practitioner): PublicProfile {
  const verified = p.alboVerifiedAt != null && Boolean(p.alboProvince);
  return {
    spokenLanguages: p.spokenLanguages ?? [],
    careOptions: p.careOptions ?? {},
    specializations: verified ? (p.specializations ?? []) : [],
    albo: verified ? { province: p.alboProvince!, verifiedAt: p.alboVerifiedAt! } : null,
    bioI18n: p.bioI18n ?? {},
    specialtyI18n: p.specialtyI18n ?? {},
  };
}

/** A practice-written text in the page's language when the practice translated it, else the original. */
export function localizedText(base: string, i18n: LocalizedText | null | undefined, locale: Locale, contentLocale: Locale): { text: string; lang: Locale } {
  const own = i18n?.[locale]?.trim();
  return own ? { text: own, lang: locale } : { text: base, lang: contentLocale };
}

// ---------------------------------------------------------------- reviews

/**
 * A published review as the public pages show it. Never a service or treatment name; the
 * author's name only when they chose to show it (first name and initial).
 */
export type PublicReview = {
  id: string;
  rating: number;
  comment: string | null;
  authorDisplay: ReviewAuthorDisplay;
  /** Set only when authorDisplay is "first_initial". */
  authorName: string | null;
  /** The language the review was written in, when known. */
  locale: Locale | null;
  reply: string | null;
  createdAt: Date;
  practitionerId: string;
  practitionerName: string;
  practitionerTitle: string;
};

export async function getPublicReviews(orgId: string, practitionerId?: string, limit = 20): Promise<PublicReview[]> {
  const rows = await db
    .select({
      id: reviews.id,
      rating: reviews.rating,
      comment: reviews.comment,
      authorDisplay: reviews.authorDisplay,
      authorName: reviews.authorName,
      locale: reviews.locale,
      reply: reviews.reply,
      createdAt: reviews.createdAt,
      publishedAt: reviews.publishedAt,
      practitionerId: reviews.practitionerId,
      practitionerName: practitioners.name,
      practitionerTitle: practitioners.title,
    })
    .from(reviews)
    .innerJoin(practitioners, eq(practitioners.id, reviews.practitionerId))
    .where(
      and(
        eq(reviews.orgId, orgId),
        eq(reviews.status, "published"),
        listedPractitioner(),
        practitionerId ? eq(reviews.practitionerId, practitionerId) : undefined,
      ),
    )
    .orderBy(desc(sql`coalesce(${reviews.publishedAt}, ${reviews.createdAt})`))
    .limit(limit);
  return rows.map(({ publishedAt, authorName, ...r }) => ({
    ...r,
    createdAt: publishedAt ?? r.createdAt,
    authorName: r.authorDisplay === "first_initial" ? authorName : null,
  }));
}

// ---------------------------------------------------------------- search

export const ACCESS_FEATURES = ["stepFree", "lift", "accessibleWc", "disabledParking", "hearingLoop", "wheelchairTransferChair"] as const;
export type AccessFeature = (typeof ACCESS_FEATURES)[number];

export type SearchParams = {
  city?: string;
  category?: ServiceCategory;
  q?: string;
  days?: number;
  /** Spoken language (ISO 639-1). */
  lang?: SpokenLanguage;
  /** A fund's slug: only practices that declared it. */
  fund?: string;
  maxPriceCents?: number;
  priceType?: PriceType;
  /** Every listed feature at one of the practitioner's offices (in the searched city). */
  access?: readonly AccessFeature[];
  children?: boolean;
  anxiety?: boolean;
  sedation?: boolean;
  /** Soonest free slot first. */
  urgent?: boolean;
  /** Language of the page: picks translated service names. */
  locale?: Locale;
  now?: Date;
};

export type SearchResult = {
  org: Pick<Organization, "id" | "slug" | "name" | "timezone" | "brandColor">;
  practitioner: Pick<Practitioner, "id" | "slug" | "title" | "name" | "specialty" | "color" | "acceptsNewPatients" | "spokenLanguages" | "careOptions"> & {
    alboVerified: boolean;
  };
  locations: Pick<Location, "id" | "name" | "address" | "city" | "accessibility">[];
  featuredService: Pick<Service, "id" | "name" | "category" | "priceCents" | "priceType" | "priceMaxCents" | "durationMinutes">;
  priceFrom: number | null;
  rating: Rating | null;
  slots: Slot[];
  /** The practice's today (YYYY-MM-DD), for the day labels on the card. */
  today: string;
  /** Score and the reasons shown under "Why am I seeing this?". */
  rank: RankResult;
};

/**
 * Marketplace search: listed practitioners matching the filters, each with real next-available
 * slots for the featured treatment, ordered by the transparent ranking (src/lib/ranking.ts).
 */
export async function searchPractitioners(params: SearchParams): Promise<SearchResult[]> {
  const now = params.now ?? new Date();
  const q = params.q?.trim().toLowerCase();
  const city = params.city?.trim().toLowerCase();
  const locale = params.locale;

  const rows = await db
    .select({ practitioner: practitioners, org: organizations })
    .from(practitioners)
    .innerJoin(organizations, eq(organizations.id, practitioners.orgId))
    .where(and(listedPractitioner(), eq(organizations.listed, true), isNull(organizations.closureRequestedAt)));

  const people = rows.filter(({ practitioner: p }) => {
    // The marketplace finds a dentist for a first visit: someone who takes no new patients can't
    // be booked from here (createAppointment refuses it). Their own patients book on the practice page.
    if (!p.acceptsNewPatients) return false;
    if (params.lang && !(p.spokenLanguages ?? []).includes(params.lang)) return false;
    if (params.anxiety && !p.careOptions?.anxiousPatients) return false;
    if (params.sedation && !p.careOptions?.sedation) return false;
    return true;
  });
  if (!people.length) return [];
  const pIds = people.map((r) => r.practitioner.id);
  const orgIds = [...new Set(people.map((r) => r.org.id))];

  const [links, scheduleLocs, orgServices, ratings, fundLinks] = await Promise.all([
    db.select().from(practitionerServices).where(inArray(practitionerServices.practitionerId, pIds)),
    db
      .selectDistinct({ practitionerId: schedules.practitionerId, location: locations })
      .from(schedules)
      .innerJoin(locations, eq(locations.id, schedules.locationId))
      .where(and(inArray(schedules.practitionerId, pIds), eq(locations.active, true))),
    db
      .select()
      .from(services)
      .where(and(inArray(services.orgId, orgIds), eq(services.active, true), eq(services.onlineBookable, true)))
      .orderBy(asc(services.sortOrder)),
    getRatings(pIds),
    params.fund
      ? db
          .select({ orgId: orgFunds.orgId, serviceIds: orgFunds.serviceIds, name: funds.name })
          .from(orgFunds)
          .innerJoin(funds, eq(funds.id, orgFunds.fundId))
          .where(and(eq(funds.slug, params.fund), inArray(orgFunds.orgId, orgIds)))
      : Promise.resolve([]),
  ]);
  const serviceById = new Map(orgServices.map((s) => [s.id, s]));
  const fundByOrg = new Map(fundLinks.map((f) => [f.orgId, f]));
  const serviceName = (s: Service) => (locale && s.nameI18n?.[locale]?.trim()) || s.name;
  const priceOk = (s: Service) =>
    (!params.priceType || s.priceType === params.priceType) &&
    (params.maxPriceCents == null || (s.priceCents != null && s.priceCents <= params.maxPriceCents));

  const candidates = people.flatMap(({ practitioner, org }) => {
    const offered = links
      .filter((l) => l.practitionerId === practitioner.id)
      .map((l) => serviceById.get(l.serviceId))
      .filter((s): s is Service => Boolean(s));
    const allLocs = scheduleLocs
      .filter((s) => s.practitionerId === practitioner.id)
      .map((s) => s.location)
      .filter((l, i, arr) => arr.findIndex((x) => x.id === l.id) === i);
    const locs = city ? allLocs.filter((l) => l.city.toLowerCase() === city) : allLocs;
    if (!offered.length || !locs.length) return [];
    if (params.access?.length && !locs.some((l) => params.access!.every((f) => l.accessibility?.[f] === true))) return [];
    if (params.children && !practitioner.careOptions?.children && !offered.some((s) => s.category === "pediatric")) return [];
    let inScope = params.category ? offered.filter((s) => s.category === params.category) : offered;
    if (params.fund) {
      const f = fundByOrg.get(org.id);
      if (!f) return [];
      if (f.serviceIds) inScope = inScope.filter((s) => f.serviceIds!.includes(s.id));
    }
    inScope = inScope.filter(priceOk);
    if (!inScope.length) return [];
    if (q) {
      const haystack = [practitioner.name, practitioner.specialty, org.name, ...offered.flatMap((s) => [s.name, serviceName(s)])]
        .join(" ")
        .toLowerCase();
      if (!q.split(/\s+/).every((word) => haystack.includes(word))) return [];
    }
    const accessLocs = params.access?.length ? locs.filter((l) => params.access!.every((f) => l.accessibility?.[f] === true)) : locs;
    return [{ practitioner, org, offered, inScope, locs: accessLocs }];
  });
  if (!candidates.length) return [];

  const [reliability, mean] = await Promise.all([reliabilitySignals(candidates.map((c) => c.practitioner.id), now), globalMeanRating()]);

  const items = await Promise.all(
    candidates.map(async ({ practitioner, org, offered, inScope, locs }) => {
      const matchingText = q ? inScope.filter((s) => serviceName(s).toLowerCase().includes(q) || s.name.toLowerCase().includes(q)) : [];
      const featured = matchingText[0] ?? inScope.find((s) => s.category === "checkup") ?? inScope[0];
      const avail = await getAvailability({
        orgId: org.id,
        serviceId: featured.id,
        practitionerIds: [practitioner.id],
        locationId: locs.length === 1 ? locs[0].id : undefined,
        fromDate: todayIn(org.timezone, now),
        days: params.days ?? 7,
        timezone: org.timezone,
        now,
      });
      const slots = (avail?.slots ?? []).filter((s) => locs.some((l) => l.id === s.locationId));
      const prices = inScope.map((s) => s.priceCents).filter((p): p is number => p != null);
      const rating = ratings.get(practitioner.id) ?? null;
      const rel = reliability.get(practitioner.id) ?? { rate: 0, sample: 0 };
      const input: RankInput = {
        practitionerId: practitioner.id,
        orgId: org.id,
        soonestSlotAt: slots[0]?.start ?? null,
        ratingSum: rating ? rating.average * rating.count : 0,
        ratingCount: rating?.count ?? 0,
        staffCancelRate180d: rel.rate,
        reliabilitySample: rel.sample,
        profileCompleteness: profileCompleteness({
          bio: practitioner.bio,
          spokenLanguages: practitioner.spokenLanguages ?? [],
          alboVerifiedAt: practitioner.alboVerifiedAt,
          careOptions: practitioner.careOptions ?? {},
          locations: locs,
          services: offered,
        }),
        cityMatch: Boolean(city),
        distanceKm: null,
      };
      return { input, practitioner, org, locs, featured, slots, prices, rating };
    }),
  );

  const ranked = rankResults(items, { globalMeanRating: mean, now, seed: daySeed(now) }, { urgent: params.urgent });
  return ranked.map(({ rank, practitioner, org, locs, featured, slots, prices, rating }) => {
    // The filters the result matched come first among the reasons.
    const matched: RankReason[] = [];
    if (params.lang) matched.push({ key: "language", value: params.lang });
    const fund = params.fund ? fundByOrg.get(org.id) : undefined;
    if (fund) matched.push({ key: "fund", value: fund.name });
    return {
      org: { id: org.id, slug: org.slug, name: org.name, timezone: org.timezone, brandColor: org.brandColor },
      practitioner: {
        id: practitioner.id,
        slug: practitioner.slug,
        title: practitioner.title,
        name: practitioner.name,
        specialty: practitioner.specialty,
        color: practitioner.color,
        acceptsNewPatients: practitioner.acceptsNewPatients,
        spokenLanguages: practitioner.spokenLanguages ?? [],
        careOptions: practitioner.careOptions ?? {},
        alboVerified: practitioner.alboVerifiedAt != null,
      },
      locations: locs.map((l) => ({ id: l.id, name: l.name, address: l.address, city: l.city, accessibility: l.accessibility ?? {} })),
      featuredService: {
        id: featured.id,
        name: serviceName(featured),
        category: featured.category,
        priceCents: featured.priceCents,
        priceType: featured.priceType,
        priceMaxCents: featured.priceMaxCents,
        durationMinutes: featured.durationMinutes,
      },
      priceFrom: prices.length ? Math.min(...prices) : null,
      rating,
      slots,
      today: todayIn(org.timezone, now),
      rank: { score: rank.score, reasons: [...matched, ...rank.reasons] },
    } satisfies SearchResult;
  });
}

// ---------------------------------------------------------------- profile statistics

/** Crawlers, link previewers, monitors and scripts: they don't count as views. */
const BOT_UA =
  /bot\b|bot\/|crawl|spider|slurp|preview|facebookexternalhit|facebot|whatsapp|telegram|skype|discord|embedly|headless|lighthouse|pingdom|uptime|monitor|curl\/|wget|python|httpclient|java\/|go-http|axios|node-fetch|undici|okhttp|libwww|scrapy|feedfetcher|mediapartners/i;

/** True for requests that must not count: bots (or no user agent at all) and router prefetches. */
export function isAutomatedRequest(h: Pick<Headers, "get" | "has">): boolean {
  const ua = h.get("user-agent") ?? "";
  if (!ua.trim() || BOT_UA.test(ua)) return true;
  const purpose = `${h.get("purpose") ?? ""} ${h.get("sec-purpose") ?? ""}`.toLowerCase();
  return purpose.includes("prefetch") || h.has("next-router-prefetch") || h.has("x-middleware-prefetch");
}

/**
 * Count marketplace views of profile pages and appearances in search results, per practitioner
 * and day (profile_stats). Server-side, no cookie or identifier: only a daily counter, and
 * automated requests are skipped. Never throws.
 */
export async function recordProfileStats(
  kind: "views" | "searchImpressions",
  practitionerIds: readonly string[],
  h: Pick<Headers, "get" | "has">,
  now: Date = new Date(),
): Promise<boolean> {
  const ids = [...new Set(practitionerIds)];
  if (!ids.length || isAutomatedRequest(h)) return false;
  const day = todayIn("Europe/Rome", now);
  const column = kind === "views" ? profileStats.views : profileStats.searchImpressions;
  try {
    await db
      .insert(profileStats)
      .values(ids.map((practitionerId) => ({ practitionerId, day, views: kind === "views" ? 1 : 0, searchImpressions: kind === "views" ? 0 : 1 })))
      .onConflictDoUpdate({ target: [profileStats.practitionerId, profileStats.day], set: { [kind]: sql`${column} + 1` } });
    return true;
  } catch (err) {
    logError("profile-stats", err, { kind, count: ids.length }); // statistics must never break a page
    return false;
  }
}

export async function countPatients(orgId: string) {
  const [row] = await db.select({ n: count() }).from(patients).where(eq(patients.orgId, orgId));
  return row?.n ?? 0;
}
