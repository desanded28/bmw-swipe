import type { Client, InStatement } from "@libsql/client";
import { decrypt, encrypt, isEncrypted } from "../crypto";

/**
 * Re-encrypt every encryptedText column under the active key (the first entry of
 * DATA_ENCRYPTION_KEYS): plaintext written before encryption existed, and values encrypted with
 * an older key after a rotation. Run by scripts/encrypt-existing.ts (npm run db:encrypt).
 *
 * - Idempotent: only values not already "v1:<active kid>:" are selected, so a second run finds nothing.
 * - Batches of 500 rows, each batch one write transaction; an UPDATE only applies if the value is
 *   still the one read, so a concurrent edit is never overwritten (it is picked up by a re-run).
 * - The AAD (table.column) is the one src/db/schema.ts binds; the plaintext never changes, so the
 *   audit chain (which hashes the decrypted reason) stays valid.
 * - A value that can't be decrypted (unknown key id, tampered) is counted and left alone.
 */

export type EncryptedColumn = { table: string; column: string; aad: string };

/** Every encryptedText column in src/db/schema.ts (reencrypt.test.ts checks the list against the schema). */
export const ENCRYPTED_COLUMNS: readonly EncryptedColumn[] = [
  { table: "users", column: "totp_secret_enc", aad: "users.totp_secret" },
  { table: "patients", column: "notes", aad: "patients.notes" },
  { table: "appointments", column: "patient_note", aad: "appointments.patient_note" },
  { table: "appointments", column: "internal_note", aad: "appointments.internal_note" },
  { table: "appointments", column: "cancel_reason", aad: "appointments.cancel_reason" },
  { table: "appointments", column: "manage_token_enc", aad: "appointments.manage_token" },
  { table: "messages", column: "subject", aad: "messages.subject" },
  { table: "messages", column: "body", aad: "messages.body" },
  { table: "messages", column: "html", aad: "messages.html" },
  { table: "waitlist", column: "note", aad: "waitlist.note" },
  { table: "privacy_requests", column: "details", aad: "privacy_requests.details" },
  { table: "privacy_requests", column: "answer_contact", aad: "privacy_requests.answer_contact" },
  { table: "audit_log", column: "reason", aad: "audit_log.reason" },
  { table: "form_submissions", column: "answers", aad: "form_submissions.answers" },
];

export type ColumnReport = { table: string; column: string; pending: number; rewritten: number; failed: number };

const IDENT = /^[a-z_]+$/;

/** The active key id, read from a fresh encryption (crypto.ts keeps the key list private). */
export function activeKeyId(): string {
  return encrypt("probe").split(":")[1];
}

export async function reencryptColumns(
  client: Client,
  opts: { dryRun?: boolean; batchSize?: number; columns?: readonly EncryptedColumn[]; log?: (line: string) => void } = {},
): Promise<ColumnReport[]> {
  const batchSize = opts.batchSize ?? 500;
  const prefix = `v1:${activeKeyId()}:`;
  const reports: ColumnReport[] = [];
  for (const { table, column, aad } of opts.columns ?? ENCRYPTED_COLUMNS) {
    if (!IDENT.test(table) || !IDENT.test(column)) throw new Error(`Bad identifier ${table}.${column}`);
    const stale = `"${column}" IS NOT NULL AND substr("${column}", 1, ${prefix.length}) != ?`;
    const counted = await client.execute({ sql: `SELECT count(*) AS n FROM "${table}" WHERE ${stale}`, args: [prefix] });
    const report: ColumnReport = { table, column, pending: Number(counted.rows[0]?.n ?? 0), rewritten: 0, failed: 0 };
    reports.push(report);
    if (opts.dryRun || report.pending === 0) {
      opts.log?.(`${table}.${column}: ${report.pending} to re-encrypt`);
      continue;
    }
    let after = 0;
    for (;;) {
      const batch = await client.execute({
        sql: `SELECT rowid AS rid, "${column}" AS v FROM "${table}" WHERE ${stale} AND rowid > ? ORDER BY rowid LIMIT ?`,
        args: [prefix, after, batchSize],
      });
      if (!batch.rows.length) break;
      const updates: InStatement[] = [];
      for (const row of batch.rows) {
        const rid = Number(row.rid);
        const value = String(row.v);
        after = rid;
        try {
          const plain = isEncrypted(value) ? decrypt(value, aad) : value;
          updates.push({ sql: `UPDATE "${table}" SET "${column}" = ? WHERE rowid = ? AND "${column}" = ?`, args: [encrypt(plain, aad), rid, value] });
        } catch {
          report.failed++;
        }
      }
      if (updates.length) {
        const results = await client.batch(updates, "write");
        report.rewritten += results.reduce((n, r) => n + r.rowsAffected, 0);
      }
      opts.log?.(`${table}.${column}: ${report.rewritten}/${report.pending}`);
      if (batch.rows.length < batchSize) break;
    }
  }
  return reports;
}
