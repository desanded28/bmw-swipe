/**
 * Server startup: configuration checks, then the background jobs of a long-running server
 * (next start / next dev).
 *
 * Checks (Node.js runtime, every host): production refuses to start without DATA_ENCRYPTION_KEYS
 * and HMAC_SECRET, or with SMTP_URL but no SMTP_PROVIDER_NAME/ENTITY/REGION. Development and
 * tests fall back to built-in values, so they need no extra environment.
 *
 * Jobs, each never overlapping itself (a tick is skipped while the previous run is in flight):
 *   reminders     every minute, then expires bookings held for another adult's confirmation
 *   care          every 15 minutes: recalls, no-show risk refresh, anamnesis invites
 *   retention     daily at 02:15 UTC, like the Vercel cron
 *   provider-copies daily at 03:15 UTC: asks Twilio to delete its copies of old texts
 *   audit-heads   2 minutes after startup, then daily: logs each audit chain's head, so that
 *                 deleting the newest rows can be detected later (verifyAuditChain({ head })), and
 *                 how many audit rows could not be written (audit() never throws)
 * On serverless hosts (VERCEL) or with REMINDER_WORKER=off none of them run here: schedule
 * /api/cron/reminders (reminders and care jobs) and /api/cron/retention instead (see vercel.json).
 *
 * This file is also bundled for the edge runtime. Everything Node.js-only lives in
 * instrumentation-node.ts, imported only inside the NEXT_RUNTIME check so the bundler leaves it
 * (and the db, crypto and log modules behind it) out of the edge bundle.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerNode } = await import("./instrumentation-node");
    await registerNode();
  }
}
