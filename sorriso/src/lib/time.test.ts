import { describe, expect, it } from "vitest";
import { addDays, diffDays, startOfWeek, weekdayOf, zonedParts, zonedToUtc } from "./time";

const ROME = "Europe/Rome";

describe("time zones", () => {
  it("converts wall-clock time to UTC in winter and summer", () => {
    expect(zonedToUtc("2026-01-15", 9 * 60, ROME).toISOString()).toBe("2026-01-15T08:00:00.000Z");
    expect(zonedToUtc("2026-07-01", 9 * 60, ROME).toISOString()).toBe("2026-07-01T07:00:00.000Z");
  });

  it("handles the DST switch days", () => {
    // 29 March 2026: clocks jump 02:00 → 03:00
    expect(zonedToUtc("2026-03-29", 9 * 60, ROME).toISOString()).toBe("2026-03-29T07:00:00.000Z");
    expect(zonedToUtc("2026-03-28", 9 * 60, ROME).toISOString()).toBe("2026-03-28T08:00:00.000Z");
    // 25 October 2026: clocks go back 03:00 → 02:00
    expect(zonedToUtc("2026-10-25", 9 * 60, ROME).toISOString()).toBe("2026-10-25T08:00:00.000Z");
    expect(zonedToUtc("2026-10-24", 9 * 60, ROME).toISOString()).toBe("2026-10-24T07:00:00.000Z");
  });

  it("round-trips through zonedParts", () => {
    const instant = zonedToUtc("2026-10-13", 14 * 60 + 45, ROME);
    const p = zonedParts(instant, ROME);
    expect(p.date).toBe("2026-10-13");
    expect(p.minutes).toBe(14 * 60 + 45);
    expect(p.weekday).toBe(2);
  });

  it("does calendar arithmetic on date strings", () => {
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(diffDays("2027-01-02", "2026-12-30")).toBe(3);
    expect(weekdayOf("2026-10-13")).toBe(2);
    expect(startOfWeek("2026-10-18")).toBe("2026-10-12");
    expect(startOfWeek("2026-10-12")).toBe("2026-10-12");
  });
});
