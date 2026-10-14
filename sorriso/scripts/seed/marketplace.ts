import type { SeedContext } from "../seed";

/**
 * Marketplace demo data (WP7), run by scripts/seed.ts after the core seed: the health-fund
 * list and each practice's org_funds, public practitioner profiles (spoken languages, care
 * options, approval, Albo numbers), price types, location accessibility, profile stats and
 * review publication consents. Deterministic, like the core seed.
 *
 * STUB: adds nothing yet.
 */
export async function seedMarketplace(ctx: SeedContext): Promise<void> {
  void ctx;
}
