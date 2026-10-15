/**
 * The Node.js part of src/instrumentation.ts (startup checks and background jobs); see there.
 * Imports stay dynamic so a job's modules load only when it first runs.
 */

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const DAY = 24 * 60 * MINUTE;

type Job = { name: string; firstIn: number; every: number; run: () => Promise<void> };

const g = globalThis as unknown as { __sorrisoJobs?: { stop: () => void } };

export async function registerNode() {
  const { assertCryptoConfigured } = await import("./lib/crypto");
  const { assertSubprocessorsConfigured } = await import("./lib/privacy/subprocessors");
  const { assertPlatformIdentityConfigured } = await import("./lib/privacy/platform-identity");
  assertCryptoConfigured();
  assertSubprocessorsConfigured();
  assertPlatformIdentityConfigured();

  if (process.env.REMINDER_WORKER === "off" || process.env.VERCEL) return;
  if (g.__sorrisoJobs) return; // dev: register() can run again in the same process
  const stops: (() => void)[] = [];
  g.__sorrisoJobs = { stop: () => stops.forEach((stop) => stop()) };
  const { logError } = await import("./lib/log");
  for (const job of await backgroundJobs()) stops.push(schedule(job, logError));
}

/** Milliseconds from `now` until the next hh:mm UTC. */
function msUntilUtc(hour: number, minute: number, now = new Date()): number {
  const next = new Date(now);
  next.setUTCHours(hour, minute, 0, 0);
  if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1);
  return next.getTime() - now.getTime();
}

async function backgroundJobs(): Promise<Job[]> {
  const { logError, logInfo } = await import("./lib/log");
  return [
    {
      name: "reminders",
      firstIn: 5 * SECOND,
      every: MINUTE,
      run: async () => {
        const { processDueReminders } = await import("./lib/reminders");
        const s = await processDueReminders();
        if (s.due) logInfo("reminders", "tick", s);
        // Marketplace bookings held for another adult's confirmation: cancelled after 48 hours or
        // at the visit time. Its own failure must not hide that the reminders went out.
        try {
          const { expireAdultConfirmations } = await import("./lib/privacy/adult-confirmation");
          const expired = await expireAdultConfirmations(new Date());
          if (expired) logInfo("reminders", "adult confirmations expired", { expired });
        } catch (err) {
          logError("jobs", err, { job: "adult-confirmations" });
        }
      },
    },
    {
      name: "care",
      firstIn: MINUTE,
      every: 15 * MINUTE,
      run: async () => {
        const { runCareJobs } = await import("./lib/recalls");
        const s = await runCareJobs();
        if (s.recallsSent || s.risksRefreshed || s.formInvites) logInfo("care", "tick", s);
      },
    },
    {
      name: "retention",
      firstIn: msUntilUtc(2, 15),
      every: DAY,
      run: async () => {
        const { runRetention } = await import("./lib/privacy/retention");
        const s = await runRetention();
        logInfo("retention", "run", { ...s.counts, orgs: s.orgs, ms: s.finishedAt.getTime() - s.startedAt.getTime() });
      },
    },
    {
      // Ask the SMS/WhatsApp provider to delete its copies once the practice's
      // privacy.retention.providerMessageDays have passed (the reminders cron does it on serverless hosts).
      name: "provider-copies",
      firstIn: msUntilUtc(3, 15),
      every: DAY,
      run: async () => {
        const { purgeProviderCopies } = await import("./lib/reminders");
        await purgeProviderCopies();
      },
    },
    {
      name: "audit-heads",
      firstIn: 2 * MINUTE,
      every: DAY,
      run: async () => {
        const { getAuditFailureCount, logAuditHeads } = await import("./lib/audit");
        await logAuditHeads();
        // Each failure was logged when it happened; this daily count is the line to alert on.
        const failures = getAuditFailureCount();
        if (failures) logError("audit", "access-log rows could not be written since startup", { failures });
      },
    },
  ];
}

/** Runs `job` after `firstIn`, then every `every`. Returns a function that stops it. */
function schedule(job: Job, logError: typeof import("./lib/log").logError): () => void {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await job.run();
    } catch (err) {
      logError("jobs", err, { job: job.name });
    } finally {
      running = false;
    }
  };
  let timer = setTimeout(() => {
    void tick();
    timer = setInterval(tick, job.every);
  }, job.firstIn);
  // clearTimeout also clears an interval in Node.
  return () => clearTimeout(timer);
}
