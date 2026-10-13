/**
 * Money and number formatting from a static table, so server and browser render the same bytes
 * (Intl.NumberFormat output varies with the ICU version: fr switched to U+202F, ro prints "EUR").
 * Labels such as "Price on request" are dictionary texts: common.price.*.
 */
import type { Locale } from "./config";

const NBSP = "\u00a0";

type NumberFormat = {
  decimal: string;
  group: string;
  /** 2 = a 4-digit integer part is not grouped ("2500", but "12 500"), as CLDR has for es, pt and pl. */
  minGroup: 1 | 2;
  /** Currency sign before the number with no space (en), or after it with a no-break space. */
  currency: "prefix" | "suffix";
  /** Percent sign after a no-break space ("12 %") or attached ("12%"). */
  percentSpace: boolean;
};

/*
 * it keeps grouping 4-digit prices ("2.500 €"), as Italian price lists do, although recent CLDR
 * data says "2500 €".
 */
export const NUMBER_FORMATS: Record<Locale, NumberFormat> = {
  it: { decimal: ",", group: ".", minGroup: 1, currency: "suffix", percentSpace: false },
  en: { decimal: ".", group: ",", minGroup: 1, currency: "prefix", percentSpace: false },
  de: { decimal: ",", group: ".", minGroup: 1, currency: "suffix", percentSpace: true },
  fr: { decimal: ",", group: NBSP, minGroup: 1, currency: "suffix", percentSpace: true },
  es: { decimal: ",", group: ".", minGroup: 2, currency: "suffix", percentSpace: true },
  pt: { decimal: ",", group: NBSP, minGroup: 2, currency: "suffix", percentSpace: false },
  ro: { decimal: ",", group: ".", minGroup: 1, currency: "suffix", percentSpace: true },
  pl: { decimal: ",", group: NBSP, minGroup: 2, currency: "suffix", percentSpace: false },
};

function groupInt(int: string, f: NumberFormat): string {
  if (int.length <= 3 || (f.minGroup === 2 && int.length === 4)) return int;
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, f.group);
}

/** |n| with `digits` fraction digits; trailing zeros trimmed when `trim`. */
function formatAbs(n: number, locale: Locale, digits: number, trim: boolean): string {
  const f = NUMBER_FORMATS[locale];
  let [int, frac = ""] = Math.abs(n).toFixed(digits).split(".");
  if (trim) frac = frac.replace(/0+$/, "");
  int = groupInt(int, f);
  return frac ? `${int}${f.decimal}${frac}` : int;
}

/**
 * Euro amounts from cents: whole euros without decimals, otherwise two.
 *   en "€25", "€2,500", "€25.50" · it "25 €", "2.500 €" · es "2500 €", "12.500 €" · pl "12 500 €"
 */
export function formatMoney(cents: number, locale: Locale): string {
  const f = NUMBER_FORMATS[locale];
  const amount = formatAbs(cents / 100, locale, cents % 100 === 0 ? 0 : 2, false);
  const sign = cents < 0 ? "-" : "";
  return f.currency === "prefix" ? `${sign}€${amount}` : `${sign}${amount}${NBSP}€`;
}

/**
 * A plain number with local separators. With `digits`, exactly that many fraction digits;
 * without, up to two and trailing zeros dropped ("4,5", "3").
 */
export function formatDecimal(n: number, locale: Locale, digits?: number): string {
  if (!Number.isFinite(n)) return String(n);
  const text = formatAbs(n, locale, digits ?? 2, digits === undefined);
  return n < 0 && /[1-9]/.test(text) ? `-${text}` : text;
}

/** A ratio as a percentage: 0.125 -> "13%" (en), "13 %" (de), "12,5 %" with digits = 1. */
export function formatPercent(ratio: number, locale: Locale, digits = 0): string {
  const text = formatDecimal(ratio * 100, locale, digits);
  return NUMBER_FORMATS[locale].percentSpace ? `${text}${NBSP}%` : `${text}%`;
}
