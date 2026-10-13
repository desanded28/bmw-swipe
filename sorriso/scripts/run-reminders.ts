/**
 * Send all due reminders once, or keep running with --watch (every 60s).
 * In production prefer the HTTP cron endpoint: GET /api/cron/reminders.
 */
import { processDueReminders } from "../src/lib/reminders";

async function tick() {
  const summary = await processDueReminders();
  if (summary.due) console.log(new Date().toISOString(), summary);
}

async function main() {
  await tick();
  if (process.argv.includes("--watch")) {
    console.log("watching for due reminders every 60s…");
    setInterval(() => tick().catch(console.error), 60_000);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
