import { eq } from "drizzle-orm";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { noticeVersions, organizations } from "@/db/schema";
import { LOCALES } from "@/i18n/config";
import { NOTICE_VERSIONS } from "@/lib/privacy/versions";
import { createPractice } from "@/test/fixtures";
import CookiesPage from "../../../legal/cookies/page";
import SorrisoPage from "../../../legal/privacy/page";
import MinorsPage from "./minors/page";
import PracticePage from "./page";

/** Every notice page renders in all 8 locales with its version and date, and translations say the Italian version prevails. */

let slug: string;
let orgId: string;

beforeAll(async () => {
  const p = await createPractice();
  orgId = p.orgId;
  await db.update(organizations).set({ legalName: "Studio Test S.r.l.", privacyEmail: "privacy@studio.test" }).where(eq(organizations.id, orgId));
  [{ slug }] = await db.select({ slug: organizations.slug }).from(organizations).where(eq(organizations.id, orgId));
});

const params = <T extends object>(p: T) => Promise.resolve(p);
const BANNER = /Italian version prevails/;

describe("notice pages", () => {
  it.each(LOCALES)("the practice notice renders in %s with version, date and the right banner", async (locale) => {
    const html = renderToStaticMarkup(await PracticePage({ params: params({ locale, org: slug }) }));
    expect(html).toContain(NOTICE_VERSIONS.practice_patient);
    expect(html).toContain("Studio Test S.r.l.");
    expect(html).toMatch(/id="summary"/);
    expect(html).toMatch(/href="#rights"/);
    expect(html).toMatch(/\b20\d\d\b/);
    if (locale === "it") expect(html).not.toMatch(BANNER);
    else expect(html).toMatch(BANNER);
  });

  it("records the practice notice's version in every language it was shown in", async () => {
    const rows = await db.select().from(noticeVersions).where(eq(noticeVersions.orgId, orgId));
    for (const locale of LOCALES) expect(rows.some((r) => r.kind === "practice_patient" && r.locale === locale)).toBe(true);
  });

  it.each(LOCALES)("the notice for young people, Sorriso's notice and the cookie notice render in %s", async (locale) => {
    const minors = renderToStaticMarkup(await MinorsPage({ params: params({ locale, org: slug }) }));
    const sorriso = renderToStaticMarkup(await SorrisoPage({ params: params({ locale }), searchParams: params({}) }));
    const cookies = renderToStaticMarkup(await CookiesPage({ params: params({ locale }) }));
    for (const html of [minors, sorriso, cookies]) {
      expect(html).toContain("2026-10");
      if (locale === "it") expect(html).not.toMatch(BANNER);
      else expect(html).toMatch(BANNER);
    }
    expect(cookies).toContain("__Host-sorriso_pc");
  });

  it("serves the staff and practitioner notices from Sorriso's page", async () => {
    const staff = renderToStaticMarkup(await SorrisoPage({ params: params({ locale: "en" }), searchParams: params({ for: "staff" }) }));
    expect(staff).toContain("Law 300/1970");
    const practitioners = renderToStaticMarkup(await SorrisoPage({ params: params({ locale: "en" }), searchParams: params({ for: "practitioners" }) }));
    expect(practitioners).toContain("Albo");
  });
});
