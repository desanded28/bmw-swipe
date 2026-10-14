"use client";

import { BadgeCheck, Flag, MessageSquareReply } from "lucide-react";
import Link from "next/link";
import type { Locale } from "@/db/enums";
import { fmtDay, zonedDate } from "@/i18n/datefmt";
import { lhref } from "@/i18n/href";
import { formatDecimal } from "@/i18n/number";
import { useLocale, useT } from "@/i18n/provider";
import type { PublicReview } from "@/lib/directory";
import { Stars } from "./ui";

/**
 * Published reviews. The author is "Verified patient" unless they chose to show their first name
 * and initial; a treatment or service name is never shown next to a review. Each review links to
 * the public report form (DSA Art. 16). Texts written in another language than the page's carry
 * their own lang attribute.
 */
export function ReviewList({
  reviews,
  showPractitioner = false,
  replyLang,
}: {
  reviews: PublicReview[];
  showPractitioner?: boolean;
  /** The language the practice writes its replies in. */
  replyLang?: Locale;
}) {
  const t = useT("reviews");
  const ta = useT("a11y");
  const locale = useLocale();
  const lang = (l: Locale | null | undefined) => (l && l !== locale ? l : undefined);

  return (
    <ul className="divide-y divide-slate-100" aria-label={t("listLabel")}>
      {reviews.map((r) => {
        const author = r.authorDisplay === "first_initial" && r.authorName ? r.authorName : t("author.pseudonym");
        return (
          <li key={r.id} className="py-4 first:pt-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Stars value={r.rating} label={ta("rating.stars", { rating: formatDecimal(r.rating, locale) })} />
              <span className="text-sm font-semibold">{author}</span>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                <BadgeCheck size={13} aria-hidden /> {t("verifiedVisit")}
              </span>
              <span className="text-xs text-slate-500">{fmtDay(zonedDate(r.createdAt, "Europe/Rome"), "monthYear", locale)}</span>
            </div>
            {showPractitioner ? (
              <p className="mt-0.5 text-xs text-slate-500">{t("visitWith", { name: [r.practitionerTitle, r.practitionerName].filter(Boolean).join(" ") })}</p>
            ) : null}
            {r.comment ? (
              <p className="mt-1.5 whitespace-pre-line text-sm text-slate-700" lang={lang(r.locale)}>
                {r.comment}
              </p>
            ) : null}
            {r.reply ? (
              <div className="mt-2 flex gap-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                <MessageSquareReply size={15} className="mt-0.5 shrink-0 text-slate-500" aria-hidden />
                <div>
                  <p className="font-semibold text-slate-700">{t("practiceReply")}</p>
                  <p className="whitespace-pre-line" lang={lang(replyLang)}>
                    {r.reply}
                  </p>
                </div>
              </div>
            ) : null}
            <Link
              href={lhref(locale, `/legal/reviews?report=${encodeURIComponent(r.id)}#report`)}
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-ink hover:underline"
              aria-label={t("reportLabel")}
              rel="nofollow"
            >
              <Flag size={12} aria-hidden /> {t("report")}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
