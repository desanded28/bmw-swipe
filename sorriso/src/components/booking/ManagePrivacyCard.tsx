"use client";

import { FileText, ShieldCheck, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { lhref } from "@/i18n/href";
import { useT } from "@/i18n/provider";
import { Card, LinkButton } from "../ui";
import type { ManageSlotProps } from "./contracts";

/**
 * The privacy card of the appointment page (WP4): the patient's privacy choices for this visit
 * (/[locale]/a/[token]/privacy: language, channel, optional consents, unsubscribe, and the
 * one-time code that opens everything else), the privacy center and the practice's notice.
 * Shown for past and cancelled visits too: rights don't end with the appointment.
 */
export function ManagePrivacyCard({ token, locale, orgSlug }: ManageSlotProps) {
  const t = useT("privacy");
  return (
    <Card className="mt-6 p-5">
      <h2 className="flex items-center gap-2 font-semibold">
        <ShieldCheck size={18} className="text-brand-700" aria-hidden /> {t("manageCard.title")}
      </h2>
      <p className="mt-1 text-sm text-slate-600">{t("manageCard.body")}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <LinkButton href={lhref(locale, `/a/${token}/privacy`)} variant="secondary" size="sm" prefetch={false}>
          <SlidersHorizontal size={14} aria-hidden /> {t("manageCard.preferences")}
        </LinkButton>
        <LinkButton href={lhref(locale, "/privacy")} variant="ghost" size="sm" prefetch={false}>
          {t("manageCard.privacyCenter")}
        </LinkButton>
        <Link
          href={lhref(locale, `/c/${orgSlug}/privacy`)}
          prefetch={false}
          className="inline-flex min-h-8 items-center gap-1 text-[13px] font-semibold text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline"
        >
          <FileText size={14} aria-hidden /> {t("manageCard.notice")}
        </Link>
      </div>
    </Card>
  );
}
