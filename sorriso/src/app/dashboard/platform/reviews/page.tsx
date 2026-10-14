import type { Metadata } from "next";
import { ModerationPanel } from "@/components/marketplace/ModerationPanel";
import { Badge, Card, EmptyState, PageHeader, Stars } from "@/components/ui";
import type { Review } from "@/db/schema";
import { fmtDay, zonedDate } from "@/i18n/datefmt";
import { formatDecimal } from "@/i18n/number";
import { getStaffLocale, getT } from "@/i18n/server";
import { requirePlatformAdmin } from "@/lib/auth";
import { moderationQueue } from "@/lib/reviews";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getStaffLocale(), "reviews")("moderation.metaTitle") };
}

/**
 * Review moderation (platform admins): reports and appeals, oldest first, then reviews the
 * automatic check held. Every decision needs a statement of reasons, sent to the author and to
 * whoever reported; review.moderate is audited with that reason. Appeals go to a different
 * moderator. Practices have no access to this page.
 */
export default async function ModerationPage() {
  await requirePlatformAdmin();
  const locale = await getStaffLocale();
  const t = getT(locale, "reviews");
  const ta = getT(locale, "a11y");
  const { reports, held } = await moderationQueue();
  const day = (d: Date) => fmtDay(zonedDate(d, "Europe/Rome"), "medium", locale);
  const flagLabel = (f: string) => {
    const key = `flags.${f}` as const;
    return t.has(key) ? t(key) : f;
  };

  const reviewBox = (review: Review, comment: string | null, orgName: string, practitionerName: string) => (
    <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Stars value={review.rating} label={ta("rating.stars", { rating: formatDecimal(review.rating, locale) })} />
        <span className="font-semibold">{orgName}</span>
        <span className="text-slate-600">· {practitionerName}</span>
        <Badge tone={review.status === "published" ? "green" : "amber"}>{t(`status.${review.status}`)}</Badge>
      </div>
      {comment ? (
        <p className="mt-2 whitespace-pre-line text-sm text-slate-700" lang={review.locale && review.locale !== locale ? review.locale : undefined}>
          {comment}
        </p>
      ) : null}
      {review.flags?.length ? (
        <p className="mt-2 text-xs text-slate-600">
          <span className="font-semibold">{t("moderation.flags")}</span> {review.flags.map(flagLabel).join(", ")}
        </p>
      ) : null}
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={t("moderation.title")} description={t("moderation.description")} />

      <h2 className="mb-2 text-lg font-bold">{t("moderation.reportsTitle")}</h2>
      {reports.length ? (
        <ul className="space-y-4">
          {reports.map((r) => (
            <li key={r.report.id}>
              <Card className="space-y-3 p-5">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge tone={r.previous ? "violet" : "amber"}>{r.previous ? t("moderation.appeal") : t(`grounds.${r.report.ground}`)}</Badge>
                  <span className="text-slate-600">
                    {r.source === "practice" ? t("moderation.reportedBy.practice") : r.source === "public" ? t("moderation.reportedBy.public") : t("moderation.appeal")}
                  </span>
                  <span className="text-xs text-slate-500">{t("moderation.received", { date: day(r.report.createdAt) })}</span>
                  <span className="text-xs font-semibold text-amber-800">{t("moderation.dueBy", { date: day(r.decideBy) })}</span>
                </div>
                {reviewBox(r.review, r.comment, r.orgName, r.practitionerName)}
                {r.previous?.decision && r.previous.decisionReason ? (
                  <p className="text-sm text-slate-700">{t("moderation.previous", { decision: t(`decision.${r.previous.decision}`), reason: r.previous.decisionReason })}</p>
                ) : null}
                {r.details ? (
                  <div className="text-sm">
                    <p className="font-semibold text-slate-700">{t("moderation.details")}</p>
                    <p className="whitespace-pre-line text-slate-700">{r.details}</p>
                  </div>
                ) : null}
                <div className="text-sm">
                  <p className="font-semibold text-slate-700">{t("moderation.patientResponse")}</p>
                  {r.authorResponse ? <p className="whitespace-pre-line text-slate-700">{r.authorResponse}</p> : <p className="text-slate-600">{t("moderation.noResponse")}</p>}
                  {r.responseDue ? <p className="text-xs text-slate-500">{t("moderation.patientDue", { date: day(r.responseDue) })}</p> : null}
                </div>
                <ModerationPanel kind="report" id={r.report.id} canAsk={r.report.status === "open" && !r.report.patientAskedAt} />
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title={t("moderation.empty")} />
      )}

      <h2 className="mb-2 mt-8 text-lg font-bold">{t("moderation.heldTitle")}</h2>
      {held.length ? (
        <ul className="space-y-4">
          {held.map((h) => (
            <li key={h.review.id}>
              <Card className="space-y-3 p-5">
                <p className="text-xs text-slate-500">{t("moderation.received", { date: day(h.review.createdAt) })}</p>
                {reviewBox(h.review, h.comment, h.orgName, h.practitionerName)}
                <ModerationPanel kind="held" id={h.review.id} canAsk={false} />
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title={t("moderation.empty")} />
      )}
    </div>
  );
}
