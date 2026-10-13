import { describe, expect, it } from "vitest";
import { fmtDay as legacyFmtDay, fmtWhen as legacyFmtWhen } from "@/lib/datefmt";
import { formatDate, formatDateTime, formatDay, formatTime, relativeDayLabel } from "@/lib/time";
import { CALENDAR_NAMES } from "./calendar-names";
import { LOCALES, type Locale } from "./config";
import { capitalizeFirst, fmtDay, fmtRelativeDay, fmtTime, fmtWhen, zonedDate, zonedTime, type DayStyle } from "./datefmt";

const ROME = "Europe/Rome";
const STYLES: DayStyle[] = ["long", "medium", "weekday", "short", "wd", "monthYear"];

// Tuesday 13 October 2026, in every locale and style. Reviewed by hand: change only on purpose.
const TABLE: Record<Locale, Record<DayStyle, string>> = {
  it: {
    long: "martedì 13 ottobre 2026",
    medium: "martedì 13 ottobre",
    weekday: "mar 13 ott",
    short: "13 ott",
    wd: "mar",
    monthYear: "ottobre 2026",
  },
  en: {
    long: "Tuesday 13 October 2026",
    medium: "Tuesday 13 October",
    weekday: "Tue 13 Oct",
    short: "13 Oct",
    wd: "Tue",
    monthYear: "October 2026",
  },
  de: {
    long: "Dienstag, 13. Oktober 2026",
    medium: "Dienstag, 13. Oktober",
    weekday: "Di., 13. Okt.",
    short: "13. Okt.",
    wd: "Di.",
    monthYear: "Oktober 2026",
  },
  fr: {
    long: "mardi 13 octobre 2026",
    medium: "mardi 13 octobre",
    weekday: "mar. 13 oct.",
    short: "13 oct.",
    wd: "mar.",
    monthYear: "octobre 2026",
  },
  es: {
    long: "martes, 13 de octubre de 2026",
    medium: "martes, 13 de octubre",
    weekday: "mar, 13 oct",
    short: "13 oct",
    wd: "mar",
    monthYear: "octubre de 2026",
  },
  pt: {
    long: "terça-feira, 13 de outubro de 2026",
    medium: "terça-feira, 13 de outubro",
    weekday: "terça, 13 out.",
    short: "13 out.",
    wd: "terça",
    monthYear: "outubro de 2026",
  },
  ro: {
    long: "marți, 13 octombrie 2026",
    medium: "marți, 13 octombrie",
    weekday: "mar., 13 oct.",
    short: "13 oct.",
    wd: "mar.",
    monthYear: "octombrie 2026",
  },
  pl: {
    long: "wtorek, 13 października 2026",
    medium: "wtorek, 13 października",
    weekday: "wt., 13 paź",
    short: "13 paź",
    wd: "wt.",
    monthYear: "październik 2026",
  },
};

describe("calendar names", () => {
  it.each(LOCALES)("%s has 7 weekdays and 12 months of every kind", (l) => {
    const n = CALENDAR_NAMES[l];
    for (const list of [n.weekdays, n.weekdaysShort]) expect(list.filter(Boolean)).toHaveLength(7);
    for (const list of [n.months, n.monthsStandalone, n.monthsShort]) {
      expect(list.filter(Boolean)).toHaveLength(12);
      for (const name of list) expect(name).not.toMatch(/^\d+$/);
    }
  });
});

describe("fmtDay", () => {
  it.each(LOCALES)("%s, every style", (l) => {
    for (const style of STYLES) expect(`${style}: ${fmtDay("2026-10-13", style, l)}`).toBe(`${style}: ${TABLE[l][style]}`);
  });

  it("uses the Polish genitive after a day number and the nominative alone", () => {
    expect(fmtDay("2026-01-05", "medium", "pl")).toBe("poniedziałek, 5 stycznia");
    expect(fmtDay("2026-01-05", "monthYear", "pl")).toBe("styczeń 2026");
    expect(fmtDay("2026-07-01", "long", "pl")).toBe("środa, 1 lipca 2026");
    expect(fmtDay("2026-07-01", "monthYear", "pl")).toBe("lipiec 2026");
  });

  it("gets weekdays right across month, year and DST boundaries", () => {
    expect(fmtDay("2026-03-29", "medium", "en")).toBe("Sunday 29 March");
    expect(fmtDay("2026-10-25", "medium", "it")).toBe("domenica 25 ottobre");
    expect(fmtDay("2026-12-31", "long", "de")).toBe("Donnerstag, 31. Dezember 2026");
    expect(fmtDay("2027-01-01", "long", "fr")).toBe("vendredi 1 janvier 2027");
    expect(fmtDay("2028-02-29", "weekday", "es")).toBe("mar, 29 feb");
  });

  it("returns invalid input unchanged", () => {
    expect(fmtDay("2026-02-30", "long", "en")).toBe("2026-02-30");
    expect(fmtDay("tomorrow", "long", "en")).toBe("tomorrow");
  });
});

describe("zoned time and fmtWhen", () => {
  it("formats an instant in the practice time zone", () => {
    const at = "2026-10-13T06:30:00Z";
    expect(zonedDate(at, ROME)).toBe("2026-10-13");
    expect(zonedTime(at, ROME)).toBe("08:30");
    const expected: Record<Locale, string> = {
      it: "martedì 13 ottobre alle 08:30",
      en: "Tuesday 13 October at 08:30",
      de: "Dienstag, 13. Oktober um 08:30",
      fr: "mardi 13 octobre à 08:30",
      es: "martes, 13 de octubre a las 08:30",
      pt: "terça-feira, 13 de outubro às 08:30",
      ro: "marți, 13 octombrie la 08:30",
      pl: "wtorek, 13 października o 08:30",
    };
    for (const l of LOCALES) expect(fmtWhen(at, ROME, l)).toBe(expected[l]);
    expect(fmtWhen(new Date(at), ROME, "en", "weekday")).toBe("Tue 13 Oct at 08:30");
  });

  it("uses the singular article at one o'clock in es and pt", () => {
    const one = "2026-10-12T23:30:00Z"; // 01:30 in Rome
    expect(fmtWhen(one, ROME, "es")).toBe("martes, 13 de octubre a la 01:30");
    expect(fmtWhen(one, ROME, "pt")).toBe("terça-feira, 13 de outubro à 01:30");
    expect(fmtWhen("2026-10-13T11:30:00Z", ROME, "es")).toBe("martes, 13 de octubre a las 13:30");
  });

  it("is DST-safe", () => {
    // 29 March 2026: 02:00 CET jumps to 03:00 CEST at 01:00 UTC.
    expect(fmtTime("2026-03-29T00:30:00Z", ROME)).toBe("01:30");
    expect(fmtTime("2026-03-29T01:30:00Z", ROME)).toBe("03:30");
    // 25 October 2026: 03:00 CEST falls back to 02:00 CET at 01:00 UTC; 02:30 happens twice.
    expect(fmtWhen("2026-10-25T00:30:00Z", ROME, "en")).toBe("Sunday 25 October at 02:30");
    expect(fmtWhen("2026-10-25T01:30:00Z", ROME, "en")).toBe("Sunday 25 October at 02:30");
    expect(fmtWhen("2026-10-25T09:00:00Z", ROME, "it")).toBe("domenica 25 ottobre alle 10:00");
    expect(fmtWhen("2026-07-01T07:00:00Z", ROME, "it")).toBe("mercoledì 1 luglio alle 09:00");
  });

  it("crosses midnight in the zone, never shows 24:00, and honours other zones", () => {
    expect(fmtWhen("2026-10-24T22:00:00Z", ROME, "en", "weekday")).toBe("Sun 25 Oct at 00:00");
    expect(fmtWhen("2026-10-13T03:00:00Z", "America/New_York", "en")).toBe("Monday 12 October at 23:00");
    expect(zonedDate("2026-10-13T03:00:00Z", "UTC")).toBe("2026-10-13");
  });
});

describe("fmtRelativeDay and capitalizeFirst", () => {
  it("says today and tomorrow, else a short date, capitalised", () => {
    expect(fmtRelativeDay("2026-10-13", "2026-10-13", "it")).toBe("Oggi");
    expect(fmtRelativeDay("2026-10-14", "2026-10-13", "it")).toBe("Domani");
    expect(fmtRelativeDay("2026-10-15", "2026-10-13", "it")).toBe("Gio 15 ott");
    expect(fmtRelativeDay("2026-10-12", "2026-10-13", "en")).toBe("Mon 12 Oct");
    expect(fmtRelativeDay("2026-10-13", "2026-10-13", "fr")).toBe("Aujourd'hui");
    expect(fmtRelativeDay("2026-10-14", "2026-10-13", "pl")).toBe("Jutro");
    expect(fmtRelativeDay("2026-03-30", "2026-03-29", "en")).toBe("Tomorrow");
    expect(fmtRelativeDay("2027-01-01", "2026-12-31", "ro")).toBe("Mâine");
  });

  it("upper-cases the first letter only", () => {
    expect(capitalizeFirst("ąbc", "pl")).toBe("Ąbc");
    expect(capitalizeFirst("über", "de")).toBe("Über");
    expect(capitalizeFirst("martedì 13 ottobre", "it")).toBe("Martedì 13 ottobre");
    expect(capitalizeFirst("", "it")).toBe("");
  });
});

describe("legacy wrappers (src/lib/datefmt.ts, src/lib/time.ts)", () => {
  const at = new Date("2026-10-13T06:30:00Z");

  it("keep their English output by default", () => {
    expect(legacyFmtDay("2026-10-13")).toBe("Tue 13 Oct");
    // Every short month is 3 letters, as before the core (CLDR en-GB says "Sept").
    expect(legacyFmtDay("2026-09-15")).toBe("Tue 15 Sep");
    expect(CALENDAR_NAMES.en.monthsShort.every((m) => m.length === 3)).toBe(true);
    expect(legacyFmtDay("2026-10-13", "long")).toBe("Tuesday 13 October 2026");
    expect(legacyFmtWhen(at, ROME)).toBe("Tuesday 13 October at 08:30");
    expect(formatTime(at, ROME)).toBe("08:30");
    expect(formatDate(at, ROME)).toBe("Tuesday 13 October 2026");
    expect(formatDateTime(at, ROME)).toBe("Tue 13 Oct, 08:30");
    expect(formatDay("2026-10-13")).toBe("Tue 13 Oct");
    expect(relativeDayLabel("2026-10-13", "2026-10-13")).toBe("Today");
  });

  it("take a trailing locale (or an Intl tag)", () => {
    expect(legacyFmtDay("2026-10-13", "medium", "pl")).toBe("wtorek, 13 października");
    expect(legacyFmtWhen(at, ROME, "medium", "de")).toBe("Dienstag, 13. Oktober um 08:30");
    expect(formatDate(at, ROME, "it", "long")).toBe("martedì 13 ottobre 2026");
    expect(formatDate(at, ROME, "it-IT", "weekday")).toBe("mar 13 ott");
    expect(formatDay("2026-10-13", "xx")).toBe("Tue 13 Oct");
    expect(relativeDayLabel("2026-10-14", "2026-10-13", "it")).toBe("Domani");
  });
});
