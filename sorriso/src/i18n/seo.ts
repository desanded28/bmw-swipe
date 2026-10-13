import type { Metadata } from "next";
import { LOCALES, type Locale } from "./config";
import { lhref, stripLocale } from "./href";

/**
 * Canonical and hreflang alternates for a public page, relative to metadataBase (APP_URL).
 * `path` may carry a locale prefix (the proxy's x-pathname does): it is stripped first, so
 * x-default always points at the unprefixed URL, which the proxy redirects to the visitor's
 * language.
 */
export function alternatesFor(path: string, locale: Locale): NonNullable<Metadata["alternates"]> {
  const bare = stripLocale(path).path;
  const languages: Record<string, string> = {};
  for (const l of LOCALES) languages[l] = lhref(l, bare);
  languages["x-default"] = bare;
  return { canonical: lhref(locale, bare), languages };
}
