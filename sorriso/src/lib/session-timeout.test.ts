import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getT } from "@/i18n/t";
import { IDLE_TIMEOUT_MS } from "./auth";
import { IDLE_WARNING_MS, idleWarningDelay } from "./session-timeout";

describe("the dashboard's idle warning (WCAG 2.2.1)", () => {
  it("comes 2 minutes before the 30-minute idle sign-out, which leaves far more than 20 seconds to extend", () => {
    expect(idleWarningDelay(IDLE_TIMEOUT_MS)).toBe(28 * 60_000);
    expect(IDLE_WARNING_MS).toBeGreaterThanOrEqual(20_000);
    expect(idleWarningDelay(60_000)).toBe(0);
  });

  it("is mounted on every dashboard page, with the real idle limit, and offers a one-click extension", () => {
    const layout = readFileSync(path.join(__dirname, "../app/dashboard/layout.tsx"), "utf8");
    expect(layout).toContain("<SessionTimeout idleMs={IDLE_TIMEOUT_MS} />");
    const component = readFileSync(path.join(__dirname, "../components/dashboard/SessionTimeout.tsx"), "utf8");
    expect(component).toContain("keepSessionAlive()");
    expect(getT("en", "dashboard")("session.idleBody", { count: 2 })).toContain("2 minutes");
  });
});
