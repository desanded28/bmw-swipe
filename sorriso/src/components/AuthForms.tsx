"use client";

import { Eye, EyeOff, LoaderCircle, MailCheck } from "lucide-react";
import Link from "next/link";
import { useActionState, useId, useState, type ComponentProps, type ReactNode } from "react";
import {
  acceptInvite,
  cancelMfaLogin,
  login,
  requestPasswordReset,
  resetPassword,
  signup,
  verifyEmail,
  verifyMfaLogin,
  type FormState,
} from "@/app/auth-actions";
import { lhref } from "@/i18n/href";
import { useLocale, useT } from "@/i18n/provider";
import { rich } from "@/i18n/rich";
import { Button, Field, Input } from "./ui";

/** Public account forms (login, second step, signup, password reset, email confirmation, invitations). */

function FormError({ state }: { state: FormState }) {
  if (!state?.error) return null;
  return (
    <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700 ring-1 ring-red-100">
      {state.error}
    </p>
  );
}

function Submit({ pending, children }: { pending: boolean; children: ReactNode }) {
  return (
    <Button type="submit" className="w-full" size="lg" disabled={pending} aria-busy={pending}>
      {pending ? <LoaderCircle size={18} className="animate-spin" aria-hidden /> : null} {children}
    </Button>
  );
}

function LocaleInput() {
  const locale = useLocale();
  return <input type="hidden" name="locale" value={locale} />;
}

/** A password input with a show/hide toggle. */
function PasswordInput(props: ComponentProps<"input">) {
  const t = useT("auth");
  const [shown, setShown] = useState(false);
  return (
    <span className="relative block">
      <Input {...props} type={shown ? "text" : "password"} className="pr-11" />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        aria-label={t(shown ? "fields.hide" : "fields.show")}
        aria-pressed={shown}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-slate-500 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-brand-500"
      >
        {shown ? <EyeOff size={17} aria-hidden /> : <Eye size={17} aria-hidden />}
      </button>
    </span>
  );
}

function Sent({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div role="status" className="rounded-2xl bg-brand-50 p-5 text-brand-900">
      <p className="flex items-center gap-2 font-bold">
        <MailCheck size={19} aria-hidden /> {title}
      </p>
      <div className="mt-2 space-y-2 text-sm">{children}</div>
    </div>
  );
}

const invalid = (state: FormState, name: string) => (state?.fieldErrors?.[name] ? true : undefined);

// ---------------------------------------------------------------- login

export function LoginForm({ demo, next }: { demo: boolean; next?: string }) {
  const t = useT("auth");
  const locale = useLocale();
  const [state, action, pending] = useActionState<FormState, FormData>(login, null);
  return (
    <form action={action} className="space-y-4" noValidate>
      <LocaleInput />
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <Field label={t("fields.email")}>
        <Input
          name="email"
          type="email"
          autoComplete="username"
          required
          defaultValue={state?.values?.email ?? (demo ? "demo@sorriso.dev" : "")}
        />
      </Field>
      <Field label={t("fields.password")}>
        <PasswordInput name="password" autoComplete="current-password" required defaultValue={demo ? "demo1234" : ""} />
      </Field>
      <div className="text-right text-sm">
        <Link href={lhref(locale, "/reset-password")} className="font-semibold text-brand-700 hover:underline">
          {t("login.forgot")}
        </Link>
      </div>
      <FormError state={state} />
      <Submit pending={pending}>{t("login.submit")}</Submit>
    </form>
  );
}

export function MfaForm({ next }: { next?: string }) {
  const t = useT("auth");
  const [state, action, pending] = useActionState<FormState, FormData>(verifyMfaLogin, null);
  const hintId = useId();
  return (
    <div className="space-y-4">
      <form action={action} className="space-y-4">
        <LocaleInput />
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <Field label={t("mfa.code")} hint={<span id={hintId}>{t("mfa.codeHint")}</span>}>
          <Input
            name="code"
            autoComplete="one-time-code"
            autoCapitalize="characters"
            spellCheck={false}
            required
            autoFocus
            maxLength={16}
            aria-describedby={hintId}
            className="text-center font-mono text-lg tracking-[0.3em]"
          />
        </Field>
        <FormError state={state} />
        <Submit pending={pending}>{t("mfa.submit")}</Submit>
      </form>
      <form action={cancelMfaLogin}>
        <LocaleInput />
        <Button type="submit" variant="ghost" className="w-full">
          {t("mfa.cancel")}
        </Button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------- signup

export function SignupForm() {
  const t = useT("auth");
  const locale = useLocale();
  const [state, action, pending] = useActionState<FormState, FormData>(signup, null);
  const v = state?.values ?? {};
  const e = state?.fieldErrors ?? {};
  if (state?.done) {
    return (
      <Sent title={t("signup.sentTitle")}>
        <p>{t("signup.sentBody", { email: state.email ?? "" })}</p>
        <p>{t("signup.sentNoEmail")}</p>
      </Sent>
    );
  }
  // Opens in a new tab, so the half-filled form isn't lost.
  const legal = (path: string) =>
    function LegalLink(chunk: ReactNode) {
      return (
        <a href={lhref(locale, path)} target="_blank" rel="noopener" className="font-semibold text-brand-700 underline">
          {chunk}
        </a>
      );
    };
  return (
    <form action={action} className="space-y-4" noValidate>
      <LocaleInput />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("fields.name")} error={e.name}>
          <Input name="name" required autoComplete="name" defaultValue={v.name} aria-invalid={invalid(state, "name")} />
        </Field>
        <Field label={t("fields.email")} error={e.email}>
          <Input name="email" type="email" required autoComplete="email" defaultValue={v.email} aria-invalid={invalid(state, "email")} />
        </Field>
      </div>
      <Field label={t("fields.password")} hint={t("fields.passwordHint")} error={e.password}>
        <PasswordInput name="password" required minLength={12} maxLength={128} autoComplete="new-password" aria-invalid={invalid(state, "password")} />
      </Field>
      <hr className="border-slate-100" />
      <Field label={t("signup.practiceName")} error={e.practiceName}>
        <Input name="practiceName" required placeholder={t("signup.practicePlaceholder")} defaultValue={v.practiceName} aria-invalid={invalid(state, "practiceName")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-[1.5fr_1fr]">
        <Field label={t("signup.address")} error={e.address}>
          <Input name="address" required autoComplete="street-address" placeholder={t("signup.addressPlaceholder")} defaultValue={v.address} aria-invalid={invalid(state, "address")} />
        </Field>
        <Field label={t("signup.city")} error={e.city}>
          <Input name="city" required autoComplete="address-level2" placeholder={t("signup.cityPlaceholder")} defaultValue={v.city} aria-invalid={invalid(state, "city")} />
        </Field>
      </div>
      <Field label={t("signup.phone")} hint={t("signup.phoneHint")} error={e.phone}>
        <Input name="phone" type="tel" autoComplete="tel" placeholder={t("signup.phonePlaceholder")} defaultValue={v.phone} />
      </Field>
      <label className="flex items-start gap-2.5 text-sm text-slate-700">
        <input type="checkbox" name="isDentist" defaultChecked className="mt-0.5 h-4 w-4 shrink-0 accent-brand-700" />
        <span>{t("signup.isDentist")}</span>
      </label>
      <fieldset className="space-y-3 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
        <label className="flex items-start gap-2.5 text-sm text-slate-700">
          <input type="checkbox" name="acceptTerms" required className="mt-0.5 h-4 w-4 shrink-0 accent-brand-700" aria-invalid={invalid(state, "acceptTerms")} />
          <span>{rich(t("signup.acceptTerms"), { terms: legal("/legal/terms") })}</span>
        </label>
        <label className="flex items-start gap-2.5 text-sm text-slate-700">
          <input type="checkbox" name="acceptDpa" required className="mt-0.5 h-4 w-4 shrink-0 accent-brand-700" aria-invalid={invalid(state, "acceptDpa")} />
          <span>{rich(t("signup.acceptDpa"), { dpa: legal("/legal/dpa"), subprocessors: legal("/legal/subprocessors") })}</span>
        </label>
        {e.acceptTerms || e.acceptDpa ? <p className="text-xs font-medium text-red-600">{e.acceptTerms ?? e.acceptDpa}</p> : null}
      </fieldset>
      <FormError state={state} />
      <Submit pending={pending}>{t("signup.submit")}</Submit>
    </form>
  );
}

// ---------------------------------------------------------------- password reset

export function ResetRequestForm() {
  const t = useT("auth");
  const locale = useLocale();
  const [state, action, pending] = useActionState<FormState, FormData>(requestPasswordReset, null);
  if (state?.done) {
    return (
      <div className="space-y-4">
        <Sent title={t("reset.sentTitle")}>
          <p>{t("reset.sentBody", { email: state.email ?? "" })}</p>
        </Sent>
        <Link href={lhref(locale, "/login")} className="inline-block text-sm font-semibold text-brand-700 hover:underline">
          {t("reset.back")}
        </Link>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-4" noValidate>
      <LocaleInput />
      <Field label={t("fields.email")} error={state?.fieldErrors?.email}>
        <Input name="email" type="email" autoComplete="username" required defaultValue={state?.values?.email} aria-invalid={invalid(state, "email")} />
      </Field>
      <FormError state={state} />
      <Submit pending={pending}>{t("reset.submit")}</Submit>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const t = useT("auth");
  const [state, action, pending] = useActionState<FormState, FormData>(resetPassword, null);
  const e = state?.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      <LocaleInput />
      <input type="hidden" name="token" value={token} />
      <Field label={t("fields.newPassword")} hint={t("fields.passwordHint")} error={e.password}>
        <PasswordInput name="password" required minLength={12} maxLength={128} autoComplete="new-password" aria-invalid={invalid(state, "password")} />
      </Field>
      <Field label={t("fields.confirmPassword")} error={e.confirm}>
        <PasswordInput name="confirm" required autoComplete="new-password" aria-invalid={invalid(state, "confirm")} />
      </Field>
      <FormError state={state} />
      <Submit pending={pending}>{t("reset.submitNew")}</Submit>
    </form>
  );
}

// ---------------------------------------------------------------- email confirmation

export function VerifyEmailForm({ token }: { token: string }) {
  const t = useT("auth");
  const [state, action, pending] = useActionState<FormState, FormData>(verifyEmail, null);
  return (
    <form action={action} className="space-y-4">
      <LocaleInput />
      <input type="hidden" name="token" value={token} />
      <FormError state={state} />
      <Submit pending={pending}>{t("verify.submit")}</Submit>
    </form>
  );
}

// ---------------------------------------------------------------- invitations

/**
 * Join a practice. `newAccount`: ask for a name and password; otherwise the signed-in account
 * (same email as the invitation) joins. The staff instructions are rendered by the page above the
 * form; `acceptLabel` is their acceptance sentence (legalPractice namespace).
 */
export function InviteForm({ token, newAccount, acceptLabel }: { token: string; newAccount: boolean; acceptLabel: string }) {
  const t = useT("auth");
  const [state, action, pending] = useActionState<FormState, FormData>(acceptInvite, null);
  const e = state?.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      <LocaleInput />
      <input type="hidden" name="token" value={token} />
      {newAccount ? (
        <>
          <Field label={t("fields.name")} error={e.name}>
            <Input name="name" required autoComplete="name" defaultValue={state?.values?.name} aria-invalid={invalid(state, "name")} />
          </Field>
          <Field label={t("fields.password")} hint={t("fields.passwordHint")} error={e.password}>
            <PasswordInput name="password" required minLength={12} maxLength={128} autoComplete="new-password" aria-invalid={invalid(state, "password")} />
          </Field>
        </>
      ) : null}
      <label className="flex items-start gap-2.5 rounded-xl bg-slate-50 p-4 text-sm font-medium text-slate-800 ring-1 ring-slate-200">
        <input type="checkbox" name="acceptInstructions" required className="mt-0.5 h-4 w-4 shrink-0 accent-brand-700" aria-invalid={invalid(state, "acceptInstructions")} />
        <span>{acceptLabel}</span>
      </label>
      {e.acceptInstructions ? <p className="text-xs font-medium text-red-600">{e.acceptInstructions}</p> : null}
      <FormError state={state} />
      <Submit pending={pending}>{t("invite.submit")}</Submit>
    </form>
  );
}
