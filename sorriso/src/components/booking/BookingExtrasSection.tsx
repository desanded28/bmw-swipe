"use client";

import { Info } from "lucide-react";
import { useId } from "react";
import { formatMoney, formatPercent } from "@/i18n/number";
import { useLocale, useT } from "@/i18n/provider";
import { TAX_DEDUCTION_RATE, TAX_DEDUCTION_THRESHOLD_CENTS } from "../marketplace/price";
import { Select } from "../ui";
import type { BookingExtrasSectionProps } from "./contracts";

/**
 * The health fund the patient says they'll use ("I will use fund X"), posted as fundId. Only the
 * funds the practice declared for this treatment are offered; the server keeps the choice only if
 * the practice still lists it (src/lib/booking.ts). Below it, a short note on the 19% tax
 * deduction and the Sistema Tessera Sanitaria receipt.
 */
export function BookingExtrasSection({ clinic, serviceId, value, onChange }: BookingExtrasSectionProps) {
  const t = useT("catalog");
  const locale = useLocale();
  const id = useId();
  const eligible = (clinic.funds ?? []).filter((f) => !f.serviceIds || f.serviceIds.includes(serviceId));
  const selected = eligible.some((f) => f.id === value.fundId) ? (value.fundId ?? "") : "";

  return (
    <div className="space-y-3">
      {eligible.length ? (
        <div>
          <label htmlFor={`${id}fund`} className="mb-1.5 block text-[13px] font-semibold text-slate-700">
            {t("extras.fund")}
          </label>
          <Select
            id={`${id}fund`}
            aria-describedby={`${id}fundhint`}
            value={selected}
            onChange={(e) => onChange({ ...value, fundId: e.target.value || null })}
          >
            <option value="">{t("extras.none")}</option>
            {eligible.map((f) => (
              <option key={f.id} value={f.id}>
                {t("extras.option", { fund: f.name, mode: t(`extras.modes.${f.mode}`) })}
              </option>
            ))}
          </Select>
          <p id={`${id}fundhint`} className="mt-1 text-xs text-slate-500">
            {t("extras.fundHint")} {t("extras.declared")}
          </p>
        </div>
      ) : null}
      <details className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600 ring-1 ring-slate-200">
        <summary className="inline-flex cursor-pointer items-center gap-1.5 font-semibold text-slate-700">
          <Info size={14} aria-hidden /> {t("tax.title")}
        </summary>
        <p className="mt-2">{t("tax.body", { rate: formatPercent(TAX_DEDUCTION_RATE, locale), threshold: formatMoney(TAX_DEDUCTION_THRESHOLD_CENTS, locale) })}</p>
      </details>
    </div>
  );
}
