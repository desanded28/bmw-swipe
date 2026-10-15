import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/db";
import { organizations, practitioners } from "@/db/schema";
import { LOCALES } from "@/i18n/config";
import { createPractice } from "@/test/fixtures";
import robots from "./robots";
import sitemap from "./sitemap";

const APP = "https://sorriso.test";

describe("/sitemap.xml", () => {
  it("lists each listed clinic and each approved public practitioner once per locale, with alternates and x-default", async () => {
    const p = await createPractice();
    const [org] = await db.select().from(organizations).where(eq(organizations.id, p.orgId));
    const approved = { publicProfile: true, profileApprovedAt: new Date() };
    await db.update(practitioners).set(approved).where(eq(practitioners.id, p.drA));
    // Opted out of the marketplace: never listed, even with an approved public profile.
    await db.update(practitioners).set({ ...approved, marketplaceOptOutAt: new Date() }).where(eq(practitioners.id, p.drB));
    // Public but never approved (e.g. after the backfill, during the grace period): its page is a 404.
    await db.update(practitioners).set({ publicProfile: true, profileApprovedAt: null }).where(eq(practitioners.id, p.drC));

    const hidden = await createPractice();
    await db.update(organizations).set({ listed: false }).where(eq(organizations.id, hidden.orgId));
    await db.update(practitioners).set({ publicProfile: true, profileApprovedAt: new Date() }).where(eq(practitioners.orgId, hidden.orgId));

    const entries = await sitemap();
    const urls = entries.map((e) => e.url);
    expect(new Set(urls).size).toBe(urls.length);

    const clinic = `/c/${org.slug}`;
    for (const l of LOCALES) {
      expect(urls.filter((u) => u === `${APP}/${l}${clinic}`)).toHaveLength(1);
      expect(urls.filter((u) => u === `${APP}/${l}${clinic}/a`)).toHaveLength(1);
      expect(urls).not.toContain(`${APP}/${l}${clinic}/b`); // opted out
      expect(urls).not.toContain(`${APP}/${l}${clinic}/c`); // public profile not approved
      expect(urls).toContain(l === "it" ? `${APP}/it` : `${APP}/${l}`);
    }
    expect(urls.some((u) => u.includes(hidden.orgId.toLowerCase()))).toBe(false);

    const entry = entries.find((e) => e.url === `${APP}/de${clinic}`)!;
    const languages = entry.alternates?.languages as Record<string, string>;
    expect(Object.keys(languages).sort()).toEqual([...LOCALES, "x-default"].sort());
    expect(languages["x-default"]).toBe(`${APP}${clinic}`);
    expect(languages.pl).toBe(`${APP}/pl${clinic}`);
  });

  it("leaves out practitioners without a public profile and inactive ones, approved or not", async () => {
    const p = await createPractice();
    const [org] = await db.select().from(organizations).where(eq(organizations.id, p.orgId));
    await db.update(practitioners).set({ publicProfile: false, profileApprovedAt: new Date() }).where(eq(practitioners.id, p.drA));
    await db.update(practitioners).set({ publicProfile: true, profileApprovedAt: new Date(), active: false }).where(eq(practitioners.id, p.drB));
    const urls = (await sitemap()).map((e) => e.url);
    for (const slug of ["a", "b", "c"]) expect(urls).not.toContain(`${APP}/it/c/${org.slug}/${slug}`);
    expect(urls).toContain(`${APP}/it/c/${org.slug}`);
  });

  it("never lists patient links, booking forms or the dashboard", async () => {
    await createPractice();
    const urls = (await sitemap()).map((e) => e.url);
    expect(urls.some((u) => /\/(a|book|embed|privacy)\//.test(u.replace(APP, "")) || u.includes("/dashboard"))).toBe(false);
  });
});

describe("/robots.txt", () => {
  it("disallows private and transactional paths and points at the sitemap", () => {
    const r = robots();
    const rules = Array.isArray(r.rules) ? r.rules : [r.rules];
    const disallow = rules.flatMap((rule) => (Array.isArray(rule.disallow) ? rule.disallow : [rule.disallow]));
    for (const path of ["/dashboard", "/api/", "/a/", "/*/a/", "/*/book/", "/it/privacy/", "/pl/privacy/"]) expect(disallow).toContain(path);
    expect(r.sitemap).toBe(`${APP}/sitemap.xml`);
  });

  it("blocks the privacy center but not the practices' indexable privacy notices", () => {
    const r = robots();
    const rules = Array.isArray(r.rules) ? r.rules : [r.rules];
    const disallow = rules.flatMap((rule) => (Array.isArray(rule.disallow) ? rule.disallow : [rule.disallow])).filter((d): d is string => Boolean(d));
    // Robots matching: a prefix, "*" any characters, "$" the end.
    const blocked = (url: string) =>
      disallow.some((d) => new RegExp(`^${d.replace(/[.+?^{}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}`).test(url));
    for (const url of ["/it/privacy/me", "/de/privacy/verify", "/it/book/studio-bianchi", "/it/a/tok"]) expect(blocked(url), url).toBe(true);
    for (const url of ["/it/c/studio-bianchi/privacy/minors", "/it/c/studio-bianchi/privacy", "/it/c/studio-bianchi"]) expect(blocked(url), url).toBe(false);
  });
});
