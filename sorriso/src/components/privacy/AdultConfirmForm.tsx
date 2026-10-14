"use client";

import { CalendarCheck, CheckCircle2, LoaderCircle, Send, XCircle } from "lucide-react";
import { useActionState, useId, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { useLocale, useT } from "@/i18n/provider";
import { Button, Input } from "../ui";
import { FormMessage, SubmitButton, type PrivacyFormState } from "./ActionForm";

/** What the confirmation action answers: a message, the sealed code ticket once a code is sent, and whether it's over. */
export type AdultConfirmState = (NonNullable<PrivacyFormState> & { ticket?: string; done?: boolean }) | null;

/**
 * The adult a marketplace booking was made for confirms it, giving Sorriso's Art. 9(2)(a) consent
 * themselves (the exact text from the `consents` namespace, unticked), or cancels it.
 *
 * The page is reached through the appointment link, which whoever booked also has, so the link
 * proves nothing: first a one-time code goes to the adult's own phone or email (`contacts`, masked;
 * never the booker's), then the code, the consent and the decision go together. One action and one
 * state for both steps, so the code's ticket carries over; once a decision succeeds, the outcome
 * replaces the form.
 */
export function AdultConfirmForm({
  token,
  contacts,
  action,
}: {
  token: string;
  contacts: { kind: "phone" | "email"; label: string }[];
  action: (prev: AdultConfirmState, fd: FormData) => Promise<AdultConfirmState>;
}) {
  const t = useT("privacy");
  const locale = useLocale();
  const id = useId();
  const [state, dispatch] = useActionState(action, null);
  const ticket = state?.ticket ?? null;

  if (state?.done) {
    return (
      <p role="status" className="flex items-start gap-2 rounded-xl bg-emerald-50 p-4 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200">
        <CheckCircle2 size={18} className="shrink-0" aria-hidden />
        {state.message}
      </p>
    );
  }
  if (!contacts.length) {
    return <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">{t("confirm.noContact")}</p>;
  }

  return (
    <div className="space-y-5">
      <form action={dispatch} className="space-y-3">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="step" value="code" />
        <fieldset>
          <legend className="mb-1 text-[13px] font-semibold text-slate-700">{t("confirm.codeHeading")}</legend>
          <p className="mb-2 text-xs text-slate-500">{t("confirm.codeIntro")}</p>
          <div className="flex flex-wrap gap-2">
            {contacts.map((c, i) => (
              <label
                key={c.kind}
                className="flex min-h-10 cursor-pointer items-center gap-2 rounded-xl bg-white px-3 text-sm font-semibold ring-1 ring-line-strong has-[input:checked]:bg-brand-50 has-[input:checked]:ring-2 has-[input:checked]:ring-brand-600 has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-brand-600"
              >
                <input type="radio" name="kind" value={c.kind} defaultChecked={i === 0} className="h-4 w-4 accent-brand-700" />
                {c.label}
              </label>
            ))}
          </div>
        </fieldset>
        <SubmitButton
          label={<><Send size={16} aria-hidden /> {ticket ? t("confirm.resend") : t("confirm.sendCode")}</>}
          pending={t("center.signIn.sending")}
          variant={ticket ? "secondary" : "primary"}
          size="sm"
        />
      </form>

      {ticket ? (
        <form action={dispatch} className="space-y-4 border-t border-slate-200 pt-4">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="step" value="decide" />
          <input type="hidden" name="ticket" value={ticket} />
          <div>
            <label htmlFor={`${id}code`} className="mb-1.5 block text-[13px] font-semibold text-slate-700">
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
              className="max-w-48 text-center font-mono text-2xl tracking-[0.4em]"
            />
          </div>
          <div className="space-y-2">
            <p className="text-[13px] font-semibold text-slate-700">{t("booking.platformHeading")}</p>
            <ConsentBox id={id} />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <DecisionButton intent="confirm" label={<><CalendarCheck size={16} aria-hidden /> {t("confirm.confirmButton")}</>} pending={t("verify.checking")} />
            <DecisionButton intent="decline" label={<><XCircle size={16} aria-hidden /> {t("confirm.declineButton")}</>} pending={t("verify.checking")} variant="danger" />
          </div>
          <p className="text-xs text-slate-500">{t("confirm.declineHint")}</p>
        </form>
      ) : null}

      <FormMessage state={state} />
    </div>
  );
}

/** Sorriso's Art. 9(2)(a) consent: unticked, needed to confirm, not to decline. */
function ConsentBox({ id }: { id: string }) {
  const t = useT("privacy");
  const tc = useT("consents");
  return (
    <>
      <label
        htmlFor={`${id}consent`}
        className="flex cursor-pointer items-start gap-3 rounded-xl bg-white p-3 text-sm text-slate-700 ring-1 ring-slate-200 has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-brand-600"
      >
        <input id={`${id}consent`} type="checkbox" name="consent" value="1" aria-describedby={`${id}what`} className="mt-0.5 h-5 w-5 shrink-0 accent-brand-700" />
        <span className="leading-relaxed">
          {tc("platform_booking_art9.label")}
          <span className="ml-2 inline-block rounded-full bg-slate-100 px-2 py-0.5 align-middle text-[11px] font-semibold text-slate-600">{t("confirm.neededToConfirm")}</span>
        </span>
      </label>
      <details className="px-1 text-xs text-slate-600">
        <summary className="cursor-pointer font-semibold text-brand-700">{t("booking.whatThisMeans")}</summary>
        <p id={`${id}what`} className="mt-1 leading-relaxed">
          {tc("platform_booking_art9.description")}
        </p>
      </details>
    </>
  );
}

/** One of the decision form's two submit buttons; the one pressed is posted as `intent`. */
function DecisionButton({ intent, label, pending, variant = "primary" }: { intent: "confirm" | "decline"; label: ReactNode; pending: string; variant?: "primary" | "danger" }) {
  const status = useFormStatus();
  const busy = status.pending && status.data?.get("intent") === intent;
  return (
    <Button
      type="submit"
      name="intent"
      value={intent}
      variant={variant}
      size="sm"
      aria-disabled={status.pending || undefined}
      onClick={(e) => {
        if (status.pending) e.preventDefault();
      }}
      className="aria-disabled:opacity-60"
    >
      {busy ? <LoaderCircle size={16} className="animate-spin" aria-hidden /> : null}
      {busy ? pending : label}
    </Button>
  );
}
