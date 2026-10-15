import { insecureDemoKeysAllowed } from "../crypto";

/**
 * Sorriso's identity as controller (marketplace bookings, reviews, the privacy center), from the
 * deployment's environment (.env.example PLATFORM_*). Its notices must name the legal entity and
 * give a way to reach it (Art. 13(1)(a)-(b) GDPR): without these the notice says only the app's
 * name, so a production server refuses to start (src/instrumentation-node.ts).
 */
export const PLATFORM_IDENTITY_VARS = ["PLATFORM_LEGAL_NAME", "PLATFORM_ADDRESS", "PLATFORM_PRIVACY_EMAIL"] as const;

export function missingPlatformIdentity(env: Record<string, string | undefined> = process.env): string[] {
  return PLATFORM_IDENTITY_VARS.filter((name) => !env[name]?.trim());
}

/**
 * Startup check: in production every PLATFORM_IDENTITY_VARS is set. A local demo of a production
 * build (insecureDemoKeysAllowed: DEMO_MODE=1 and SORRISO_ALLOW_DEV_KEY=1 on a local database) is
 * only warned, loudly.
 */
export function assertPlatformIdentityConfigured(): void {
  if (process.env.NODE_ENV !== "production") return;
  const missing = missingPlatformIdentity();
  if (!missing.length) return;
  if (insecureDemoKeysAllowed()) {
    process.stderr.write(`[privacy] DEMO: Sorriso's privacy notice has no controller identity (${missing.join(", ")} not set).\n`);
    return;
  }
  throw new Error(`Sorriso's controller identity for the privacy notices is incomplete (Art. 13(1)(a)-(b) GDPR): set ${missing.join(", ")}`);
}
