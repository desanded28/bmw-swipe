/**
 * Backward-compatible wrappers over the i18n date core (src/i18n/datefmt.ts), which owns the
 * deterministic, hydration-safe formatting. The locale is a trailing optional argument so
 * existing callers keep their English output; new code imports from "@/i18n/datefmt" and passes
 * the locale explicitly.
 */
import type { Locale } from "@/i18n/config";
import { fmtDay as fmtDayCore, fmtWhen as fmtWhenCore, type DayStyle } from "@/i18n/datefmt";

export { zonedDate, zonedTime, type DayStyle } from "@/i18n/datefmt";

/** Format a YYYY-MM-DD calendar date. */
export function fmtDay(date: string, style: DayStyle = "weekday", locale: Locale = "en"): string {
  return fmtDayCore(date, style, locale);
}

/** e.g. "Wednesday 14 October at 08:30" */
export function fmtWhen(iso: string | Date, tz: string, style: DayStyle = "medium", locale: Locale = "en"): string {
  return fmtWhenCore(iso, tz, locale, style);
}
