/**
 * Locale-aware date labels with identical output in Node and every browser.
 *
 * Intl's long formats differ between runtimes and ICU versions ("Tuesday 13 October" vs
 * "Tuesday, 13 October"), which breaks hydration of server-rendered client components. So the
 * words come from the committed calendar-names.ts and the order from date-patterns.ts; Intl is
 * used only for numeric parts (the wall-clock date and time in a time zone), which are stable.
 */
import { CALENDAR_NAMES } from "./calendar-names";
import { INTL_TAG, type Locale } from "./config";
import { DATE_PATTERNS } from "./date-patterns";

export type DayStyle = "long" | "medium" | "weekday" | "short" | "wd" | "monthYear";

const numericCache = new Map<string, Intl.DateTimeFormat>();

function numericParts(instant: string | Date, tz: string): Record<string, string> {
  let f = numericCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    numericCache.set(tz, f);
  }
  const out: Record<string, string> = {};
  for (const p of f.formatToParts(typeof instant === "string" ? new Date(instant) : instant)) out[p.type] = p.value;
  return out;
}

/** The calendar day (YYYY-MM-DD) an instant falls on in `tz`. */
export function zonedDate(instant: string | Date, tz: string): string {
  const p = numericParts(instant, tz);
  return `${p.year}-${p.month}-${p.day}`;
}

/** The wall-clock time (HH:mm, 24-hour) of an instant in `tz`. */
export function zonedTime(instant: string | Date, tz: string): string {
  const p = numericParts(instant, tz);
  return `${p.hour}:${p.minute}`;
}

function fill(pattern: string, values: Record<string, string>): string {
  return pattern.replace(/\{(\w+)\}/g, (whole, k: string) => values[k] ?? whole);
}

function parseDay(date: string): { y: number; m: number; d: number; wd: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const t = new Date(Date.UTC(y, m - 1, d));
  if (t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return null;
  return { y, m, d, wd: t.getUTCDay() };
}

/**
 * Format a calendar day ('YYYY-MM-DD'; no time zone involved).
 *   long      martedì 13 ottobre 2026 · Tuesday 13 October 2026
 *   medium    martedì 13 ottobre      · wtorek, 13 października
 *   weekday   mar 13 ott              · Tue 13 Oct
 *   short     13 ott                  · 13. Okt.
 *   wd        mar                     · Tue
 *   monthYear ottobre 2026            · październik 2026
 * An invalid date is returned unchanged.
 */
export function fmtDay(date: string, style: DayStyle, locale: Locale): string {
  const p = parseDay(date);
  if (!p) return date;
  const names = CALENDAR_NAMES[locale];
  if (style === "wd") return names.weekdaysShort[p.wd];
  return fill(DATE_PATTERNS[locale][style], {
    weekday: names.weekdays[p.wd],
    wd: names.weekdaysShort[p.wd],
    d: String(p.d),
    month: names.months[p.m - 1],
    mon: names.monthsShort[p.m - 1],
    monthAlone: names.monthsStandalone[p.m - 1],
    year: String(p.y),
  });
}

/** Always 24-hour HH:mm, in every locale. */
export function fmtTime(instant: string | Date, tz: string): string {
  return zonedTime(instant, tz);
}

/** "martedì 13 ottobre alle 08:30", "Tuesday 13 October at 08:30". */
export function fmtWhen(instant: string | Date, tz: string, locale: Locale, style: DayStyle = "medium"): string {
  const time = zonedTime(instant, tz);
  const patterns = DATE_PATTERNS[locale];
  const pattern = time.startsWith("01:") && patterns.atOne ? patterns.atOne : patterns.at;
  return fill(pattern, { date: fmtDay(zonedDate(instant, tz), style, locale), time });
}

function dayNumber(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

/** A standalone label, capitalised: "Oggi", "Domani", else "Mar 13 ott". */
export function fmtRelativeDay(date: string, today: string, locale: Locale): string {
  const diff = dayNumber(date) - dayNumber(today);
  const patterns = DATE_PATTERNS[locale];
  const label = diff === 0 ? patterns.today : diff === 1 ? patterns.tomorrow : fmtDay(date, "weekday", locale);
  return capitalizeFirst(label, locale);
}

/** Upper-case the first letter (code point aware), for dates that start a sentence or heading. */
export function capitalizeFirst(s: string, locale: Locale): string {
  const first = s.codePointAt(0);
  if (first === undefined) return s;
  const ch = String.fromCodePoint(first);
  return ch.toLocaleUpperCase(INTL_TAG[locale]) + s.slice(ch.length);
}
