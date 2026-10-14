import type { MetadataRoute } from "next";
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
        disallow: ["/dashboard", "/api/", "/a/", "/*/a/", "/*/book/", "/*/privacy/"],
      },
    ],
    sitemap: `${APP_URL}/sitemap.xml`,
  };
}
