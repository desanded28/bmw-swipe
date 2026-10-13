/**
 * Background reminder worker for long-running servers (next start / next dev).
 * On serverless hosts (Vercel) use the cron endpoint instead: /api/cron/reminders.
 * Disable with REMINDER_WORKER=off.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.REMINDER_WORKER === "off" || process.env.VERCEL) return;
  const g = globalThis as unknown as { __sorrisoWorker?: NodeJS.Timeout };
  if (g.__sorrisoWorker) return;
  const { processDueReminders } = await import("./lib/reminders");
  const { logError, logInfo } = await import("./lib/log");
  const tick = () =>
    processDueReminders()
      .then((s) => s.due && logInfo("reminders", "tick", s))
      .catch((err) => logError("reminders", err, { step: "worker" }));
  g.__sorrisoWorker = setInterval(tick, 60_000);
  setTimeout(tick, 5_000);
}
