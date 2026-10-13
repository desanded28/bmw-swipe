import { INTL_TAG, type Locale } from "./config";
import type { Plural, PluralCategory, PluralForms } from "./types";

/**
 * Declare a plural leaf in a dictionary. The const type parameter keeps each form's literal
 * type, so the placeholders of every form reach Vars<> and t() checks them.
 *
 *   days: p({ one: "{count} day", other: "{count} days" })
 */
export function p<const F extends PluralForms & Record<Exclude<keyof F, keyof PluralForms>, never>>(forms: F): F & Plural {
  return { ...forms, __plural: true } as F & Plural;
}

export function isPlural(v: unknown): v is Plural {
  return typeof v === "object" && v !== null && (v as { __plural?: unknown }).__plural === true;
}

const rulesCache = new Map<Locale, Intl.PluralRules>();

function rulesFor(locale: Locale): Intl.PluralRules {
  let r = rulesCache.get(locale);
  if (!r) {
    r = new Intl.PluralRules(INTL_TAG[locale]);
    rulesCache.set(locale, r);
  }
  return r;
}

/** The CLDR category of n in this locale (pt uses pt-PT rules: 0 is "other", not "one"). */
export function pluralCategory(locale: Locale, n: number): PluralCategory {
  return rulesFor(locale).select(n) as PluralCategory;
}

/** Categories CLDR defines for the locale, e.g. pl: few, many, one, other. */
export function pluralCategories(locale: Locale): PluralCategory[] {
  return rulesFor(locale).resolvedOptions().pluralCategories as PluralCategory[];
}

/** Pick the form for n; a category the dictionary does not provide falls back to "other". */
export function plural(locale: Locale, n: number, forms: Plural): string {
  return forms[pluralCategory(locale, n)] ?? forms.other;
}
