import type { MetadataRoute } from "next";
import { LOCALES } from "@/i18n/config";
import { APP_URL } from "@/lib/config";

/**
 * /robots.txt. Personal and transactional pages stay out of search engines: the dashboard, the API,
 * patient links (/a/<token>, with or without a locale), booking forms and privacy-center pages.
 * Those pages also carry robots noindex themselves, since robots.txt only asks crawlers not to fetch.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // The privacy center's pages, per locale: "/*/privacy/" would also block every practice's
        // privacy notices (/{locale}/c/{org}/privacy/minors), which listed practices want indexed.
        disallow: ["/dashboard", "/api/", "/a/", "/*/a/", "/*/book/", ...LOCALES.map((l) => `/${l}/privacy/`)],
      },
    ],
    sitemap: `${APP_URL}/sitemap.xml`,
  };
}
