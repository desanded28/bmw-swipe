"use client";

import { Baby, ClipboardCheck, ClipboardList, Copy, LoaderCircle, Repeat, TriangleAlert, UserRound } from "lucide-react";
import Link from "next/link";
import { useCallback, useId, useState } from "react";
import { loadAnamnesis } from "@/app/dashboard/actions/care";
import { capitalizeFirst, fmtDay, zonedDate } from "@/i18n/datefmt";
import { useLocale, useT } from "@/i18n/provider";
import { DEFAULT_TIMEZONE } from "@/lib/config";
import { Badge, Button, Card } from "../ui";
import { useToast } from "../dashboard/Toast";
import { AnamnesisSheet } from "./AnamnesisSheet";
import type { AnamnesisSheetData, PatientCareData } from "./types";

const RECALL_TONE = { due: "slate", sent: "blue", booked: "green", dismissed: "slate", call: "amber" } as const;

/** The patient page's care card (rendered by the PatientCarePanel server component). */
export function PatientCareView({ data }: { data: PatientCareData }) {
  const t = useT("care");
  const locale = useLocale();
  const toast = useToast();
  const headingId = useId();
  const [sheet, setSheet] = useState<AnamnesisSheetData | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const closeSheet = useCallback(() => setSheet(null), []);
  const day = (iso: string) => fmtDay(zonedDate(iso, DEFAULT_TIMEZONE), "medium", locale);

  async function open(submissionId: string) {
    setOpening(submissionId);
    try {
      const r = await loadAnamnesis({ submissionId });
      if (r.ok) setSheet(r.data);
      else toast.show({ tone: "error", text: r.error });
    } finally {
      setOpening(null);
    }
  }

  return (
    <Card className="p-5">
      <section aria-labelledby={headingId} className="space-y-5">
        <h2 id={headingId} className="flex items-center gap-2 font-bold">
          <ClipboardList size={18} className="text-brand-700" aria-hidden /> {t("patient.title")}
        </h2>

        {data.duplicate ? (
          <div className="rounded-xl bg-amber-50 p-3 text-sm ring-1 ring-amber-200">
            <p className="flex items-center gap-1.5 font-semibold text-amber-900">
              <Copy size={15} aria-hidden /> {t("patient.duplicate")}
            </p>
            <p className="mt-1 text-amber-900">
              {data.duplicate.ofName
                ? t("patient.duplicateOf", { name: data.duplicate.ofName })
                : data.duplicate.ofRestricted
                  ? t("patient.duplicateOfRestricted")
                  : t("patient.duplicateOthers", { count: data.duplicate.flaggedBy })}
            </p>
            <Link
              href={`/dashboard/patients/duplicates#p-${data.patientId}`}
              className="mt-1.5 inline-block font-semibold text-brand-700 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-brand-600"
            >
              {t("patient.reviewDuplicates")}
            </Link>
          </div>
        ) : null}

        {data.minor || data.guardian ? (
          <div className="space-y-1.5">
            {data.minor ? (
              <Badge tone="violet">
                <Baby size={12} aria-hidden /> {t("badges.parentalConsent")}
              </Badge>
            ) : null}
            {data.guardian ? (
              <div className="text-sm">
                <p className="text-xs font-semibold text-slate-500">{t("patient.guardian")}</p>
                <p className="flex items-center gap-1.5 font-semibold">
                  <UserRound size={14} aria-hidden /> {data.guardian.name ?? "—"}
                  {data.guardian.relation ? <span className="font-normal text-slate-600">· {t(`patient.relation.${data.guardian.relation}`)}</span> : null}
                </p>
                {data.guardian.phone || data.guardian.email ? (
                  <p className="text-slate-600">{[data.guardian.phone, data.guardian.email].filter(Boolean).join(" · ")}</p>
                ) : null}
                {data.viaGuardian ? <p className="mt-0.5 text-xs text-slate-500">{t("patient.viaGuardian")}</p> : null}
              </div>
            ) : null}
          </div>
        ) : null}

        <div>
          <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
            <Repeat size={13} aria-hidden /> {t("patient.recalls")}
          </h3>
          {data.recalls.length ? (
            <ul className="divide-y divide-slate-100 text-sm">
              {data.recalls.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <p className="font-semibold">{r.serviceName}</p>
                    <p className="text-xs text-slate-500">
                      {capitalizeFirst(t("patient.due", { date: fmtDay(r.dueDate, "medium", locale) }), locale)} ·{" "}
                      {t("patient.every", { count: r.intervalMonths })}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {!r.confirmed && r.status !== "dismissed" && r.status !== "booked" ? <Badge tone="amber">{t("patient.unconfirmed")}</Badge> : null}
                    <Badge tone={RECALL_TONE[r.status]}>{t(`panel.recall.status.${r.status}`)}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">{t("patient.noRecalls")}</p>
          )}
        </div>

        <div>
          <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
            <ClipboardCheck size={13} aria-hidden /> {t("patient.forms")}
          </h3>
          {data.submissions.length ? (
            <ul className="divide-y divide-slate-100 text-sm">
              {data.submissions.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <p className="font-semibold">{t("patient.signed", { date: day(s.signedAt), name: s.signerName ?? "—" })}</p>
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {s.alerts !== null ? (
                        s.alerts ? (
                          <Badge tone="red">
                            <TriangleAlert size={12} aria-hidden /> {t("patient.alerts", { count: s.alerts })}
                          </Badge>
                        ) : (
                          <Badge tone="green">{t("patient.noAlerts")}</Badge>
                        )
                      ) : null}
                      {s.exportedAt ? <Badge tone="slate">{t("patient.inRecord")}</Badge> : null}
                    </div>
                  </div>
                  {data.canReadClinical ? (
                    <Button type="button" size="sm" variant="secondary" disabled={opening === s.id} onClick={() => open(s.id)}>
                      {opening === s.id ? <LoaderCircle size={14} className="animate-spin" aria-hidden /> : null}
                      {t("patient.view")}
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">{t("patient.noForms")}</p>
          )}
        </div>
      </section>
      {sheet ? <AnamnesisSheet data={sheet} onClose={closeSheet} /> : null}
    </Card>
  );
}
