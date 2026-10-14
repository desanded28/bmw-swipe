/**
 * Idempotent data backfill for migration 0001 (run by scripts/migrate.ts and the test fixtures).
 *  1. appointments: raw manage tokens → sha256 hash + encrypted copy; the old column keeps a
 *     non-secret placeholder ("h:<id>"). Links already sent keep working (lookup by hash).
 *  2. practitioners: raw ICS feed tokens → hash; placeholder in the old column. Feeds stay off
 *     until the practice enables them (privacy.icsFeedsEnabled).
 *  3. practitioners.languages (free text) → spoken_languages (ISO 639-1 codes).
 */
import { and, eq, isNull, like, not, sql } from "drizzle-orm";
import type { DB } from "../src/db";
import { appointments, practitioners, type SpokenLanguage } from "../src/db/schema";
import { sha256Hex } from "../src/lib/crypto";

const LANGUAGE_WORDS: Record<string, SpokenLanguage> = {
  italiano: "it", italian: "it", english: "en", inglese: "en", deutsch: "de", german: "de", tedesco: "de",
  français: "fr", francais: "fr", french: "fr", francese: "fr", español: "es", espanol: "es", spanish: "es",
  spagnolo: "es", português: "pt", portugues: "pt", portuguese: "pt", portoghese: "pt", română: "ro",
  romana: "ro", romanian: "ro", rumeno: "ro", polski: "pl", polish: "pl", polacco: "pl", shqip: "sq",
  albanian: "sq", albanese: "sq", українська: "uk", ukrainian: "uk", ucraino: "uk", русский: "ru",
  russian: "ru", russo: "ru", arabic: "ar", arabo: "ar", العربية: "ar", chinese: "zh", cinese: "zh", 中文: "zh",
};

export function parseSpokenLanguages(text: string | null | undefined): SpokenLanguage[] {
  const out = new Set<SpokenLanguage>();
  for (const word of (text ?? "").toLowerCase().split(/[\s,;/·|]+/)) {
    const code = LANGUAGE_WORDS[word.trim()];
    if (code) out.add(code);
  }
  return [...out];
}

export async function backfill0001(db: DB) {
  let tokens = 0;
  for (;;) {
    const batch = await db
      .select({ id: appointments.id, manageToken: appointments.manageToken })
      .from(appointments)
      .where(and(isNull(appointments.manageTokenHash), not(like(appointments.manageToken, "h:%"))))
      .limit(500);
    if (!batch.length) break;
    await db.transaction(async (tx) => {
      for (const a of batch) {
        await tx
          .update(appointments)
          // manageTokenEnc is an encryptedText column: the token is encrypted on write.
          .set({ manageTokenHash: sha256Hex(a.manageToken), manageTokenEnc: a.manageToken, manageToken: `h:${a.id}` })
          .where(eq(appointments.id, a.id));
      }
    });
    tokens += batch.length;
  }

  const feeds = await db
    .select({
      id: practitioners.id,
      icsToken: practitioners.icsToken,
      icsTokenHash: practitioners.icsTokenHash,
      languages: practitioners.languages,
      spoken: practitioners.spokenLanguages,
    })
    .from(practitioners);
  let icsMoved = 0;
  for (const p of feeds) {
    const patch: Partial<typeof practitioners.$inferInsert> = {};
    if (!p.icsToken.startsWith("h:")) {
      patch.icsToken = `h:${p.id}`;
      // A feed already issued under the hash (rotateIcsToken) is the live one: re-running the backfill
      // only clears the leftover plaintext, never replaces that feed, re-enables it or extends it.
      if (!p.icsTokenHash) {
        patch.icsTokenHash = sha256Hex(p.icsToken);
        patch.icsEnabled = true;
        patch.icsTokenExpiresAt = new Date(Date.now() + 365 * 86_400_000);
        icsMoved++;
      }
    }
    if (!p.spoken.length) patch.spokenLanguages = parseSpokenLanguages(p.languages);
    if (Object.keys(patch).length) await db.update(practitioners).set(patch).where(eq(practitioners.id, p.id));
  }

  // Sanity: nothing left in plaintext.
  const [{ left }] = await db
    .select({ left: sql<number>`count(*)` })
    .from(appointments)
    .where(not(like(appointments.manageToken, "h:%")));
  return { tokens, icsMoved, plaintextTokensLeft: Number(left) };
}
