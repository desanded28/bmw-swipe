"use client";

import { Download, Eraser, FileCheck2, LoaderCircle, Lock, LockOpen } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useId, useState, type ReactNode } from "react";
import type { ActionResult } from "@/app/dashboard/actions/_shared";
import { erasePatientAction, recordConsentAction, restrictPatientAction, unrestrictPatientAction } from "@/app/dashboard/actions/patients";
import { useT } from "@/i18n/provider";
import { SubmitButton } from "../dashboard/ActionForm";
import { Button, cx, Field, Input, Select, Textarea } from "../ui";
import { FormStatus, STEP_UP_PAGE } from "./PatientForms";

export type PrivacyActionKind = "export" | "restrict" | "unrestrict" | "erase" | "consents";

type Props = {
  patientId: string;
  /** The full name as stored, which must be typed to confirm an erasure. */
  fullName: string;
  restricted: boolean;
  erased: boolean;
  allowed: { export: boolean; erase: boolean; restrict: boolean; consents: boolean };
  /** Purposes the practice may record, with their titles in the staff language. */
  purposes: { id: string; title: string }[];
  /** Open this panel first (one-click actions from a privacy request). */
  initial?: PrivacyActionKind | null;
  /** Today in the practice's time zone (YYYY-MM-DD), for date limits. */
  today: string;
  /** The open privacy request an erasure would answer (opened from it), with its labels. */
  answering?: AnsweredRequest | null;
};

export type AnsweredRequest = { id: string; type: string; received: string; language: string };

/**
 * The data protection actions on a patient record: download (with step-up), restrict or lift the
 * restriction, erase (pseudonymise or keep-and-restrict, with the name typed to confirm), and
 * record a consent or withdrawal on the patient's behalf. Each opens an inline panel.
 */
export function PatientPrivacyActions(props: Props) {
  const t = useT("privacyAdmin");
  const [open, setOpen] = useState<PrivacyActionKind | null>(props.initial ?? null);
  const toggle = (k: PrivacyActionKind) => setOpen((cur) => (cur === k ? null : k));
  const { allowed, restricted, erased } = props;

  const buttons: { kind: PrivacyActionKind; label: string; icon: ReactNode; show: boolean; danger?: boolean }[] = [
    { kind: "export", label: t("privacy.export"), icon: <Download size={15} aria-hidden />, show: allowed.export },
    { kind: "consents", label: t("privacy.recordConsent"), icon: <FileCheck2 size={15} aria-hidden />, show: allowed.consents && !erased },
    { kind: "restrict", label: t("privacy.restrict"), icon: <Lock size={15} aria-hidden />, show: allowed.restrict && !restricted && !erased },
    { kind: "unrestrict", label: t("privacy.unrestrict"), icon: <LockOpen size={15} aria-hidden />, show: allowed.restrict && restricted && !erased },
    { kind: "erase", label: t("privacy.erase"), icon: <Eraser size={15} aria-hidden />, show: allowed.erase && !erased, danger: true },
  ];
  const visible = buttons.filter((b) => b.show);
  if (!visible.length) return null;

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {visible.map((b) => (
          <Button
            key={b.kind}
            type="button"
            size="sm"
            variant={b.danger ? "danger" : open === b.kind ? "subtle" : "secondary"}
            aria-expanded={open === b.kind}
            aria-controls={`privacy-panel-${b.kind}`}
            onClick={() => toggle(b.kind)}
          >
            {b.icon} {b.label}
          </Button>
        ))}
      </div>
      {open ? (
        <div id={`privacy-panel-${open}`} className="mt-3 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
          {open === "export" ? <ExportPanel patientId={props.patientId} /> : null}
          {open === "restrict" ? <RestrictPanel patientId={props.patientId} today={props.today} /> : null}
          {open === "unrestrict" ? <UnrestrictPanel patientId={props.patientId} /> : null}
          {open === "erase" ? <ErasePanel patientId={props.patientId} fullName={props.fullName} today={props.today} answering={props.answering ?? null} /> : null}
          {open === "consents" ? <ConsentPanel patientId={props.patientId} purposes={props.purposes} /> : null}
        </div>
      ) : null}
    </div>
  );
}

/** After a successful action the record changes (restricted, erased): reload the server data. */
function useRefreshOnSuccess(state: ActionResult | null) {
  const router = useRouter();
  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);
}

function ExportPanel({ patientId }: { patientId: string }) {
  const t = useT("privacyAdmin");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verify, setVerify] = useState<string | null>(null);
  const url = `/dashboard/patients/${patientId}/export`;

  const download = async () => {
    setBusy(true);
    setError(null);
    setVerify(null);
    try {
      const res = await fetch(url, { headers: { accept: "application/zip" } });
      const type = res.headers.get("content-type") ?? "";
      if (res.status === 403) {
        const body = (await res.json().catch(() => null)) as { error?: { code?: string; verify?: string | null } } | null;
        const code = body?.error?.code;
        setError(code === "step_up_required" ? t("errors.stepUp") : code === "restricted_reason_required" ? t("patient.errors.reason_required") : t("errors.forbidden"));
        // Back to this record with the export panel open, not to the download URL the server names:
        // after the confirmation the browser would fetch the file and stay on the confirmation page.
        if (code === "step_up_required") setVerify(`${STEP_UP_PAGE}?next=${encodeURIComponent(`${window.location.pathname}?action=export`)}`);
        return;
      }
      if (!res.ok || !type.includes("zip")) {
        // A redirect to a sign-in or step-up page: let the browser follow it.
        window.location.assign(url);
        return;
      }
      const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? "patient-export.zip";
      const href = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = href;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 10_000);
    } catch {
      setError(t("errors.generic"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">{t("privacy.exportHint")}</p>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={download} disabled={busy}>
          {busy ? <LoaderCircle size={16} className="animate-spin" aria-hidden /> : <Download size={16} aria-hidden />}
          {t("privacy.export")}
        </Button>
        {error ? (
          <span role="alert" className="text-sm font-medium text-red-600">
            {error}{" "}
            {verify ? (
              <Link href={verify} className="font-semibold underline">
                {t("errors.stepUpLink")}
              </Link>
            ) : null}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function RestrictPanel({ patientId, today }: { patientId: string; today: string }) {
  const t = useT("privacyAdmin");
  const [state, action] = useActionState<ActionResult | null, FormData>(restrictPatientAction.bind(null, patientId), null);
  useRefreshOnSuccess(state);
  return (
    <form action={action} className="space-y-3">
      <h3 className="font-bold">{t("privacy.restrictTitle")}</h3>
      <p className="text-sm text-slate-600">{t("privacy.restrictHint")}</p>
      <Field label={t("privacy.restrictReason")}>
        <Textarea name="reason" rows={2} required minLength={3} maxLength={500} placeholder={t("privacy.restrictReasonPlaceholder")} />
      </Field>
      <Field label={t("privacy.retainUntil")}>
        <Input name="retainUntil" type="date" min={today} />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton label={t("privacy.restrict")} />
        <FormStatus state={state} />
      </div>
    </form>
  );
}

function UnrestrictPanel({ patientId }: { patientId: string }) {
  const t = useT("privacyAdmin");
  const [state, action] = useActionState<ActionResult | null, FormData>(unrestrictPatientAction.bind(null, patientId), null);
  useRefreshOnSuccess(state);
  const needsConfirm = state?.ok === false && state.code === "notice_required";
  return (
    <form action={action} className="space-y-3">
      <h3 className="font-bold">{t("privacy.unrestrictTitle")}</h3>
      <p className="text-sm text-slate-600">{t("privacy.unrestrictHint")}</p>
      <Field label={t("privacy.unrestrictReason")}>
        <Textarea name="reason" rows={2} required minLength={3} maxLength={500} placeholder={t("privacy.unrestrictReasonPlaceholder")} />
      </Field>
      {needsConfirm ? (
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="informedOtherwise" required className="mt-0.5 h-4 w-4 accent-brand-700" />
          {t("privacy.informedOtherwise")}
        </label>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton label={t("privacy.unrestrict")} />
        <FormStatus state={state} />
      </div>
    </form>
  );
}

function ErasePanel({ patientId, fullName, today, answering }: { patientId: string; fullName: string; today: string; answering: AnsweredRequest | null }) {
  const t = useT("privacyAdmin");
  const [state, action] = useActionState<ActionResult | null, FormData>(erasePatientAction.bind(null, patientId), null);
  useRefreshOnSuccess(state);
  const [mode, setMode] = useState<"anonymise" | "restrict">("anonymise");
  const [confirm, setConfirm] = useState("");
  const matches = confirm.trim().replace(/\s+/g, " ").toLowerCase() === fullName.trim().replace(/\s+/g, " ").toLowerCase();
  const groupId = useId();
  const confirmId = useId();
  const answerId = useId();

  return (
    <form action={action} className="space-y-3">
      <h3 className="font-bold text-red-800">{t("privacy.eraseTitle")}</h3>
      <fieldset aria-describedby={groupId} className="space-y-2">
        <legend id={groupId} className="text-sm text-slate-600">
          {t("privacy.eraseIntro")}
        </legend>
        {(
          [
            ["anonymise", t("privacy.modeAnonymise"), t("privacy.modeAnonymiseHint")],
            ["restrict", t("privacy.modeRestrict"), t("privacy.modeRestrictHint")],
          ] as const
        ).map(([value, label, hint]) => (
          <label
            key={value}
            className={cx("flex cursor-pointer items-start gap-2 rounded-xl bg-white p-3 text-sm ring-1", mode === value ? "ring-2 ring-brand-500" : "ring-slate-200")}
          >
            <input type="radio" name="mode" value={value} checked={mode === value} onChange={() => setMode(value)} className="mt-0.5 h-4 w-4 accent-brand-700" />
            <span>
              <span className="block font-semibold">{label}</span>
              <span className="block text-slate-600">{hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <Field label={t("privacy.eraseReason")}>
        <Textarea name="reason" rows={2} required minLength={3} maxLength={500} placeholder={t("privacy.eraseReasonPlaceholder")} />
      </Field>
      {mode === "restrict" ? (
        <Field label={t("privacy.retainUntil")}>
          <Input name="retainUntil" type="date" required min={today} />
        </Field>
      ) : null}
      {answering ? (
        <div className="space-y-2 rounded-xl bg-white p-3 ring-1 ring-slate-200">
          <input type="hidden" name="requestId" value={answering.id} />
          <p className="text-sm text-slate-700">{t("privacy.answerFor", { type: answering.type, date: answering.received })}</p>
          <label htmlFor={answerId} className="block text-[13px] font-semibold text-slate-700">
            {t("privacy.answerLabel", { language: answering.language })}
          </label>
          <Textarea id={answerId} name="answer" rows={3} required minLength={3} maxLength={2000} aria-describedby={`${answerId}-hint`} />
          <p id={`${answerId}-hint`} className="text-xs text-slate-500">
            {t("privacy.answerHint")}
          </p>
        </div>
      ) : null}
      <div>
        <label htmlFor={confirmId} className="mb-1.5 block text-[13px] font-semibold text-slate-700">
          {t("privacy.confirmLabel", { name: fullName })}
        </label>
        <Input id={confirmId} name="confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" spellCheck={false} required />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="danger" disabled={!matches} aria-disabled={!matches}>
          <Eraser size={16} aria-hidden /> {t("privacy.eraseButton")}
        </Button>
        <FormStatus state={state} />
      </div>
    </form>
  );
}

function ConsentPanel({ patientId, purposes }: { patientId: string; purposes: { id: string; title: string }[] }) {
  const t = useT("privacyAdmin");
  const [state, action] = useActionState<ActionResult | null, FormData>(recordConsentAction.bind(null, patientId), null);
  useRefreshOnSuccess(state);
  return (
    <form action={action} className="space-y-3">
      <h3 className="font-bold">{t("privacy.recordTitle")}</h3>
      <p className="text-sm text-slate-600">{t("privacy.recordHint")}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t("privacy.purpose")}>
          <Select name="purpose" required>
            {purposes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("privacy.decision")}>
          <Select name="decision" defaultValue="withdraw">
            <option value="grant">{t("privacy.grant")}</option>
            <option value="withdraw">{t("privacy.withdraw")}</option>
          </Select>
        </Field>
        <Field label={t("privacy.givenBy")}>
          <Select name="givenBy" defaultValue="self">
            <option value="self">{t("privacy.givenBySelf")}</option>
            <option value="parent">{t("privacy.givenByParent")}</option>
            <option value="legal_guardian">{t("privacy.givenByGuardian")}</option>
          </Select>
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton label={t("privacy.recordButton")} />
        <FormStatus state={state} />
      </div>
    </form>
  );
}
