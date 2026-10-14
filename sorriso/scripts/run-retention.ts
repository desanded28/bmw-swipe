/**
 * Run the retention job once (purges, redactions, pseudonymisation, deadline reminders; see
 * src/lib/privacy/retention.ts), log every audit chain's head, and print what changed.
 * Idempotent: a second run in a row changes nothing.
 *
 *   npm run retention
 *
 * Deployments run it daily on their own: Vercel through /api/cron/retention (vercel.json),
 * long-running servers in-process (src/instrumentation.ts).
 */
import { logAuditHeads } from "../src/lib/audit";
import { runRetention } from "../src/lib/privacy/retention";

async function main() {
  const summary = await runRetention();
  const ms = summary.finishedAt.getTime() - summary.startedAt.getTime();
  console.log(`✓ retention ran for ${summary.orgs} org(s) in ${ms} ms`);
  const counts = Object.entries(summary.counts).filter(([, n]) => n > 0);
  if (!counts.length) console.log("  nothing to purge");
  for (const [step, n] of counts) console.log(`  ${step}: ${n}`);
  console.log(`  audit chain heads logged: ${await logAuditHeads()}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
