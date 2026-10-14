import { eq } from "drizzle-orm";
import { BadgeCheck, Info, ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ReviewReply } from "@/components/dashboard/ReviewReply";
import { REPLY_TEMPLATES, type ReplyTemplates } from "@/components/marketplace/review-templates";
import { Avatar, Badge, Card, EmptyState, PageHeader, Stars } from "@/components/ui";
import { db } from "@/db";
import { practitioners } from "@/db/schema";
import { isLocale, type Locale } from "@/i18n/config";
import { fmtDay, zonedDate } from "@/i18n/datefmt";
import { lhref } from "@/i18n/href";
import { formatDecimal } from "@/i18n/number";
import { getStaffLocale, getT } from "@/i18n/server";
import { practitionerName } from "@/lib/format";
import { can, requirePermission } from "@/lib/permissions";
import { practiceReviews } from "@/lib/reviews";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getStaffLocale(), "reviews")("dashboard.metaTitle") };
}

/** Neutral reply templates in the review's own language (patients read the reply in that language). */
function templatesFor(locale: Locale): ReplyTemplates {
  const t = getT(locale, "reviews");
  return Object.fromEntries(REPLY_TEMPLATES.map((k) => [k, t(`reply.templateTexts.${k}`)])) as ReplyTemplates;
}

/**
 * The practice's reviews. Practices reply and report; only Sorriso's moderators decide whether a
 * review is shown. Pseudonymous reviews stay pseudonymous here too (no link to the appointment or
 * the patient), and the text of a review that was never public is not shown.
 */
export default async function ReviewsPage() {
  const s = await requirePermission("calendar.read");
  const locale = await getStaffLocale();
  const t = getT(locale, "reviews");
  const ta = getT(locale, "a11y");
  const [rows, team] = await Promise.all([practiceReviews(s.org.id), db.select().from(practitioners).where(eq(practitioners.orgId, s.org.id))]);
  const byId = new Map(team.map((p) => [p.id, p]));
  const stats = new Map<string, { sum: number; n: number }>();
  for (const r of rows.filter((x) => x.status === "published")) {
    const cur = stats.get(r.practitionerId) ?? { sum: 0, n: 0 };
    cur.sum += r.rating;
    cur.n += 1;
    stats.set(r.practitionerId, cur);
  }
  const canReply = can(s.role, "reviews.reply");
  const canReport = can(s.role, "reviews.report");
  const orgLocale = isLocale(s.org.contentLocale) ? s.org.contentLocale : "it";
  const day = (d: Date) => fmtDay(zonedDate(d, s.org.timezone), "medium", locale);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={t("dashboard.title")}
        description={
          <>
            {t("dashboard.description")}{" "}
            <Link href={lhref(locale, "/legal/reviews")} target="_blank" className="font-semibold text-brand-700 hover:underline">
              {t("howWeVerify")}
            </Link>
          </>
        }
      />
      {stats.size ? (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[...stats.entries()].map(([pid, { sum, n }]) => {
            const p = byId.get(pid);
            if (!p) return null;
            const avg = formatDecimal(sum / n, locale, 1);
            return (
              <Card key={pid} className="flex items-center gap-3 p-4">
                <Avatar name={p.name} color={p.color} size={38} />
                <div>
                  <p className="text-sm font-semibold">{practitionerName(p)}</p>
                  <p className="flex items-center gap-1 text-xs text-slate-600">
                    <Stars value={sum / n} size={12} label={ta("rating.stars", { rating: avg })} /> {t("dashboard.average", { rating: avg, count: n })}
                  </p>
                </div>
              </Card>
            );
          })}
        </div>
      ) : null}
      {rows.length === 0 ? (
        <EmptyState title={t("dashboard.empty")}>{t("dashboard.emptyBody")}</EmptyState>
      ) : (
        <Card>
          <ul className="divide-y divide-slate-100">
            {rows.map((r) => {
              const p = byId.get(r.practitionerId);
              const author = r.authorDisplay === "first_initial" && r.authorName ? r.authorName : t("author.pseudonym");
              const reviewLocale = r.locale && isLocale(r.locale) ? r.locale : orgLocale;
              return (
                <li key={r.id} className={r.status === "published" ? "p-4" : "bg-slate-50/70 p-4"}>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Stars value={r.rating} label={ta("rating.stars", { rating: formatDecimal(r.rating, locale) })} />
                    <span className="font-semibold">{author}</span>
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
                      <BadgeCheck size={12} aria-hidden /> {t("verifiedVisit")}
                    </span>
                    {p ? <span className="text-xs text-slate-600">· {practitionerName(p)}</span> : null}
                    {r.status !== "published" ? <Badge tone={r.status === "under_review" ? "amber" : "slate"}>{t(`status.${r.status}`)}</Badge> : null}
                    <span className="ml-auto text-xs text-slate-500">{day(r.createdAt)}</span>
                  </div>
                  {r.comment ? (
                    <p className="mt-1.5 whitespace-pre-line text-sm text-slate-700" lang={r.locale && r.locale !== locale ? r.locale : undefined}>
                      {r.comment}
                    </p>
                  ) : r.status === "under_review" && !r.report ? (
                    <p className="mt-1.5 flex items-start gap-1.5 text-xs text-slate-600">
                      <ShieldAlert size={13} className="mt-0.5 shrink-0" aria-hidden /> {t("dashboard.held")}
                    </p>
                  ) : null}
                  {r.reply ? (
                    <p className="mt-2 rounded-lg bg-slate-50 p-2.5 text-sm text-slate-600">
                      <span className="font-semibold text-slate-700">{t("practiceReply")}</span>
                      <br />
                      {r.reply}
                    </p>
                  ) : null}
                  {r.report ? (
                    <p className="mt-2 flex items-start gap-1.5 text-xs text-slate-600">
                      <Info size={13} className="mt-0.5 shrink-0" aria-hidden />
                      <span>
                        {r.report.decision && r.report.decisionReason
                          ? t("dashboard.decided", { decision: t(`decision.${r.report.decision}`), reason: r.report.decisionReason })
                          : t("dashboard.reported", { date: day(r.report.createdAt), ground: t(`grounds.${r.report.ground}`), status: t(`reportStatus.${r.report.status}`) })}
                      </span>
                    </p>
                  ) : null}
                  <ReviewReply
                    id={r.id}
                    reply={r.reply}
                    status={r.status}
                    canReply={canReply}
                    canReport={canReport}
                    canAppeal={r.canAppeal}
                    templates={templatesFor(reviewLocale)}
                  />
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
