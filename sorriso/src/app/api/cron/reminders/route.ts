import { NextResponse } from "next/server";
import { logError } from "@/lib/log";
import { runCareJobs } from "@/lib/recalls";
import { processDueReminders } from "@/lib/reminders";
import { isCronAuthorized } from "@/lib/security/cron";

/**
 * Sends all due reminders, then runs the care jobs (recalls, risk refresh, anamnesis invites).
 * Call it every few minutes:
 *   - Vercel Cron (see vercel.json) sends `Authorization: Bearer $CRON_SECRET` automatically
 *   - or any scheduler: curl -H "Authorization: Bearer $CRON_SECRET" https://…/api/cron/reminders
 * Self-hosted servers also run an in-process worker (see src/instrumentation.ts).
 */
async function run(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const summary = await processDueReminders({ limit: 500 });
  // A failing care job must not hide that the reminders went out; the next run retries it.
  const care = await runCareJobs().catch((err: unknown) => {
    logError("cron", err, { step: "care" });
    return null;
  });
  return NextResponse.json({ ok: true, ...summary, care });
}

export const GET = run;
export const POST = run;
