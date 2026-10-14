"use client";

import { KeyRound, Send } from "lucide-react";
import { useActionState, useId } from "react";
import { useLocale, useT } from "@/i18n/provider";
import { Input, Select } from "../ui";
import { DIAL_CODES } from "./dial";
import { FormMessage, SubmitButton, type PrivacyAction } from "./ActionForm";

/**
 * Step 1 of the privacy-center sign-in: one field for a mobile number or an email address. The
 * answer is the same whether or not the contact is known (the action redirects to the code form
 * either way); only a malformed contact or too many codes come back as an error here.
 */
export function SignInForm({ action }: { action: PrivacyAction }) {
  const t = useT("privacy");
  const locale = useLocale();
  const id = useId();
  const [state, formAction] = useActionState(action, null);
  const error = state && !state.ok ? state.message : null;
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="locale" value={locale} />
      <label htmlFor={`${id}contact`} className="block text-[13px] font-semibold text-slate-700">
        {t("center.signIn.contactLabel")}
      </label>
      <div className="flex gap-2">
        <Select name="dial" defaultValue="39" aria-label={t("center.signIn.countryCode")} className="w-24 shrink-0">
          {DIAL_CODES.map((code) => (
            <option key={code} value={code}>
              {t("center.signIn.dialOption", { code })}
            </option>
          ))}
        </Select>
        <Input
          id={`${id}contact`}
          name="contact"
          required
          autoComplete="username"
          spellCheck={false}
          autoCapitalize="none"
          aria-describedby={`${id}hint${error ? ` ${id}error` : ""}`}
          aria-invalid={error ? true : undefined}
        />
      </div>
      <p id={`${id}hint`} className="text-xs text-slate-500">
        {t("center.signIn.contactHint")}
      </p>
      <SubmitButton label={<><Send size={16} aria-hidden /> {t("center.signIn.submit")}</>} pending={t("center.signIn.sending")} className="w-full sm:w-auto" />
      <FormMessage state={state} id={`${id}error`} />
      <p className="rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600 ring-1 ring-slate-200/70">{t("center.signIn.neutral")}</p>
    </form>
  );
}

/** Step 2: the 6-digit code. The sealed ticket travels in a hidden field (the contact is never in the page). */
export function CodeForm({ action, ticket }: { action: PrivacyAction; ticket: string }) {
  const t = useT("privacy");
  const locale = useLocale();
  const id = useId();
  const [state, formAction] = useActionState(action, null);
  const error = state && !state.ok ? state.message : null;
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="ticket" value={ticket} />
      <label htmlFor={`${id}code`} className="block text-[13px] font-semibold text-slate-700">
        {t("verify.codeLabel")}
      </label>
      <Input
        id={`${id}code`}
        name="code"
        required
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9 ]{6,7}"
        maxLength={7}
        // The code field is the only thing on the page: start there.
        autoFocus
        className="max-w-48 text-center font-mono text-2xl tracking-[0.4em]"
        aria-describedby={error ? `${id}error` : undefined}
        aria-invalid={error ? true : undefined}
      />
      <SubmitButton label={<><KeyRound size={16} aria-hidden /> {t("verify.submit")}</>} pending={t("verify.checking")} />
      <FormMessage state={state} id={`${id}error`} />
    </form>
  );
}
