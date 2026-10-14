import { describe, expect, it } from "vitest";
import { formatPhone, normalizePhone, parseDialCode } from "./phone";

describe("normalizePhone", () => {
  it("applies each country's trunk-prefix rule (acceptance table)", () => {
    expect(normalizePhone("0151 2345678", "49")).toBe("+491512345678");
    expect(normalizePhone("0722 123 456", "40")).toBe("+40722123456");
    expect(normalizePhone("600 123 456", "48")).toBe("+48600123456");
    expect(normalizePhone("02 1234 5678", "39")).toBe("+390212345678");
  });

  it.each([
    // [typed, dial code, E.164]
    ["07700 900123", "44", "+447700900123"],
    ["7700 900123", "44", "+447700900123"],
    ["0151 2345 6789", "49", "+4915123456789"],
    ["06 12 34 56 78", "33", "+33612345678"],
    ["6 12 34 56 78", "33", "+33612345678"],
    ["0722 123 456", "40", "+40722123456"],
    ["612 345 678", "34", "+34612345678"],
    ["912 345 678", "351", "+351912345678"],
    ["912 345 678", "+351", "+351912345678"],
    ["600-123-456", "48", "+48600123456"],
    ["333 123 4567", "39", "+393331234567"],
    ["06 1234 5678", "39", "+390612345678"],
    ["333/1234567", "39", "+393331234567"],
  ])("%s with +%s -> %s", (typed, dial, e164) => {
    expect(normalizePhone(typed, dial)).toBe(e164);
  });

  it("defaults to the Italian dial code and keeps the Italian leading 0", () => {
    expect(normalizePhone("333 123 4567")).toBe("+393331234567");
    expect(normalizePhone("02 1234 5678")).toBe("+390212345678");
    expect(normalizePhone("0039 333 1234567")).toBe("+393331234567");
    expect(normalizePhone("whatsapp:+393331234567")).toBe("+393331234567");
  });

  it("leaves a number with an international prefix unchanged, whatever dial code is passed", () => {
    for (const dial of ["39", "44", "49", "33", "34", "351", "40", "48", null, undefined, "garbage"]) {
      expect(normalizePhone("+44 7700 900123", dial)).toBe("+447700900123");
      expect(normalizePhone("0044 7700 900123", dial)).toBe("+447700900123");
      expect(normalizePhone("+39 333 1234567", dial)).toBe("+393331234567");
    }
  });

  it("drops the bracketed trunk 0 written after a country code", () => {
    expect(normalizePhone("+44 (0)7700 900123", "39")).toBe("+447700900123");
    expect(normalizePhone("+49 (0)151 2345678")).toBe("+491512345678");
    expect(normalizePhone("0049 (0) 151 2345678")).toBe("+491512345678");
  });

  it("falls back to the default for a missing or malformed dial code", () => {
    expect(normalizePhone("333 1234567", null)).toBe("+393331234567");
    expect(normalizePhone("333 1234567", "")).toBe("+393331234567");
    expect(normalizePhone("333 1234567", "0049")).toBe("+393331234567");
    expect(normalizePhone("333 1234567", "1234")).toBe("+393331234567");
    expect(normalizePhone("333 1234567", "abc")).toBe("+393331234567");
  });

  it("returns null for garbage", () => {
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone(undefined)).toBeNull();
    expect(normalizePhone("12")).toBeNull();
    expect(normalizePhone("call me", "49")).toBeNull();
    expect(normalizePhone("abc-def-ghij")).toBeNull();
    expect(normalizePhone("+0 123 456 789")).toBeNull();
    expect(normalizePhone("+39 333 1234567 8901 2345")).toBeNull();
    expect(normalizePhone("333 123 4567 ext 12")).toBeNull();
  });
});

describe("parseDialCode", () => {
  it("accepts 1-3 digits with an optional plus", () => {
    expect(parseDialCode("1")).toBe("1");
    expect(parseDialCode("+351")).toBe("351");
    expect(parseDialCode(" 49 ")).toBe("49");
    expect(parseDialCode("0")).toBeNull();
    expect(parseDialCode("3510")).toBeNull();
    expect(parseDialCode(undefined)).toBeNull();
  });
});

describe("formatPhone", () => {
  it("groups Italian numbers and leaves other numbers as they are", () => {
    const formatted = formatPhone("+393331234567");
    expect(formatted.startsWith("+39 333 ")).toBe(true);
    expect(formatted.replace(/\s/g, "")).toBe("+393331234567");
    expect(formatPhone("+447700900123")).toBe("+447700900123");
    expect(formatPhone(null)).toBe("");
  });
});
