"use client";

import { CircleHelp } from "lucide-react";
import Link from "next/link";
import type { SpokenLanguage } from "@/db/enums";
import { lhref } from "@/i18n/href";
import { formatDecimal } from "@/i18n/number";
import { useLocale, useT } from "@/i18n/provider";
import type { RankReason } from "@/lib/ranking";

/**
 * "Why am I seeing this?": the factors that lifted a result most (src/lib/ranking.ts), the filters
 * it matched, the statement that nobody pays for position, and the link to /legal/ranking.
 * A native <details>, so it works with the keyboard and screen readers without script.
 */
export function RankReasons({ reasons }: { reasons: readonly RankReason[] }) {
  const t = useT("marketplace");
  const tc = useT("common");
  const locale = useLocale();

  const text = (r: RankReason): string => {
    switch (r.key) {
      case "rating":
        return t("rank.rating", { rating: formatDecimal(Number(r.value ?? 0), locale, 1) });
      case "language":
        return t("rank.language", { language: tc.has(`languages.${r.value}`) ? tc(`languages.${r.value as SpokenLanguage}`) : String(r.value ?? "") });
      case "fund":
        return t("rank.fund", { fund: String(r.value ?? "") });
      default:
        return t(`rank.${r.key}`);
    }
  };

  return (
    <details className="group text-xs text-slate-600">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded font-semibold text-slate-600 hover:text-ink focus-visible:outline-2 focus-visible:outline-brand-600">
        <CircleHelp size={13} aria-hidden /> {t("rank.why")}
      </summary>
      <div className="mt-2 rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200">
        {reasons.length ? (
          <>
            <p>{t("rank.intro")}</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {reasons.map((r, i) => (
                <li key={`${r.key}-${i}`}>{text(r)}</li>
              ))}
            </ul>
          </>
        ) : (
          <p>{t("rank.none")}</p>
        )}
        <p className="mt-2 font-semibold text-slate-700">{t("rank.neutral")}</p>
        <Link href={lhref(locale, "/legal/ranking")} className="mt-1 inline-block font-semibold text-brand-700 hover:underline">
          {t("rank.learnMore")}
        </Link>
      </div>
    </details>
  );
}
