/**
 * Care jobs run on a schedule: recall invitations ("time for your check-up"), refreshing no-show
 * risk for upcoming visits, and anamnesis form invitations.
 *
 * STUB with its final signature (WP8). Called every 15 minutes by src/instrumentation.ts, the
 * reminders cron route and scripts/run-reminders.ts.
 */

export type CareJobsSummary = { recallsSent: number; risksRefreshed: number; formInvites: number };

export async function runCareJobs(now: Date = new Date()): Promise<CareJobsSummary> {
  void now;
  return { recallsSent: 0, risksRefreshed: 0, formInvites: 0 };
}
