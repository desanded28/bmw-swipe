/**
 * Re-encrypt every encryptedText column under the active key (the first entry of
 * DATA_ENCRYPTION_KEYS): plaintext rows written before encryption, and rows encrypted with an
 * older key after a rotation (see needsReencrypt in src/lib/crypto.ts). The review texts that
 * src/lib/reviews.ts encrypts itself (comments held for moderation, report details, the author's
 * response, statements of reasons) are rotated too, but plaintext there stays plaintext: a
 * published comment is public (ENCRYPTED_TEXT_VALUES in src/lib/security/reencrypt.ts).
 *
 *   npm run db:encrypt              # rewrite, in batches of 500
 *   npm run db:encrypt -- --dry-run # only count what would change
 *
 * Idempotent: a second run finds nothing to do. Key rotation, in docs/security.md:
 *   1. put the new key first in DATA_ENCRYPTION_KEYS ("k3:<new>,k2:<old>") and deploy;
 *   2. run this script against the production database;
 *   3. once it reports 0 left (and backups older than your retention have rolled over), drop the old key.
 */
import { client } from "../src/db";
import { activeKeyId, reencryptColumns } from "../src/lib/security/reencrypt";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const sizeArg = process.argv.find((a) => a.startsWith("--batch="));
  const batchSize = sizeArg ? Math.max(1, Math.min(5000, Number(sizeArg.split("=")[1]) || 500)) : 500;
  console.log(`db:encrypt — active key "${activeKeyId()}"${dryRun ? " (dry run: nothing is written)" : ""}`);
  const reports = await reencryptColumns(client, { dryRun, batchSize, log: (line) => console.log(`  ${line}`) });
  const pending = reports.reduce((n, r) => n + r.pending, 0);
  const rewritten = reports.reduce((n, r) => n + r.rewritten, 0);
  const failed = reports.reduce((n, r) => n + r.failed, 0);
  console.log(dryRun ? `${pending} value(s) would be re-encrypted.` : `${rewritten} of ${pending} value(s) re-encrypted.`);
  if (failed) {
    console.error(`${failed} value(s) could not be decrypted with the configured keys and were left unchanged.`);
    process.exit(2);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
