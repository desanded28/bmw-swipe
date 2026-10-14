"use client";

import { CalendarClock, ClipboardCheck, ClipboardList } from "lucide-react";
import { useEffect, useState } from "react";
import { formsCardStatus } from "@/app/[locale]/(site)/a/[token]/forms/actions";
import { fmtDay } from "@/i18n/datefmt";
import { lhref } from "@/i18n/href";
import { useT } from "@/i18n/provider";
import type { ManageCareCard } from "../care/types";
import { Card, LinkButton } from "../ui";
import type { ManageSlotProps } from "./contracts";

/**
 * The manage page's care card (WP8): "we need to move your appointment" when the practice closed
 * during the visit (link to the rebooking page), and the medical-history form's status with a
 * link to fill it in (or send an update). Loads its own status through the link; renders nothing
 * when there is nothing to show.
 */
export function ManageFormsCard({ token, locale, appointmentId, status }: ManageSlotProps) {
  const t = useT("care");
  const [card, setCard] = useState<{ key: string; data: ManageCareCard | null } | null>(null);
  const key = `${appointmentId}:${status}`;

  useEffect(() => {
    let alive = true;
    formsCardStatus(token)
      .then((data) => alive && setCard({ key, data }))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [token, key]);

  const data = card?.key === key ? card.data : null;
  if (!data) return null;
  const a = data.anamnesis;
  const showForm = a && (a.status === "missing" || a.status === "complete") && (a.canFill || a.status === "complete");
  if (!data.rebookNeeded && !showForm) return null;

  return (
    <div className="space-y-4">
      {data.rebookNeeded ? (
        <Card className="p-5 ring-amber-300">
          <h2 className="flex items-center gap-2 font-semibold">
            <CalendarClock size={18} className="text-amber-700" aria-hidden /> {t("manageCard.rebookTitle")}
          </h2>
          <p className="mt-1 text-sm text-slate-700">{t("manageCard.rebookBody")}</p>
          <LinkButton href={lhref(locale, `/a/${token}/rebook`)} className="mt-3">
            {t("manageCard.rebookButton")}
          </LinkButton>
        </Card>
      ) : null}
      {showForm && a ? (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 font-semibold">
              {a.status === "complete" ? (
                <ClipboardCheck size={18} className="text-emerald-600" aria-hidden />
              ) : (
                <ClipboardList size={18} className="text-brand-700" aria-hidden />
              )}
              {t("manageCard.anamnesisTitle")}
            </h2>
            <p className="mt-1 text-sm text-slate-700">
              {a.status === "complete" && a.signedOn
                ? t("manageCard.complete", { date: fmtDay(a.signedOn, "medium", locale) })
                : t("manageCard.missing")}
            </p>
          </div>
          {a.canFill ? (
            <LinkButton href={lhref(locale, `/a/${token}/forms/anamnesis`)} variant={a.status === "complete" ? "secondary" : "primary"}>
              {a.status === "complete" ? t("manageCard.update") : t("manageCard.fill")}
            </LinkButton>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
