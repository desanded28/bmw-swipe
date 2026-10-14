import type { BookingLabels } from "@/components/booking/BookingFlow";
import type { Locale, PriceType } from "@/db/enums";
import { formatMoney } from "@/i18n/number";
import type { Translator } from "@/i18n/types";

/**
 * Italian tax deduction for health expenses (IRPEF, art. 15 c. 1 lett. c TUIR): 19% of the part
 * above a yearly threshold of €129.11. Shown as an informational note (catalog.tax.body).
 */
export const TAX_DEDUCTION_RATE = 0.19;
export const TAX_DEDUCTION_THRESHOLD_CENTS = 12_911;

/** The two translators a price label needs (common.price.* and catalog.price.*), server or client. */
type PriceTexts = {
  onRequest: string;
  free: string;
  from: (price: string) => string;
  range: (min: string, max: string) => string;
  quote: string;
};

/**
 * A treatment's price as patients read it: fixed ("50 €"), a starting price ("from 50 €"), a range
 * ("50 € to 120 €"), "price after an assessment", "free" or "price on request". Pure: pass the
 * texts from getT (server) or useT (client).
 */
export function priceLabel(
  s: { priceCents: number | null; priceType?: PriceType; priceMaxCents?: number | null },
  locale: Locale,
  texts: PriceTexts,
): string {
  const type = s.priceType ?? "fixed";
  if (type === "quote") return texts.quote;
  if (s.priceCents == null) return texts.onRequest;
  if (s.priceCents === 0 && type === "fixed") return texts.free;
  const price = formatMoney(s.priceCents, locale);
  if (type === "from") return s.priceMaxCents != null && s.priceMaxCents > s.priceCents ? texts.range(price, formatMoney(s.priceMaxCents, locale)) : texts.from(price);
  return price;
}

/** The texts priceLabel needs, from the common and catalog namespaces (getT on the server, useT on the client). */
export function priceTexts(tc: Translator<"common">, tcat: Translator<"catalog">): PriceTexts {
  return {
    onRequest: tc("price.onRequest"),
    free: tc("price.free"),
    from: (price) => tc("price.from", { price }),
    range: (min, max) => tcat("price.range", { min, max }),
    quote: tcat("price.quote"),
  };
}

/**
 * BookingFlow's `labels`, formatted on the server: each treatment's price as patients read it
 * (with its price type: starting price, range, quote) and its duration.
 */
export function bookingLabels(
  services: readonly { id: string; priceCents: number | null; priceType?: PriceType; priceMaxCents?: number | null; durationMinutes: number }[],
  locale: Locale,
  tc: Translator<"common">,
  tcat: Translator<"catalog">,
): BookingLabels {
  const texts = priceTexts(tc, tcat);
  return {
    services: Object.fromEntries(
      services.map((s) => [s.id, { price: priceLabel(s, locale, texts), duration: tc("units.minutesShort", { count: s.durationMinutes }) }]),
    ),
  };
}
