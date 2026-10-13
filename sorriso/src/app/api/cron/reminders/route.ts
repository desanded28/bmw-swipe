import { NextResponse } from "next/server";
import { processDueReminders } from "@/lib/reminders";

/**
 * Sends all due reminders. Call it every few minutes:
 *   - Vercel Cron (see vercel.json) sends `Authorization: Bearer $CRON_SECRET` automatically
 *   - or any scheduler: curl -H "Authorization: Bearer $CRON_SECRET" https://…/api/cron/reminders
 * Self-hosted servers also run an in-process worker (see src/instrumentation.ts).
 */
async function run(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (secret ? auth !== `Bearer ${secret}` : process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const summary = await processDueReminders({ limit: 500 });
  return NextResponse.json({ ok: true, ...summary });
}

export const GET = run;
export const POST = run;
