/**
 * Display helpers. formatPrice, pluralize and CATEGORY_LABELS predate the i18n core and are
 * thin wrappers over it now (see src/i18n): they keep their signatures and their old defaults.
 */
import { isLocale, type Locale } from "@/i18n/config";
import EN_COMMON from "@/i18n/messages/en/common";
import { negotiate } from "@/i18n/negotiate";
import { formatMoney } from "@/i18n/number";
import { plural } from "@/i18n/plural";

function resolveLocale(locale: Locale | string): Locale {
  return isLocale(locale) ? locale : (negotiate(locale) ?? "en");
}

/**
 * Price label from cents. Backward-compatible wrapper over formatMoney: `locale` is a Locale or
 * an Intl tag ("it-IT"), defaulting to Italian amounts ("25 €") as the Intl it-IT version did,
 * since its callers pass none. The "on request" and "free" labels stay English (English
 * common.price): client components import this module, so it must not bundle every locale's
 * dictionary. Localised code calls formatMoney(cents, locale) and t("price.onRequest").
 */
export function formatPrice(cents: number | null | undefined, locale: Locale | string = "it"): string {
  if (cents == null) return EN_COMMON.price.onRequest;
  if (cents === 0) return EN_COMMON.price.free;
  return formatMoney(cents, resolveLocale(locale));
}

export function initials(name: string): string {
  return name
    .replace(/^(dr\.?|dott\.?(ssa)?\.?|prof\.?)\s+/i, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function fullName(p: { firstName: string; lastName: string }): string {
  return `${p.firstName} ${p.lastName}`.trim();
}

export function practitionerName(p: { title: string; name: string }): string {
  return p.title ? `${p.title} ${p.name}` : p.name;
}

/**
 * "3 days". English-style (two forms only): kept for existing callers. Localised code declares
 * plurals in its dictionary with p() instead.
 */
export function pluralize(n: number, one: string, many: string = `${one}s`, locale: Locale = "en"): string {
  return plural(locale, n, { __plural: true, one: `${n} ${one}`, other: `${n} ${many}` });
}

/** English service-category labels (common.categories). Localised code uses t(`categories.${c}`). */
export const CATEGORY_LABELS: Record<string, string> = { ...EN_COMMON.categories };
