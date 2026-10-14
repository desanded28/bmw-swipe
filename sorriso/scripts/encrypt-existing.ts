/**
 * Re-encrypt every encryptedText column under the active key (the first entry of
 * DATA_ENCRYPTION_KEYS): plaintext rows written before encryption, and rows encrypted with an
 * older key after a rotation (see needsReencrypt in src/lib/crypto.ts).
 *
 *   npm run db:encrypt              # rewrite
 *   npm run db:encrypt -- --dry-run # count only
 *
 * To be implemented by WP6: idempotent, batches of 500, a --dry-run flag. Until then this stub
 * changes nothing and exits successfully.
 */

export {};

console.log("db:encrypt: not implemented yet (WP6). Nothing was changed.");
process.exit(0);
