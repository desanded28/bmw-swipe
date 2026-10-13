/**
 * Automatic retention (Art. 5(1)(e)): purges expired sessions and codes, redacts old message
 * bodies, pseudonymises inactive patients, prunes the audit log behind an anchor, and so on,
 * per org and for the platform's own rows (org_id NULL). Idempotent: a second run in a row
 * changes nothing.
 *
 * STUB with its final signature (WP5). Called by the retention cron route,
 * scripts/run-retention.ts and the daily job in src/instrumentation.ts.
 */

export type RetentionSummary = {
  startedAt: Date;
  finishedAt: Date;
  orgs: number;
  /** Rows affected per step, e.g. { messagesRedacted: 12, patientsPseudonymised: 1 }. */
  counts: Record<string, number>;
};

export async function runRetention(now: Date = new Date()): Promise<RetentionSummary> {
  return { startedAt: now, finishedAt: now, orgs: 0, counts: {} };
}
