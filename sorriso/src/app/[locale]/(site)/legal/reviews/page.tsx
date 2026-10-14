import { Info } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { PublicNoticeForm } from "@/components/marketplace/PublicNoticeForm";
import type { TextActionState } from "@/components/marketplace/TextActionForm";
import { Card, Stars } from "@/components/ui";
import { REVIEW_REPORT_GROUNDS, type ReviewReportGround } from "@/db/enums";
import { LOCALES, OG_LOCALE, toLocale, type Locale } from "@/i18n/config";
import { ClientMessages } from "@/i18n/ClientMessages";
import { capitalizeFirst, fmtDay } from "@/i18n/datefmt";
import { lhref } from "@/i18n/href";
import { formatDecimal } from "@/i18n/number";
import { rich } from "@/i18n/rich";
import { alternatesFor } from "@/i18n/seo";
import { getT } from "@/i18n/server";
import { rateLimitByIp } from "@/lib/rate-limit";
import { reviewForNotice, submitPublicNotice } from "@/lib/reviews";

export const dynamic = "force-dynamic";

type Params = Promise<{ locale: string }>;
type SP = Promise<{ report?: string }>;

/** When this policy was last reviewed (update with every change; see docs/marketplace.md). */
const UPDATED_ON = "2026-10-14";

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const locale = toLocale((await params).locale);
  const t = getT(locale, "reviews");
  const title = t("policy.metaTitle");
  const description = t("policy.metaDescription");
  return {
    title,
    description,
    alternates: alternatesFor("/legal/reviews", locale),
    openGraph: { type: "website", title, description, locale: OG_LOCALE[locale], alternateLocale: LOCALES.filter((l) => l !== locale).map((l) => OG_LOCALE[l]) },
  };
}

/** A notice from anyone about a review (DSA Art. 16): rate limited per network. */
async function sendNotice(reviewId: string, rawLocale: string, _prev: TextActionState, fd: FormData): Promise<TextActionState> {
  "use server";
  const locale: Locale = toLocale(rawLocale);
  const t = getT(locale, "reviews");
  if (!(await rateLimitByIp(await headers(), "review-notice", 5, 60 * 60_000)).ok) return { error: t("publicReport.rateLimited") };
  const ground = String(fd.get("ground") ?? "");
  if (!(REVIEW_REPORT_GROUNDS as readonly string[]).includes(ground) || fd.get("goodFaith") !== "yes") return { error: t("publicReport.required") };
  const res = await submitPublicNotice({
    reviewId,
    ground: ground as ReviewReportGround,
    explanation: String(fd.get("explanation") ?? ""),
    name: String(fd.get("name") ?? ""),
    email: String(fd.get("email") ?? ""),
    locale,
  });
  if (!res.ok) return { error: res.code === "not_found" ? t("publicReport.notFound") : t("publicReport.required") };
  return { ok: true, message: t("publicReport.sent") };
}

/**
 * How Sorriso verifies and moderates reviews (Codice del Consumo art. 22(4-bis); DSA Art. 16, 17,
 * 20), and how ratings are computed. Linked next to every rating. With ?report=<id> it carries
 * the notice form for that review.
 */
export default async function ReviewPolicyPage({ params, searchParams }: { params: Params; searchParams: SP }) {
  const locale = toLocale((await params).locale);
  const t = getT(locale, "reviews");
  const ta = getT(locale, "a11y");
  const { report } = await searchParams;
  const target = report && /^[0-9A-Za-z]{6,40}$/.test(report) ? await reviewForNotice(report) : null;
  const section = "mt-10 text-xl font-bold";
  const link = "font-semibold text-brand-700 underline underline-offset-2";
  const steps = ["report", "ask", "decide", "appeal", "outside"] as const;

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 text-slate-700">
      <h1 className="text-3xl font-extrabold tracking-tight text-ink">{t("policy.title")}</h1>
      {locale !== "it" ? (
        <p className="mt-4 flex gap-2 rounded-xl bg-slate-50 p-3 text-sm ring-1 ring-slate-200">
          <Info size={16} className="mt-0.5 shrink-0 text-slate-600" aria-hidden />
          <span>
            {rich(t("policy.translationNotice"), {
              link: (c) => (
                <Link href={lhref("it", "/legal/reviews")} hrefLang="it" lang="it" className={link}>
                  {c}
                </Link>
              ),
            })}
          </span>
        </p>
      ) : null}
      <p className="mt-6 text-lg">{t("policy.intro")}</p>

      <h2 className={section}>{t("policy.whoTitle")}</h2>
      <p className="mt-3">{t("policy.whoBody")}</p>
      <h2 className={section}>{t("policy.consentTitle")}</h2>
      <p className="mt-3">{t("policy.consentBody")}</p>
      <h2 className={section}>{t("policy.healthTitle")}</h2>
      <p className="mt-3">{t("policy.healthBody")}</p>
      <h2 className={section}>{t("policy.incentivesTitle")}</h2>
      <p className="mt-3">{t("policy.incentivesBody")}</p>
      <h2 className={section}>{t("policy.practicesTitle")}</h2>
      <p className="mt-3">{t("policy.practicesBody")}</p>
      <h2 className={section}>{t("policy.moderationTitle")}</h2>
      <ol className="mt-3 list-decimal space-y-2 pl-5">
        {steps.map((k) => (
          <li key={k}>{t(`policy.moderationSteps.${k}`)}</li>
        ))}
      </ol>
      <h2 className={section}>{t("policy.removeTitle")}</h2>
      <p className="mt-3">{t("policy.removeBody")}</p>
      <h2 className={section}>{t("policy.ratingTitle")}</h2>
      <p className="mt-3">{t("policy.ratingBody")}</p>

      <h2 id="report" className={section}>
        {t("policy.reportTitle")}
      </h2>
      {target ? (
        <Card className="mt-4 space-y-4 p-6">
          <p className="text-sm">{t("publicReport.intro")}</p>
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Stars value={target.rating} label={ta("rating.stars", { rating: formatDecimal(target.rating, locale) })} />
            {t("publicReport.reviewOf", { clinic: target.orgName, rating: formatDecimal(target.rating, locale) })}
          </p>
          <ClientMessages locale={locale} ns={["reviews"]}>
            <PublicNoticeForm action={sendNotice.bind(null, target.id, locale)} />
          </ClientMessages>
        </Card>
      ) : report ? (
        <p className="mt-3">{t("publicReport.notFound")}</p>
      ) : (
        <p className="mt-3">{t("policy.reportBody")}</p>
      )}

      <p className="mt-10 text-sm text-slate-500">{t("policy.updated", { date: capitalizeFirst(fmtDay(UPDATED_ON, "long", locale), locale) })}</p>
    </article>
  );
}
