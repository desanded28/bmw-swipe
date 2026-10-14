import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { appointments, locations, organizations, patients, practitioners, reviews, type StoredOrgSettings } from "@/db/schema";
import EN from "@/i18n/messages/en/marketplace";
import { createPractice, NOW } from "@/test/fixtures";
import { searchPractitioners } from "./directory";
import { newId } from "./ids";
import {
  bayesianRating,
  buildRankInputs,
  daySeed,
  profileCompleteness,
  RANK_WEIGHTS,
  rankResults,
  reliabilitySignals,
  scoreResult,
  tieBreaker,
  type RankContext,
  type RankInput,
  type RankReason,
} from "./ranking";

const ctx: RankContext = { globalMeanRating: 4.3, now: NOW, seed: "2030-03-01" };

function input(over: Partial<RankInput> = {}): RankInput {
  return {
    practitionerId: newId(),
    orgId: "org",
    soonestSlotAt: new Date(NOW.getTime() + 2 * 86_400_000),
    ratingSum: 0,
    ratingCount: 0,
    staffCancelRate180d: 0.02,
    profileCompleteness: 0.5,
    cityMatch: true,
    distanceKm: null,
    reliabilitySample: 40,
    ...over,
  };
}

const ALL_REASON_KEYS: RankReason["key"][] = ["soonest", "rating", "reliability", "completeness", "distance", "language", "fund"];

describe("scoreResult", () => {
  it("ranks one 5-star review below 200 reviews averaging 4.8 (Bayesian average, C = 5)", () => {
    const one = input({ ratingSum: 5, ratingCount: 1 });
    const many = input({ ratingSum: 4.8 * 200, ratingCount: 200 });
    expect(bayesianRating(5, 1, 4.3)).toBeCloseTo((5 * 4.3 + 5) / 6, 9);
    expect(scoreResult(many, ctx).score).toBeGreaterThan(scoreResult(one, ctx).score);
    const order = rankResults([{ input: one }, { input: many }], ctx).map((r) => r.input.practitionerId);
    expect(order).toEqual([many.practitionerId, one.practitionerId]);
  });

  it("weights sum to 1 and every signal moves the score the right way", () => {
    expect(Object.values(RANK_WEIGHTS).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
    const base = scoreResult(input(), ctx).score;
    expect(scoreResult(input({ soonestSlotAt: null }), ctx).score).toBeLessThan(base);
    expect(scoreResult(input({ staffCancelRate180d: 0.4 }), ctx).score).toBeLessThan(base);
    expect(scoreResult(input({ profileCompleteness: 1 }), ctx).score).toBeGreaterThan(base);
    expect(scoreResult(input({ cityMatch: false }), ctx).score).toBeLessThan(base);
    expect(scoreResult(input({ cityMatch: false, distanceKm: 1 }), ctx).score).toBeGreaterThan(scoreResult(input({ cityMatch: false, distanceKm: 25 }), ctx).score);
  });

  it("only reads ranking inputs: a plan, billing or settings field changes nothing", () => {
    const plain = input({ ratingSum: 40, ratingCount: 9 });
    const premium = { ...plain, plan: "premium", billing: { paid: true }, settings: { boost: 10 } } as unknown as RankInput;
    expect(scoreResult(premium, ctx)).toEqual(scoreResult(plain, ctx));
  });

  it("returns at most three reasons, all with a text in the marketplace namespace", () => {
    const rich = scoreResult(input({ ratingSum: 4.9 * 50, ratingCount: 50, profileCompleteness: 1, soonestSlotAt: NOW, staffCancelRate180d: 0 }), ctx);
    expect(rich.reasons.length).toBeGreaterThan(0);
    expect(rich.reasons.length).toBeLessThanOrEqual(3);
    const samples = [
      rich,
      scoreResult(input({ cityMatch: false, distanceKm: 1 }), ctx),
      scoreResult(input({ soonestSlotAt: null, cityMatch: false, profileCompleteness: 1, staffCancelRate180d: 0 }), ctx),
      scoreResult(input({ soonestSlotAt: null, cityMatch: false, staffCancelRate180d: 1, profileCompleteness: 0 }), ctx),
    ];
    for (const r of samples.flatMap((s) => s.reasons)) {
      expect(ALL_REASON_KEYS).toContain(r.key);
      expect(EN.rank).toHaveProperty(r.key);
    }
    for (const key of ALL_REASON_KEYS) expect(typeof EN.rank[key]).toBe("string");
    // A rating reason carries the weighted score, rounded.
    expect(rich.reasons.find((r) => r.key === "rating")?.value).toBe(Math.round(bayesianRating(4.9 * 50, 50, 4.3) * 10) / 10);
  });

  it("doesn't call a practice reliable on too few appointments", () => {
    const fresh = scoreResult(input({ staffCancelRate180d: 0, reliabilitySample: 3, soonestSlotAt: null, cityMatch: false }), ctx);
    expect(fresh.reasons.map((r) => r.key)).not.toContain("reliability");
  });
});

describe("rankResults", () => {
  const twins = Array.from({ length: 6 }, (_, i) => ({ input: input({ practitionerId: `p${i}`, soonestSlotAt: null }) }));

  it("breaks ties with a rotation that is stable within a day", () => {
    const a = rankResults(twins, { ...ctx, seed: "2030-03-01" }).map((r) => r.input.practitionerId);
    const b = rankResults(twins, { ...ctx, seed: "2030-03-01" }).map((r) => r.input.practitionerId);
    expect(a).toEqual(b);
    expect([...a].sort()).toEqual(twins.map((t) => t.input.practitionerId).sort());
  });

  it("rotates ties from one day to the next", () => {
    const firsts = new Set(
      Array.from({ length: 14 }, (_, d) => rankResults(twins, { ...ctx, seed: `2030-03-${String(d + 1).padStart(2, "0")}` })[0].input.practitionerId),
    );
    expect(firsts.size).toBeGreaterThan(1);
    expect(tieBreaker("2030-03-01", "p1")).toBe(tieBreaker("2030-03-01", "p1"));
  });

  it("never lets the tie-break beat a real score difference", () => {
    const better = { input: input({ practitionerId: "zz-better", profileCompleteness: 0.6, soonestSlotAt: null }) };
    for (let d = 1; d <= 10; d++) {
      expect(rankResults([...twins, better], { ...ctx, seed: `2030-04-${d}` })[0].input.practitionerId).toBe("zz-better");
    }
  });

  it("puts the soonest slot first for urgent searches", () => {
    const late = { input: input({ ratingSum: 5 * 300, ratingCount: 300, soonestSlotAt: new Date(NOW.getTime() + 6 * 86_400_000) }) };
    const soon = { input: input({ soonestSlotAt: new Date(NOW.getTime() + 3_600_000) }) };
    const none = { input: input({ soonestSlotAt: null }) };
    const order = rankResults([late, none, soon], ctx, { urgent: true }).map((r) => r.input.practitionerId);
    expect(order).toEqual([soon.input.practitionerId, late.input.practitionerId, none.input.practitionerId]);
  });

  it("uses the Rome calendar day as the seed", () => {
    expect(daySeed(new Date("2030-03-01T23:30:00Z"))).toBe("2030-03-02");
  });
});

describe("profileCompleteness", () => {
  it("counts six profile items", () => {
    const full = {
      bio: "Graduated in Milan, general and conservative dentistry for adults and children.",
      spokenLanguages: ["it", "en"],
      alboVerifiedAt: NOW,
      careOptions: { children: true },
      locations: [{ accessibility: { stepFree: true } }],
      services: [{ priceCents: 5000, priceType: "fixed" as const }, { priceCents: null, priceType: "quote" as const }],
    };
    expect(profileCompleteness(full)).toBe(1);
    expect(profileCompleteness({ ...full, bio: null, spokenLanguages: [], alboVerifiedAt: null })).toBe(0.5);
    expect(profileCompleteness({ ...full, services: [{ priceCents: null, priceType: "fixed" }] })).toBeCloseTo(5 / 6, 9);
  });
});

// ---------------------------------------------------------------- from the database

let p: Awaited<ReturnType<typeof createPractice>>;

async function visit(
  practitionerId: string,
  status: "completed" | "cancelled",
  cancelledBy: "staff" | "patient" | null = null,
  daysAgo = 10,
  practice: Awaited<ReturnType<typeof createPractice>> = p,
) {
  const patientId = newId();
  const appointmentId = newId();
  const at = new Date(Date.now() - daysAgo * 86_400_000);
  await db.insert(patients).values({ id: patientId, orgId: practice.orgId, firstName: "Luca", lastName: "Neri" });
  await db.insert(appointments).values({
    id: appointmentId,
    orgId: practice.orgId,
    locationId: practice.milano,
    practitionerId,
    serviceId: practice.visit,
    patientId,
    startsAt: at,
    endsAt: at,
    blockedUntil: at,
    status,
    cancelledBy,
    source: "staff",
    manageToken: `h:${appointmentId}`,
  });
  return appointmentId;
}

async function review(practitionerId: string, rating: number, status: "published" | "under_review") {
  const appointmentId = await visit(practitionerId, "completed");
  await db.insert(reviews).values({ id: newId(), orgId: p.orgId, practitionerId, appointmentId, rating, authorName: "Verified patient", status });
}

beforeAll(async () => {
  p = await createPractice();
});

describe("buildRankInputs", () => {
  it("reads published ratings, the staff-cancellation rate and profile completeness", async () => {
    await review(p.drB, 4, "published");
    await review(p.drB, 2, "published");
    await review(p.drB, 5, "under_review");
    // Dr. C: 12 appointments in 180 days, 3 cancelled by the practice, 2 by patients (not counted).
    for (let i = 0; i < 7; i++) await visit(p.drC, "completed");
    for (let i = 0; i < 3; i++) await visit(p.drC, "cancelled", "staff");
    for (let i = 0; i < 2; i++) await visit(p.drC, "cancelled", "patient");
    await visit(p.drC, "cancelled", "staff", 400); // outside the window
    await db
      .update(practitioners)
      .set({ bio: "Graduated in Milan; general dentistry and prevention for the whole family.", spokenLanguages: ["it", "en"] })
      .where(eq(practitioners.id, p.drA));

    const inputs = await buildRankInputs(p.orgId);
    expect(inputs.map((i) => i.practitionerId).sort()).toEqual([p.drA, p.drB, p.drC].sort());
    const b = inputs.find((i) => i.practitionerId === p.drB)!;
    expect(b).toMatchObject({ orgId: p.orgId, ratingSum: 6, ratingCount: 2, cityMatch: false, distanceKm: null });
    const c = inputs.find((i) => i.practitionerId === p.drC)!;
    expect(c.staffCancelRate180d).toBeCloseTo(3 / 12, 9);
    expect(c.reliabilitySample).toBe(12);
    const a = inputs.find((i) => i.practitionerId === p.drA)!;
    // bio, languages and priced treatments; no Albo check, care options or office accessibility yet.
    expect(a.profileCompleteness).toBeCloseTo(3 / 6, 9);
    expect(a.soonestSlotAt).toBeInstanceOf(Date);
    expect(await buildRankInputs("no-such-org")).toEqual([]);
  });

  it("gives a practitioner with few or no appointments the practice-wide rate, over all of the practice's appointments", async () => {
    const q = await createPractice();
    // Dr. A: 20 appointments, half cancelled by the practice. Dr. C: 3 completed. Dr. B: none.
    for (let i = 0; i < 10; i++) await visit(q.drA, "completed", null, 10, q);
    for (let i = 0; i < 10; i++) await visit(q.drA, "cancelled", "staff", 10, q);
    for (let i = 0; i < 3; i++) await visit(q.drC, "completed", null, 10, q);
    const practiceWide = { rate: 10 / 23, sample: 23 };
    // Asked about Dr. B alone (e.g. the only search candidate): still the whole practice's rate, not a perfect record.
    expect((await reliabilitySignals([q.drB])).get(q.drB)).toEqual(practiceWide);
    const all = await reliabilitySignals([q.drA, q.drB, q.drC]);
    expect(all.get(q.drA)).toEqual({ rate: 0.5, sample: 20 });
    expect(all.get(q.drB)).toEqual(practiceWide);
    expect(all.get(q.drC)).toEqual(practiceWide);
    // A practice with no appointments at all: no signal either way.
    const empty = await createPractice();
    expect((await reliabilitySignals([empty.drA])).get(empty.drA)).toEqual({ rate: 0, sample: 0 });
    expect(await reliabilitySignals([])).toEqual(new Map());
  });

  it("gives the same inputs and search order when non-ranking practice columns change", async () => {
    const q = await createPractice();
    await db.update(practitioners).set({ publicProfile: true, profileApprovedAt: NOW }).where(eq(practitioners.orgId, q.orgId));
    await db.update(locations).set({ city: "Rankville" }).where(eq(locations.orgId, q.orgId));
    const now = new Date();
    const before = await buildRankInputs(q.orgId, now);
    const searchBefore = await searchPractitioners({ city: "Rankville", now });

    const [org] = await db.select().from(organizations).where(eq(organizations.id, q.orgId));
    const settings = org.settings as StoredOrgSettings & { plan?: string };
    await db
      .update(organizations)
      .set({
        settings: { ...settings, plan: "premium", privacy: { ...settings.privacy, marketingEnabled: true } } as StoredOrgSettings,
        description: "Now with a premium plan",
        vatNumber: "IT01234567890",
      })
      .where(eq(organizations.id, q.orgId));

    expect(await buildRankInputs(q.orgId, now)).toEqual(before);
    const searchAfter = await searchPractitioners({ city: "Rankville", now });
    expect(searchAfter.map((r) => [r.practitioner.id, r.rank.score])).toEqual(searchBefore.map((r) => [r.practitioner.id, r.rank.score]));
  });
});
