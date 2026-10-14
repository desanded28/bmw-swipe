/**
 * Idempotent data backfill for migration 0003 (run by scripts/migrate.ts and the test fixtures),
 * for what the SQL can't do (it needs sha256 or the app's date arithmetic):
 *  1. api_keys: keys issued before expiries existed (expires_at NULL) get created_at + 12 months,
 *     the date apiKeyExpiry() in src/lib/api.ts already enforces, so the data says what the code does.
 *  2. api_keys: any key holding the old published demo secret (printed on the developers page) is
 *     revoked. checkApiKey() already refuses it by hash; this makes the row say so too.
 */
import { and, eq, isNull } from "drizzle-orm";
import type { DB } from "../src/db";
import { apiKeys } from "../src/db/schema";
import { sha256 } from "../src/lib/ids";

/** Same rule as API_KEY_DEFAULT_MONTHS / addMonths in src/lib/api.ts (kept here: scripts can't load Next modules). */
const DEFAULT_EXPIRY_MONTHS = 12;
const PUBLISHED_DEMO_KEYS = ["sk_demo_studio_bianchi_local_only"];

function addMonths(d: Date, months: number): Date {
  const out = new Date(d);
  out.setUTCMonth(out.getUTCMonth() + months);
  return out;
}

export async function backfill0003(db: DB, now: Date = new Date()) {
  const open = await db.select({ id: apiKeys.id, createdAt: apiKeys.createdAt }).from(apiKeys).where(isNull(apiKeys.expiresAt));
  for (const k of open) {
    await db
      .update(apiKeys)
      .set({ expiresAt: addMonths(k.createdAt, DEFAULT_EXPIRY_MONTHS) })
      .where(and(eq(apiKeys.id, k.id), isNull(apiKeys.expiresAt)));
  }

  let demoKeysRevoked = 0;
  for (const secret of PUBLISHED_DEMO_KEYS) {
    const res = await db
      .update(apiKeys)
      .set({ revokedAt: now })
      .where(and(eq(apiKeys.keyHash, sha256(secret)), isNull(apiKeys.revokedAt)));
    demoKeysRevoked += res.rowsAffected;
  }
  return { apiKeyExpiriesSet: open.length, demoKeysRevoked };
}
