import { Gavel, LinkIcon, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import { TextActionForm } from "@/components/marketplace/TextActionForm";
import { Badge, Button, Card, LinkButton, Stars } from "@/components/ui";
import { toLocale, type Locale } from "@/i18n/config";
import { fmtDay, zonedDate } from "@/i18n/datefmt";
import { lhref } from "@/i18n/href";
import { formatDecimal } from "@/i18n/number";
import { getT } from "@/i18n/server";
import { authorModerationView, REPORT_TEXT_MAX } from "@/lib/reviews";
import { appealAction, respondAction, withdrawFromModerationAction } from "./actions";

export const dynamic = "force-dynamic";

type Params = Promise<{ locale: string; token: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const locale = toLocale((await params).locale);
  return { title: getT(locale, "reviews")("respond.metaTitle"), robots: { index: false, follow: false, nocache: true }, referrer: "no-referrer" };
}

function Shell({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <Card className="p-7">{children}</Card>
      <p className="mt-4 text-center">
        <LinkButton href={lhref(locale, "/legal/reviews")} variant="ghost" size="sm">
          {getT(locale, "reviews")("howWeVerify")}
        </LinkButton>
      </p>
    </div>
  );
}

/**
 * The author's side of moderation, opened from the signed link in the moderation emails (it
 * works after the visit link has expired): reply to a report within 7 days, read the decision and
 * its reasons, appeal a removal once, or delete the review.
 */
export default async function ReviewModerationPage({ params, searchParams }: { params: Params; searchParams: Promise<{ deleted?: string }> }) {
  const { locale: raw, token } = await params;
  const locale = toLocale(raw);
  const t = getT(locale, "reviews");
  const ta = getT(locale, "a11y");
  if ((await searchParams).deleted) {
    return (
      <Shell locale={locale}>
        <p role="status" className="flex items-center gap-2 font-semibold">
          <Trash2 size={18} aria-hidden /> {t("page.deleted")}
        </p>
      </Shell>
    );
  }
  const view = await authorModerationView(token);
  if (!view) {
    return (
      <Shell locale={locale}>
        <p className="flex items-start gap-2 text-slate-700">
          <LinkIcon size={18} className="mt-0.5 shrink-0" aria-hidden /> {t("respond.invalid")}
        </p>
      </Shell>
    );
  }
  const { report, review, org, appeal } = view;
  const day = (d: Date) => fmtDay(zonedDate(d, org.timezone), "long", locale);
  const asked = report.patientAskedAt != null;
  const decided = appeal?.decision ? appeal : report.decision ? report : null;

  return (
    <Shell locale={locale}>
      <h1 className="text-2xl font-extrabold tracking-tight">{t("respond.title", { clinic: org.name })}</h1>
      {review.status !== "withdrawn" ? (
        <section className="mt-4 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200" aria-label={t("page.yourReview")}>
          <div className="flex flex-wrap items-center gap-2">
            <Stars value={review.rating} label={ta("rating.stars", { rating: formatDecimal(review.rating, locale) })} />
            <Badge tone={review.status === "published" ? "green" : "amber"}>{t(`status.${review.status}`)}</Badge>
          </div>
          {review.comment ? <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{review.comment}</p> : null}
        </section>
      ) : null}

      {decided ? (
        <section className="mt-6 space-y-2" aria-labelledby="decision">
          <h2 id="decision" className="flex items-center gap-2 text-lg font-bold">
            <Gavel size={18} aria-hidden /> {t("respond.decisionTitle", { decision: t(`decision.${decided.decision!}`) })}
          </h2>
          {decided.decisionReason ? <p className="text-sm text-slate-700">{t("respond.reasons", { reason: decided.decisionReason })}</p> : null}
          {appeal && !appeal.decision ? <p className="text-sm font-medium text-slate-700">{t("respond.appealed")}</p> : null}
          {appeal?.decision || report.appealOfId ? <p className="text-sm text-slate-600">{t("respond.final")}</p> : null}
          {view.canAppeal && view.appealUntil ? (
            <div className="mt-4 space-y-2 rounded-xl p-4 ring-1 ring-slate-200">
              <h3 className="font-bold">{t("respond.appealTitle")}</h3>
              <p className="text-sm text-slate-600">{t("respond.appealBody", { date: day(view.appealUntil) })}</p>
              <TextActionForm action={appealAction.bind(null, token, locale)} name="appeal" label={t("respond.appeal")} hint={t("respond.responseHint")} submitLabel={t("respond.appealSend")} maxLength={REPORT_TEXT_MAX} />
            </div>
          ) : null}
        </section>
      ) : asked ? (
        <section className="mt-6 space-y-3" aria-labelledby="reported">
          <h2 id="reported" className="text-lg font-bold">
            {t("respond.reportedTitle")}
          </h2>
          {view.canRespond && view.responseDue ? (
            <>
              <p className="text-sm text-slate-700">{t("respond.reportedBody", { ground: t(`grounds.${report.ground}`), date: day(view.responseDue) })}</p>
              <TextActionForm action={respondAction.bind(null, token, locale)} name="response" label={t("respond.response")} hint={t("respond.responseHint")} submitLabel={t("respond.send")} maxLength={REPORT_TEXT_MAX} />
            </>
          ) : report.patientResponse ? (
            <p className="text-sm text-slate-700">{t("respond.sent")}</p>
          ) : (
            <p className="text-sm text-slate-700">{t("respond.lateBody")}</p>
          )}
        </section>
      ) : (
        <p className="mt-6 text-sm text-slate-700">{t(`reportStatus.${report.status}`)}</p>
      )}

      {review.status !== "withdrawn" && review.status !== "removed" ? (
        <details className="mt-6 rounded-xl p-3 ring-1 ring-red-200">
          <summary className="cursor-pointer text-sm font-semibold text-red-700">{t("respond.editInstead")}</summary>
          <p className="mt-2 text-sm text-slate-600">{t("page.deleteHint")}</p>
          <form action={withdrawFromModerationAction.bind(null, token, locale)} className="mt-3">
            <Button type="submit" variant="danger" size="sm">
              <Trash2 size={14} aria-hidden /> {t("page.deleteConfirm")}
            </Button>
          </form>
        </details>
      ) : null}
    </Shell>
  );
}
