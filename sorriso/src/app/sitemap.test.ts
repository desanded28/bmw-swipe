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
  it("lists each listed clinic and each public practitioner once per locale, with alternates and x-default", async () => {
    const p = await createPractice();
    const [org] = await db.select().from(organizations).where(eq(organizations.id, p.orgId));
    await db.update(practitioners).set({ publicProfile: true }).where(eq(practitioners.id, p.drA));
    // Opted out of the marketplace: never listed, even with a public profile.
    await db.update(practitioners).set({ publicProfile: true, marketplaceOptOutAt: new Date() }).where(eq(practitioners.id, p.drB));

    const hidden = await createPractice();
    await db.update(organizations).set({ listed: false }).where(eq(organizations.id, hidden.orgId));
    await db.update(practitioners).set({ publicProfile: true }).where(eq(practitioners.orgId, hidden.orgId));

    const entries = await sitemap();
    const urls = entries.map((e) => e.url);
    expect(new Set(urls).size).toBe(urls.length);

    const clinic = `/c/${org.slug}`;
    for (const l of LOCALES) {
      expect(urls.filter((u) => u === `${APP}/${l}${clinic}`)).toHaveLength(1);
      expect(urls.filter((u) => u === `${APP}/${l}${clinic}/a`)).toHaveLength(1);
      expect(urls).not.toContain(`${APP}/${l}${clinic}/b`); // opted out
      expect(urls).not.toContain(`${APP}/${l}${clinic}/c`); // no public profile
      expect(urls).toContain(l === "it" ? `${APP}/it` : `${APP}/${l}`);
    }
    expect(urls.some((u) => u.includes(hidden.orgId.toLowerCase()))).toBe(false);

    const entry = entries.find((e) => e.url === `${APP}/de${clinic}`)!;
    const languages = entry.alternates?.languages as Record<string, string>;
    expect(Object.keys(languages).sort()).toEqual([...LOCALES, "x-default"].sort());
    expect(languages["x-default"]).toBe(`${APP}${clinic}`);
    expect(languages.pl).toBe(`${APP}/pl${clinic}`);
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
    for (const path of ["/dashboard", "/api/", "/a/", "/*/a/", "/*/book/", "/*/privacy/"]) expect(disallow).toContain(path);
    expect(r.sitemap).toBe(`${APP}/sitemap.xml`);
  });
});
