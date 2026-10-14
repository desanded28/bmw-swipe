import { NextResponse, type NextRequest } from "next/server";
import { isLocale, LOCALE_COOKIE } from "@/i18n/config";
import { stripLocale, swapLocale } from "@/i18n/href";

export const dynamic = "force-dynamic";

const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

/**
 * A same-site path to return to: starts with "/", never "//" or "/\" (browsers read both as a
 * protocol-relative URL to another host), no control characters, bounded length.
 */
function safeNext(next: string): boolean {
  return (
    next.length <= 2048 &&
    next.startsWith("/") &&
    !next.startsWith("//") &&
    !next.startsWith("/\\") &&
    !/[\u0000-\u001f\u007f]/.test(next)
  );
}

/**
 * The query of the page the visitor came from, when `next` is that page without one. A safety net:
 * the switcher's links carry the query themselves (with JavaScript from useSearchParams, without it
 * from the proxy's x-search header, which the layouts pass down), so this only helps a switcher
 * rendered without the server's query. The browser's same-origin Referer still has it then (not on
 * no-referrer pages). Only a Referer from this host for the same page counts.
 */
function refererQuery(req: NextRequest, next: string): string {
  if (next.includes("?") || next.includes("#")) return "";
  try {
    const ref = new URL(req.headers.get("referer") ?? "");
    const sameHost = ref.host === (req.headers.get("host") ?? req.nextUrl.host);
    return sameHost && stripLocale(ref.pathname).path === stripLocale(next).path ? ref.search : "";
  } catch {
    return "";
  }
}

function badRequest(code: "invalid_locale" | "invalid_next") {
  return NextResponse.json(
    { error: { code, message: "Bad request." } },
    { status: 400, headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * GET /api/locale?to=de&next=/it/c/studio?service=x
 *
 * The language switcher's target: an explicit choice of language, the only place NEXT_LOCALE is
 * ever set (automatic detection in the proxy never writes it). It works without JavaScript (the
 * switcher is a list of plain links) and answers 303 to `next` in the chosen language, query kept.
 * Anything but a valid locale and a same-site path is refused with 400 and sets no cookie.
 */
export async function GET(req: NextRequest) {
  const to = req.nextUrl.searchParams.get("to");
  if (!isLocale(to)) return badRequest("invalid_locale");
  const next = req.nextUrl.searchParams.get("next") ?? "/";
  if (!safeNext(next)) return badRequest("invalid_next");

  // A relative Location: the browser resolves it against this origin, so it can't leave the site.
  const res = new NextResponse(null, {
    status: 303,
    headers: { Location: swapLocale(next + refererQuery(req, next), to), "Cache-Control": "no-store" },
  });
  res.cookies.set(LOCALE_COOKIE, to, {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: ONE_YEAR_SECONDS,
  });
  return res;
}
