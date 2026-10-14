/**
 * Metadata of the WP1 pages: localised titles, Open Graph in the page language, and hreflang
 * alternates for all 8 languages plus x-default (the unprefixed URL).
 */
import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { organizations } from "@/db/schema";
import { LOCALES, OG_LOCALE } from "@/i18n/config";
import { createPractice } from "@/test/fixtures";

vi.mock("next/headers", () => ({ headers: async () => new Headers(), cookies: async () => ({ get: () => undefined }) }));

const pages = {
  "/": () => import("./page"),
  "/for-clinics": () => import("./for-clinics/page"),
  "/developers": () => import("./developers/page"),
  "/legal/accessibility": () => import("./legal/accessibility/page"),
} as const;

type WithMetadata = { generateMetadata: (p: { params: Promise<{ locale: string }> }) => Promise<Metadata> };

function expectAlternates(meta: Metadata, path: string, locale: string) {
  const languages = meta.alternates?.languages as Record<string, string>;
  expect(Object.keys(languages).sort()).toEqual([...LOCALES, "x-default"].sort());
  for (const l of LOCALES) expect(languages[l]).toBe(path === "/" ? `/${l}` : `/${l}${path}`);
  expect(languages["x-default"]).toBe(path);
  expect(meta.alternates?.canonical).toBe(path === "/" ? `/${locale}` : `/${locale}${path}`);
}

describe("WP1 page metadata", () => {
  for (const [path, load] of Object.entries(pages)) {
    it.each(LOCALES)(`${path} in %s`, async (locale) => {
      const { generateMetadata } = (await load()) as unknown as WithMetadata;
      const meta = await generateMetadata({ params: Promise.resolve({ locale }) });
      expectAlternates(meta, path, locale);
      expect(meta.title).toBeTruthy();
      expect(meta.description).toBeTruthy();
      const og = meta.openGraph as { locale: string; alternateLocale: string[] };
      expect(og.locale).toBe(OG_LOCALE[locale]);
      expect(og.alternateLocale.sort()).toEqual(LOCALES.filter((l) => l !== locale).map((l) => OG_LOCALE[l]).sort());
    });
  }

  it("book pages are noindex,follow with the practice page as canonical", async () => {
    const p = await createPractice();
    const [org] = await db.select().from(organizations).where(eq(organizations.id, p.orgId));
    const { generateMetadata } = await import("./book/[org]/page");
    for (const locale of LOCALES) {
      const meta = await generateMetadata({ params: Promise.resolve({ locale, org: org.slug }) });
      expect(meta.robots).toMatchObject({ index: false, follow: true });
      expect(meta.alternates?.canonical).toBe(`/${locale}/c/${org.slug}`);
      const languages = meta.alternates?.languages as Record<string, string>;
      expect(Object.keys(languages)).toHaveLength(9);
      expect(languages["x-default"]).toBe(`/book/${org.slug}`);
      expect(meta.title).toBe("Book an appointment at Studio Test");
    }
  });
});
