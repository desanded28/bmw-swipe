"use client";

import { Baby, BadgeCheck, HandHeart, HeartHandshake, Languages, Sparkles, type LucideIcon } from "lucide-react";
import type { LegalSpecialization, Locale, SpokenLanguage } from "@/db/enums";
import type { PractitionerCareOptions } from "@/db/schema";
import { fmtDay, zonedDate } from "@/i18n/datefmt";
import { useLocale, useT } from "@/i18n/provider";

const CARE_ICONS: Record<keyof PractitionerCareOptions, LucideIcon> = {
  children: Baby,
  anxiousPatients: HeartHandshake,
  sedation: Sparkles,
  specialNeeds: HandHeart,
};

export type ProfileFactsData = {
  spokenLanguages: readonly SpokenLanguage[];
  careOptions: PractitionerCareOptions;
  /** Legal specialisations to show: pass them only once the Albo registration is verified. */
  specializations: readonly LegalSpecialization[];
  albo: { province: string; verifiedAt: Date } | null;
};

/**
 * The verifiable facts of a public profile: the Albo badge, legal specialisations (only after the
 * Albo check), areas of interest, spoken languages and care options. Used on the practitioner
 * page and in the dashboard preview, so the preview shows exactly what patients see.
 */
export function ProfileFacts({
  profile,
  areas,
}: {
  profile: ProfileFactsData;
  /** The practitioner's areas of interest (practice-written text) and its language. */
  areas?: { text: string; lang: Locale } | null;
}) {
  const t = useT("marketplace");
  const tc = useT("common");
  const locale = useLocale();
  const care = (Object.keys(CARE_ICONS) as (keyof PractitionerCareOptions)[]).filter((k) => profile.careOptions?.[k] === true);
  const heading = "text-xs font-bold uppercase tracking-wider text-slate-600";

  return (
    <div className="space-y-4 text-sm">
      {profile.albo ? (
        <p className="flex items-start gap-2 rounded-xl bg-emerald-50 p-3 font-medium text-emerald-900 ring-1 ring-emerald-200">
          <BadgeCheck size={18} className="mt-0.5 shrink-0" aria-hidden />
          <span>{t("practitioner.albo", { province: profile.albo.province, date: fmtDay(zonedDate(profile.albo.verifiedAt, "Europe/Rome"), "long", locale) })}</span>
        </p>
      ) : null}
      {profile.specializations.length ? (
        <div>
          <p className={heading}>{t("practitioner.specializations")}</p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {profile.specializations.map((s) => (
              <li key={s} className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-800 ring-1 ring-brand-200">
                {t(`specializations.${s}`)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {areas?.text ? (
        <div>
          <p className={heading}>{t("practitioner.areasOfInterest")}</p>
          <p className="mt-1 text-slate-700" lang={areas.lang !== locale ? areas.lang : undefined}>
            {areas.text}
          </p>
        </div>
      ) : null}
      {profile.spokenLanguages.length ? (
        <div>
          <p className={heading}>{t("practitioner.languages")}</p>
          <p className="mt-1 flex items-start gap-2 text-slate-700">
            <Languages size={15} className="mt-0.5 shrink-0 text-slate-500" aria-hidden />
            <span>{profile.spokenLanguages.map((l) => tc(`languages.${l}`)).join(", ")}</span>
          </p>
        </div>
      ) : null}
      {care.length ? (
        <div>
          <p className={heading}>{t("practitioner.care")}</p>
          <ul className="mt-1.5 space-y-1">
            {care.map((k) => {
              const Icon = CARE_ICONS[k];
              return (
                <li key={k} className="flex items-center gap-2 text-slate-700">
                  <Icon size={15} className="shrink-0 text-brand-700" aria-hidden /> {t(`careOptions.${k}`)}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
