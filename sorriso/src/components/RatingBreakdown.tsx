"use client";

import { Info } from "lucide-react";
import Link from "next/link";
import { lhref } from "@/i18n/href";
import { formatDecimal } from "@/i18n/number";
import { useLocale, useT } from "@/i18n/provider";
import type { RatingBreakdown as Breakdown } from "@/lib/directory";
import { Stars } from "./ui";

/**
 * The published-review summary: simple average with the count, the distribution by stars, the
 * weighted (Bayesian) score that ranking uses, and the link to how reviews are verified.
 */
export function RatingBreakdown({ breakdown }: { breakdown: Breakdown }) {
  const t = useT("reviews");
  const ta = useT("a11y");
  const locale = useLocale();
  const policy = lhref(locale, "/legal/reviews");
  const link = "inline-flex items-center gap-1 text-xs font-semibold text-brand-700 underline-offset-2 hover:underline";

  if (!breakdown.count) {
    return (
      <div className="text-sm text-slate-600">
        <p>{t("breakdown.none")}</p>
        <Link href={policy} className={`${link} mt-1`}>
          <Info size={13} aria-hidden /> {t("howWeVerify")}
        </Link>
      </div>
    );
  }
  const average = formatDecimal(breakdown.average, locale, 1);
  const max = Math.max(...breakdown.distribution, 1);
  return (
    <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
      <div>
        <p className="text-4xl font-extrabold tracking-tight">{average}</p>
        <Stars value={breakdown.average} size={16} label={ta("rating.stars", { rating: average })} />
        <p className="mt-1 max-w-56 text-xs text-slate-600">{t("breakdown.average", { rating: average, count: breakdown.count })}</p>
      </div>
      <div>
        <ul className="space-y-1" aria-label={t("breakdown.title")}>
          {breakdown.distribution.map((n, i) => {
            const stars = 5 - i;
            const label = t("breakdown.row", { stars: t("breakdown.stars", { count: stars }), reviews: t("breakdown.reviews", { count: n }) });
            return (
              <li key={stars} className="flex items-center gap-2 text-xs text-slate-600" aria-label={label}>
                <span aria-hidden className="w-6 shrink-0 text-right font-semibold">
                  {stars}★
                </span>
                <span aria-hidden className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <span className="block h-full rounded-full bg-amber-400" style={{ width: `${(n / max) * 100}%` }} />
                </span>
                <span aria-hidden className="w-8 shrink-0 tabular-nums">
                  {formatDecimal(n, locale)}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-xs text-slate-600">{t("breakdown.weighted", { rating: formatDecimal(breakdown.weighted, locale, 2) })}</p>
        <Link href={policy} className={`${link} mt-1`}>
          <Info size={13} aria-hidden /> {t("howWeVerify")}
        </Link>
      </div>
    </div>
  );
}
