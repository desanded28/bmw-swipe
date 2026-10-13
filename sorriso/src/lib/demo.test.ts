import { afterEach, describe, expect, it, vi } from "vitest";
import { isAllowedRecipient, isDemoMode, isLiveMessaging, messagingAllowlist } from "./demo";

afterEach(() => vi.unstubAllEnvs());

describe("demo mode and the messaging allowlist", () => {
  it("parses and normalises MESSAGING_ALLOWLIST", () => {
    vi.stubEnv("MESSAGING_ALLOWLIST", " +39 333 123 4567, Dev@Example.com ,,whatsapp:+447700900123");
    expect([...messagingAllowlist()]).toEqual(["+393331234567", "dev@example.com", "+447700900123"]);
  });

  it("demo mode sends only to the allowlist, even in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DEMO_MODE", "1");
    vi.stubEnv("MESSAGING_ALLOWLIST", "+393331234567,dev@example.com");
    expect(isDemoMode()).toBe(true);
    expect(isAllowedRecipient("whatsapp:+393331234567")).toBe(true);
    expect(isAllowedRecipient("DEV@example.com")).toBe(true);
    expect(isAllowedRecipient("+393339999999")).toBe(false);
    vi.stubEnv("MESSAGING_ALLOWLIST", "");
    expect(isAllowedRecipient("+393331234567")).toBe(false);
  });

  it("only the live deployment sends to anyone; other environments only to the allowlist", () => {
    vi.stubEnv("DEMO_MODE", "");
    vi.stubEnv("MESSAGING_ALLOWLIST", "");
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("MESSAGING_LIVE", "1");
    expect(isDemoMode()).toBe(false);
    expect(isLiveMessaging()).toBe(true);
    expect(isAllowedRecipient("+393339999999")).toBe(true);
    vi.stubEnv("VERCEL_ENV", "production");
    expect(isAllowedRecipient("+393339999999")).toBe(true);
    vi.stubEnv("NODE_ENV", "development");
    expect(isAllowedRecipient("+393339999999")).toBe(false);
    vi.stubEnv("MESSAGING_ALLOWLIST", "+393339999999");
    expect(isAllowedRecipient("+39 333 999 9999")).toBe(true);
  });

  it("fails closed in production builds that are not the live deployment", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DEMO_MODE", "");
    vi.stubEnv("MESSAGING_ALLOWLIST", "");
    // A Vercel preview, even with production's MESSAGING_LIVE copied over.
    vi.stubEnv("MESSAGING_LIVE", "1");
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(isAllowedRecipient("+393331234567")).toBe(false);
    // A staging box running `next start` without the explicit opt-in.
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("MESSAGING_LIVE", "");
    expect(isLiveMessaging()).toBe(false);
    expect(isAllowedRecipient("+393331234567")).toBe(false);
  });
});
