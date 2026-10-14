/**
 * The demo seed creates fake practices, patients and API keys. It must never run against a real
 * deployment: it refuses when NODE_ENV is production or the database is not a local file (Turso,
 * sqld), unless ALLOW_DEMO_SEED=1 says so explicitly (scripts/reset.ts sets it for a local reset).
 */
export function demoSeedRefusal(env: Record<string, string | undefined>): string | null {
  if (env.ALLOW_DEMO_SEED === "1") return null;
  if (env.NODE_ENV === "production") return "NODE_ENV is production";
  const url = env.DATABASE_URL ?? "file:./data/sorriso.db";
  if (!url.startsWith("file:")) return "DATABASE_URL is not a local file: URL";
  return null;
}

/**
 * Seeded phone numbers come from a range no real subscriber has: "+39 000…" (Italian numbers never
 * start with 000), so even a misconfigured provider can't text a real person.
 */
export const FAKE_PHONE_PREFIX = "+39000";

export function fakePhone(n: number): string {
  return `${FAKE_PHONE_PREFIX}${String(Math.abs(Math.trunc(n)) % 10_000_000).padStart(7, "0")}`;
}

export function isFakePhone(phone: string | null | undefined): boolean {
  return typeof phone === "string" && phone.replace(/[\s()-]/g, "").startsWith(FAKE_PHONE_PREFIX);
}
