/**
 * Locale configuration. Pure (no Node or React imports): safe everywhere.
 * Italian is the default and the authoritative language for legal texts;
 * English is the source language for dictionary keys.
 */
export const LOCALES = ["it", "en", "de", "fr", "es", "pt", "ro", "pl"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "it";
export const SOURCE_LOCALE: Locale = "en";

/** BCP-47 tags for Intl (pt-PT: plain "pt" would apply Brazilian conventions). */
export const INTL_TAG: Record<Locale, string> = {
  it: "it-IT",
  en: "en-GB",
  de: "de-DE",
  fr: "fr-FR",
  es: "es-ES",
  pt: "pt-PT",
  ro: "ro-RO",
  pl: "pl-PL",
};

/** Language names in their own language, for language pickers. */
export const ENDONYM: Record<Locale, string> = {
  it: "Italiano",
  en: "English",
  de: "Deutsch",
  fr: "Français",
  es: "Español",
  pt: "Português",
  ro: "Română",
  pl: "Polski",
};

export const OG_LOCALE: Record<Locale, string> = {
  it: "it_IT",
  en: "en_GB",
  de: "de_DE",
  fr: "fr_FR",
  es: "es_ES",
  pt: "pt_PT",
  ro: "ro_RO",
  pl: "pl_PL",
};

export const DIR: Record<Locale, "ltr" | "rtl"> = { it: "ltr", en: "ltr", de: "ltr", fr: "ltr", es: "ltr", pt: "ltr", ro: "ltr", pl: "ltr" };

/** Default phone dial code suggested for each language (the user can change it). */
export const DIAL_CODE: Record<Locale, string> = { it: "39", en: "44", de: "49", fr: "33", es: "34", pt: "351", ro: "40", pl: "48" };

export const LOCALE_COOKIE = "NEXT_LOCALE";
/** Request header the proxy sets for locale-prefixed pages (read by getRequestLocale). */
export const LOCALE_HEADER = "x-sorriso-locale";

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}

export function toLocale(v: unknown, fallback: Locale = DEFAULT_LOCALE): Locale {
  return isLocale(v) ? v : fallback;
}
