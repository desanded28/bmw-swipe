import { Download } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BarChart, type BarDatum } from "@/components/dashboard/charts/BarChart";
import { ColumnChart } from "@/components/dashboard/charts/ColumnChart";
import { DataTable } from "@/components/dashboard/charts/DataTable";
import { ORDINAL } from "@/components/dashboard/charts/palette";
import { Meter, StatTile } from "@/components/dashboard/charts/StatTile";
import { Card, PageHeader, ScrollRegion, buttonClass, cx } from "@/components/ui";
import { CALENDAR_NAMES } from "@/i18n/calendar-names";
import { capitalizeFirst, fmtDay, fmtWhen } from "@/i18n/datefmt";
import { lhref } from "@/i18n/href";
import { formatDecimal, formatPercent } from "@/i18n/number";
import { getStaffLocale, getT } from "@/i18n/server";
import { ANALYTICS_RANGES, loadAnalytics, toRange, type OutcomeRow, type PartOfDay, type Rate } from "@/lib/analytics";
import { requirePermission } from "@/lib/permissions";
import { todayIn } from "@/lib/time";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getStaffLocale(), "analytics")("title") };
}

const DIMENSIONS = ["service", "practitioner", "weekday", "partOfDay"] as const;
type Dimension = (typeof DIMENSIONS)[number];
const SECTION_OF = {
  service: "sections.byService",
  practitioner: "sections.byPractitioner",
  weekday: "sections.byWeekday",
  partOfDay: "sections.byPartOfDay",
} as const satisfies Record<Dimension, string>;

/**
 * Practice analytics (analytics.read: owners and admins). Everything is computed on the server
 * when the page is requested (src/lib/analytics.ts): aggregate counts only, no cookies, no
 * client-side script, nothing sent to a third party. The CSV export prints the same figures.
 */
export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ months?: string; by?: string }> }) {
  const s = await requirePermission("analytics.read");
  const sp = await searchParams;
  const months = toRange(sp.months);
  const by: Dimension = DIMENSIONS.find((d) => d === sp.by) ?? "service";
  const locale = await getStaffLocale();
  const t = getT(locale, "analytics");
  const tc = getT(locale, "common");
  const tz = s.org.timezone;
  const a = await loadAnalytics(s.org, { months });

  const pct = (r: Rate) => (r.pct == null ? t("none") : formatPercent(r.pct / 100, locale, 1));
  /** Every count shown as text, with the staff locale's separators ("1.234", "1 234"). */
  const num = (n: number) => formatDecimal(n, locale);
  const ratio = (r: Rate) => (r.pct == null ? null : r.pct / 100);
  const weekdays = CALENDAR_NAMES[locale].weekdays;
  const outcomeLabel = (r: OutcomeRow) =>
    by === "weekday"
      ? capitalizeFirst(weekdays[Number(r.key)], locale)
      : by === "partOfDay"
        ? t(`partsOfDay.${r.key as PartOfDay}`)
        : (r.name ?? r.key);
  const outcomeRows = {
    service: a.outcomes.byService,
    practitioner: a.outcomes.byPractitioner,
    weekday: a.outcomes.byWeekday,
    partOfDay: a.outcomes.byPartOfDay,
  }[by];
  const outcomeBars = (pick: (r: OutcomeRow) => Rate, detail: (r: OutcomeRow) => string): BarDatum[] =>
    outcomeRows.map((r) => ({ key: r.key, label: outcomeLabel(r), value: pick(r).pct, display: pct(pick(r)), detail: detail(r) }));
  const rateBars = <K extends string>(rows: { key: K; sent: number; confirmed: number; rate: Rate }[], label: (k: K) => string): BarDatum[] =>
    rows.map((r) => ({
      key: r.key,
      label: label(r.key),
      value: r.rate.pct,
      display: pct(r.rate),
      detail: t("kpi.confirmationHint", { confirmed: num(r.confirmed), sent: t("counts.reminders", { count: r.sent }) }),
    }));
  const href = (patch: { months?: number; by?: Dimension }) => `/dashboard/analytics?months=${patch.months ?? months}&by=${patch.by ?? by}`;
  const today = todayIn(tz);
  const fromDay = todayIn(tz, new Date(a.from));
  const total = a.outcomes.total;
  const closedEntries = a.waitlist.booked + a.waitlist.removed + a.waitlist.expired;
  // Counted phrases are plurals of their own ("1 no-show in 8 visits"), joined by a pattern key.
  const noShowHint = (r: Pick<OutcomeRow, "noShows" | "completed">) =>
    t("kpi.noShowHint", { noShows: t("counts.noShows", { count: r.noShows }), visits: t("counts.visits", { count: r.completed + r.noShows }) });
  const lateCancelHint = a.lateCancelHours > 0 ? t("kpi.lateCancelHint", { count: a.lateCancelHours }) : t("kpi.lateCancelHintNoDeadline");
  const monthLabel = (m: string) => CALENDAR_NAMES[locale].monthsShort[Number(m.slice(5, 7)) - 1];
  const monthLong = (m: string) => fmtDay(`${m}-01`, "monthYear", locale);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <a href={`/dashboard/analytics/export?months=${months}`} className={buttonClass("secondary", "md")} title={t("exportHint")} download>
            <Download size={16} aria-hidden /> {t("export")}
          </a>
        }
      />

      <nav aria-label={t("range.label")} className="-mt-4 flex flex-wrap items-center gap-2">
        {ANALYTICS_RANGES.map((m) => (
          <Link
            key={m}
            href={href({ months: m })}
            aria-current={m === months ? "true" : undefined}
            className={cx(
              "rounded-full px-3.5 py-1.5 text-sm font-semibold ring-1",
              m === months ? "bg-ink text-white ring-ink" : "bg-white text-slate-700 ring-slate-300 hover:ring-slate-400",
            )}
          >
            {t("range.months", { count: m })}
          </Link>
        ))}
        <span className="text-xs text-slate-600">{t("range.window", { from: fmtDay(fromDay, "monthYear", locale), to: fmtDay(today, "monthYear", locale) })}</span>
      </nav>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label={t("title")}>
        <StatTile
          label={t("kpi.noShow")}
          value={pct(total.noShowRate)}
          ratio={ratio(total.noShowRate)}
          hint={noShowHint(total)}
        />
        <StatTile label={t("kpi.lateCancel")} value={pct(total.lateCancelRate)} ratio={ratio(total.lateCancelRate)} hint={lateCancelHint} />
        <StatTile
          label={t("kpi.confirmation")}
          value={pct(a.confirmation.total.rate)}
          ratio={ratio(a.confirmation.total.rate)}
          hint={t("kpi.confirmationHint", { confirmed: num(a.confirmation.total.confirmed), sent: t("counts.reminders", { count: a.confirmation.total.sent }) })}
        />
        <StatTile
          label={t("kpi.waitlist")}
          value={pct(a.waitlist.fillRate)}
          ratio={ratio(a.waitlist.fillRate)}
          hint={t("kpi.waitlistHint", { booked: t("counts.booked", { count: a.waitlist.booked }), closed: t("counts.closedEntries", { count: closedEntries }) })}
        />
        <StatTile
          label={t("kpi.recalls")}
          value={pct(a.recalls.conversion)}
          ratio={ratio(a.recalls.conversion)}
          hint={t("kpi.recallsHint", { booked: t("counts.booked", { count: a.recalls.booked }), contacted: t("counts.patientsRecalled", { count: a.recalls.contacted }) })}
        />
        <StatTile
          label={t("kpi.leadTime")}
          // A plural text: the translator shows `count` with the locale's separators ("3,5 giorni").
          value={a.leadTime.medianDays == null ? t("none") : t("kpi.leadTimeValue", { count: a.leadTime.medianDays })}
          hint={t("kpi.leadTimeHint", { count: a.leadTime.bookings })}
        />
      </section>

      <Card className="p-5 sm:p-6">
        <section aria-labelledby="attendance-heading">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-2xl">
              <h2 id="attendance-heading" className="text-lg font-bold">
                {t("sections.attendance")}
              </h2>
              <p className="mt-1 text-xs text-slate-600">{t("sections.attendanceHint")}</p>
            </div>
            <nav aria-label={t("dimension.label")} className="inline-flex flex-wrap rounded-lg bg-slate-100 p-0.5">
              {DIMENSIONS.map((d) => (
                <Link
                  key={d}
                  href={href({ by: d })}
                  scroll={false}
                  aria-current={d === by ? "true" : undefined}
                  className={cx("rounded-md px-2.5 py-1 text-[13px] font-semibold", d === by ? "bg-white text-ink shadow-sm" : "text-slate-600 hover:text-ink")}
                >
                  {t(`dimension.${d}`)}
                </Link>
              ))}
            </nav>
          </div>
          <div className="mt-5 grid grid-cols-1 gap-8 lg:grid-cols-2">
            <BarChart
              id="noshow"
              caption={t("sections.noShowChart")}
              data={outcomeBars((r) => r.noShowRate, noShowHint)}
              max={Math.max(10, ...outcomeRows.map((r) => r.noShowRate.pct ?? 0))}
              empty={t("noData")}
            />
            <BarChart
              id="latecancel"
              caption={t("sections.lateCancelChart")}
              data={outcomeBars((r) => r.lateCancelRate, () => lateCancelHint)}
              max={Math.max(10, ...outcomeRows.map((r) => r.lateCancelRate.pct ?? 0))}
              empty={t("noData")}
            />
          </div>
          <DataTable
            summary={t("showTable")}
            caption={t(SECTION_OF[by])}
            headers={[t(`dimension.${by}`), t("table.visits"), t("table.noShows"), t("table.lateCancels"), t("table.noShowRate"), t("table.lateCancelRate")]}
            rows={outcomeRows.map((r) => ({
              key: r.key,
              cells: [outcomeLabel(r), num(r.completed + r.noShows), num(r.noShows), num(r.lateCancels), pct(r.noShowRate), pct(r.lateCancelRate)],
            }))}
          />
        </section>
      </Card>

      <Card className="p-5 sm:p-6">
        <section aria-labelledby="confirmation-heading">
          <h2 id="confirmation-heading" className="text-lg font-bold">
            {t("sections.confirmation")}
          </h2>
          <p className="mt-1 max-w-2xl text-xs text-slate-600">{t("sections.confirmationHint")}</p>
          <div className="mt-5 grid grid-cols-1 gap-8 lg:grid-cols-2">
            <div>
              <BarChart caption={t("sections.confirmationByChannel")} data={rateBars(a.confirmation.byChannel, (k) => tc(`channels.${k}`))} max={100} empty={t("noData")} />
              <DataTable
                summary={t("showTable")}
                caption={t("sections.confirmationByChannel")}
                headers={[t("table.item"), t("table.sent"), t("table.confirmed"), t("table.rate")]}
                rows={a.confirmation.byChannel.map((r) => ({ key: r.key, cells: [tc(`channels.${r.key}`), num(r.sent), num(r.confirmed), pct(r.rate)] }))}
              />
            </div>
            <div>
              <BarChart caption={t("sections.confirmationByOffset")} data={rateBars(a.confirmation.byOffset, (k) => t(`offsets.${k}`))} max={100} empty={t("noData")} />
              <DataTable
                summary={t("showTable")}
                caption={t("sections.confirmationByOffset")}
                headers={[t("table.item"), t("table.sent"), t("table.confirmed"), t("table.rate")]}
                rows={a.confirmation.byOffset.map((r) => ({ key: r.key, cells: [t(`offsets.${r.key}`), num(r.sent), num(r.confirmed), pct(r.rate)] }))}
              />
            </div>
          </div>
        </section>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5 sm:p-6">
          <h2 className="text-lg font-bold">{t("sections.waitlist")}</h2>
          <p className="mt-2 text-3xl font-extrabold tracking-tight">{pct(a.waitlist.fillRate)}</p>
          <p className="text-sm text-slate-600">{t("kpi.waitlist")}</p>
          {ratio(a.waitlist.fillRate) != null ? <Meter ratio={ratio(a.waitlist.fillRate)!} className="mt-2" /> : null}
          <p className="mt-3 text-xs text-slate-600">
            {t("sections.waitlistDetail", {
              entries: t("counts.entries", { count: a.waitlist.entries }),
              booked: t("counts.booked", { count: a.waitlist.booked }),
              removed: t("counts.removed", { count: a.waitlist.removed }),
              expired: t("counts.expired", { count: a.waitlist.expired }),
              waiting: t("counts.waiting", { count: a.waitlist.waiting }),
            })}
          </p>
        </Card>
        <Card className="p-5 sm:p-6">
          <h2 className="text-lg font-bold">{t("sections.recalls")}</h2>
          <p className="mt-2 text-3xl font-extrabold tracking-tight">{pct(a.recalls.conversion)}</p>
          <p className="text-sm text-slate-600">{t("kpi.recalls")}</p>
          {ratio(a.recalls.conversion) != null ? <Meter ratio={ratio(a.recalls.conversion)!} className="mt-2" /> : null}
          <p className="mt-3 text-xs text-slate-600">{t("sections.recallsDetail", {
              due: t("counts.recallsDue", { count: a.recalls.due }),
              contacted: t("counts.patientsContacted", { count: a.recalls.contacted }),
              booked: t("counts.booked", { count: a.recalls.booked }),
            })}</p>
        </Card>
      </div>

      <Card className="p-5 sm:p-6">
        <section aria-labelledby="bookings-heading">
          <h2 id="bookings-heading" className="text-lg font-bold">
            {t("sections.bookings")}
          </h2>
          <div className="mt-5 grid grid-cols-1 gap-8 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <ColumnChart
                caption={t("sections.leadTime")}
                data={a.leadTime.buckets.map((b) => ({
                  key: b.key,
                  label: t(`leadBuckets.${b.key}`),
                  value: b.count,
                  display: num(b.count),
                  detail: t("chart.column", { label: t(`leadBuckets.${b.key}`), value: num(b.count) }),
                }))}
                empty={t("noData")}
              />
              <DataTable
                summary={t("showTable")}
                caption={t("sections.leadTime")}
                headers={[t("table.item"), t("table.count")]}
                rows={a.leadTime.buckets.map((b) => ({ key: b.key, cells: [t(`leadBuckets.${b.key}`), num(b.count)] }))}
              />
            </div>
            <BarChart
              caption={t("sections.newBySource")}
              data={a.newPatients.bySource.map((r) => {
                const key = `sources.${r.key}` as const;
                const label = t.has(key) ? t(key) : r.key;
                return { key: r.key, label, value: r.count, display: num(r.count), detail: t("chart.bar", { label, value: num(r.count) }) };
              })}
              empty={t("noData")}
            />
            <BarChart
              caption={t("sections.newByContext")}
              data={a.newPatients.byContext.map((r) => ({
                key: r.key,
                label: t(`contexts.${r.key}`),
                value: r.count,
                display: num(r.count),
                detail: t("chart.bar", { label: t(`contexts.${r.key}`), value: num(r.count) }),
              }))}
              empty={t("noData")}
            />
          </div>
        </section>
      </Card>

      <Card className="p-5 sm:p-6">
        <section aria-labelledby="reviews-heading">
          <h2 id="reviews-heading" className="text-lg font-bold">
            {t("sections.reviews")}
          </h2>
          <p className="mt-1 text-xs text-slate-600">
            {t("sections.reviewsHint")}{" "}
            {a.reviews.average != null
              ? t("sections.reviewsSummary", { count: a.reviews.total, average: formatDecimal(a.reviews.average, locale, 1) })
              : null}
          </p>
          <div className="mt-5">
            <ColumnChart
              caption={t("sections.reviews")}
              data={a.reviews.months.map((m) => ({
                key: m.month,
                label: monthLabel(m.month),
                value: m.count,
                display: num(m.count),
                detail:
                  m.average != null
                    ? t("sections.reviewsSummary", { count: m.count, average: formatDecimal(m.average, locale, 1) })
                    : t("chart.column", { label: monthLong(m.month), value: num(m.count) }),
              }))}
              empty={t("noData")}
            />
            <DataTable
              summary={t("showTable")}
              caption={t("sections.reviews")}
              headers={[t("table.month"), t("table.count"), t("table.average")]}
              rows={a.reviews.months.map((m) => ({
                key: m.month,
                cells: [capitalizeFirst(monthLong(m.month), locale), num(m.count), m.average != null ? formatDecimal(m.average, locale, 1) : t("none")],
              }))}
            />
          </div>
        </section>
      </Card>

      <Card className="p-5 sm:p-6">
        <section aria-labelledby="funnel-heading">
          <h2 id="funnel-heading" className="text-lg font-bold">
            {t("sections.funnel")}
          </h2>
          <p className="mt-1 max-w-2xl text-xs text-slate-600">{t("sections.funnelHint")}</p>
          <div className="mt-5 grid grid-cols-1 gap-8 lg:grid-cols-2">
            <div>
              <BarChart
                caption={t("sections.funnel")}
                data={(["impressions", "views", "bookings"] as const).map((k, i) => ({
                  key: k,
                  label: t(`funnel.${k}`),
                  value: a.funnel[k],
                  display: num(a.funnel[k]),
                  detail: t("chart.bar", { label: t(`funnel.${k}`), value: num(a.funnel[k]) }),
                  color: ORDINAL[i],
                }))}
                empty={t("noData")}
              />
              {a.funnel.views || a.funnel.impressions ? (
                <ul className="mt-3 space-y-1 text-xs text-slate-600">
                  <li>{t("funnel.viewRate", { value: pct(a.funnel.viewRate) })}</li>
                  <li>{t("funnel.bookingRate", { value: pct(a.funnel.bookingRate) })}</li>
                </ul>
              ) : null}
            </div>
            <DataTable
              caption={t("sections.funnel")}
              headers={[t("ranking.practitioner"), t("funnel.impressions"), t("funnel.views"), t("funnel.bookings"), t("measures.bookingRate")]}
              rows={a.funnel.byPractitioner.map((r) => ({
                key: r.practitionerId,
                cells: [r.name, num(r.impressions), num(r.views), num(r.bookings), pct(r.bookingRate)],
              }))}
              empty={t("noData")}
            />
          </div>
        </section>
      </Card>

      <Card className="p-5 sm:p-6">
        <section aria-labelledby="ranking-heading">
          <h2 id="ranking-heading" className="text-lg font-bold">
            {t("sections.ranking")}
          </h2>
          <p className="mt-1 max-w-3xl text-xs text-slate-600">
            {t("sections.rankingHint")}{" "}
            <a href={lhref(locale, "/legal/ranking")} target="_blank" rel="noopener" className="font-semibold text-brand-700 hover:underline">
              {t("sections.rankingLink")}
            </a>
          </p>
          {a.ranking.practitioners.length === 0 ? (
            <p className="mt-4 text-sm text-slate-600">{t("ranking.empty")}</p>
          ) : (
            <ScrollRegion label={t("sections.ranking")} className="mt-4">
              <table className="w-full min-w-[48rem] border-collapse text-left text-sm">
                <caption className="sr-only">{t("sections.ranking")}</caption>
                <thead>
                  <tr className="border-b border-slate-200 text-xs text-slate-600">
                    <th scope="col" className="py-2 pr-3 font-semibold">{t("ranking.practitioner")}</th>
                    <th scope="col" className="w-36 px-3 py-2 font-semibold">{t("ranking.score")}</th>
                    <th scope="col" className="px-3 py-2 font-semibold">{t("ranking.soonest")}</th>
                    <th scope="col" className="px-3 py-2 font-semibold">{t("ranking.rating")}</th>
                    <th scope="col" className="px-3 py-2 font-semibold">{t("ranking.cancellations")}</th>
                    <th scope="col" className="px-3 py-2 font-semibold">{t("ranking.completeness")}</th>
                    <th scope="col" className="py-2 pl-3 font-semibold">{t("ranking.reasons")}</th>
                  </tr>
                </thead>
                <tbody>
                  {a.ranking.practitioners.map((r) => (
                    <tr key={r.practitionerId} className="border-b border-slate-100 align-top last:border-0">
                      <th scope="row" className="py-2.5 pr-3 font-semibold">
                        {r.name}
                      </th>
                      <td className="px-3 py-2.5">
                        <span className="font-semibold tabular-nums">{formatDecimal(r.score, locale, 1)}</span>
                        <Meter ratio={r.score / 100} className="mt-1" />
                      </td>
                      <td className="px-3 py-2.5 text-slate-700">{r.soonestSlotAt ? fmtWhen(r.soonestSlotAt, tz, locale, "weekday") : t("ranking.noSlot")}</td>
                      <td className="px-3 py-2.5 text-slate-700">
                        {r.ratingAverage != null
                          ? t("ranking.ratingValue", { count: r.ratingCount, average: formatDecimal(r.ratingAverage, locale, 1) })
                          : t("ranking.noReviews")}
                      </td>
                      <td className="px-3 py-2.5 text-slate-700">{t("ranking.cancellationsValue", { value: pct(r.staffCancelRate) })}</td>
                      <td className="px-3 py-2.5 tabular-nums text-slate-700">{formatPercent(r.completeness / 100, locale)}</td>
                      <td className="py-2.5 pl-3 text-slate-700">
                        {r.reasons.length ? (
                          <ul className="flex flex-wrap gap-1">
                            {r.reasons.map((reason) => (
                              <li key={reason.key} className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-800">
                                {t(`ranking.reasonLabels.${reason.key}`)}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          t("ranking.noReasons")
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {a.ranking.globalMeanRating ? (
                <p className="mt-3 text-xs text-slate-600">{t("ranking.globalMean", { value: formatDecimal(a.ranking.globalMeanRating, locale, 2) })}</p>
              ) : null}
            </ScrollRegion>
          )}
        </section>
      </Card>
    </div>
  );
}
