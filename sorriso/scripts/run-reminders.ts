/**
 * Send all due reminders (and expire bookings held for another adult's confirmation), run the
 * care jobs (recalls, no-show risk refresh, anamnesis invites) and ask the SMS/WhatsApp provider
 * to delete its copies of old texts, once; or keep running with --watch: reminders every 60s,
 * care jobs every 15 minutes, provider copies daily, as the in-process worker does
 * (src/instrumentation.ts).
 * In production prefer the HTTP cron endpoint: GET /api/cron/reminders.
 */
import { expireAdultConfirmations } from "../src/lib/privacy/adult-confirmation";
import { runCareJobs } from "../src/lib/recalls";
import { processDueReminders, purgeProviderCopies } from "../src/lib/reminders";

async function reminders() {
  const summary = await processDueReminders();
  if (summary.due) console.log(new Date().toISOString(), "reminders", summary);
  const expired = await expireAdultConfirmations(new Date());
  if (expired) console.log(new Date().toISOString(), "adult confirmations expired", { expired });
}

async function care() {
  const summary = await runCareJobs();
  const { recallsSent, risksRefreshed, formInvites } = summary;
  if (recallsSent || risksRefreshed || formInvites) console.log(new Date().toISOString(), "care", summary);
}

async function providerCopies() {
  // Counts are logged by purgeProviderCopies itself.
  await purgeProviderCopies();
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
  await providerCopies();
  if (process.argv.includes("--watch")) {
    console.log("watching: reminders every 60s, care jobs every 15 minutes, provider copies daily…");
    every(60_000, reminders);
    every(15 * 60_000, care);
    every(24 * 60 * 60_000, providerCopies);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
