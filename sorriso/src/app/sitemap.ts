import { and, eq, isNull } from "drizzle-orm";
import type { MetadataRoute } from "next";
import { db } from "@/db";
import { organizations, practitioners } from "@/db/schema";
import { LOCALES } from "@/i18n/config";
import { lhref } from "@/i18n/href";
import { APP_URL } from "@/lib/config";
import { isDemoMode } from "@/lib/demo";

// Reads the directory on every request: listings and opt-outs show up (and disappear) at once.
export const dynamic = "force-dynamic";

/** Public pages that exist in every language. Legal pages belong to several packages; all are public. */
const STATIC_PATHS = [
  "/",
  "/search",
  "/for-clinics",
  "/developers",
  "/legal/privacy",
  "/legal/cookies",
  "/legal/terms",
  "/legal/dpa",
  "/legal/subprocessors",
  "/legal/accessibility",
  "/legal/reviews",
  "/legal/ranking",
];

/**
 * One entry per page and language, each listing every language version plus x-default (the
 * unprefixed URL, which the proxy sends to the visitor's language).
 */
function localizedEntries(path: string): MetadataRoute.Sitemap {
  const languages: Record<string, string> = {};
  for (const l of LOCALES) languages[l] = `${APP_URL}${lhref(l, path)}`;
  languages["x-default"] = `${APP_URL}${path}`;
  return LOCALES.map((l) => ({ url: languages[l], alternates: { languages } }));
}

/**
 * /sitemap.xml: the static pages, every listed practice (/c/<org>) and every practitioner with an
 * approved public profile (/c/<org>/<practitioner>), once per language. Practices that asked to
 * close, practitioners who opted out of the marketplace and demo practices (outside demo mode)
 * are left out.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const demo = isDemoMode();
  const orgs = await db
    .select({ id: organizations.id, slug: organizations.slug, isDemo: organizations.isDemo })
    .from(organizations)
    .where(and(eq(organizations.listed, true), isNull(organizations.closureRequestedAt)));
  const visible = orgs.filter((o) => demo || !o.isDemo);
  const slugById = new Map(visible.map((o) => [o.id, o.slug]));

  const people = visible.length
    ? await db
        .select({ orgId: practitioners.orgId, slug: practitioners.slug })
        .from(practitioners)
        .where(
          and(eq(practitioners.active, true), eq(practitioners.publicProfile, true), isNull(practitioners.marketplaceOptOutAt)),
        )
    : [];

  const paths = [
    ...STATIC_PATHS,
    ...visible.map((o) => `/c/${encodeURIComponent(o.slug)}`),
    ...people
      .filter((p) => slugById.has(p.orgId))
      .map((p) => `/c/${encodeURIComponent(slugById.get(p.orgId)!)}/${encodeURIComponent(p.slug)}`),
  ];
  return paths.flatMap(localizedEntries);
}
