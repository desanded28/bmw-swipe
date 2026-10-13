/**
 * Time-zone helpers built on Intl (no dependencies).
 *
 * Conventions:
 *   - "date string" = YYYY-MM-DD, a calendar day in some time zone
 *   - "minutes"     = minutes after local midnight
 *   - instants are JS Dates (UTC under the hood)
 */

import { isLocale, type Locale } from "@/i18n/config";
import { fmtDay, fmtRelativeDay, fmtTime, zonedDate } from "@/i18n/datefmt";
import { negotiate } from "@/i18n/negotiate";

const dtfCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(tz: string) {
  let f = dtfCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
    });
    dtfCache.set(tz, f);
  }
  return f;
}

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number;
  /** YYYY-MM-DD */
  date: string;
  /** minutes after local midnight */
  minutes: number;
};

export function zonedParts(instant: Date, tz: string): ZonedParts {
  const parts = partsFormatter(tz).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "0";
  const year = Number(get("year"));
  const month = Number(get("month"));
  const day = Number(get("day"));
  const hour = Number(get("hour"));
  const minute = Number(get("minute"));
  const second = Number(get("second"));
  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    weekday: WEEKDAYS[get("weekday")] ?? 0,
    date: `${year}-${pad(month)}-${pad(day)}`,
    minutes: hour * 60 + minute,
  };
}

/** Offset of `tz` from UTC at `instant`, in ms (Rome summer = +7_200_000). */
export function tzOffsetMs(instant: Date, tz: string): number {
  const p = zonedParts(instant, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** The instant at which the wall clock in `tz` shows `date` + `minutes`. */
export function zonedToUtc(date: string, minutes: number, tz: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, 0, minutes);
  const offset1 = tzOffsetMs(new Date(guess), tz);
  let result = guess - offset1;
  const offset2 = tzOffsetMs(new Date(result), tz);
  if (offset2 !== offset1) result = guess - offset2;
  return new Date(result);
}

export function startOfDayUtc(date: string, tz: string): Date {
  return zonedToUtc(date, 0, tz);
}

export function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function isDateString(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

export function diffDays(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(ay, am - 1, ad) - Date.UTC(by, bm - 1, bd)) / 86_400_000);
}

export function weekdayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Monday of the week containing `date`. */
export function startOfWeek(date: string): string {
  const wd = weekdayOf(date);
  return addDays(date, wd === 0 ? -6 : 1 - wd);
}

export function todayIn(tz: string, now = new Date()): string {
  return zonedParts(now, tz).date;
}

export function minutesToHHMM(minutes: number): string {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

export function hhmmToMinutes(value: string): number | null {
  const m = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 24 || min > 59 || (h === 24 && min > 0)) return null;
  return h * 60 + min;
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();
}

// ---------- display formatting ----------
// Backward-compatible wrappers over the i18n date core (src/i18n/datefmt.ts): same signatures,
// but deterministic output (no Intl long formats) in all 8 locales. `locale` accepts a Locale or
// an Intl tag such as "it-IT"; anything else falls back to English. New code uses @/i18n/datefmt.

function resolveLocale(locale: Locale | string): Locale {
  return isLocale(locale) ? locale : (negotiate(locale) ?? "en");
}

export function formatTime(instant: Date, tz: string, _locale: Locale | string = "en"): string {
  return fmtTime(instant, tz);
}

export function formatDate(
  instant: Date,
  tz: string,
  locale: Locale | string = "en",
  style: "long" | "short" | "weekday" = "long",
): string {
  return fmtDay(zonedDate(instant, tz), style, resolveLocale(locale));
}

export function formatDateTime(instant: Date, tz: string, locale: Locale | string = "en"): string {
  return `${formatDate(instant, tz, locale, "weekday")}, ${formatTime(instant, tz, locale)}`;
}

/** Format a calendar date string (no time zone involved). */
export function formatDay(date: string, locale: Locale | string = "en", style: "long" | "short" | "weekday" = "weekday") {
  return fmtDay(date, style, resolveLocale(locale));
}

export function relativeDayLabel(date: string, today: string, locale: Locale | string = "en"): string {
  return fmtRelativeDay(date, today, resolveLocale(locale));
}
