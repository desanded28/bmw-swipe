"use client";

import { CircleCheck, Lock } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useActionState, useEffect, useId, useState } from "react";
import type { ActionResult } from "@/app/dashboard/actions/_shared";
import { openRestrictedRecord, updatePatient, updatePatientNotes } from "@/app/dashboard/actions/patients";
import { ENDONYM, LOCALES, type Locale } from "@/i18n/config";
import { useT } from "@/i18n/provider";
import { SubmitButton } from "../dashboard/ActionForm";
import { Card, Field, Input, Select, Textarea } from "../ui";

/** WP6's re-authentication page; it comes back to `next` afterwards. */
export const STEP_UP_PAGE = "/dashboard/account/security/verify";

/**
 * Inline result of a form action: success in green, error in red, announced to screen readers.
 * When the action needs a fresh second factor, it links to the re-authentication page.
 */
export function FormStatus({ state }: { state: ActionResult | null }) {
  const t = useT("privacyAdmin");
  const path = usePathname();
  if (!state) return <span aria-live="polite" />;
  return state.ok ? (
    <span role="status" className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700">
      <CircleCheck size={16} aria-hidden /> {state.message ?? t("patient.saved")}
    </span>
  ) : (
    <span role="alert" className="text-sm font-medium text-red-600">
      {state.error}
      {state.code === "step_up_required" ? (
        <>
          {" "}
          <Link href={`${STEP_UP_PAGE}?next=${encodeURIComponent(path)}`} className="font-semibold underline">
            {t("errors.stepUpLink")}
          </Link>
        </>
      ) : null}
    </span>
  );
}

export type PatientDetails = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  birthDate: string | null;
  locale: Locale;
  preferredChannel: "sms" | "whatsapp" | "email";
  smsOptIn: boolean;
  emailOptIn: boolean;
  /** The patient opted out of these (cached flag or latest ledger row): turning them on needs a reason. */
  optedOut: { sms: boolean; email: boolean; whatsapp: boolean };
  /** The ledger holds the patient's consent to WhatsApp. */
  whatsappGranted: boolean;
};

/**
 * Identity and contacts. Turning a channel back on that the patient opted out of asks for a
 * reason, which is recorded with the consent row. Choosing WhatsApp without a consent on file
 * asks staff to confirm the patient agreed, and how (recorded as a staff-recorded consent).
 */
export function PatientDetailsForm({ patient, whatsappEnabled }: { patient: PatientDetails; whatsappEnabled: boolean }) {
  const t = useT("privacyAdmin");
  const tc = useT("common");
  const [state, action] = useActionState<ActionResult | null, FormData>(updatePatient.bind(null, patient.id), null);
  const [sms, setSms] = useState(!patient.optedOut.sms);
  const [email, setEmail] = useState(!patient.optedOut.email);
  const [channel, setChannel] = useState(patient.preferredChannel);
  const whatsappConsent = whatsappEnabled && channel === "whatsapp" && !patient.whatsappGranted;
  const reEnabling = (sms && patient.optedOut.sms) || (email && patient.optedOut.email) || (whatsappConsent && patient.optedOut.whatsapp);
  const needsReason = reEnabling || whatsappConsent;
  const reasonId = useId();

  return (
    <form action={action} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t("patient.firstName")}>
          <Input name="firstName" defaultValue={patient.firstName} required autoComplete="off" />
        </Field>
        <Field label={t("patient.lastName")}>
          <Input name="lastName" defaultValue={patient.lastName} required autoComplete="off" />
        </Field>
      </div>
      <Field label={t("patient.mobile")}>
        <Input name="phone" type="tel" defaultValue={patient.phone ?? ""} autoComplete="off" />
      </Field>
      <Field label={t("patient.email")}>
        <Input name="email" type="email" defaultValue={patient.email ?? ""} autoComplete="off" />
      </Field>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t("patient.birthDate")}>
          <Input name="birthDate" type="date" defaultValue={patient.birthDate ?? ""} />
        </Field>
        <Field label={t("patient.language")}>
          <Select name="locale" defaultValue={patient.locale}>
            {LOCALES.map((l) => (
              <option key={l} value={l} lang={l}>
                {ENDONYM[l]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label={t("patient.remindersBy")} hint={channel === "whatsapp" ? t("patient.whatsappHint") : undefined}>
        <Select name="preferredChannel" value={channel} onChange={(e) => setChannel(e.target.value as PatientDetails["preferredChannel"])}>
          <option value="sms">{tc("channels.sms")}</option>
          {whatsappEnabled || patient.preferredChannel === "whatsapp" ? <option value="whatsapp">{tc("channels.whatsapp")}</option> : null}
          <option value="email">{tc("channels.email")}</option>
        </Select>
      </Field>
      <fieldset className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
        <legend className="sr-only">{t("patient.remindersBy")}</legend>
        <input type="hidden" name="channels" value="1" />
        <label className="flex items-center gap-2">
          <input type="checkbox" name="smsOptIn" checked={sms} onChange={(e) => setSms(e.target.checked)} className="h-4 w-4 accent-brand-700" />
          {t("patient.smsOk")}
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="emailOptIn" checked={email} onChange={(e) => setEmail(e.target.checked)} className="h-4 w-4 accent-brand-700" />
          {t("patient.emailOk")}
        </label>
      </fieldset>
      {needsReason ? (
        <div className="space-y-2 rounded-xl bg-amber-50 p-3 ring-1 ring-amber-200">
          {whatsappConsent ? (
            <label className="flex items-start gap-2 text-sm text-amber-900">
              <input type="checkbox" name="whatsappAgreed" required className="mt-0.5 h-4 w-4 shrink-0 accent-brand-700" />
              {t("patient.whatsappAgreed")}
            </label>
          ) : null}
          <label htmlFor={reasonId} className="block text-[13px] font-semibold text-amber-900">
            {reEnabling ? t("patient.optInReason") : t("patient.whatsappHow")}
          </label>
          <Textarea id={reasonId} name="optInReason" rows={2} required minLength={3} maxLength={300} />
          <p className="text-xs text-amber-900">{reEnabling ? t("patient.optInReasonHint") : t("patient.whatsappHowHint")}</p>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-3 pt-2">
        <SubmitButton label={tc("actions.save")} />
        <FormStatus state={state} />
      </div>
    </form>
  );
}

/** The practice's notes (clinicians and managers). */
export function PatientNotesForm({ patientId, notes }: { patientId: string; notes: string | null }) {
  const t = useT("privacyAdmin");
  const [state, formAction] = useActionState<ActionResult | null, FormData>(updatePatientNotes.bind(null, patientId), null);
  const id = useId();
  return (
    <form action={formAction} className="space-y-2">
      <label htmlFor={id} className="block text-[13px] font-semibold text-slate-700">
        {t("patient.notes")}
      </label>
      <Textarea id={id} name="notes" rows={4} maxLength={4000} defaultValue={notes ?? ""} aria-describedby={`${id}-hint`} />
      <p id={`${id}-hint`} className="text-xs text-slate-500">
        {t("patient.notesHint")}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton label={t("patient.saveNotes")} variant="secondary" />
        <FormStatus state={state} />
      </div>
    </form>
  );
}

/** Asks why a restricted record is being opened; the reason is audited, then the page reloads. */
export function RestrictedReasonForm({ patientId }: { patientId: string }) {
  const t = useT("privacyAdmin");
  const router = useRouter();
  const [state, action] = useActionState<ActionResult | null, FormData>(openRestrictedRecord.bind(null, patientId), null);
  const id = useId();
  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);
  return (
    <Card className="mx-auto max-w-lg p-6">
      <div className="mb-3 flex items-center gap-2 text-amber-800">
        <Lock size={18} aria-hidden />
        <h1 className="text-lg font-bold">{t("patient.reasonGate.title")}</h1>
      </div>
      <p className="mb-4 text-sm text-slate-600">{t("patient.reasonGate.body")}</p>
      <form action={action} className="space-y-3">
        <label htmlFor={id} className="block text-[13px] font-semibold text-slate-700">
          {t("patient.reasonGate.reason")}
        </label>
        <Textarea id={id} name="reason" rows={3} required minLength={3} maxLength={500} placeholder={t("patient.reasonGate.placeholder")} />
        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton label={t("patient.reasonGate.submit")} />
          <FormStatus state={state?.ok ? null : state} />
        </div>
      </form>
    </Card>
  );
}
