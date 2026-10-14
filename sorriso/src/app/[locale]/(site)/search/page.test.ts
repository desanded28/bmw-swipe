/**
 * /[locale]/search: filters reach the directory, results are listed practitioners only, and
 * impressions are counted server-side (no cookie), never for bots.
 */
import { and, eq } from "drizzle-orm";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PractitionerCard } from "@/components/PractitionerCard";
import { db } from "@/db";
import { locations, orgFunds, practitioners, profileStats } from "@/db/schema";
import { LOCALES } from "@/i18n/config";
import type { SearchResult } from "@/lib/directory";
import { todayIn } from "@/lib/time";
import { createPractice, NOW } from "@/test/fixtures";

let requestHeaders = new Headers();
vi.mock("next/headers", () => ({ headers: async () => requestHeaders, cookies: async () => ({ get: () => undefined }) }));

const { default: SearchPage, generateMetadata } = await import("./page");

function findAll(node: ReactNode, type: unknown, out: ReactElement<Record<string, unknown>>[] = []) {
  if (Array.isArray(node)) node.forEach((n) => findAll(n, type, out));
  else if (isValidElement(node)) {
    if (node.type === type) out.push(node as ReactElement<Record<string, unknown>>);
    findAll((node.props as { children?: ReactNode }).children, type, out);
  }
  return out;
}

async function results(query: Record<string, string | string[]>, locale = "it"): Promise<SearchResult[]> {
  const tree = await SearchPage({ params: Promise.resolve({ locale }), searchParams: Promise.resolve(query) });
  return findAll(tree, PractitionerCard).map((el) => el.props.result as SearchResult);
}

let p: Awaited<ReturnType<typeof createPractice>>;
let q: Awaited<ReturnType<typeof createPractice>>;

beforeAll(async () => {
  p = await createPractice();
  q = await createPractice();
  const listed = { publicProfile: true, profileApprovedAt: NOW };
  await db.update(practitioners).set({ ...listed, spokenLanguages: ["it", "de"] }).where(eq(practitioners.id, p.drA));
  await db.update(practitioners).set({ ...listed, spokenLanguages: ["it"] }).where(eq(practitioners.id, p.drB));
  await db.update(practitioners).set({ spokenLanguages: ["de"] }).where(eq(practitioners.id, p.drC)); // never approved
  await db.update(practitioners).set({ ...listed, spokenLanguages: ["de"], marketplaceOptOutAt: NOW }).where(eq(practitioners.id, q.drA));
  await db.update(practitioners).set({ ...listed, spokenLanguages: ["en"] }).where(eq(practitioners.id, q.drB));
  await db.update(locations).set({ accessibility: { stepFree: true } }).where(eq(locations.id, q.milano));
  await db.insert(orgFunds).values({ orgId: q.orgId, fundId: "fund_fasi", mode: "indirect", serviceIds: null });
});

beforeEach(() => {
  requestHeaders = new Headers({ "user-agent": "Mozilla/5.0 (Macintosh) Safari/605.1.15", "x-real-ip": "198.51.100.20" });
});

describe("/[locale]/search", () => {
  it("?lang=de returns only practitioners with 'de' in spokenLanguages", async () => {
    const rs = await results({ lang: "de" });
    expect(rs.map((r) => r.practitioner.id)).toEqual([p.drA]);
    for (const r of rs) expect(r.practitioner.spokenLanguages).toContain("de");
  });

  it("?fund=fasi returns only practices offering FASI", async () => {
    const rs = await results({ fund: "fasi" });
    expect(rs.length).toBeGreaterThan(0);
    expect(new Set(rs.map((r) => r.org.id))).toEqual(new Set([q.orgId]));
  });

  it("?access=stepFree returns only practitioners with a step-free office", async () => {
    const rs = await results({ access: "stepFree" });
    expect(rs.map((r) => r.practitioner.id)).toEqual([q.drB]);
    expect(rs[0].locations.every((l) => l.accessibility?.stepFree)).toBe(true);
  });

  it("never lists a practitioner without approval or who opted out", async () => {
    const all = (await results({})).map((r) => r.practitioner.id);
    expect(all.sort()).toEqual([p.drA, p.drB, q.drB].sort());
    expect(all).not.toContain(p.drC);
    expect(all).not.toContain(q.drA);
  });

  it("ignores malformed filters", async () => {
    expect((await results({ lang: "xx", fund: "../etc", priceType: "free", maxPrice: "abc", access: "nope" })).length).toBe(3);
  });

  it("counts impressions server-side, not for bots", async () => {
    const day = todayIn("Europe/Rome");
    const count = async () =>
      (await db.select().from(profileStats).where(and(eq(profileStats.practitionerId, q.drB), eq(profileStats.day, day))))[0]?.searchImpressions ?? 0;
    const before = await count();
    await results({});
    expect(await count()).toBe(before + 1);
    requestHeaders = new Headers({ "user-agent": "Mozilla/5.0 (compatible; bingbot/2.0)" });
    await results({});
    expect(await count()).toBe(before + 1);
  });

  it("has localised metadata with hreflang alternates, and filtered pages are not indexed", async () => {
    for (const locale of LOCALES) {
      const meta = await generateMetadata({ params: Promise.resolve({ locale }), searchParams: Promise.resolve({ city: "Milano" }) });
      expect(meta.title).toBeTruthy();
      expect(Object.keys(meta.alternates?.languages ?? {}).sort()).toEqual([...LOCALES, "x-default"].sort());
      expect(meta.robots).toMatchObject({ index: true });
    }
    const filtered = await generateMetadata({ params: Promise.resolve({ locale: "it" }), searchParams: Promise.resolve({ lang: "de" }) });
    expect(filtered.robots).toMatchObject({ index: false, follow: true });
  });
});
