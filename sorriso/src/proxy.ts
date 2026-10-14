import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, LOCALE_HEADER } from "@/i18n/config";
import { negotiate } from "@/i18n/negotiate";
import { securityHeaders } from "@/lib/security/headers";

/**
 * Locale routing for public pages, plus security headers on every response.
 *
 * - /api, /dashboard and the short patient links /a/... pass through: the API and the dashboard
 *   are not localised by URL, and /a/<token> redirects itself once it knows the patient's language.
 * - /{locale}/... passes through with the locale in a request header for getRequestLocale().
 * - Anything else gets a 307 to /{cookie ?? Accept-Language ?? it}{path}{search}.
 *
 * Every request that passes through also carries, set here only (client-sent values are
 * overwritten): x-pathname (the path) and x-search (the query string with its "?", or empty), so
 * server components can see the full URL, e.g. the language switcher without JavaScript.
 *
 * No database access here: the proxy runs on every request.
 */

const PASS_THROUGH = /^\/(api|dashboard|a)(\/|$)/;

/** Request header with the query string ("?a=1" or ""), for server components. */
const SEARCH_HEADER = "x-search";

export function proxy(req: NextRequest): NextResponse {
  const sec = securityHeaders(req);
  const { pathname, search } = req.nextUrl;

  const forward = (extra: Record<string, string>) => {
    const headers = new Headers(req.headers);
    // Never trust a client-sent locale header: only the proxy sets it.
    headers.delete(LOCALE_HEADER);
    for (const [k, v] of Object.entries({ ...sec.request, ...extra })) headers.set(k, v);
    const res = NextResponse.next({ request: { headers } });
    for (const [k, v] of Object.entries(sec.response)) res.headers.set(k, v);
    return res;
  };

  if (PASS_THROUGH.test(pathname)) return forward({ "x-pathname": pathname, [SEARCH_HEADER]: search });

  const first = pathname.split("/")[1];
  if (isLocale(first)) return forward({ [LOCALE_HEADER]: first, "x-pathname": pathname, [SEARCH_HEADER]: search });

  const cookie = req.cookies.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(cookie) ? cookie : (negotiate(req.headers.get("accept-language")) ?? DEFAULT_LOCALE);
  const url = req.nextUrl.clone();
  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  url.search = search;
  const res = NextResponse.redirect(url, 307);
  res.headers.set("Vary", "Accept-Language, Cookie");
  for (const [k, v] of Object.entries(sec.response)) res.headers.set(k, v);
  return res;
}

export const config = {
  // Everything except Next internals, /.well-known and files with an extension (widget.js, icon.svg…),
  // plus every API route, extension or not (the ICS feeds end in .ics and need the security headers).
  matcher: ["/((?!_next/|\\.well-known/|.*\\.[A-Za-z0-9]+$).*)", "/api/:path*"],
};
