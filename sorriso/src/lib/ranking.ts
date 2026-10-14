import { and, avg, count, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  appointments,
  locations,
  practitionerServices,
  practitioners,
  reviews,
  schedules,
  services,
  type LocationAccessibility,
  type PractitionerCareOptions,
  type PriceType,
} from "@/db/schema";
import { getAvailability } from "./availability";
import { todayIn } from "./time";

/**
 * Marketplace ranking (WP7). Transparent by design, in the spirit of the EU P2B Regulation
 * (2019/1150, Art. 5): the main parameters and their relative weight are published on
 * /legal/ranking, every result carries the reasons it ranks where it does, and nobody can pay for
 * position. Ranking reads only the fields of RankInput: never a plan, a subscription, billing
 * data or anything else about the practice's commercial relationship with Sorriso.
 *
 * The score is a weighted sum of five signals, each normalised to 0..1:
 *
 *   soonest       30%  how soon the searched treatment can be booked online
 *   rating        30%  Bayesian average of published verified reviews: (C*m + sum) / (C + n),
 *                      C = 5 and m the platform-wide mean, so one 5-star review can't beat
 *                      200 reviews averaging 4.8
 *   location      15%  in the searched city, or the distance from the searched point
 *   reliability   15%  1 - the share of appointments the practice cancelled itself (180 days)
 *   completeness  10%  how much of the public profile is filled in
 *
 * Equal scores are ordered by a hash of (day, practitioner): stable within a day, rotating from
 * one day to the next, so no one sits permanently on top of a tie.
 *
 * The cancellation rate and profile completeness are computed from the practice's data for
 * Sorriso's own purpose (ranking the marketplace): they are aggregate counts, never patient
 * records, and are listed as Sorriso-controller processing in docs/marketplace.md.
 */

/** What ranking knows about one practitioner for one search. [fields may only be added] */
export type RankInput = {
  practitionerId: string;
  orgId: string;
  /** Soonest bookable slot for the searched service; null when none in the search window. */
  soonestSlotAt: Date | null;
  /** Sum and count of published ratings (1-5), for the Bayesian average. */
  ratingSum: number;
  ratingCount: number;
  /** Share (0-1) of the appointments the practice itself cancelled over the last 180 days. */
  staffCancelRate180d: number;
  /** Share (0-1) of the public profile filled in. */
  profileCompleteness: number;
  /** The practice is in the searched city. */
  cityMatch: boolean;
  /** Distance from the searched point; null without one. */
  distanceKm: number | null;
  /**
   * How many appointments the cancellation rate is based on. Below RELIABILITY_MIN_SAMPLE the
   * rate still counts (it is 0 or the practice-wide rate) but is not shown as a reason.
   */
  reliabilitySample?: number;
};

export type RankContext = {
  /** Mean of all published ratings (m in the Bayesian average). */
  globalMeanRating: number;
  now: Date;
  /** Rotation seed for ties, e.g. the date: stable within a day, different across days. */
  seed: string;
};

/** Why a result ranks where it does; `key` maps to marketplace.rank.<key>. */
export type RankReason = {
  key: "soonest" | "rating" | "reliability" | "completeness" | "distance" | "language" | "fund";
  /** A language-neutral detail: the weighted rating, a distance in km, a language code or a fund name. */
  value?: string | number;
};

export type RankResult = { score: number; reasons: RankReason[] };

/** C in the Bayesian average: how many "average" reviews every practitioner starts with. */
export const BAYES_C = 5;
/** m when the platform has no published review yet. */
export const DEFAULT_MEAN_RATING = 4;
/** Below this many appointments in 180 days the cancellation rate is not shown as a reason. */
export const RELIABILITY_MIN_SAMPLE = 10;
export const RELIABILITY_DAYS = 180;

/** The published weights (also rendered on /legal/ranking). They sum to 1. */
export const RANK_WEIGHTS = { soonest: 0.3, rating: 0.3, location: 0.15, reliability: 0.15, completeness: 0.1 } as const;

const DAY_MS = 86_400_000;
const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

/** (C*m + sum) / (C + n): the rating shrunk towards the platform mean while reviews are few. */
export function bayesianRating(sum: number, n: number, mean: number, c: number = BAYES_C): number {
  return (c * mean + sum) / (c + n);
}

/** 1 for a slot within a day, 0.5 at 3 days, ~0.2 at two weeks; 0 without a slot. */
export function soonestScore(soonest: Date | null, now: Date): number {
  if (!soonest) return 0;
  const days = Math.max(0, (soonest.getTime() - now.getTime()) / DAY_MS - 1);
  return clamp01(1 / (1 + days / 2));
}

/** 1 in the searched city or within 2 km, falling to 0 at 30 km; 0 when nothing was searched. */
export function locationScore(r: Pick<RankInput, "cityMatch" | "distanceKm">): number {
  if (r.distanceKm != null) return clamp01(1 - Math.max(0, r.distanceKm - 2) / 28);
  return r.cityMatch ? 1 : 0;
}

/**
 * Score one result; higher ranks first. Reads only the RankInput fields named here, so nothing
 * else about the practice (its settings, a plan, billing) can move it.
 */
export function scoreResult(r: RankInput, ctx: RankContext): RankResult {
  const mean = ctx.globalMeanRating > 0 ? ctx.globalMeanRating : DEFAULT_MEAN_RATING;
  const weighted = bayesianRating(r.ratingSum, r.ratingCount, mean);
  const signals = {
    soonest: soonestScore(r.soonestSlotAt, ctx.now),
    rating: clamp01((weighted - 1) / 4),
    location: locationScore(r),
    reliability: clamp01(1 - r.staffCancelRate180d),
    completeness: clamp01(r.profileCompleteness),
  };
  const score =
    RANK_WEIGHTS.soonest * signals.soonest +
    RANK_WEIGHTS.rating * signals.rating +
    RANK_WEIGHTS.location * signals.location +
    RANK_WEIGHTS.reliability * signals.reliability +
    RANK_WEIGHTS.completeness * signals.completeness;

  // The factors that actually lift this result, strongest first (at most three).
  const candidates: { reason: RankReason; weight: number }[] = [];
  if (signals.soonest >= 0.5) candidates.push({ reason: { key: "soonest" }, weight: RANK_WEIGHTS.soonest * signals.soonest });
  if (r.ratingCount > 0 && weighted >= Math.max(mean, 4)) {
    candidates.push({ reason: { key: "rating", value: Math.round(weighted * 10) / 10 }, weight: RANK_WEIGHTS.rating * signals.rating });
  }
  if (signals.location >= 0.6) {
    const value = r.distanceKm != null ? Math.round(r.distanceKm * 10) / 10 : undefined;
    candidates.push({ reason: value === undefined ? { key: "distance" } : { key: "distance", value }, weight: RANK_WEIGHTS.location * signals.location });
  }
  if ((r.reliabilitySample ?? RELIABILITY_MIN_SAMPLE) >= RELIABILITY_MIN_SAMPLE && r.staffCancelRate180d <= 0.05) {
    candidates.push({ reason: { key: "reliability" }, weight: RANK_WEIGHTS.reliability * signals.reliability });
  }
  if (signals.completeness >= 0.8) candidates.push({ reason: { key: "completeness" }, weight: RANK_WEIGHTS.completeness * signals.completeness });
  const reasons = candidates
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3)
    .map((c) => c.reason);
  return { score: Math.round(score * 1e9) / 1e9, reasons };
}

/** FNV-1a: a stable 32-bit hash for the daily tie rotation (not for security). */
export function tieBreaker(seed: string, practitionerId: string): number {
  let h = 0x811c9dc5;
  const s = `${seed}|${practitionerId}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Score and order results. `urgent` puts the soonest slot first (score breaks ties there);
 * otherwise the score decides, and equal scores rotate by day.
 */
export function rankResults<T extends { input: RankInput }>(
  items: readonly T[],
  ctx: RankContext,
  opts: { urgent?: boolean } = {},
): (T & { rank: RankResult })[] {
  const scored = items.map((item) => ({ ...item, rank: scoreResult(item.input, ctx), tie: tieBreaker(ctx.seed, item.input.practitionerId) }));
  const soonest = (x: (typeof scored)[number]) => x.input.soonestSlotAt?.getTime() ?? Number.POSITIVE_INFINITY;
  scored.sort((a, b) => {
    if (opts.urgent && soonest(a) !== soonest(b)) return soonest(a) - soonest(b);
    return b.rank.score - a.rank.score || a.tie - b.tie;
  });
  return scored.map(({ tie: _tie, ...rest }) => rest as unknown as T & { rank: RankResult });
}

/** The day's rotation seed (Europe/Rome calendar day). */
export function daySeed(now: Date = new Date()): string {
  return todayIn("Europe/Rome", now);
}

// ---------------------------------------------------------------- inputs from the database

/** What the profile-completeness signal looks at. */
export type CompletenessInput = {
  bio: string | null;
  spokenLanguages: readonly string[];
  alboVerifiedAt: Date | null;
  careOptions: PractitionerCareOptions;
  locations: { accessibility: LocationAccessibility }[];
  services: { priceCents: number | null; priceType: PriceType }[];
};

/**
 * Share of six profile items filled in: a bio of a few lines, spoken languages, a verified Albo
 * registration, declared care options, accessibility details for every office, and a price (or
 * "quote after a visit") for every treatment offered.
 */
export function profileCompleteness(p: CompletenessInput): number {
  const items = [
    (p.bio ?? "").trim().length >= 40,
    p.spokenLanguages.length > 0,
    p.alboVerifiedAt != null,
    Object.keys(p.careOptions ?? {}).length > 0,
    p.locations.length > 0 && p.locations.every((l) => Object.keys(l.accessibility ?? {}).length > 0),
    p.services.length > 0 && p.services.every((s) => s.priceCents != null || s.priceType === "quote"),
  ];
  return items.filter(Boolean).length / items.length;
}

/** The mean of every published rating on the platform (m), or DEFAULT_MEAN_RATING without any. */
export async function globalMeanRating(): Promise<number> {
  const [row] = await db.select({ mean: avg(reviews.rating), n: count() }).from(reviews).where(eq(reviews.status, "published"));
  return row && row.n > 0 ? Number(row.mean) : DEFAULT_MEAN_RATING;
}

export type ReliabilitySignal = { rate: number; sample: number };

/**
 * Staff-cancellation rate over the last 180 days per practitioner. A practitioner with fewer
 * than RELIABILITY_MIN_SAMPLE appointments gets the practice-wide rate (and that sample size).
 * Counts only: no patient data is read.
 */
export async function reliabilitySignals(practitionerIds: readonly string[], now: Date = new Date()): Promise<Map<string, ReliabilitySignal>> {
  const out = new Map<string, ReliabilitySignal>();
  if (!practitionerIds.length) return out;
  const from = new Date(now.getTime() - RELIABILITY_DAYS * DAY_MS);
  const staffCancelled = sql<number>`sum(case when ${appointments.status} = 'cancelled' and ${appointments.cancelledBy} = 'staff' then 1 else 0 end)`;
  const rows = await db
    .select({ practitionerId: appointments.practitionerId, orgId: appointments.orgId, total: count(), cancelled: staffCancelled })
    .from(appointments)
    .where(
      and(
        inArray(appointments.practitionerId, [...practitionerIds]),
        gte(appointments.startsAt, from),
        lte(appointments.startsAt, now),
        sql`${appointments.status} <> 'requested'`,
      ),
    )
    .groupBy(appointments.practitionerId, appointments.orgId);
  const byOrg = new Map<string, { total: number; cancelled: number }>();
  for (const r of rows) {
    const o = byOrg.get(r.orgId) ?? { total: 0, cancelled: 0 };
    o.total += r.total;
    o.cancelled += Number(r.cancelled ?? 0);
    byOrg.set(r.orgId, o);
  }
  const orgOf = new Map(rows.map((r) => [r.practitionerId, r.orgId]));
  for (const id of practitionerIds) {
    const own = rows.find((r) => r.practitionerId === id);
    if (own && own.total >= RELIABILITY_MIN_SAMPLE) {
      out.set(id, { rate: Number(own.cancelled ?? 0) / own.total, sample: own.total });
      continue;
    }
    const org = byOrg.get(orgOf.get(id) ?? "");
    out.set(id, org && org.total > 0 ? { rate: org.cancelled / org.total, sample: org.total } : { rate: 0, sample: 0 });
  }
  return out;
}

/**
 * The org's practitioners as ranking sees them, for the practice's own "your ranking inputs"
 * view (WP2's analytics). One entry per active practitioner. The search-dependent inputs are
 * neutral (no city, no distance); the soonest slot is for their first-visit treatment (a
 * check-up when they offer one), over the next 14 days.
 */
export async function buildRankInputs(orgId: string, now: Date = new Date()): Promise<RankInput[]> {
  const team = await db
    .select()
    .from(practitioners)
    .where(and(eq(practitioners.orgId, orgId), eq(practitioners.active, true)));
  if (!team.length) return [];
  const ids = team.map((p) => p.id);
  const [ratings, offered, workplaces, reliability] = await Promise.all([
    db
      .select({
        practitionerId: reviews.practitionerId,
        sum: sql<number>`coalesce(sum(${reviews.rating}), 0)`,
        n: count(),
      })
      .from(reviews)
      .where(and(inArray(reviews.practitionerId, ids), eq(reviews.status, "published")))
      .groupBy(reviews.practitionerId),
    db
      .select({ practitionerId: practitionerServices.practitionerId, service: services })
      .from(practitionerServices)
      .innerJoin(services, eq(services.id, practitionerServices.serviceId))
      .where(and(inArray(practitionerServices.practitionerId, ids), eq(services.active, true), eq(services.onlineBookable, true))),
    db
      .selectDistinct({ practitionerId: schedules.practitionerId, locationId: locations.id, accessibility: locations.accessibility, timezone: locations.timezone })
      .from(schedules)
      .innerJoin(locations, eq(locations.id, schedules.locationId))
      .where(and(inArray(schedules.practitionerId, ids), eq(locations.active, true))),
    reliabilitySignals(ids, now),
  ]);

  return Promise.all(
    team.map(async (p) => {
      const rating = ratings.find((r) => r.practitionerId === p.id);
      const svcs = offered.filter((o) => o.practitionerId === p.id).map((o) => o.service);
      const locs = workplaces.filter((w) => w.practitionerId === p.id);
      const featured = svcs.find((s) => s.category === "checkup") ?? svcs[0];
      let soonestSlotAt: Date | null = null;
      if (featured && locs.length) {
        const tz = locs[0].timezone;
        const avail = await getAvailability({ orgId, serviceId: featured.id, practitionerIds: [p.id], fromDate: todayIn(tz, now), days: 14, timezone: tz, now });
        soonestSlotAt = avail?.slots[0]?.start ?? null;
      }
      const rel = reliability.get(p.id) ?? { rate: 0, sample: 0 };
      return {
        practitionerId: p.id,
        orgId,
        soonestSlotAt,
        ratingSum: Number(rating?.sum ?? 0),
        ratingCount: Number(rating?.n ?? 0),
        staffCancelRate180d: rel.rate,
        reliabilitySample: rel.sample,
        profileCompleteness: profileCompleteness({
          bio: p.bio,
          spokenLanguages: p.spokenLanguages,
          alboVerifiedAt: p.alboVerifiedAt,
          careOptions: p.careOptions,
          locations: locs,
          services: svcs,
        }),
        cityMatch: false,
        distanceKm: null,
      } satisfies RankInput;
    }),
  );
}
