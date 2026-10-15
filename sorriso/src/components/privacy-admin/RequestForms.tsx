"use client";

import { LoaderCircle, Play, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useId, useRef, useState, useTransition } from "react";
import type { ActionResult } from "@/app/dashboard/actions/_shared";
import { searchPatients } from "@/app/dashboard/actions/patients";
import {
  carryOutPlatformRequestAction,
  completePlatformRequestAction,
  completePrivacyRequestAction,
  extendPlatformRequestAction,
  extendPrivacyRequestAction,
  logPrivacyRequest,
  startPlatformRequestAction,
  startPrivacyRequestAction,
} from "@/app/dashboard/actions/privacy";
import { PRIVACY_REQUEST_DECISIONS, PRIVACY_REQUEST_TYPES } from "@/db/enums";
import { ENDONYM, LOCALES, type Locale } from "@/i18n/config";
import { useT } from "@/i18n/provider";
import { SubmitButton } from "../dashboard/ActionForm";
import { useRunAction } from "../dashboard/useRunAction";
import { Button, Card, cx, Field, Input, Select, Textarea } from "../ui";
import { FormStatus } from "./PatientForms";

/** Channels staff log by hand (the others arrive through Sorriso itself). */
const MANUAL_CHANNELS = ["phone", "email", "in_person", "support"] as const;

type Hit = { id: string; label: string };

/**
 * Log a request received outside Sorriso. The deadline runs from the day it arrived; linking the
 * patient lets the answer be sent automatically, in the requester's language.
 */
export function LogRequestForm({ today, defaultLocale }: { today: string; defaultLocale: Locale }) {
  const t = useT("privacyAdmin");
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [patient, setPatient] = useState<Hit | null>(null);
  const [term, setTerm] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [searching, start] = useTransition();
  const searchId = useId();
  const [state, action] = useActionState<ActionResult | null, FormData>(async (prev, fd) => {
    const res = await logPrivacyRequest(prev, fd);
    if (res.ok) {
      formRef.current?.reset();
      setPatient(null);
      setHits([]);
      setTerm("");
      router.refresh();
    }
    return res;
  }, null);

  const find = () =>
    start(async () => {
      if (term.trim().length < 2) return setHits([]);
      const found = await searchPatients(term);
      setHits(found.map((p) => ({ id: p.id, label: [p.lastName, p.firstName].filter(Boolean).join(" ") })));
    });

  return (
    <Card className="p-5">
      <h2 className="font-bold">{t("requests.log.title")}</h2>
      <p className="mb-4 mt-0.5 text-sm text-slate-500">{t("requests.log.description")}</p>
      <form ref={formRef} action={action} className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label={t("requests.log.type")}>
            <Select name="type" required defaultValue="access">
              {PRIVACY_REQUEST_TYPES.map((v) => (
                <option key={v} value={v}>
                  {t(`requests.types.${v}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("requests.log.channel")}>
            <Select name="channel" required defaultValue="phone">
              {MANUAL_CHANNELS.map((v) => (
                <option key={v} value={v}>
                  {t(`requests.channels.${v}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("requests.log.receivedAt")}>
            <Input name="receivedAt" type="date" required max={today} defaultValue={today} />
          </Field>
        </div>

        <div>
          <label htmlFor={searchId} className="mb-1.5 block text-[13px] font-semibold text-slate-700">
            {t("requests.log.patient")}
          </label>
          <input type="hidden" name="patientId" value={patient?.id ?? ""} />
          {patient ? (
            <div className="flex items-center justify-between rounded-xl bg-brand-50 px-3 py-2 text-sm ring-1 ring-brand-200">
              <span className="font-semibold">{patient.label}</span>
              <Button type="button" variant="ghost" size="sm" onClick={() => setPatient(null)}>
                <X size={14} aria-hidden /> {t("requests.log.unlink")}
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  id={searchId}
                  type="search"
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      find();
                    }
                  }}
                  placeholder={t("requests.log.searchPatient")}
                  autoComplete="off"
                />
                <Button type="button" variant="secondary" onClick={find} disabled={searching} aria-label={t("patients.search")}>
                  {searching ? <LoaderCircle size={16} className="animate-spin" aria-hidden /> : <Search size={16} aria-hidden />}
                </Button>
              </div>
              {hits.length ? (
                <ul className="divide-y divide-slate-100 rounded-xl bg-white ring-1 ring-slate-200">
                  {hits.map((h) => (
                    <li key={h.id} className="flex items-center justify-between px-3 py-1.5 text-sm">
                      <span>{h.label}</span>
                      <Button type="button" size="sm" variant="subtle" onClick={() => setPatient(h)}>
                        {t("requests.log.choose")}
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-500">{t("requests.log.patientHint")}</p>
              )}
            </div>
          )}
        </div>

        {patient ? null : (
          <Field label={t("requests.log.answerContact")} hint={t("requests.log.answerContactHint")} className="max-w-md">
            <Input name="answerContact" autoComplete="off" spellCheck={false} maxLength={254} />
          </Field>
        )}
        <Field label={t("requests.log.details")} hint={t("requests.log.detailsHint")}>
          <Textarea name="details" rows={3} maxLength={4000} />
        </Field>
        <Field label={t("requests.log.language")} className="max-w-xs">
          <Select name="language" defaultValue={defaultLocale}>
            {LOCALES.map((l) => (
              <option key={l} value={l} lang={l}>
                {ENDONYM[l]}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton label={t("requests.log.submit")} />
          <FormStatus state={state} />
        </div>
      </form>
    </Card>
  );
}

type RequestActionsProps = {
  id: string;
  scope: "org" | "platform";
  canStart: boolean;
  /** Extension allowed (open, not yet extended, still within the first month). */
  canExtend: boolean;
  extendMin: string;
  extendMax: string;
  maxLabel: string;
  languageLabel: string;
  open: boolean;
  /**
   * The decisions the answer may carry now (decisionsAllowed): an erasure, restriction or
   * objection is offered "granted" only once it has been carried out.
   */
  decisions: readonly (typeof PRIVACY_REQUEST_DECISIONS)[number][];
  /** Why some decisions are missing, and how to make them available. */
  decisionsHint?: string | null;
};

/** Start, extend (≤ 2 months, with reasons sent to the requester) and complete a request. */
export function RequestActions(p: RequestActionsProps) {
  const t = useT("privacyAdmin");
  const router = useRouter();
  const { run, pending } = useRunAction();
  const platform = p.scope === "platform";
  const [extendState, extendAction] = useActionState<ActionResult | null, FormData>(
    (platform ? extendPlatformRequestAction : extendPrivacyRequestAction).bind(null, p.id),
    null,
  );
  const [completeState, completeAction] = useActionState<ActionResult | null, FormData>(
    (platform ? completePlatformRequestAction : completePrivacyRequestAction).bind(null, p.id),
    null,
  );
  const [decision, setDecision] = useState<(typeof PRIVACY_REQUEST_DECISIONS)[number]>(p.decisions[0] ?? "refused");
  // The offer can shrink while the page is open (another tab carried out or undid the change).
  const chosen = p.decisions.includes(decision) ? decision : (p.decisions[0] ?? "refused");
  useEffect(() => {
    if (extendState?.ok || completeState?.ok) router.refresh();
  }, [extendState, completeState, router]);

  if (!p.open) return null;
  return (
    <div className="space-y-6">
      {p.canStart ? (
        <Button type="button" variant="secondary" disabled={pending} onClick={() => run(() => (platform ? startPlatformRequestAction(p.id) : startPrivacyRequestAction(p.id)))}>
          <Play size={15} aria-hidden /> {t("requests.detail.start")}
        </Button>
      ) : null}

      <Card className="p-5">
        <h2 className="font-bold">{t("requests.detail.complete.title")}</h2>
        <p className="mb-3 mt-0.5 text-sm text-slate-500">{t("requests.detail.complete.body", { language: p.languageLabel })}</p>
        <form action={completeAction} className="space-y-3">
          <fieldset className="flex flex-wrap gap-2">
            <legend className="mb-1.5 block text-[13px] font-semibold text-slate-700">{t("requests.detail.complete.decision")}</legend>
            {PRIVACY_REQUEST_DECISIONS.filter((d) => p.decisions.includes(d)).map((d) => (
              <label
                key={d}
                className={cx(
                  "flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm ring-1",
                  chosen === d ? "bg-brand-50 ring-2 ring-brand-500" : "bg-white ring-slate-200",
                )}
              >
                <input type="radio" name="decision" value={d} checked={chosen === d} onChange={() => setDecision(d)} className="h-4 w-4 accent-brand-700" />
                {t(`requests.decisions.${d}`)}
              </label>
            ))}
          </fieldset>
          {p.decisionsHint ? <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">{p.decisionsHint}</p> : null}
          <Field label={t("requests.detail.complete.reason")} hint={chosen !== "granted" ? t("requests.detail.complete.reasonHint") : undefined}>
            <Textarea name="reason" rows={4} required minLength={3} maxLength={2000} />
          </Field>
          <div className="flex flex-wrap items-center gap-3">
            <SubmitButton label={t("requests.detail.complete.submit")} />
            <FormStatus state={completeState} />
          </div>
        </form>
      </Card>

      {p.canExtend ? (
        <Card className="p-5">
          <h2 className="font-bold">{t("requests.detail.extend.title")}</h2>
          <p className="mb-3 mt-0.5 text-sm text-slate-500">{t("requests.detail.extend.body")}</p>
          <form action={extendAction} className="space-y-3">
            <Field label={t("requests.detail.extend.until")} hint={t("requests.detail.extend.max", { date: p.maxLabel })} className="max-w-xs">
              <Input name="until" type="date" required min={p.extendMin} max={p.extendMax} defaultValue={p.extendMax} />
            </Field>
            <Field label={t("requests.detail.extend.reason")}>
              <Textarea name="reason" rows={2} required minLength={3} maxLength={1000} />
            </Field>
            <div className="flex flex-wrap items-center gap-3">
              <SubmitButton label={t("requests.detail.extend.submit")} variant="secondary" />
              <FormStatus state={extendState} />
            </div>
          </form>
        </Card>
      ) : null}
    </div>
  );
}

/**
 * Sorriso's own inbox: carry out an erasure (erase Sorriso's data), restriction or objection (stop
 * Sorriso's processing) for the linked patient, before answering it.
 */
export function PlatformCarryOut({ id, mode }: { id: string; mode: "stop" | "erase" }) {
  const t = useT("privacyAdmin");
  const { run, pending } = useRunAction();
  return (
    <Card className="p-5">
      <h2 className="font-bold">{t("requests.detail.platformAct.title")}</h2>
      <p className="mb-3 mt-0.5 text-sm text-slate-500">{t(mode === "erase" ? "requests.detail.platformAct.eraseBody" : "requests.detail.platformAct.stopBody")}</p>
      <Button type="button" variant="secondary" disabled={pending} onClick={() => run(() => carryOutPlatformRequestAction(id))}>
        {t(mode === "erase" ? "requests.detail.platformAct.erase" : "requests.detail.platformAct.stop")}
      </Button>
    </Card>
  );
}
