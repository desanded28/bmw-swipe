import { describe, expect, it } from "vitest";
import { CATEGORY_LABELS, formatPrice, pluralize } from "@/lib/format";
import { LOCALES } from "./config";
import { formatDecimal, formatMoney, formatPercent } from "./number";

const NB = "\u00a0";
// Make the no-break spaces visible in failure output.
const show = (s: string) => s.replaceAll(NB, "~");

describe("formatMoney", () => {
  const cases: Record<string, [number, string][]> = {
    en: [[2500, "€25"], [250000, "€2,500"], [1250000, "€12,500"], [2550, "€25.50"], [123456789, "€1,234,567.89"]],
    it: [[2500, "25~€"], [250000, "2.500~€"], [1250000, "12.500~€"], [2550, "25,50~€"]],
    de: [[2500, "25~€"], [250000, "2.500~€"], [1250000, "12.500~€"], [2550, "25,50~€"]],
    fr: [[2500, "25~€"], [250000, "2~500~€"], [1250000, "12~500~€"], [2550, "25,50~€"]],
    es: [[2500, "25~€"], [250000, "2500~€"], [1250000, "12.500~€"], [2550, "25,50~€"]],
    pt: [[2500, "25~€"], [250000, "2500~€"], [1250000, "12~500~€"], [2550, "25,50~€"]],
    ro: [[2500, "25~€"], [250000, "2.500~€"], [1250000, "12.500~€"], [2550, "25,50~€"]],
    pl: [[2500, "25~€"], [250000, "2500~€"], [1250000, "12~500~€"], [123456789, "1~234~567,89~€"]],
  };

  it("covers every locale", () => {
    expect(Object.keys(cases).sort()).toEqual([...LOCALES].sort());
  });

  it.each(Object.entries(cases))("%s", (locale, rows) => {
    for (const [cents, expected] of rows) expect(show(formatMoney(cents, locale as (typeof LOCALES)[number]))).toBe(expected);
  });

  it("handles zero and negative amounts", () => {
    expect(formatMoney(0, "en")).toBe("€0");
    expect(formatMoney(-2550, "en")).toBe("-€25.50");
    expect(show(formatMoney(-250000, "it"))).toBe("-2.500~€");
  });
});

describe("formatDecimal", () => {
  it("uses local separators and trims trailing zeros unless digits is given", () => {
    expect(formatDecimal(4.5, "en")).toBe("4.5");
    expect(formatDecimal(4.5, "it")).toBe("4,5");
    expect(formatDecimal(3, "de")).toBe("3");
    expect(formatDecimal(4.25, "fr", 1)).toBe("4,3");
    expect(formatDecimal(4, "es", 1)).toBe("4,0");
    expect(show(formatDecimal(12345.678, "fr"))).toBe("12~345,68");
    expect(formatDecimal(2500.5, "pl")).toBe("2500,5");
    expect(formatDecimal(1234567, "en")).toBe("1,234,567");
    expect(formatDecimal(-1.5, "it")).toBe("-1,5");
    expect(formatDecimal(-0.001, "it")).toBe("0");
  });
});

describe("formatPercent", () => {
  it("places the sign the local way", () => {
    expect(formatPercent(0.12, "en")).toBe("12%");
    expect(formatPercent(0.12, "it")).toBe("12%");
    expect(show(formatPercent(0.12, "de"))).toBe("12~%");
    expect(show(formatPercent(0.125, "fr", 1))).toBe("12,5~%");
    expect(formatPercent(0.125, "pl", 1)).toBe("12,5%");
  });
});

describe("legacy wrappers (src/lib/format.ts)", () => {
  it("keep their signatures and defaults (formatPrice: Italian amounts, English labels)", () => {
    expect(formatPrice(null)).toBe("Price on request");
    expect(formatPrice(undefined)).toBe("Price on request");
    expect(formatPrice(0)).toBe("Free");
    // Before the core this was Intl it-IT: "25 €". Its six callers pass no locale.
    expect(show(formatPrice(2500))).toBe("25~€");
    expect(show(formatPrice(2550))).toBe("25,50~€");
    expect(formatPrice(2500, "en")).toBe("€25");
    expect(show(formatPrice(250000, "it-IT"))).toBe("2.500~€");
    expect(show(formatPrice(2550, "pl"))).toBe("25,50~€");
    expect(pluralize(1, "day")).toBe("1 day");
    expect(pluralize(2, "day")).toBe("2 days");
    expect(pluralize(0, "person", "people")).toBe("0 people");
    expect(CATEGORY_LABELS.checkup).toBe("Check-up & first visit");
  });
});
