"use client";

import { Accessibility, Armchair, ArrowUpDown, Bath, CircleParking, Ear, Route, type LucideIcon } from "lucide-react";
import type { Locale } from "@/db/enums";
import type { LocationAccessibility } from "@/db/schema";
import { useLocale, useT } from "@/i18n/provider";

export const ACCESS_ICONS: Record<Exclude<keyof LocationAccessibility, "transit">, LucideIcon> = {
  stepFree: Accessibility,
  lift: ArrowUpDown,
  accessibleWc: Bath,
  disabledParking: CircleParking,
  hearingLoop: Ear,
  wheelchairTransferChair: Armchair,
};

/**
 * An office's accessibility features (only those the practice declared true) and its directions.
 * The directions are the practice's own text: marked with its language when it isn't the page's.
 */
export function AccessibilityList({ accessibility, contentLocale }: { accessibility: LocationAccessibility | undefined; contentLocale?: Locale }) {
  const t = useT("marketplace");
  const locale = useLocale();
  const a = accessibility ?? {};
  const features = (Object.keys(ACCESS_ICONS) as (keyof typeof ACCESS_ICONS)[]).filter((k) => a[k] === true);
  if (!features.length && !a.transit) return <p className="text-sm text-slate-600">{t("access.none")}</p>;
  return (
    <div className="space-y-2">
      {features.length ? (
        <ul className="flex flex-wrap gap-1.5" aria-label={t("form.access")}>
          {features.map((k) => {
            const Icon = ACCESS_ICONS[k];
            return (
              <li key={k} className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-800 ring-1 ring-sky-200">
                <Icon size={13} aria-hidden /> {t(`access.${k}`)}
              </li>
            );
          })}
        </ul>
      ) : null}
      {a.transit ? (
        <p className="flex items-start gap-1.5 text-sm text-slate-600">
          <Route size={14} className="mt-0.5 shrink-0" aria-hidden />
          <span>
            <span className="block font-semibold text-slate-700">{t("access.transit")}</span>
            <span className="block" lang={contentLocale && contentLocale !== locale ? contentLocale : undefined}>
              {a.transit}
            </span>
          </span>
        </p>
      ) : null}
    </div>
  );
}
