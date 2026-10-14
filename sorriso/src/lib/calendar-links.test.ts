import { describe, expect, it } from "vitest";
import { googleCalendarUrl } from "./calendar-links";

describe("googleCalendarUrl", () => {
  const event = {
    title: "Appointment at Studio Bianchi",
    start: new Date("2026-10-20T08:30:00Z"),
    end: new Date("2026-10-20T09:00:00Z"),
    location: "Via Torino 42, Milano",
  };

  it("builds a Google Calendar template link with the time and place", () => {
    const url = new URL(googleCalendarUrl(event));
    expect(url.origin + url.pathname).toBe("https://calendar.google.com/calendar/render");
    expect(url.searchParams.get("action")).toBe("TEMPLATE");
    expect(url.searchParams.get("text")).toBe("Appointment at Studio Bianchi");
    expect(url.searchParams.get("dates")).toBe("20261020T083000Z/20261020T090000Z");
    expect(url.searchParams.get("location")).toBe("Via Torino 42, Milano");
  });

  it("never carries a manage link or any details field", () => {
    // Extra properties (an old caller passing details) are ignored, not forwarded.
    const legacy = { ...event, details: "https://sorriso.test/a/SECRET_TOKEN_123" } as Parameters<typeof googleCalendarUrl>[0];
    const url = googleCalendarUrl(legacy);
    expect(url).not.toContain("SECRET_TOKEN_123");
    expect(decodeURIComponent(url)).not.toMatch(/\/a\/[A-Za-z0-9_-]+/);
    expect(new URL(url).searchParams.has("details")).toBe(false);
  });
});
