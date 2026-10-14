import type { SeedContext } from "../seed";

/**
 * Continuity-of-care demo data (WP8), run by scripts/seed.ts after the core seed: recall
 * intervals set by clinicians and due recalls, risk levels on upcoming visits, the anamnesis
 * form template and a few submissions (some missing, one with a red flag). Deterministic, like
 * the core seed.
 *
 * STUB: adds nothing yet.
 */
export async function seedCare(ctx: SeedContext): Promise<void> {
  void ctx;
}
