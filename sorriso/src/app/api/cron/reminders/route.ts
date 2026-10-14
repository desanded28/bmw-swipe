import { NextResponse } from "next/server";
import { logError, logInfo } from "@/lib/log";
import { expireAdultConfirmations } from "@/lib/privacy/adult-confirmation";
import { runCareJobs } from "@/lib/recalls";
import { processDueReminders, purgeProviderCopies } from "@/lib/reminders";
import { isCronAuthorized } from "@/lib/security/cron";

/**
 * Sends all due reminders, cancels marketplace bookings held for another adult's confirmation
 * that ran out (48 hours, or the visit time), then runs the care jobs (recalls, risk refresh,
 * anamnesis invites) and asks Twilio to delete its copies of texts older than each practice's
 * privacy.retention.providerMessageDays. Call it every few minutes:
 *   - Vercel Cron (see vercel.json) sends `Authorization: Bearer $CRON_SECRET` automatically
 *   - or any scheduler: curl -H "Authorization: Bearer $CRON_SECRET" https://…/api/cron/reminders
 * Self-hosted servers also run an in-process worker (see src/instrumentation.ts); on serverless
 * hosts this route is the only runner of all four jobs.
 */
async function run(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const summary = await processDueReminders({ limit: 500 });
  // Best effort, like the jobs below: a failure is logged and must not hide that the reminders
  // went out; the next run retries. The count is logged (the response keeps its shape).
  try {
    const expired = await expireAdultConfirmations(new Date());
    if (expired) logInfo("cron", "adult confirmations expired", { expired });
  } catch (err) {
    logError("cron", err, { step: "adult-confirmations" });
  }
  const care = await runCareJobs().catch((err: unknown) => {
    logError("cron", err, { step: "care" });
    return null;
  });
  // Copies that can't be deleted now are retried on a later run (purgeProviderCopies backs off
  // per copy). The counts are logged by purgeProviderCopies.
  try {
    await purgeProviderCopies();
  } catch (err) {
    logError("cron", err, { step: "provider-cleanup" });
  }
  return NextResponse.json({ ok: true, ...summary, care });
}

export const GET = run;
export const POST = run;
