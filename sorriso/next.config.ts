import type { NextConfig } from "next";

/**
 * Static security headers (the per-request Content-Security-Policy with its nonce is set by
 * src/proxy.ts through src/lib/security/headers.ts). When two rules set the same header on a path,
 * the later rule wins, so the general rules come first.
 */

const LOCALE_LIST = "it|en|de|fr|es|pt|ro|pl";
/** A path-to-regexp parameter pattern (no nested capturing groups: path-to-regexp refuses them). */
const LOCALE = `(${LOCALE_LIST})`;

/** Patient links and records: never sent on as a Referer, never indexed, never cached. */
const PRIVATE_PATHS = [
  "/a/:path*",
  `/:locale${LOCALE}/a/:path*`,
  "/api/ics/:path*",
  "/api/v1/appointments/:path*",
  `/:locale${LOCALE}/privacy`,
  `/:locale${LOCALE}/privacy/:path*`,
];

const PRIVATE_HEADERS = [
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
  { key: "Cache-Control", value: "private, no-store, max-age=0" },
];

export function securityHeaderRules(production = process.env.NODE_ENV === "production") {
  return [
    {
      source: "/:path*",
      headers: [
        ...(production ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }] : []),
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
        { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
      ],
    },
    // Framing: nowhere except the embeddable booking widget (/{locale}/embed/...), whose
    // frame-ancestors comes from the CSP.
    {
      source: `/:path((?!(?:${LOCALE_LIST})/embed(?:/|$)).*)`,
      headers: [{ key: "X-Frame-Options", value: "DENY" }],
    },
    ...PRIVATE_PATHS.map((source) => ({ source, headers: PRIVATE_HEADERS })),
  ];
}

const nextConfig: NextConfig = {
  serverExternalPackages: ["@libsql/client", "libsql"],
  poweredByHeader: false,
  experimental: {
    // Two root layouts ([locale] and dashboard) and none at the top: unmatched URLs need their own page.
    globalNotFound: true,
  },
  async headers() {
    return securityHeaderRules();
  },
};

export default nextConfig;
