/**
 * Run the retention job once (purges, redactions, pseudonymisation; see src/lib/privacy/retention.ts)
 * and print what it changed. Idempotent: a second run in a row changes nothing.
 *
 *   npm run retention
 *
 * Deployments run it daily on their own: Vercel through /api/cron/retention (vercel.json),
 * long-running servers in-process (src/instrumentation.ts).
 */
import { runRetention } from "../src/lib/privacy/retention";

async function main() {
  const summary = await runRetention();
  const ms = summary.finishedAt.getTime() - summary.startedAt.getTime();
  console.log(`✓ retention ran for ${summary.orgs} org(s) in ${ms} ms`);
  const counts = Object.entries(summary.counts).filter(([, n]) => n > 0);
  if (!counts.length) console.log("  nothing to purge");
  for (const [step, n] of counts) console.log(`  ${step}: ${n}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
