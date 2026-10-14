import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { practitioners, reviews } from "@/db/schema";

/**
 * Marketplace ranking (WP7). Transparent by design (in the spirit of the EU P2B Regulation): the
 * main parameters are listed on /legal/ranking, every result carries the reasons it ranks where
 * it does, and nobody can pay for position: ranking never reads plan or billing data.
 */

/** What ranking knows about one practitioner for one search. */
export type RankInput = {
  practitionerId: string;
  orgId: string;
  /** Soonest bookable slot for the searched service; null when none in the search window. */
  soonestSlotAt: Date | null;
  /** Sum and count of published ratings (1-5), for the Bayesian average. */
  ratingSum: number;
  ratingCount: number;
  /** Share (0-1) of the practice's appointments cancelled by staff over the last 180 days. */
  staffCancelRate180d: number;
  /** Share (0-1) of the public profile filled in. */
  profileCompleteness: number;
  /** The practice is in the searched city. */
  cityMatch: boolean;
  /** Distance from the searched point; null without one. */
  distanceKm: number | null;
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
  /** A preformatted detail for the text, e.g. the rating or the distance. */
  value?: string | number;
};

export type RankResult = { score: number; reasons: RankReason[] };

/**
 * Score one result; higher ranks first. WP7 combines the soonest slot, the Bayesian rating
 * ((C*m + sum) / (C + n), C = 5), city match or distance, profile completeness and reliability
 * (1 - staffCancelRate180d), breaking ties with ctx.seed.
 *
 * STUB with its final signature (WP7): every result scores 0 with no reasons.
 */
export function scoreResult(r: RankInput, ctx: RankContext): RankResult {
  void r;
  void ctx;
  return { score: 0, reasons: [] };
}

/**
 * The org's practitioners as ranking sees them, for the practice's own "your ranking inputs"
 * view (WP2's analytics). One entry per active practitioner.
 *
 * STUB with its final signature (WP7): real published-rating sums; the other inputs are
 * neutral (no slot, no cancellations, empty profile, no location match).
 */
export async function buildRankInputs(orgId: string): Promise<RankInput[]> {
  const rows = await db
    .select({
      practitionerId: practitioners.id,
      ratingSum: sql<number>`coalesce(sum(${reviews.rating}), 0)`,
      ratingCount: sql<number>`count(${reviews.id})`,
    })
    .from(practitioners)
    .leftJoin(reviews, and(eq(reviews.practitionerId, practitioners.id), eq(reviews.status, "published")))
    .where(and(eq(practitioners.orgId, orgId), eq(practitioners.active, true)))
    .groupBy(practitioners.id);
  return rows.map((r) => ({
    practitionerId: r.practitionerId,
    orgId,
    soonestSlotAt: null,
    ratingSum: Number(r.ratingSum),
    ratingCount: Number(r.ratingCount),
    staffCancelRate180d: 0,
    profileCompleteness: 0,
    cityMatch: false,
    distanceKm: null,
  }));
}
