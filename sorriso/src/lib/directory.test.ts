import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { appointments, locations, orgFunds, patients, practitionerServices, practitioners, profileStats, reviews, services } from "@/db/schema";
import { createPractice, NOW } from "@/test/fixtures";
import {
  getPublicClinic,
  getPublicReviews,
  getRatingBreakdown,
  isAutomatedRequest,
  isReservedSlug,
  listFunds,
  recordProfileStats,
  searchPractitioners,
} from "./directory";
import { newId } from "./ids";

let p: Awaited<ReturnType<typeof createPractice>>;
let q: Awaited<ReturnType<typeof createPractice>>;
const CITY = "Testopoli";

const listed = { publicProfile: true, profileApprovedAt: NOW, marketplaceOptOutAt: null };

async function review(org: typeof p, practitionerId: string, rating: number, status: "published" | "under_review" = "published") {
  const patientId = newId();
  const appointmentId = newId();
  await db.insert(patients).values({ id: patientId, orgId: org.orgId, firstName: "Ada", lastName: "Neri" });
  await db.insert(appointments).values({
    id: appointmentId,
    orgId: org.orgId,
    locationId: org.milano,
    practitionerId,
    serviceId: org.visit,
    patientId,
    startsAt: NOW,
    endsAt: NOW,
    blockedUntil: NOW,
    status: "completed",
    source: "staff",
    manageToken: `h:${appointmentId}`,
  });
  await db.insert(reviews).values({ id: newId(), orgId: org.orgId, practitionerId, appointmentId, rating, authorName: "Verified patient", status, publishedAt: NOW });
}

beforeAll(async () => {
  p = await createPractice();
  q = await createPractice();
  // p: A listed (speaks German, step-free Milano office), B listed, C never approved.
  await db.update(practitioners).set({ ...listed, spokenLanguages: ["it", "de"], careOptions: { anxiousPatients: true } }).where(eq(practitioners.id, p.drA));
  await db.update(practitioners).set({ ...listed, spokenLanguages: ["it", "en"] }).where(eq(practitioners.id, p.drB));
  await db.update(practitioners).set({ publicProfile: true, spokenLanguages: ["de"] }).where(eq(practitioners.id, p.drC));
  await db.update(locations).set({ city: CITY }).where(eq(locations.orgId, p.orgId));
  await db.update(locations).set({ accessibility: { stepFree: true, lift: true } }).where(eq(locations.id, p.milano));
  await db.update(locations).set({ accessibility: { stepFree: false } }).where(eq(locations.id, p.monza));
  // q: A listed but opted out, B listed (speaks German), works with FASI; Monza only for B.
  await db.update(practitioners).set({ ...listed, spokenLanguages: ["de"], marketplaceOptOutAt: NOW }).where(eq(practitioners.id, q.drA));
  await db.update(practitioners).set({ ...listed, spokenLanguages: ["de"] }).where(eq(practitioners.id, q.drB));
  await db.update(locations).set({ city: CITY }).where(eq(locations.orgId, q.orgId));
  await db.insert(orgFunds).values({ orgId: q.orgId, fundId: "fund_fasi", mode: "direct", serviceIds: null });
});

const ids = (rs: { practitioner: { id: string } }[]) => rs.map((r) => r.practitioner.id).sort();

describe("listing rule", () => {
  it("lists only practitioners with an approved public profile and no opt-out", async () => {
    const all = await searchPractitioners({ city: CITY });
    expect(ids(all)).toEqual([p.drA, p.drB, q.drB].sort());
    const clinic = (await getPublicClinic((await db.query.organizations.findFirst({ where: (o, { eq }) => eq(o.id, p.orgId) }))!.slug))!;
    // The booking form still offers every active practitioner; only listed ones have a profile.
    expect(clinic.practitioners.map((x) => [x.id, x.listed])).toEqual(
      expect.arrayContaining([
        [p.drA, true],
        [p.drB, true],
        [p.drC, false],
      ]),
    );
    expect(clinic.practitioners.find((x) => x.id === p.drC)?.profile).toBeNull();
  });

  it("reserves slugs that static routes would shadow", () => {
    expect(isReservedSlug("privacy")).toBe(true);
    expect(isReservedSlug("anna-a")).toBe(false);
  });
});

describe("search filters", () => {
  it("lang: only practitioners who speak it", async () => {
    const de = await searchPractitioners({ city: CITY, lang: "de" });
    expect(ids(de)).toEqual([p.drA, q.drB].sort());
    for (const r of de) {
      expect(r.practitioner.spokenLanguages).toContain("de");
      expect(r.rank.reasons[0]).toEqual({ key: "language", value: "de" });
    }
  });

  it("fund: only practices that declared it", async () => {
    const fasi = await searchPractitioners({ city: CITY, fund: "fasi" });
    expect(fasi.length).toBeGreaterThan(0);
    expect(new Set(fasi.map((r) => r.org.id))).toEqual(new Set([q.orgId]));
    expect(fasi[0].rank.reasons).toContainEqual({ key: "fund", value: "FASI" });
    expect(await searchPractitioners({ city: CITY, fund: "unisalute" })).toEqual([]);
  });

  it("access: only practitioners with an office that has every feature", async () => {
    const stepFree = await searchPractitioners({ city: CITY, access: ["stepFree"] });
    expect(ids(stepFree)).toEqual([p.drA, p.drB].sort());
    for (const r of stepFree) expect(r.locations.every((l) => l.accessibility?.stepFree)).toBe(true);
    expect(await searchPractitioners({ city: CITY, access: ["stepFree", "hearingLoop"] })).toEqual([]);
  });

  it("price, care options and children", async () => {
    expect(ids(await searchPractitioners({ city: CITY, maxPriceCents: 5000 }))).toEqual([p.drA, p.drB, q.drB].sort());
    expect(await searchPractitioners({ city: CITY, maxPriceCents: 4000 })).toEqual([]);
    expect(await searchPractitioners({ city: CITY, priceType: "quote" })).toEqual([]);
    expect(ids(await searchPractitioners({ city: CITY, anxiety: true }))).toEqual([p.drA]);
    expect(await searchPractitioners({ city: CITY, sedation: true })).toEqual([]);
    await db.update(services).set({ category: "pediatric" }).where(eq(services.id, q.cleaning));
    await db.insert(practitionerServices).values({ practitionerId: q.drB, serviceId: q.cleaning });
    expect(ids(await searchPractitioners({ city: CITY, children: true }))).toEqual([q.drB]);
  });

  it("returns slim public data with a rank and reasons", async () => {
    const [r] = await searchPractitioners({ city: CITY, lang: "de" });
    expect(Object.keys(r.org).sort()).toEqual(["brandColor", "id", "name", "slug", "timezone"]);
    expect(r.practitioner).not.toHaveProperty("icsTokenHash");
    expect(r.practitioner).not.toHaveProperty("userId");
    expect(typeof r.rank.score).toBe("number");
    expect(r.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("ratings and reviews", () => {
  it("count only published reviews of listed practitioners, with the distribution and the weighted score", async () => {
    await review(p, p.drA, 5);
    await review(p, p.drA, 4);
    await review(p, p.drA, 1, "under_review");
    await review(p, p.drC, 2); // not listed: not shown
    const b = await getRatingBreakdown({ orgId: p.orgId });
    expect(b.count).toBe(2);
    expect(b.average).toBe(4.5);
    expect(b.distribution).toEqual([1, 1, 0, 0, 0]);
    expect(b.weighted).toBeGreaterThan(1);
    expect((await getPublicReviews(p.orgId)).map((r) => r.rating).sort()).toEqual([4, 5]);
  });
});

describe("profile statistics", () => {
  const browser = new Headers({ "user-agent": "Mozilla/5.0 (Windows NT 10.0) Firefox/131.0" });

  it("counts views and impressions per day, never for bots or prefetches", async () => {
    expect(await recordProfileStats("views", [p.drA], browser, NOW)).toBe(true);
    expect(await recordProfileStats("views", [p.drA], browser, NOW)).toBe(true);
    expect(await recordProfileStats("searchImpressions", [p.drA, p.drB], browser, NOW)).toBe(true);
    expect(await recordProfileStats("views", [p.drA], new Headers({ "user-agent": "Googlebot/2.1" }), NOW)).toBe(false);
    expect(await recordProfileStats("views", [p.drA], new Headers(), NOW)).toBe(false);
    expect(await recordProfileStats("views", [p.drA], new Headers({ "user-agent": "Mozilla/5.0", "next-router-prefetch": "1" }), NOW)).toBe(false);
    const [row] = await db.select().from(profileStats).where(and(eq(profileStats.practitionerId, p.drA), eq(profileStats.day, "2030-03-01")));
    expect(row).toMatchObject({ views: 2, searchImpressions: 1 });
    expect(isAutomatedRequest(new Headers({ "user-agent": "WhatsApp/2.24" }))).toBe(true);
  });
});

describe("funds", () => {
  it("lists the fund table seeded by the migration", async () => {
    const funds = await listFunds();
    expect(funds.map((f) => f.slug)).toEqual(expect.arrayContaining(["fasi", "unisalute", "fondo-est", "metasalute"]));
  });

  it("exposes a practice's declared funds on its public data", async () => {
    const slug = (await db.query.organizations.findFirst({ where: (o, { eq }) => eq(o.id, q.orgId) }))!.slug;
    const clinic = await getPublicClinic(slug);
    expect(clinic?.funds).toEqual([expect.objectContaining({ slug: "fasi", mode: "direct", serviceIds: null })]);
  });
});
