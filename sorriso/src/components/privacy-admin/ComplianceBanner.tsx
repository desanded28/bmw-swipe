"use client";

import { AlertTriangle, FileWarning } from "lucide-react";
import Link from "next/link";
import { fmtDay } from "@/i18n/datefmt";
import { useLocale, useT } from "@/i18n/provider";
import type { ComplianceBannerState } from "@/lib/privacy/gates";

/**
 * The dashboard-wide compliance banner. Render it in the dashboard layout with the state from
 * complianceBannerState(session) (src/lib/privacy/gates.ts):
 *
 *   <ComplianceBanner state={await complianceBannerState(s)} />
 *
 * - staff other than owners and admins, while the DPA or terms await an owner: online booking is paused;
 * - owners and admins, when Sorriso's sub-processor list changed: review, accept or object;
 * - owners and admins, when online booking is paused for another reason (email not verified, closing).
 */
export function ComplianceBanner({ state }: { state: ComplianceBannerState }) {
  const t = useT("privacyAdmin");
  const locale = useLocale();
  if (!state) return null;
  const box = "mb-4 flex flex-wrap items-start gap-2 rounded-xl p-3 text-sm ring-1";
  if (state.kind === "awaiting_owner") {
    return (
      <div role="status" className={`${box} bg-amber-50 text-amber-900 ring-amber-200`}>
        <FileWarning size={16} className="mt-0.5 shrink-0" aria-hidden />
        <p className="flex-1">{t("banner.awaitingOwner")}</p>
      </div>
    );
  }
  if (state.kind === "subprocessors") {
    return (
      <div role="status" className={`${box} bg-sky-50 text-sky-900 ring-sky-200`}>
        <FileWarning size={16} className="mt-0.5 shrink-0" aria-hidden />
        <p className="flex-1">{t("banner.subprocessors", { version: state.version, date: /^\d{4}-\d{2}-\d{2}$/.test(state.date) ? fmtDay(state.date, "long", locale) : state.date })}</p>
        <span className="flex gap-3 font-semibold">
          <Link href="/dashboard/legal?doc=subprocessors" className="underline">
            {t("banner.review")}
          </Link>
          <a href={state.objectMailto} className="underline">
            {t("banner.object")}
          </a>
        </span>
      </div>
    );
  }
  return (
    <div role="status" className={`${box} bg-amber-50 text-amber-900 ring-amber-200`}>
      <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
      <ul className="flex-1">
        {state.reasons.map((r) => (
          <li key={r}>{t(`banner.bookingsPaused.${r}`)}</li>
        ))}
      </ul>
    </div>
  );
}
