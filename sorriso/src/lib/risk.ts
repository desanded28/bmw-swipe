import { and, asc, eq, gt, inArray, isNotNull, isNull, lt, lte, or, sql } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { appointments, locations, organizations, type Appointment, type RiskLevel } from "@/db/schema";
import { NO_CARE_FLAGS, type CareFlags } from "@/components/dashboard/slots/contracts";
import { anamnesisStatuses } from "./forms";
import { logError } from "./log";
import type { Permission } from "./permissions";
import { isAllowed } from "./privacy/consent";
import { getCare, getPrivacy } from "./privacy/settings";
import { resolveSettings } from "./settings";
import { zonedParts } from "./time";

/**
 * No-show risk and the care flags shown on the calendar (WP8). See docs/care.md.
 *
 * Risk only adds help: an extra reminder (reminder rules with onlyIfRisk, src/lib/reminders.ts),
 * the front desk's call list and sorting. It never blocks a booking, hides or reorders slots, or
 * asks for a deposit: nothing in the availability engine or the booking flow reads it (GDPR
 * Art. 22, L. 132/2025). It is computed only when the practice turned on risk-based reminders,
 * and never for a patient who objected to adaptive reminders (Art. 21); a patient who objected
 * to no-show tracking is scored without their attendance history.
 */

export type { CareFlags };

/** Every factor that can raise the score, in the order reasons are listed when they tie. */
export const RISK_REASONS = [
  "no_show_history",
  "unconfirmed",
  "late_cancel_history",
  "long_lead_time",
  "new_patient",
  "edge_of_day",
] as const;
export type RiskReason = (typeof RISK_REASONS)[number];

export type RiskInput = {
  /** The patient's visits at this practice in the 24 months before now (this one excluded). */
  history24m: { noShows: number; lateCancels: number; completed: number };
  /** From booking to the visit. */
  leadTimeHours: number;
  isNewPatient: boolean;
  /** Not confirmed and less than 24 hours to go. */
  unconfirmedAtT24: boolean;
  /** Local to the office: 0 = Sunday … 6 = Saturday. */
  weekday: number;
  /** Local hour of the start, 0–23. */
  hour: number;
};

export type RiskResult = { level: RiskLevel; score: number; reasons: RiskReason[] };

/**
 * The published weights (docs/care.md). Points add up to a 0–100 score:
 *   no_show_history      25 for one no-show, +15 for each further one (counted up to 3)
 *   unconfirmed          20 when the visit is unconfirmed less than 24 hours before
 *   late_cancel_history  15 for two or more late cancellations (one alone is noise)
 *   long_lead_time       15 when booked 30+ days ahead, 8 when 14+ days
 *   new_patient          10 for a first visit
 *   edge_of_day           5 for a start before 09:00 or from 18:00
 *   reliable history    −10 for three or more completed visits and no no-show (not a reason)
 */
export const RISK_WEIGHTS = {
  noShowFirst: 25,
  noShowEachFurther: 15,
  noShowCountedUpTo: 3,
  unconfirmed: 20,
  lateCancels: 15,
  lateCancelsMin: 2,
  leadTimeLong: 15,
  leadTimeLongHours: 30 * 24,
  leadTimeMedium: 8,
  leadTimeMediumHours: 14 * 24,
  newPatient: 10,
  edgeOfDay: 5,
  reliable: -10,
  reliableMinCompleted: 3,
} as const;

/** Score cut-offs: at least `high` is high, at least `medium` is medium, anything below is low. */
export const RISK_THRESHOLDS = { medium: 25, high: 45 } as const;

/** Deterministic and explainable: the same input always gives the same level and reasons. */
export function computeRisk(i: RiskInput): RiskResult {
  const w = RISK_WEIGHTS;
  const points: [RiskReason, number][] = [];
  const h = i.history24m;
  if (h.noShows > 0) {
    points.push(["no_show_history", w.noShowFirst + w.noShowEachFurther * (Math.min(h.noShows, w.noShowCountedUpTo) - 1)]);
  }
  if (i.unconfirmedAtT24) points.push(["unconfirmed", w.unconfirmed]);
  if (h.lateCancels >= w.lateCancelsMin) points.push(["late_cancel_history", w.lateCancels]);
  if (i.leadTimeHours >= w.leadTimeLongHours) points.push(["long_lead_time", w.leadTimeLong]);
  else if (i.leadTimeHours >= w.leadTimeMediumHours) points.push(["long_lead_time", w.leadTimeMedium]);
  if (i.isNewPatient) points.push(["new_patient", w.newPatient]);
  if (i.hour < 9 || i.hour >= 18) points.push(["edge_of_day", w.edgeOfDay]);

  let score = points.reduce((sum, [, n]) => sum + n, 0);
  if (h.completed >= w.reliableMinCompleted && h.noShows === 0) score += w.reliable;
  score = Math.max(0, Math.min(100, score));
  const level: RiskLevel = score >= RISK_THRESHOLDS.high ? "high" : score >= RISK_THRESHOLDS.medium ? "medium" : "low";
  const reasons = points
    .sort((a, b) => b[1] - a[1] || RISK_REASONS.indexOf(a[0]) - RISK_REASONS.indexOf(b[0]))
    .map(([reason]) => reason);
  return { level, score, reasons };
}

export function isRiskReason(v: unknown): v is RiskReason {
  return typeof v === "string" && (RISK_REASONS as readonly string[]).includes(v);
}

// ---------------------------------------------------------------- inputs from the database

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const HISTORY_MS = 730 * DAY_MS;

type RiskAppointment = Pick<
  Appointment,
  "id" | "orgId" | "patientId" | "startsAt" | "createdAt" | "isNewPatient" | "confirmation" | "status"
>;

/** The patient's attendance at this practice over the 24 months before `now`. */
async function attendance(tx: Tx, a: RiskAppointment, cancelUntilHours: number, now: Date) {
  const [row] = await tx
    .select({
      noShows: sql<number>`coalesce(sum(case when ${appointments.status} = 'no_show' then 1 else 0 end), 0)`,
      completed: sql<number>`coalesce(sum(case when ${appointments.status} = 'completed' then 1 else 0 end), 0)`,
      lateCancels: sql<number>`coalesce(sum(case when ${appointments.status} = 'cancelled' and ${appointments.cancelledBy} = 'patient'
        and ${appointments.cancelledAt} > ${appointments.startsAt} - ${cancelUntilHours * HOUR_MS} then 1 else 0 end), 0)`,
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.orgId, a.orgId),
        eq(appointments.patientId, a.patientId),
        sql`${appointments.id} <> ${a.id}`,
        gt(appointments.startsAt, new Date(now.getTime() - HISTORY_MS)),
        lt(appointments.startsAt, now),
      ),
    );
  return { noShows: Number(row?.noShows ?? 0), completed: Number(row?.completed ?? 0), lateCancels: Number(row?.lateCancels ?? 0) };
}

/**
 * The risk of one visit, or null when it must not be computed: the practice hasn't turned on
 * risk-based reminders, or the patient objected to adaptive reminders.
 */
export async function riskFor(
  tx: Tx,
  a: RiskAppointment,
  org: { settings: unknown },
  timezone: string,
  now: Date = new Date(),
): Promise<RiskResult | null> {
  if (!getPrivacy(org).riskBasedReminders) return null;
  if (!(await isAllowed(a.patientId, "adaptive_reminders", tx))) return null;
  const settings = resolveSettings(org.settings as Parameters<typeof resolveSettings>[0]);
  // An objection to no-show tracking keeps the attendance history out of the score.
  const tracked = await isAllowed(a.patientId, "no_show_tracking", tx);
  const history = tracked ? await attendance(tx, a, settings.booking.cancelUntilHours, now) : { noShows: 0, completed: 0, lateCancels: 0 };
  const local = zonedParts(a.startsAt, timezone);
  return computeRisk({
    history24m: history,
    leadTimeHours: Math.max(0, (a.startsAt.getTime() - a.createdAt.getTime()) / HOUR_MS),
    // Without the history (objection), only the booking's own "first visit" mark counts: a
    // withheld history must never make a long-standing patient look new.
    isNewPatient: a.isNewPatient || (tracked && history.completed === 0),
    unconfirmedAtT24: a.confirmation !== "confirmed" && now.getTime() >= a.startsAt.getTime() - 24 * HOUR_MS,
    weekday: local.weekday,
    hour: Math.floor(local.minutes / 60),
  });
}

/**
 * Compute and store the risk of one appointment (riskLevel, riskReasons, riskComputedAt), or clear
 * it when it may not be computed. Inside a transaction pass its `tx`. Returns the stored level.
 */
export async function refreshAppointmentRisk(tx: Tx, appointmentId: string, now: Date = new Date()): Promise<RiskLevel | null> {
  const [row] = await tx
    .select({ a: appointments, settings: organizations.settings, timezone: locations.timezone })
    .from(appointments)
    .innerJoin(organizations, eq(organizations.id, appointments.orgId))
    .innerJoin(locations, eq(locations.id, appointments.locationId))
    .where(eq(appointments.id, appointmentId));
  if (!row) return null;
  const result = ["scheduled", "requested"].includes(row.a.status)
    ? await riskFor(tx, row.a, { settings: row.settings }, row.timezone, now)
    : null;
  await tx
    .update(appointments)
    .set({ riskLevel: result?.level ?? null, riskReasons: result?.reasons ?? [], riskComputedAt: now })
    .where(and(eq(appointments.id, row.a.id), eq(appointments.orgId, row.a.orgId)));
  return result?.level ?? null;
}

/** How far ahead the scheduled refresh looks, and how old a stored risk may get. */
const REFRESH_AHEAD_MS = 7 * DAY_MS;
const REFRESH_EVERY_MS = 6 * HOUR_MS;
/** A stored risk further ahead is re-checked this often (an objection since then clears it). */
const REFRESH_FAR_EVERY_MS = 24 * HOUR_MS;

/**
 * Keep upcoming visits' risk current (run by runCareJobs every 15 minutes): visits in the next 7
 * days whose risk is older than 6 hours, or was computed before the visit's 24-hour mark and the
 * mark has passed (the "unconfirmed the day before" factor); and any later visit carrying a risk
 * older than a day, so an objection to adaptive reminders clears it however far ahead the visit
 * is. Practices without risk-based reminders get every stored value on a future visit cleared.
 * Returns how many appointments were updated.
 */
export async function refreshRisks(now: Date = new Date(), opts: { limit?: number } = {}): Promise<number> {
  const limit = opts.limit ?? 500;
  const orgs = await db.select({ id: organizations.id, settings: organizations.settings }).from(organizations);
  const on = orgs.filter((o) => getPrivacy(o).riskBasedReminders).map((o) => o.id);
  const off = orgs.filter((o) => !getPrivacy(o).riskBasedReminders).map((o) => o.id);
  const future = and(inArray(appointments.status, ["scheduled", "requested"]), gt(appointments.startsAt, now));
  const horizon = new Date(now.getTime() + REFRESH_AHEAD_MS);
  const ids: string[] = [];
  for (const chunk of chunks(on, 200)) {
    const rows = await db
      .select({ id: appointments.id })
      .from(appointments)
      .where(
        and(
          inArray(appointments.orgId, chunk),
          future,
          or(
            and(
              lte(appointments.startsAt, horizon),
              or(
                isNull(appointments.riskComputedAt),
                lt(appointments.riskComputedAt, new Date(now.getTime() - REFRESH_EVERY_MS)),
                and(
                  lt(appointments.riskComputedAt, sql`${appointments.startsAt} - ${24 * HOUR_MS}`),
                  lte(appointments.startsAt, new Date(now.getTime() + 24 * HOUR_MS)),
                ),
              ),
            ),
            and(
              gt(appointments.startsAt, horizon),
              isNotNull(appointments.riskLevel),
              or(isNull(appointments.riskComputedAt), lt(appointments.riskComputedAt, new Date(now.getTime() - REFRESH_FAR_EVERY_MS))),
            ),
          ),
        ),
      )
      .orderBy(asc(appointments.startsAt))
      .limit(limit - ids.length);
    ids.push(...rows.map((r) => r.id));
    if (ids.length >= limit) break;
  }
  let n = 0;
  for (const id of ids) {
    try {
      await refreshAppointmentRisk(db, id, now);
      n++;
    } catch (err) {
      logError("care", err, { step: "risk", appointmentId: id });
    }
  }
  for (const chunk of chunks(off, 200)) {
    const cleared = await db
      .update(appointments)
      .set({ riskLevel: null, riskReasons: [], riskComputedAt: now })
      .where(and(inArray(appointments.orgId, chunk), isNotNull(appointments.riskLevel), future))
      .returning({ id: appointments.id });
    n += cleared.length;
  }
  return n;
}

/**
 * The patient objected to adaptive reminders (Art. 21): clear the stored risk of all their future
 * visits at once, rather than waiting for the scheduled refresh. For the objection flow (privacy
 * center, staff-recorded objections); inside a transaction pass its `tx`. Returns the visits cleared.
 */
export async function clearRiskFor(tx: Tx, orgId: string, patientId: string, now: Date = new Date()): Promise<number> {
  const cleared = await tx
    .update(appointments)
    .set({ riskLevel: null, riskReasons: [], riskComputedAt: now })
    .where(
      and(
        eq(appointments.orgId, orgId),
        eq(appointments.patientId, patientId),
        inArray(appointments.status, ["scheduled", "requested"]),
        gt(appointments.startsAt, now),
        isNotNull(appointments.riskLevel),
      ),
    )
    .returning({ id: appointments.id });
  return cleared.length;
}

/**
 * Of these patients, the ones whose stored risk may be shown and used: those who haven't objected
 * to adaptive reminders (Art. 21). The stored value can predate an objection (it is refreshed on a
 * schedule), so every reader of a stored risk checks this first.
 */
export async function riskAllowedFor(patientIds: readonly string[], tx: Tx = db): Promise<Set<string>> {
  const unique = [...new Set(patientIds)];
  const allowed = await Promise.all(unique.map((id) => isAllowed(id, "adaptive_reminders", tx)));
  return new Set(unique.filter((_, i) => allowed[i]));
}

function chunks<T>(list: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

// ---------------------------------------------------------------- calendar flags

/**
 * The care flags of some of the org's appointments, for the calendar and appointment lists
 * (WP2 calls it with the ids it is about to render). Every id in `apptIds` gets an entry; ids of
 * other orgs get NO_CARE_FLAGS. The result is already filtered for the viewer: redFlag stays
 * null without patient.clinical.read (`perms` is permissionsFor(role)). A risk is shown only
 * where the practice uses it, for upcoming visits, and never for a patient who objected to
 * adaptive reminders (checked live: the stored value may predate the objection).
 *
 * Not audited: it reveals a status and, to clinicians, one boolean. Opening the answers is
 * audited (patient.clinical.view, src/lib/forms.ts).
 */
export async function loadCareFlags(
  orgId: string,
  apptIds: readonly string[],
  perms: readonly Permission[],
): Promise<Map<string, CareFlags>> {
  const out = new Map<string, CareFlags>(apptIds.map((id) => [id, { ...NO_CARE_FLAGS, riskReasons: [] }]));
  if (!apptIds.length) return out;
  const [org] = await db.select({ settings: organizations.settings }).from(organizations).where(eq(organizations.id, orgId));
  if (!org) return out;
  const showRisk = getPrivacy(org).riskBasedReminders;
  const clinical = perms.includes("patient.clinical.read");

  const rows: Pick<Appointment, "id" | "patientId" | "status" | "startsAt" | "riskLevel" | "riskReasons">[] = [];
  for (const chunk of chunks([...new Set(apptIds)], 400)) {
    rows.push(
      ...(await db
        .select({
          id: appointments.id,
          patientId: appointments.patientId,
          status: appointments.status,
          startsAt: appointments.startsAt,
          riskLevel: appointments.riskLevel,
          riskReasons: appointments.riskReasons,
        })
        .from(appointments)
        .where(and(eq(appointments.orgId, orgId), inArray(appointments.id, chunk)))),
    );
  }
  const forms = await anamnesisStatuses(orgId, rows, getCare(org));
  const isUpcoming = (r: (typeof rows)[number]) => r.status === "scheduled" || r.status === "requested";
  // A stored risk can predate an objection to adaptive reminders: never show it once there is one.
  const allowed = showRisk ? await riskAllowedFor(rows.filter((r) => isUpcoming(r) && r.riskLevel).map((r) => r.patientId)) : new Set<string>();
  for (const r of rows) {
    const risk = showRisk && isUpcoming(r) && allowed.has(r.patientId) ? r.riskLevel : null;
    const f = forms.get(r.id);
    out.set(r.id, {
      riskLevel: risk,
      riskReasons: risk ? r.riskReasons.filter(isRiskReason) : [],
      anamnesis: f?.status ?? null,
      redFlag: clinical && f?.status === "complete" ? f.redFlags.length > 0 : null,
    });
  }
  return out;
}
