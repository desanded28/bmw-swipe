"use client";

import { Baby, CalendarClock, ClipboardCheck, ClipboardList, ClipboardX, LoaderCircle, Repeat, Send, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useId, useState } from "react";
import { loadAnamnesis, loadAppointmentCare, setRecallIntervalAction, sendFormInviteAction } from "@/app/dashboard/actions/care";
import { sendRebookOffersAction } from "@/app/dashboard/actions/timeoff";
import { AnamnesisSheet } from "@/components/care/AnamnesisSheet";
import { RECALL_INTERVALS, type AnamnesisSheetData, type AppointmentCareData, type CareResult } from "@/components/care/types";
import { capitalizeFirst, fmtDay, zonedDate } from "@/i18n/datefmt";
import { useLocale, useT } from "@/i18n/provider";
import { Badge, Button, Select, cx } from "../../ui";
import { useToast } from "../Toast";
import { useRunAction } from "../useRunAction";
import type { AppointmentCarePanelProps } from "./contracts";

/**
 * Care details inside the appointment drawer: the minor badge, no-show risk and its reasons, the
 * medical history (status for everyone; red flags and the answers only for the clinical team,
 * each opening audited), the recall interval after a completed visit (clinicians), and the
 * rebooking state when the practice closed during the visit. Loads its own details through the
 * care actions; risk, minor and anamnesis status come with `appt` (loadCareFlags).
 */
export function AppointmentCarePanel({ appt, canManage }: AppointmentCarePanelProps) {
  const t = useT("care");
  const locale = useLocale();
  const headingId = useId();
  const pickerId = useId();
  const toast = useToast();
  const { run, pending } = useRunAction();
  const [version, setVersion] = useState(0);
  const [loaded, setLoaded] = useState<{ key: string; res: CareResult<AppointmentCareData> } | null>(null);
  const [months, setMonths] = useState<string | null>(null);
  const [sheet, setSheet] = useState<AnamnesisSheetData | null>(null);
  const [opening, setOpening] = useState(false);
  const key = `${appt.id}:${appt.status}:${version}`;

  useEffect(() => {
    let alive = true;
    loadAppointmentCare(appt.id)
      .then((res) => alive && setLoaded({ key, res }))
      .catch(() => alive && setLoaded({ key, res: { ok: false, error: "" } }));
    return () => {
      alive = false;
    };
  }, [appt.id, key]);

  const reload = () => setVersion((v) => v + 1);
  const closeSheet = useCallback(() => setSheet(null), []);
  const res = loaded?.key === key ? loaded.res : null;
  const data = res?.ok ? res.data : null;
  const upcoming = appt.status === "scheduled" || appt.status === "requested";
  const risky = upcoming && appt.riskLevel && appt.riskLevel !== "low";

  async function openSheet() {
    setOpening(true);
    try {
      const r = await loadAnamnesis({ appointmentId: appt.id });
      if (r.ok) setSheet(r.data);
      else toast.show({ tone: "error", text: r.error });
    } finally {
      setOpening(false);
    }
  }

  const months0 = data ? String(data.recall?.status !== "dismissed" ? (data.recall?.intervalMonths ?? data.suggestedMonths ?? "") : "") : "";
  const picked = months ?? months0;

  return (
    <section aria-labelledby={headingId} className="space-y-4 rounded-xl ring-1 ring-slate-200 p-4">
      <h3 id={headingId} className="flex items-center gap-2 text-sm font-bold text-slate-800">
        <ClipboardList size={16} className="text-brand-700" aria-hidden /> {t("panel.title")}
      </h3>

      {appt.minorFlag ? (
        <Badge tone="violet">
          <Baby size={12} aria-hidden /> {t("badges.parentalConsent")}
        </Badge>
      ) : null}

      {risky ? (
        <div className="space-y-1.5">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <span aria-hidden className={cx("inline-block h-2.5 w-2.5 rounded-full", appt.riskLevel === "high" ? "bg-red-600" : "bg-amber-500")} />
            {t(`risk.levelLabel.${appt.riskLevel!}`)}
          </p>
          {appt.riskReasons.length ? (
            <ul className="list-disc space-y-0.5 pl-5 text-sm text-slate-700">
              {appt.riskReasons.map((r) => {
                const k = `risk.reasons.${r}` as const;
                return t.has(k) ? <li key={r}>{t(k)}</li> : null;
              })}
            </ul>
          ) : null}
          {appt.riskLevel === "high" && appt.riskReasons.includes("unconfirmed") ? (
            <p className="text-sm font-semibold text-red-800">{t("risk.callHint")}</p>
          ) : null}
          <p className="text-xs text-slate-500">{t("risk.helpOnly")}</p>
        </div>
      ) : null}

      {res === null ? (
        <p className="flex items-center gap-2 text-sm text-slate-500" role="status">
          <LoaderCircle size={14} className="animate-spin" aria-hidden /> {t("panel.loading")}
        </p>
      ) : !data ? (
        <p className="text-sm text-red-700" role="alert">
          {res.ok ? null : res.error || t("panel.loadError")}
        </p>
      ) : (
        <>
          {data.rebook.needed ? (
            <div className="rounded-lg bg-amber-50 p-3 text-sm ring-1 ring-amber-200">
              <p className="flex items-center gap-1.5 font-semibold text-amber-900">
                <CalendarClock size={15} aria-hidden /> {t("panel.rebook.title")}
              </p>
              <p className="mt-1 text-amber-900">{t("panel.rebook.needed")}</p>
              {data.rebook.callRequested ? <p className="mt-1 font-semibold text-amber-900">{t("panel.rebook.callRequested")}</p> : null}
              {canManage ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="mt-2"
                  disabled={pending}
                  onClick={() => run(() => sendRebookOffersAction([appt.id]), reload)}
                >
                  <Send size={14} aria-hidden /> {t("panel.rebook.send")}
                </Button>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-slate-500">{t("panel.anamnesis.title")}</p>
            {data.anamnesis.status === "complete" ? (
              <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-800">
                <ClipboardCheck size={15} aria-hidden />
                {data.anamnesis.signedAt
                  ? t("panel.anamnesis.complete", { date: fmtDay(zonedDate(data.anamnesis.signedAt, data.timezone), "medium", locale) })
                  : t("badges.anamnesisComplete")}
              </p>
            ) : data.anamnesis.status === "missing" ? (
              <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-800">
                <ClipboardX size={15} aria-hidden /> {t("panel.anamnesis.missing")}
              </p>
            ) : data.anamnesis.status === "none" ? (
              <p className="text-sm text-slate-600">{t("panel.anamnesis.none")}</p>
            ) : (
              <p className="text-sm text-slate-600">{t("panel.anamnesis.off")}</p>
            )}
            {data.anamnesis.redFlags?.length ? (
              <div className="rounded-lg bg-red-50 p-2.5 ring-1 ring-red-200">
                <p className="flex items-center gap-1.5 text-xs font-bold text-red-800">
                  <TriangleAlert size={14} aria-hidden /> {t("panel.anamnesis.redFlags")}
                </p>
                <ul className="mt-1 flex flex-wrap gap-1">
                  {data.anamnesis.redFlags.map((f) => {
                    const k = `anamnesis.flags.${f}` as const;
                    return (
                      <li key={f}>
                        <Badge tone="red">{t.has(k) ? t(k) : f}</Badge>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {data.canReadClinical && data.anamnesis.status === "complete" ? (
                <Button type="button" size="sm" variant="secondary" disabled={opening} onClick={openSheet}>
                  {opening ? <LoaderCircle size={14} className="animate-spin" aria-hidden /> : <ClipboardList size={14} aria-hidden />}
                  {t("panel.anamnesis.view")}
                </Button>
              ) : null}
              {canManage && data.anamnesis.canInvite ? (
                <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => run(() => sendFormInviteAction(appt.id))}>
                  <Send size={14} aria-hidden /> {t("panel.anamnesis.send")}
                </Button>
              ) : null}
            </div>
          </div>

          {data.status === "completed" ? (
            <div className="space-y-1.5">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                <Repeat size={13} aria-hidden /> {t("panel.recall.title")}
              </p>
              {data.recall && data.recall.status !== "dismissed" ? (
                <p className="text-sm">
                  <span className="font-semibold">
                    {capitalizeFirst(t("panel.recall.due", { date: fmtDay(data.recall.dueDate, "medium", locale) }), locale)}
                  </span>{" "}
                  <Badge tone={data.recall.status === "booked" ? "green" : data.recall.status === "call" ? "amber" : "slate"}>
                    {t(`panel.recall.status.${data.recall.status}`)}
                  </Badge>
                </p>
              ) : (
                <p className="text-sm text-slate-600">{t("panel.recall.none")}</p>
              )}
              {data.recall && !data.recall.confirmed && data.recall.status !== "dismissed" ? (
                <p className="text-xs text-amber-800">{t("panel.recall.unconfirmed")}</p>
              ) : null}
              {data.canSetInterval ? (
                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-40 flex-1">
                    <label htmlFor={pickerId} className="mb-1 block text-xs font-semibold text-slate-700">
                      {t("panel.recall.intervalLabel")}
                    </label>
                    <Select id={pickerId} value={picked} onChange={(e) => setMonths(e.target.value)}>
                      <option value="">{t("panel.recall.none")}</option>
                      {RECALL_INTERVALS.map((m) => (
                        <option key={m} value={String(m)}>
                          {t("panel.recall.months", { count: m })}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      run(
                        () => setRecallIntervalAction(appt.id, picked ? Number(picked) : null),
                        (r) => {
                          if (r.ok) {
                            setMonths(null);
                            reload();
                          }
                        },
                      )
                    }
                  >
                    {t("panel.recall.save")}
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-slate-500">{t("panel.recall.clinicianOnly")}</p>
              )}
              {data.canSetInterval && data.suggestedMonths && !data.recall ? (
                <p className="text-xs text-slate-500">{t("panel.recall.suggested", { count: data.suggestedMonths })}</p>
              ) : null}
            </div>
          ) : null}
        </>
      )}
      {sheet ? <AnamnesisSheet data={sheet} onClose={closeSheet} /> : null}
    </section>
  );
}
