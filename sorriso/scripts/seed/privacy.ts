import type { SeedContext } from "../seed";

/**
 * Privacy demo data (WP5), run by scripts/seed.ts after the core seed. It must accept the
 * current DPA, terms and staff instructions for every demo member (recordLegalAcceptance), so
 * the dashboard gates and canAcceptOnlineBookings() let the demo work; it can add consents,
 * an open privacy request or two and audit history. Deterministic, like the core seed.
 *
 * STUB: adds nothing yet.
 */
export async function seedPrivacy(ctx: SeedContext): Promise<void> {
  void ctx;
}
