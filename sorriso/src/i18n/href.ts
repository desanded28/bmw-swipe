/**
 * Locale-prefixed links. Public pages live under /{locale}/...; the dashboard and the API are not
 * localised by URL (staff language is per user), so their paths pass through unchanged.
 */
import { isLocale, type Locale } from "./config";

const UNPREFIXED = /^\/(api|dashboard)(\/|$|\?|#)/;

function splitSuffix(path: string): [string, string] {
  const i = path.search(/[?#]/);
  return i === -1 ? [path, ""] : [path.slice(0, i), path.slice(i)];
}

/**
 * Split a pathname into its locale prefix (if any) and the rest: "/de/c/x" -> de, "/c/x".
 * The rest never starts with "//" or "/\": "/it//evil.com" gives "/evil.com", so a
 * redirect(swapLocale(returnTo, to)) can't turn a same-site path into an off-site URL.
 */
export function stripLocale(pathname: string): { locale: Locale | null; path: string } {
  const [path, suffix] = splitSuffix(pathname);
  const seg = path.split("/")[1];
  if (!isLocale(seg)) return { locale: null, path: pathname };
  const rest = path.slice(seg.length + 1).replace(/^[/\\]+/, "/");
  return { locale: seg, path: (rest || "/") + suffix };
}

/**
 * The public URL of `path` in `locale`: lhref("de", "/c/studio?x=1") -> "/de/c/studio?x=1",
 * lhref("de", "/") -> "/de". Absolute URLs, anchors, /api and /dashboard are returned as they are.
 */
export function lhref(locale: Locale, path: string): string {
  if (!path.startsWith("/") || path.startsWith("//") || UNPREFIXED.test(path)) return path;
  const [p, suffix] = splitSuffix(stripLocale(path).path);
  return `/${locale}${p === "/" ? "" : p}${suffix}`;
}

/** The same page in another language: swapLocale("/it/c/x?y=1", "de") -> "/de/c/x?y=1". */
export function swapLocale(pathname: string, to: Locale): string {
  return lhref(to, stripLocale(pathname).path);
}
