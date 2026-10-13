/**
 * Localised Zod messages. Apply per parse, never with z.config(), which is process-wide and would
 * leak one request's language into another:
 *
 *   schema.safeParse(input, { error: zodErrorMap(locale) })
 *
 * Messages set explicitly in a schema (z.string().min(2, "...")) take precedence over this map.
 */
import type { $ZodErrorMap } from "zod/v4/core";
import { de, en, es, fr, it, pl, pt, ro } from "zod/v4/locales";
import type { Locale } from "./config";

const FACTORIES: Record<Locale, () => { localeError: $ZodErrorMap }> = { it, en, de, fr, es, pt, ro, pl };
const cache = new Map<Locale, $ZodErrorMap>();

export function zodErrorMap(locale: Locale): $ZodErrorMap {
  let map = cache.get(locale);
  if (!map) {
    map = FACTORIES[locale]().localeError;
    cache.set(locale, map);
  }
  return map;
}
