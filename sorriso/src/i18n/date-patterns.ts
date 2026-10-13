/**
 * Date patterns per locale, written by hand (names come from the generated calendar-names.ts).
 *
 * Placeholders:
 *   {weekday} long weekday     {wd}  short weekday       {d}    day number
 *   {month}   month after a day number (Polish genitive)  {mon}  short month
 *   {monthAlone} month on its own (Polish nominative)     {year} four-digit year
 *   {date} {time} in `at`
 *
 * Weekday and month names are lower case in every locale except en and de; callers that start
 * a sentence or a heading with a date use capitalizeFirst().
 */
import type { Locale } from "./config";

export type DatePatterns = {
  /** "martedì 13 ottobre 2026" */
  long: string;
  /** "martedì 13 ottobre" */
  medium: string;
  /** "mar 13 ott" */
  weekday: string;
  /** "13 ott" */
  short: string;
  /** "ottobre 2026" */
  monthYear: string;
  /** "{date} alle {time}" */
  at: string;
  /** Override of `at` for times between 01:00 and 01:59, where the article is singular (es "a la 01:30"). */
  atOne?: string;
  /** Lower case; fmtRelativeDay capitalises. */
  today: string;
  tomorrow: string;
};

/*
 * ro and pl put a comma after the weekday ("marți, 13 octombrie", "wtorek, 13 października"),
 * as CLDR and both languages' usage do; F1 listed them without one.
 */
export const DATE_PATTERNS: Record<Locale, DatePatterns> = {
  it: {
    long: "{weekday} {d} {month} {year}",
    medium: "{weekday} {d} {month}",
    weekday: "{wd} {d} {mon}",
    short: "{d} {mon}",
    monthYear: "{monthAlone} {year}",
    at: "{date} alle {time}",
    today: "oggi",
    tomorrow: "domani",
  },
  en: {
    long: "{weekday} {d} {month} {year}",
    medium: "{weekday} {d} {month}",
    weekday: "{wd} {d} {mon}",
    short: "{d} {mon}",
    monthYear: "{monthAlone} {year}",
    at: "{date} at {time}",
    today: "today",
    tomorrow: "tomorrow",
  },
  de: {
    long: "{weekday}, {d}. {month} {year}",
    medium: "{weekday}, {d}. {month}",
    weekday: "{wd}, {d}. {mon}",
    short: "{d}. {mon}",
    monthYear: "{monthAlone} {year}",
    at: "{date} um {time}",
    today: "heute",
    tomorrow: "morgen",
  },
  fr: {
    long: "{weekday} {d} {month} {year}",
    medium: "{weekday} {d} {month}",
    weekday: "{wd} {d} {mon}",
    short: "{d} {mon}",
    monthYear: "{monthAlone} {year}",
    at: "{date} à {time}",
    today: "aujourd'hui",
    tomorrow: "demain",
  },
  es: {
    long: "{weekday}, {d} de {month} de {year}",
    medium: "{weekday}, {d} de {month}",
    weekday: "{wd}, {d} {mon}",
    short: "{d} {mon}",
    monthYear: "{monthAlone} de {year}",
    at: "{date} a las {time}",
    atOne: "{date} a la {time}",
    today: "hoy",
    tomorrow: "mañana",
  },
  pt: {
    long: "{weekday}, {d} de {month} de {year}",
    medium: "{weekday}, {d} de {month}",
    weekday: "{wd}, {d} {mon}",
    short: "{d} {mon}",
    monthYear: "{monthAlone} de {year}",
    at: "{date} às {time}",
    atOne: "{date} à {time}",
    today: "hoje",
    tomorrow: "amanhã",
  },
  ro: {
    long: "{weekday}, {d} {month} {year}",
    medium: "{weekday}, {d} {month}",
    weekday: "{wd}, {d} {mon}",
    short: "{d} {mon}",
    monthYear: "{monthAlone} {year}",
    at: "{date} la {time}",
    today: "azi",
    tomorrow: "mâine",
  },
  pl: {
    long: "{weekday}, {d} {month} {year}",
    medium: "{weekday}, {d} {month}",
    weekday: "{wd}, {d} {mon}",
    short: "{d} {mon}",
    monthYear: "{monthAlone} {year}",
    at: "{date} o {time}",
    today: "dzisiaj",
    tomorrow: "jutro",
  },
};
