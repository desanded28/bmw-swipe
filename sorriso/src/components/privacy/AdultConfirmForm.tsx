"use client";

import { CalendarCheck, CheckCircle2, XCircle } from "lucide-react";
import { useActionState, useId } from "react";
import { useLocale, useT } from "@/i18n/provider";
import { FormMessage, SubmitButton, type PrivacyAction } from "./ActionForm";

/**
 * The adult a marketplace booking was made for confirms it, giving Sorriso's Art. 9(2)(a) consent
 * themselves (the exact text from the `consents` namespace, unticked), or cancels it. Once either
 * succeeds, the outcome replaces both forms.
 */
export function AdultConfirmForm({ token, confirmAction, declineAction }: { token: string; confirmAction: PrivacyAction; declineAction: PrivacyAction }) {
  const t = useT("privacy");
  const tc = useT("consents");
  const locale = useLocale();
  const id = useId();
  const [confirmed, confirm] = useActionState(confirmAction, null);
  const [declined, decline] = useActionState(declineAction, null);
  const done = confirmed?.ok ? confirmed : declined?.ok ? declined : null;

  if (done) {
    return (
      <p role="status" className="flex items-start gap-2 rounded-xl bg-emerald-50 p-4 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200">
        {confirmed?.ok ? <CheckCircle2 size={18} className="shrink-0" aria-hidden /> : <XCircle size={18} className="shrink-0" aria-hidden />}
        {done.message}
      </p>
    );
  }
  return (
    <div className="space-y-5">
      <form action={confirm} className="space-y-3">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="token" value={token} />
        <p className="text-[13px] font-semibold text-slate-700">{t("booking.platformHeading")}</p>
        <label htmlFor={`${id}consent`} className="flex cursor-pointer items-start gap-3 rounded-xl bg-white p-3 text-sm text-slate-700 ring-1 ring-slate-200 has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-brand-600">
          <input id={`${id}consent`} type="checkbox" name="consent" value="1" aria-required aria-describedby={`${id}what`} className="mt-0.5 h-5 w-5 shrink-0 accent-brand-700" />
          <span className="leading-relaxed">
            {tc("platform_booking_art9.label")}
            <span className="ml-2 inline-block rounded-full bg-slate-100 px-2 py-0.5 align-middle text-[11px] font-semibold text-slate-600">{t("booking.required")}</span>
          </span>
        </label>
        <details className="px-1 text-xs text-slate-600">
          <summary className="cursor-pointer font-semibold text-brand-700">{t("booking.whatThisMeans")}</summary>
          <p id={`${id}what`} className="mt-1 leading-relaxed">
            {tc("platform_booking_art9.description")}
          </p>
        </details>
        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton label={<><CalendarCheck size={16} aria-hidden /> {t("confirm.confirmButton")}</>} pending={t("verify.checking")} />
          <FormMessage state={confirmed} />
        </div>
      </form>
      <form action={decline} className="space-y-2 border-t border-slate-200 pt-4">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="token" value={token} />
        <p className="text-sm text-slate-600">{t("confirm.declineHint")}</p>
        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton label={t("confirm.declineButton")} pending={t("verify.checking")} variant="danger" size="sm" />
          <FormMessage state={declined} />
        </div>
      </form>
    </div>
  );
}
