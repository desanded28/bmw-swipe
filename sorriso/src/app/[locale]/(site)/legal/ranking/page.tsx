import { Info, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { LOCALES, OG_LOCALE, toLocale } from "@/i18n/config";
import { capitalizeFirst, fmtDay } from "@/i18n/datefmt";
import { lhref } from "@/i18n/href";
import { formatPercent } from "@/i18n/number";
import { rich } from "@/i18n/rich";
import { alternatesFor } from "@/i18n/seo";
import { getT } from "@/i18n/server";
import { RANK_WEIGHTS } from "@/lib/ranking";

type Params = Promise<{ locale: string }>;

/** When this description was last reviewed (update with every change to src/lib/ranking.ts). */
const UPDATED_ON = "2026-10-14";

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const locale = toLocale((await params).locale);
  const t = getT(locale, "marketplace");
  const title = t("ranking.metaTitle");
  const description = t("ranking.metaDescription");
  return {
    title,
    description,
    alternates: alternatesFor("/legal/ranking", locale),
    openGraph: { type: "website", title, description, locale: OG_LOCALE[locale], alternateLocale: LOCALES.filter((l) => l !== locale).map((l) => OG_LOCALE[l]) },
  };
}

/**
 * How search results are ranked: the main parameters and their relative weight, in the spirit of
 * the EU P2B Regulation (2019/1150, Art. 5). The weights come from src/lib/ranking.ts itself, so
 * this page can't drift from the code.
 */
export default async function RankingPage({ params }: { params: Params }) {
  const locale = toLocale((await params).locale);
  const t = getT(locale, "marketplace");
  const section = "mt-10 text-xl font-bold";
  const link = "font-semibold text-brand-700 underline underline-offset-2";
  const signals = (Object.entries(RANK_WEIGHTS) as [keyof typeof RANK_WEIGHTS, number][]).sort((a, b) => b[1] - a[1]);

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 text-slate-700">
      <h1 className="text-3xl font-extrabold tracking-tight text-ink">{t("ranking.title")}</h1>
      {locale !== "it" ? (
        <p className="mt-4 flex gap-2 rounded-xl bg-slate-50 p-3 text-sm ring-1 ring-slate-200">
          <Info size={16} className="mt-0.5 shrink-0 text-slate-600" aria-hidden />
          <span>
            {rich(t("ranking.translationNotice"), {
              link: (c) => (
                <Link href={lhref("it", "/legal/ranking")} hrefLang="it" lang="it" className={link}>
                  {c}
                </Link>
              ),
            })}
          </span>
        </p>
      ) : null}
      <p className="mt-6 text-lg">{t("ranking.intro")}</p>

      <section className="mt-8 rounded-2xl bg-brand-50 p-5 ring-1 ring-brand-200" aria-labelledby="not-paid">
        <h2 id="not-paid" className="flex items-center gap-2 text-lg font-bold text-brand-900">
          <ShieldCheck size={20} aria-hidden /> {t("ranking.notPaid")}
        </h2>
        <p className="mt-2 text-brand-900">{t("ranking.notPaidBody")}</p>
      </section>

      <h2 className={section}>{t("ranking.filtersTitle")}</h2>
      <p className="mt-3">{t("ranking.filtersBody")}</p>

      <h2 className={section}>{t("ranking.signalsTitle")}</h2>
      <dl className="mt-4 space-y-4">
        {signals.map(([key, weight]) => (
          <div key={key} className="rounded-xl p-4 ring-1 ring-slate-200">
            <dt className="flex flex-wrap items-baseline justify-between gap-2 font-bold text-ink">
              {t(`ranking.signals.${key}.title`)}
              <span className="text-sm font-semibold text-brand-800">{t("ranking.weight", { percent: formatPercent(weight, locale) })}</span>
            </dt>
            <dd className="mt-1">{t(`ranking.signals.${key}.body`)}</dd>
          </div>
        ))}
      </dl>

      <h2 className={section}>{t("ranking.urgentTitle")}</h2>
      <p className="mt-3">{t("ranking.urgentBody")}</p>
      <h2 className={section}>{t("ranking.tiesTitle")}</h2>
      <p className="mt-3">{t("ranking.tiesBody")}</p>
      <h2 className={section}>{t("ranking.reasonsTitle")}</h2>
      <p className="mt-3">{t("ranking.reasonsBody")}</p>
      <h2 className={section}>{t("ranking.dataTitle")}</h2>
      <p className="mt-3">{t("ranking.dataBody")}</p>
      <h2 className={section}>{t("ranking.practicesTitle")}</h2>
      <p className="mt-3">{t("ranking.practicesBody")}</p>
      <h2 className={section}>{t("ranking.contactTitle")}</h2>
      <p className="mt-3">{t("ranking.contactBody")}</p>
      <p className="mt-3">
        <Link href={lhref(locale, "/legal/reviews")} className={link}>
          {getT(locale, "reviews")("howWeVerify")}
        </Link>
      </p>

      <p className="mt-10 text-sm text-slate-500">{t("ranking.updated", { date: capitalizeFirst(fmtDay(UPDATED_ON, "long", locale), locale) })}</p>
    </article>
  );
}
