import { describe, expect, it } from "vitest";
import { formatPhone, normalizePhone, parseDialCode } from "./phone";

describe("normalizePhone", () => {
  it("defaults to the Italian dial code and keeps the Italian leading 0", () => {
    expect(normalizePhone("333 123 4567")).toBe("+393331234567");
    expect(normalizePhone("02 1234 5678")).toBe("+390212345678");
    expect(normalizePhone("0039 333 1234567")).toBe("+393331234567");
    expect(normalizePhone("whatsapp:+393331234567")).toBe("+393331234567");
  });

  it("uses the dial code for national numbers and drops other countries' trunk 0", () => {
    expect(normalizePhone("0151 2345 6789", "49")).toBe("+4915123456789");
    expect(normalizePhone("07700 900123", "44")).toBe("+447700900123");
    expect(normalizePhone("912 345 678", "+351")).toBe("+351912345678");
    expect(normalizePhone("333 123 4567", "39")).toBe("+393331234567");
  });

  it("ignores the dial code when the number already has an international prefix", () => {
    expect(normalizePhone("+39 333 1234567", "49")).toBe("+393331234567");
    expect(normalizePhone("0044 7700 900123", "39")).toBe("+447700900123");
  });

  it("falls back to the default for a missing or malformed dial code", () => {
    expect(normalizePhone("333 1234567", null)).toBe("+393331234567");
    expect(normalizePhone("333 1234567", "")).toBe("+393331234567");
    expect(normalizePhone("333 1234567", "0049")).toBe("+393331234567");
    expect(normalizePhone("333 1234567", "1234")).toBe("+393331234567");
    expect(normalizePhone("333 1234567", "abc")).toBe("+393331234567");
  });

  it("rejects what doesn't look like a phone number", () => {
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone("12")).toBeNull();
    expect(normalizePhone("call me", "49")).toBeNull();
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
