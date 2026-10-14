/**
 * Send all due reminders and run the care jobs (recalls, no-show risk refresh, anamnesis invites)
 * once, or keep running with --watch: reminders every 60s, care jobs every 15 minutes, as the
 * in-process worker does (src/instrumentation.ts).
 * In production prefer the HTTP cron endpoint, which does both: GET /api/cron/reminders.
 */
import { runCareJobs } from "../src/lib/recalls";
import { processDueReminders } from "../src/lib/reminders";

async function reminders() {
  const summary = await processDueReminders();
  if (summary.due) console.log(new Date().toISOString(), "reminders", summary);
}

async function care() {
  const summary = await runCareJobs();
  const { recallsSent, risksRefreshed, formInvites } = summary;
  if (recallsSent || risksRefreshed || formInvites) console.log(new Date().toISOString(), "care", summary);
}

/** Runs `job` every `ms`, skipping a tick while the previous run is still going. */
function every(ms: number, job: () => Promise<void>) {
  let running = false;
  setInterval(() => {
    if (running) return;
    running = true;
    job()
      .catch(console.error)
      .finally(() => (running = false));
  }, ms);
}

async function main() {
  await reminders();
  await care();
  if (process.argv.includes("--watch")) {
    console.log("watching: reminders every 60s, care jobs every 15 minutes…");
    every(60_000, reminders);
    every(15 * 60_000, care);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
