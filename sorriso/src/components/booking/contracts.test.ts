import { describe, expect, it } from "vitest";
import { normalizePhone } from "@/lib/phone";
import { PRACTICE_DIAL_CODE } from "./contracts";

describe("booking form contracts", () => {
  it("starts the phone field on the practices' country, not the page language", () => {
    // An Italian mobile typed without a prefix on /en or /de stays Italian.
    expect(PRACTICE_DIAL_CODE).toBe("39");
    expect(normalizePhone("333 123 4567", PRACTICE_DIAL_CODE)).toBe("+393331234567");
  });
});
