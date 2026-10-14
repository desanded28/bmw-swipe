import { NextResponse } from "next/server";
import { logAuditHeads } from "@/lib/audit";
import { logError } from "@/lib/log";
import { runRetention } from "@/lib/privacy/retention";
import { isCronAuthorized } from "@/lib/security/cron";

/**
 * Daily retention run (purges, redactions, pseudonymisation; see src/lib/privacy/retention.ts).
 * Scheduled in vercel.json ('15 2 * * *'); any scheduler can call it with
 * `Authorization: Bearer $CRON_SECRET`, the same check as /api/cron/reminders. Without
 * CRON_SECRET it is open only outside production. Self-hosted servers run it in-process
 * (src/instrumentation.ts) or with `npm run retention`.
 *
 * It also logs every audit chain's head (logAuditHeads), which the in-process job does on
 * long-running servers: on serverless hosts this is the only place it happens.
 */
async function run(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const summary = await runRetention();
  // Best effort: a logging failure must not hide that retention ran.
  await logAuditHeads().catch((err: unknown) => logError("cron", err, { step: "audit-heads" }));
  return NextResponse.json({ ok: true, ...summary });
}

export const GET = run;
export const POST = run;
