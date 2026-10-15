import "server-only";
import { and, avg, count, eq, gte, inArray, isNotNull, lt, lte, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  appointments,
  CHANNELS,
  messages,
  practitioners,
  profileStats,
  recalls,
  reminders,
  reviews,
  services,
  waitlist,
  type Channel,
  type ProcessingContext,
} from "@/db/schema";
import { CALENDAR_NAMES } from "@/i18n/calendar-names";
import type { Locale } from "@/i18n/config";
import { getT } from "@/i18n/t";
import { practitionerName } from "./format";
import { buildRankInputs, scoreResult, type RankReason } from "./ranking";
import { resolveSettings } from "./settings";
import { addDays, todayIn, zonedParts } from "./time";

/**
 * Practice analytics (WP2): aggregate counts and rates computed in the database, scoped to one
 * practice. Nothing here returns a patient, a name of a patient or a message: only counts,
 * practitioners, treatments and the practice's own ranking inputs. Cookieless by construction:
 * computed on the server when the page (or the CSV export) is requested, with no tracking.
 *
 * Every rate is a Rate: numerator, denominator and the percentage rounded to one decimal. The
 * page and the CSV export both print `pct`, so they always show the same number.
 */

export const ANALYTICS_RANGES = [3, 6, 12, 24] as const;
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];
export const DEFAULT_RANGE: AnalyticsRange = 24;

export function toRange(v: unknown): AnalyticsRange {
  const n = Number(v);
  return (ANALYTICS_RANGES as readonly number[]).includes(n) ? (n as AnalyticsRange) : DEFAULT_RANGE;
}

export type Rate = { num: number; den: number; pct: number | null };

/** num / den as a percentage with one decimal; null when there is nothing to divide by. */
export function rate(num: number, den: number): Rate {
  return { num, den, pct: den > 0 ? Math.round((num / den) * 1000) / 10 : null };
}

/** Visits that happened (completed), were missed (no-show) or were cancelled late by the patient. */
export type OutcomeRow = {
  key: string;
  /** Treatment or practitioner name (data); other dimensions are labelled by key. */
  name?: string;
  completed: number;
  noShows: number;
  lateCancels: number;
  /** no-shows / (completed + no-shows) */
  noShowRate: Rate;
  /** late cancellations / (completed + no-shows + late cancellations) */
  lateCancelRate: Rate;
};

export const PARTS_OF_DAY = ["morning", "afternoon", "evening"] as const;
export type PartOfDay = (typeof PARTS_OF_DAY)[number];
/** Monday first; keys are weekday numbers as strings (0 = Sunday). */
export const WEEKDAY_ORDER = ["1", "2", "3", "4", "5", "6", "0"] as const;

export const OFFSET_BUCKETS = ["h3", "h12", "d1", "d2", "d3"] as const;
export type OffsetBucket = (typeof OFFSET_BUCKETS)[number];
export const LEAD_BUCKETS = ["sameDay", "d2", "d7", "d14", "d30", "more"] as const;
export type LeadBucket = (typeof LEAD_BUCKETS)[number];

export type ConfirmationRow<K extends string> = { key: K; sent: number; confirmed: number; rate: Rate };

export type RankingRow = {
  practitionerId: string;
  name: string;
  /** 0-100 */
  score: number;
  reasons: RankReason[];
  soonestSlotAt: string | null;
  ratingCount: number;
  /** Plain average of published ratings (1-5); null without reviews. */
  ratingAverage: number | null;
  staffCancelRate: Rate;
  /** 0-100 */
  completeness: number;
};

export type Analytics = {
  orgId: string;
  months: AnalyticsRange;
  /** ISO instants of the window: [from, to). */
  from: string;
  to: string;
  generatedAt: string;
  lateCancelHours: number;
  outcomes: {
    total: OutcomeRow;
    byService: OutcomeRow[];
    byPractitioner: OutcomeRow[];
    byWeekday: OutcomeRow[];
    byPartOfDay: OutcomeRow[];
  };
  confirmation: {
    total: ConfirmationRow<"all">;
    byChannel: ConfirmationRow<Channel>[];
    byOffset: ConfirmationRow<OffsetBucket>[];
  };
  waitlist: { entries: number; booked: number; removed: number; expired: number; waiting: number; fillRate: Rate };
  recalls: { due: number; contacted: number; booked: number; conversion: Rate };
  leadTime: { bookings: number; medianDays: number | null; buckets: { key: LeadBucket; count: number }[] };
  newPatients: {
    total: number;
    bySource: { key: string; count: number }[];
    byContext: { key: ProcessingContext; count: number }[];
  };
  reviews: { total: number; average: number | null; months: { month: string; count: number; average: number | null }[] };
  funnel: {
    impressions: number;
    views: number;
    bookings: number;
    viewRate: Rate;
    bookingRate: Rate;
    byPractitioner: { practitionerId: string; name: string; impressions: number; views: number; bookings: number; bookingRate: Rate }[];
  };
  ranking: { globalMeanRating: number; practitioners: RankingRow[] };
};

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** The window: the last `months` calendar months up to now. */
export function analyticsWindow(months: AnalyticsRange, now: Date): { from: Date; to: Date } {
  const from = new Date(now);
  from.setUTCMonth(from.getUTCMonth() - months);
  return { from, to: now };
}

function partOfDay(minutes: number): PartOfDay {
  return minutes < 13 * 60 ? "morning" : minutes < 18 * 60 ? "afternoon" : "evening";
}

function leadBucket(ms: number): LeadBucket {
  if (ms < DAY) return "sameDay";
  if (ms < 3 * DAY) return "d2";
  if (ms < 8 * DAY) return "d7";
  if (ms < 15 * DAY) return "d14";
  if (ms < 31 * DAY) return "d30";
  return "more";
}

function outcomeRow(key: string, completed: number, noShows: number, lateCancels: number, name?: string): OutcomeRow {
  return {
    key,
    ...(name !== undefined ? { name } : {}),
    completed,
    noShows,
    lateCancels,
    noShowRate: rate(noShows, completed + noShows),
    lateCancelRate: rate(lateCancels, completed + noShows + lateCancels),
  };
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const num = (v: unknown) => Number(v ?? 0) || 0;

/**
 * Everything the analytics page shows, for one practice and one window. `timezone` is the
 * practice's (weekdays, parts of the day and months are local).
 */
export async function loadAnalytics(
  org: { id: string; timezone: string; settings: unknown },
  opts: { months?: AnalyticsRange; now?: Date } = {},
): Promise<Analytics> {
  const months = opts.months ?? DEFAULT_RANGE;
  const now = opts.now ?? new Date();
  const { from, to } = analyticsWindow(months, now);
  const orgId = org.id;
  const tz = org.timezone;
  const lateCancelHours = resolveSettings(org.settings as never).booking.cancelUntilHours;
  const lateMs = lateCancelHours * HOUR;

  // ---------------------------------------------------------------- no-shows and late cancellations
  const isCompleted = sql<number>`sum(case when ${appointments.status} = 'completed' then 1 else 0 end)`;
  const isNoShow = sql<number>`sum(case when ${appointments.status} = 'no_show' then 1 else 0 end)`;
  const lateCancel = sql`(${appointments.status} = 'cancelled' and ${appointments.cancelledBy} = 'patient' and ${appointments.cancelledAt} > ${appointments.startsAt} - ${lateMs})`;
  const isLate = sql<number>`sum(case when ${lateCancel} then 1 else 0 end)`;
  const pastVisits = and(
    eq(appointments.orgId, orgId),
    gte(appointments.startsAt, from),
    lt(appointments.startsAt, to),
    inArray(appointments.status, ["completed", "no_show", "cancelled"]),
  );

  const [byServiceRows, byPractitionerRows, timeRows] = await Promise.all([
    db
      .select({ id: services.id, name: services.name, completed: isCompleted, noShows: isNoShow, late: isLate })
      .from(appointments)
      .innerJoin(services, eq(services.id, appointments.serviceId))
      .where(pastVisits)
      .groupBy(services.id, services.name),
    db
      .select({
        id: practitioners.id,
        title: practitioners.title,
        name: practitioners.name,
        completed: isCompleted,
        noShows: isNoShow,
        late: isLate,
      })
      .from(appointments)
      .innerJoin(practitioners, eq(practitioners.id, appointments.practitionerId))
      .where(pastVisits)
      .groupBy(practitioners.id, practitioners.title, practitioners.name),
    // Weekday and part of day are local to the practice, which SQLite can't compute across DST:
    // the database returns one compact row per counted visit and the grouping happens here.
    db
      .select({
        startsAt: appointments.startsAt,
        status: appointments.status,
        late: sql<number>`case when ${lateCancel} then 1 else 0 end`,
      })
      .from(appointments)
      .where(and(pastVisits, sql`(${appointments.status} <> 'cancelled' or ${lateCancel})`)),
  ]);

  const toOutcome = (rows: { id: string; label: string; completed: unknown; noShows: unknown; late: unknown }[]) =>
    rows
      .map((r) => outcomeRow(r.id, num(r.completed), num(r.noShows), num(r.late), r.label))
      .filter((r) => r.completed + r.noShows + r.lateCancels > 0)
      .sort((a, b) => b.completed + b.noShows - (a.completed + a.noShows) || (a.name ?? "").localeCompare(b.name ?? ""));
  const byService = toOutcome(byServiceRows.map((r) => ({ ...r, label: r.name })));
  const byPractitioner = toOutcome(byPractitionerRows.map((r) => ({ ...r, label: practitionerName(r) })));

  // [completed, no-shows, late cancellations] per weekday and per part of the day.
  const weekday = new Map<string, number[]>(WEEKDAY_ORDER.map((k) => [k, [0, 0, 0]]));
  const part = new Map<PartOfDay, number[]>(PARTS_OF_DAY.map((k) => [k, [0, 0, 0]]));
  for (const r of timeRows) {
    const p = zonedParts(r.startsAt, tz);
    const slot = r.status === "completed" ? 0 : r.status === "no_show" ? 1 : num(r.late) ? 2 : -1;
    if (slot < 0) continue;
    weekday.get(String(p.weekday))![slot]++;
    part.get(partOfDay(p.minutes))![slot]++;
  }
  const fromCounts = (key: string, c: number[]) => outcomeRow(key, c[0], c[1], c[2]);
  const byWeekday = WEEKDAY_ORDER.map((k) => fromCounts(k, weekday.get(k)!));
  const byPartOfDay = PARTS_OF_DAY.map((k) => fromCounts(k, part.get(k)!));
  const total = outcomeRow(
    "all",
    byService.reduce((n, r) => n + r.completed, 0),
    byService.reduce((n, r) => n + r.noShows, 0),
    byService.reduce((n, r) => n + r.lateCancels, 0),
  );

  // ---------------------------------------------------------------- confirmations after reminders
  // A confirmation is credited to the latest confirmation-asking reminder sent before it, so a
  // patient who ignored the email and answered the SMS counts for SMS only. Confirmations taken
  // by the front desk or at booking are not the reminder's doing and are not credited.
  const credited = sql<number>`sum(case when ${appointments.confirmation} = 'confirmed'
      and ${appointments.confirmedAt} >= ${reminders.sentAt}
      and coalesce(${appointments.confirmedVia}, '') not in ('staff', 'booking')
      and not exists (
        select 1 from reminders r2
        where r2.appointment_id = ${reminders.appointmentId} and r2.ask_confirmation = 1 and r2.status = 'sent'
          and r2.sent_at > ${reminders.sentAt} and r2.sent_at <= ${appointments.confirmedAt}
      ) then 1 else 0 end)`;
  const offsetMs = sql<number>`(${appointments.startsAt} - ${reminders.sendAt})`;
  const bucketSql = sql<OffsetBucket>`case
      when ${offsetMs} <= ${3 * HOUR} then 'h3'
      when ${offsetMs} <= ${12 * HOUR} then 'h12'
      when ${offsetMs} <= ${36 * HOUR} then 'd1'
      when ${offsetMs} <= ${60 * HOUR} then 'd2'
      else 'd3' end`;
  // The channel the reminder actually went out on (its message: a rule's text may go by WhatsApp,
  // or by email when the patient has no phone), not the rule's "email" or "sms".
  const sentChannel = sql<Channel>`coalesce(${messages.channel}, ${reminders.channel})`;
  const confRows = await db
    .select({ channel: sentChannel, bucket: bucketSql, sent: count(), confirmed: credited })
    .from(reminders)
    .innerJoin(appointments, eq(appointments.id, reminders.appointmentId))
    .leftJoin(messages, eq(messages.id, reminders.messageId))
    .where(
      and(
        eq(appointments.orgId, orgId),
        eq(reminders.kind, "reminder"),
        eq(reminders.askConfirmation, true),
        eq(reminders.status, "sent"),
        isNotNull(reminders.sentAt),
        gte(reminders.sentAt, from),
        lt(reminders.sentAt, to),
      ),
    )
    .groupBy(sentChannel, bucketSql);
  const confRow = <K extends string>(key: K, rows: typeof confRows): ConfirmationRow<K> => {
    const sent = rows.reduce((n, r) => n + num(r.sent), 0);
    const confirmed = rows.reduce((n, r) => n + num(r.confirmed), 0);
    return { key, sent, confirmed, rate: rate(confirmed, sent) };
  };
  const confirmation = {
    total: confRow("all" as const, confRows),
    byChannel: CHANNELS.map((c) => confRow(c, confRows.filter((r) => r.channel === c))).filter((r) => r.sent > 0),
    byOffset: OFFSET_BUCKETS.map((b) => confRow(b, confRows.filter((r) => r.bucket === b))).filter((r) => r.sent > 0),
  };

  // ---------------------------------------------------------------- waitlist
  const today = todayIn(tz, now);
  const wlRows = await db
    .select({ status: waitlist.status, ended: sql<number>`(${waitlist.latestDate} < ${today})`, n: count() })
    .from(waitlist)
    .where(and(eq(waitlist.orgId, orgId), gte(waitlist.createdAt, from), lt(waitlist.createdAt, to)))
    .groupBy(waitlist.status, sql`(${waitlist.latestDate} < ${today})`);
  const wl = { entries: 0, booked: 0, removed: 0, expired: 0, waiting: 0 };
  for (const r of wlRows) {
    const n = num(r.n);
    wl.entries += n;
    if (r.status === "booked") wl.booked += n;
    else if (r.status === "removed") wl.removed += n;
    else if (num(r.ended)) wl.expired += n;
    else wl.waiting += n;
  }
  // Entries still waiting have no outcome yet: they stay out of the denominator.
  const waitlistStats = { ...wl, fillRate: rate(wl.booked, wl.booked + wl.removed + wl.expired) };

  // ---------------------------------------------------------------- recalls
  const fromDay = todayIn(tz, from);
  const contacted = sql`(${recalls.attempts} > 0 or ${recalls.lastSentAt} is not null)`;
  const booked = sql`(${recalls.status} = 'booked' or ${recalls.bookedAppointmentId} is not null)`;
  const [recallRow] = await db
    .select({
      due: count(),
      contacted: sql<number>`sum(case when ${contacted} then 1 else 0 end)`,
      booked: sql<number>`sum(case when ${contacted} and ${booked} then 1 else 0 end)`,
    })
    .from(recalls)
    .where(and(eq(recalls.orgId, orgId), gte(recalls.dueDate, fromDay), lte(recalls.dueDate, today)));
  const recallStats = {
    due: num(recallRow?.due),
    contacted: num(recallRow?.contacted),
    booked: num(recallRow?.booked),
    conversion: rate(num(recallRow?.booked), num(recallRow?.contacted)),
  };

  // ---------------------------------------------------------------- lead time, new patients
  const created = and(eq(appointments.orgId, orgId), gte(appointments.createdAt, from), lt(appointments.createdAt, to));
  const [leadRows, sourceRows, contextRows] = await Promise.all([
    db
      .select({ lead: sql<number>`(${appointments.startsAt} - ${appointments.createdAt})` })
      .from(appointments)
      .where(and(created, ne(appointments.status, "requested"))),
    db
      .select({ key: appointments.source, n: count() })
      .from(appointments)
      .where(and(created, eq(appointments.isNewPatient, true)))
      .groupBy(appointments.source),
    db
      .select({ key: appointments.processingContext, n: count() })
      .from(appointments)
      .where(and(created, eq(appointments.isNewPatient, true)))
      .groupBy(appointments.processingContext),
  ]);
  const leads = leadRows.map((r) => Math.max(0, num(r.lead)));
  const leadCounts = new Map<LeadBucket, number>(LEAD_BUCKETS.map((b) => [b, 0]));
  for (const ms of leads) leadCounts.set(leadBucket(ms), leadCounts.get(leadBucket(ms))! + 1);
  const med = median(leads);
  const leadTime = {
    bookings: leads.length,
    medianDays: med == null ? null : Math.round((med / DAY) * 10) / 10,
    buckets: LEAD_BUCKETS.map((key) => ({ key, count: leadCounts.get(key)! })),
  };
  const bySource = sourceRows.map((r) => ({ key: r.key, count: num(r.n) })).sort((a, b) => b.count - a.count);
  const newPatients = {
    total: bySource.reduce((n, r) => n + r.count, 0),
    bySource,
    byContext: contextRows.map((r) => ({ key: r.key, count: num(r.n) })).sort((a, b) => b.count - a.count),
  };

  // ---------------------------------------------------------------- reviews (published only)
  const reviewRows = await db
    .select({ rating: reviews.rating, at: sql<number>`coalesce(${reviews.publishedAt}, ${reviews.createdAt})` })
    .from(reviews)
    .where(
      and(
        eq(reviews.orgId, orgId),
        eq(reviews.status, "published"),
        sql`coalesce(${reviews.publishedAt}, ${reviews.createdAt}) >= ${from.getTime()}`,
        sql`coalesce(${reviews.publishedAt}, ${reviews.createdAt}) < ${to.getTime()}`,
      ),
    );
  const monthKeys: string[] = [];
  for (let d = todayIn(tz, from).slice(0, 7); d <= today.slice(0, 7); d = addDays(`${d}-28`, 7).slice(0, 7)) monthKeys.push(d);
  const perMonth = new Map(monthKeys.map((m) => [m, { count: 0, sum: 0 }]));
  for (const r of reviewRows) {
    const m = perMonth.get(zonedParts(new Date(num(r.at)), tz).date.slice(0, 7));
    if (!m) continue;
    m.count++;
    m.sum += r.rating;
  }
  const reviewTotal = reviewRows.length;
  const reviewSum = reviewRows.reduce((n, r) => n + r.rating, 0);
  const reviewStats = {
    total: reviewTotal,
    average: reviewTotal ? Math.round((reviewSum / reviewTotal) * 10) / 10 : null,
    months: monthKeys.map((month) => {
      const m = perMonth.get(month)!;
      return { month, count: m.count, average: m.count ? Math.round((m.sum / m.count) * 10) / 10 : null };
    }),
  };

  // ---------------------------------------------------------------- marketplace funnel
  const team = await db
    .select({ id: practitioners.id, title: practitioners.title, name: practitioners.name })
    .from(practitioners)
    .where(eq(practitioners.orgId, orgId));
  const teamIds = team.map((p) => p.id);
  const [statRows, mpRows] = await Promise.all([
    teamIds.length
      ? db
          .select({
            practitionerId: profileStats.practitionerId,
            views: sql<number>`coalesce(sum(${profileStats.views}), 0)`,
            impressions: sql<number>`coalesce(sum(${profileStats.searchImpressions}), 0)`,
          })
          .from(profileStats)
          .where(and(inArray(profileStats.practitionerId, teamIds), gte(profileStats.day, fromDay), lte(profileStats.day, today)))
          .groupBy(profileStats.practitionerId)
      : [],
    db
      .select({ practitionerId: appointments.practitionerId, n: count() })
      .from(appointments)
      .where(and(created, eq(appointments.processingContext, "marketplace")))
      .groupBy(appointments.practitionerId),
  ]);
  const funnelBy = team
    .map((p) => {
      const st = statRows.find((r) => r.practitionerId === p.id);
      const bookings = num(mpRows.find((r) => r.practitionerId === p.id)?.n);
      const views = num(st?.views);
      return { practitionerId: p.id, name: practitionerName(p), impressions: num(st?.impressions), views, bookings, bookingRate: rate(bookings, views) };
    })
    .filter((r) => r.impressions || r.views || r.bookings)
    .sort((a, b) => b.views - a.views || a.name.localeCompare(b.name));
  const sum = (k: "impressions" | "views" | "bookings") => funnelBy.reduce((n, r) => n + r[k], 0);
  const funnel = {
    impressions: sum("impressions"),
    views: sum("views"),
    bookings: sum("bookings"),
    viewRate: rate(sum("views"), sum("impressions")),
    bookingRate: rate(sum("bookings"), sum("views")),
    byPractitioner: funnelBy,
  };

  return {
    orgId,
    months,
    from: from.toISOString(),
    to: to.toISOString(),
    generatedAt: now.toISOString(),
    lateCancelHours,
    outcomes: { total, byService, byPractitioner, byWeekday, byPartOfDay },
    confirmation,
    waitlist: waitlistStats,
    recalls: recallStats,
    leadTime,
    newPatients,
    reviews: reviewStats,
    funnel,
    ranking: await rankingInputs(orgId, team, now),
  };
}

/**
 * "Your ranking inputs": what the marketplace ranking sees for each of the practice's
 * practitioners (WP7's buildRankInputs) and the score scoreResult() gives them with neutral
 * search inputs (no city, no distance). The same function ranks real searches.
 */
async function rankingInputs(
  orgId: string,
  team: { id: string; title: string; name: string }[],
  now: Date,
): Promise<Analytics["ranking"]> {
  const [inputs, [mean]] = await Promise.all([
    buildRankInputs(orgId),
    db.select({ mean: avg(reviews.rating), n: count() }).from(reviews).where(eq(reviews.status, "published")),
  ]);
  const globalMeanRating = mean && num(mean.n) > 0 ? Math.round(Number(mean.mean) * 100) / 100 : 0;
  const ctx = { globalMeanRating, now, seed: todayIn("UTC", now) };
  const names = new Map(team.map((p) => [p.id, practitionerName(p)]));
  const rows = inputs.map((r): RankingRow => {
    const res = scoreResult(r, ctx);
    const cancelled = Math.round(r.staffCancelRate180d * (r.reliabilitySample ?? 0));
    return {
      practitionerId: r.practitionerId,
      name: names.get(r.practitionerId) ?? r.practitionerId,
      score: Math.round(res.score * 1000) / 10,
      reasons: res.reasons,
      soonestSlotAt: r.soonestSlotAt ? r.soonestSlotAt.toISOString() : null,
      ratingCount: r.ratingCount,
      ratingAverage: r.ratingCount ? Math.round((r.ratingSum / r.ratingCount) * 10) / 10 : null,
      staffCancelRate: { num: cancelled, den: r.reliabilitySample ?? 0, pct: Math.round(r.staffCancelRate180d * 1000) / 10 },
      completeness: Math.round(r.profileCompleteness * 100),
    };
  });
  return { globalMeanRating, practitioners: rows.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)) };
}

// ---------------------------------------------------------------- CSV export

/** A CSV cell: quoted, with formula-looking text neutralised (CSV injection in spreadsheets). */
function cell(v: string | number | null): string {
  if (v === null) return "";
  if (typeof v === "number") return String(v);
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return `"${safe.replace(/"/g, '""')}"`;
}

/**
 * The analytics as CSV (UTF-8 with BOM, comma-separated, "." as decimal separator), one row per
 * figure: section, item, measure, value, numerator, denominator. Values are the same rounded
 * numbers the page shows (Rate.pct), so the export always matches the screen. Labels are in the
 * staff member's language.
 */
export function analyticsCsv(a: Analytics, locale: Locale): string {
  const t = getT(locale, "analytics");
  const tc = getT(locale, "common");
  const rows: (string | number | null)[][] = [[t("csv.section"), t("csv.item"), t("csv.measure"), t("csv.value"), t("csv.numerator"), t("csv.denominator")]];
  const pushRate = (section: string, item: string, measure: string, r: Rate) => rows.push([section, item, measure, r.pct, r.num, r.den]);
  const weekdays = CALENDAR_NAMES[locale].weekdays;

  const outcome = (section: string, list: OutcomeRow[], label: (r: OutcomeRow) => string) => {
    for (const r of list) {
      pushRate(section, label(r), t("measures.noShowRate"), r.noShowRate);
      pushRate(section, label(r), t("measures.lateCancelRate"), r.lateCancelRate);
    }
  };
  outcome(t("sections.outcomesTotal"), [a.outcomes.total], () => t("csv.all"));
  outcome(t("sections.byService"), a.outcomes.byService, (r) => r.name ?? r.key);
  outcome(t("sections.byPractitioner"), a.outcomes.byPractitioner, (r) => r.name ?? r.key);
  outcome(t("sections.byWeekday"), a.outcomes.byWeekday, (r) => weekdays[Number(r.key)]);
  outcome(t("sections.byPartOfDay"), a.outcomes.byPartOfDay, (r) => t(`partsOfDay.${r.key as PartOfDay}`));

  pushRate(t("sections.confirmation"), t("csv.all"), t("measures.confirmationRate"), a.confirmation.total.rate);
  for (const r of a.confirmation.byChannel) pushRate(t("sections.confirmationByChannel"), tc(`channels.${r.key}`), t("measures.confirmationRate"), r.rate);
  for (const r of a.confirmation.byOffset) pushRate(t("sections.confirmationByOffset"), t(`offsets.${r.key}`), t("measures.confirmationRate"), r.rate);

  pushRate(t("sections.waitlist"), t("csv.all"), t("measures.fillRate"), a.waitlist.fillRate);
  rows.push([t("sections.waitlist"), t("csv.all"), t("measures.entries"), a.waitlist.entries, null, null]);
  pushRate(t("sections.recalls"), t("csv.all"), t("measures.recallConversion"), a.recalls.conversion);
  rows.push([t("sections.recalls"), t("csv.all"), t("measures.recallsDue"), a.recalls.due, null, null]);

  rows.push([t("sections.leadTime"), t("csv.all"), t("measures.medianDays"), a.leadTime.medianDays, null, null]);
  for (const b of a.leadTime.buckets) rows.push([t("sections.leadTime"), t(`leadBuckets.${b.key}`), t("measures.bookings"), b.count, null, null]);

  for (const r of a.newPatients.bySource) {
    const key = `sources.${r.key}` as const;
    rows.push([t("sections.newBySource"), t.has(key) ? t(key) : r.key, t("measures.newPatients"), r.count, null, null]);
  }
  for (const r of a.newPatients.byContext) rows.push([t("sections.newByContext"), t(`contexts.${r.key}`), t("measures.newPatients"), r.count, null, null]);

  for (const m of a.reviews.months) {
    rows.push([t("sections.reviews"), m.month, t("measures.reviews"), m.count, null, null]);
    rows.push([t("sections.reviews"), m.month, t("measures.averageRating"), m.average, null, null]);
  }

  rows.push([t("sections.funnel"), t("csv.all"), t("measures.impressions"), a.funnel.impressions, null, null]);
  rows.push([t("sections.funnel"), t("csv.all"), t("measures.profileViews"), a.funnel.views, null, null]);
  rows.push([t("sections.funnel"), t("csv.all"), t("measures.marketplaceBookings"), a.funnel.bookings, null, null]);
  pushRate(t("sections.funnel"), t("csv.all"), t("measures.bookingRate"), a.funnel.bookingRate);

  for (const r of a.ranking.practitioners) {
    rows.push([t("sections.ranking"), r.name, t("measures.score"), r.score, null, null]);
    rows.push([t("sections.ranking"), r.name, t("measures.reviews"), r.ratingCount, null, null]);
    rows.push([t("sections.ranking"), r.name, t("measures.averageRating"), r.ratingAverage, null, null]);
    pushRate(t("sections.ranking"), r.name, t("measures.staffCancelRate"), r.staffCancelRate);
    rows.push([t("sections.ranking"), r.name, t("measures.completeness"), r.completeness, null, null]);
  }

  return `﻿${rows.map((r) => r.map(cell).join(",")).join("\r\n")}\r\n`;
}
