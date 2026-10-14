"use client";

import { ArrowLeft, CircleCheck, LoaderCircle, LockKeyhole, Send } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { sendSignatureCode, submitAnamnesisForm } from "@/app/[locale]/(site)/a/[token]/forms/actions";
import type { FormField, FormSchema } from "@/db/schema";
import { lhref } from "@/i18n/href";
import { useLocale, useT } from "@/i18n/provider";
import { Button, Card, Field, Input, Textarea, buttonClass, cx } from "../ui";

type Answers = Record<string, string>;
type Step = "form" | "sign" | "done";

/**
 * The patient's medical-history form (/{locale}/a/<token>/forms/anamnesis), rendered from the
 * form schema in the page's language. Two steps: the questions, then a simple electronic signature
 * (the signer's name and a 6-digit code sent to the contact on file). Errors are announced and
 * focus moves to the first one; answers stay in the browser until signed (nothing is stored
 * before that).
 */
export function AnamnesisForm({
  token,
  schema,
  clinic,
  contactHint,
}: {
  token: string;
  schema: FormSchema;
  clinic: string;
  /** Where the code will go, masked ("+39•••4567"); null when there is no contact. */
  contactHint: string | null;
}) {
  const t = useT("care");
  const tc = useT("common");
  const locale = useLocale();
  const uid = useId();
  const [step, setStep] = useState<Step>("form");
  const [answers, setAnswers] = useState<Answers>({});
  const [errors, setErrors] = useState<Record<string, "required" | "invalid">>({});
  const [signer, setSigner] = useState("");
  const [challenge, setChallenge] = useState<{ id: string; masked: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [alert, setAlert] = useState<{ text: string; n: number } | null>(null);
  const [focus, setFocus] = useState<{ id: string; n: number } | null>(null);

  useEffect(() => {
    if (focus) document.getElementById(focus.id)?.focus();
  }, [focus]);
  const focusOn = (id: string) => setFocus((f) => ({ id, n: (f?.n ?? 0) + 1 }));
  const fieldId = (f: FormField) => `${uid}-${f.id}`;
  const fields = schema.sections.flatMap((s) => s.fields);
  const errorText = (key: string) => {
    const k = `form.errors.${key}` as const;
    return t.has(k) ? t(k) : t("form.errors.generic");
  };
  const showAlert = (text: string) => setAlert((a) => ({ text, n: (a?.n ?? 0) + 1 }));

  const label = (key: string) => {
    const k = key as `anamnesis.${string}`;
    return k.startsWith("anamnesis.") && t.has(k) ? t(k) : key;
  };
  const optionLabel = (v: string) => {
    const k = `anamnesis.options.${v}` as const;
    return t.has(k) ? t(k) : v;
  };

  function check(): boolean {
    const next: Record<string, "required" | "invalid"> = {};
    for (const f of fields) if (f.required && !answers[f.id]?.trim()) next[f.id] = "required";
    setErrors(next);
    const first = fields.find((f) => next[f.id]);
    if (first) {
      showAlert(t("form.errors.fix"));
      focusOn(`${fieldId(first)}-legend`);
      return false;
    }
    return true;
  }

  async function sendCode() {
    if (busy) return;
    if (signer.trim().length < 3) {
      showAlert(t("form.errors.signer_required"));
      focusOn(`${uid}-signer`);
      return;
    }
    setBusy(true);
    setAlert(null);
    try {
      const res = await sendSignatureCode(token, locale);
      if (res.ok) {
        setChallenge({ id: res.challengeId, masked: res.masked });
        setCode("");
        focusOn(`${uid}-code`);
      } else showAlert(errorText(res.reason));
    } catch {
      showAlert(t("form.errors.generic"));
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (busy || !challenge) return;
    setBusy(true);
    setAlert(null);
    try {
      const res = await submitAnamnesisForm(token, locale, { answers, challengeId: challenge.id, code, signerName: signer });
      if (res.ok) {
        setStep("done");
        focusOn(`${uid}-done`);
      } else if (res.reason === "answers" && res.errors) {
        setErrors(res.errors);
        setStep("form");
        showAlert(t("form.errors.fix"));
        const first = fields.find((f) => res.errors![f.id]);
        if (first) focusOn(`${fieldId(first)}-legend`);
      } else {
        showAlert(errorText(res.reason));
        if (res.reason === "code_expired" || res.reason === "too_many_attempts") setChallenge(null);
      }
    } catch {
      showAlert(t("form.errors.generic"));
    } finally {
      setBusy(false);
    }
  }

  if (step === "done") {
    return (
      <Card className="p-6 text-center">
        <CircleCheck size={36} className="mx-auto text-emerald-600" aria-hidden />
        <h2 id={`${uid}-done`} tabIndex={-1} className="mt-3 text-xl font-bold focus:outline-none">
          {t("form.done.title")}
        </h2>
        <p className="mt-1 text-slate-600" role="status">
          {t("form.done.body", { clinic })}
        </p>
        <Link href={lhref(locale, `/a/${token}`)} className={buttonClass("secondary", "md", "mt-5")}>
          {t("form.done.back")}
        </Link>
      </Card>
    );
  }

  const set = (id: string, v: string) => {
    setAnswers((a) => ({ ...a, [id]: v }));
    if (errors[id]) setErrors(({ [id]: _drop, ...rest }) => rest);
  };

  return (
    <div className="space-y-5">
      {alert ? (
        <p key={alert.n} role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-800 ring-1 ring-red-200">
          {alert.text}
        </p>
      ) : null}

      {step === "form" ? (
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (check()) {
              setStep("sign");
              setAlert(null);
              focusOn(`${uid}-sign-title`);
            }
          }}
          className="space-y-5"
        >
          {schema.sections.map((section) => (
            <Card key={section.id} className="p-5">
              <h2 className="mb-3 text-lg font-bold">{label(section.titleKey)}</h2>
              <div className="space-y-5">
                {section.fields.map((f) => {
                  const id = fieldId(f);
                  const err = errors[f.id];
                  const hintKey = `anamnesis.hints.${f.id}` as const;
                  const hint = t.has(hintKey) ? t(hintKey) : null;
                  if (f.type === "text") {
                    return (
                      <Field
                        key={f.id}
                        id={id}
                        label={
                          <span id={`${id}-legend`} tabIndex={-1} className="focus:outline-none">
                            {label(f.labelKey)}
                          </span>
                        }
                        hint={hint}
                        error={err ? errorText(err) : null}
                      >
                        <Textarea
                          name={f.id}
                          rows={2}
                          maxLength={1000}
                          value={answers[f.id] ?? ""}
                          onChange={(e) => set(f.id, e.target.value)}
                          required={f.required}
                        />
                      </Field>
                    );
                  }
                  const options = f.type === "yesno" ? ["yes", "no"] : (f.options ?? []);
                  return (
                    <fieldset
                      key={f.id}
                      aria-describedby={err ? `${id}-error` : undefined}
                      aria-invalid={err ? true : undefined}
                    >
                      <legend id={`${id}-legend`} tabIndex={-1} className="text-sm font-semibold text-slate-800 focus:outline-none">
                        {label(f.labelKey)}
                        {f.required ? <span className="ml-1 text-xs font-normal text-slate-500">({t("form.required")})</span> : null}
                      </legend>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {options.map((o) => {
                          const checked = answers[f.id] === o;
                          return (
                            <label
                              key={o}
                              className={cx(
                                "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium ring-1 ring-inset transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-600",
                                checked ? "bg-brand-50 text-brand-800 ring-brand-600" : "bg-white ring-line-strong hover:bg-slate-50",
                                err && !checked && "ring-red-600",
                              )}
                            >
                              <input
                                type="radio"
                                name={f.id}
                                value={o}
                                checked={checked}
                                onChange={() => set(f.id, o)}
                                required={f.required}
                                className="h-4 w-4 accent-brand-700"
                              />
                              {optionLabel(o)}
                            </label>
                          );
                        })}
                      </div>
                      {err ? (
                        <p id={`${id}-error`} className="mt-1 text-xs font-medium text-red-600">
                          {errorText(err)}
                        </p>
                      ) : null}
                    </fieldset>
                  );
                })}
              </div>
            </Card>
          ))}
          <div className="flex justify-end">
            <Button type="submit" size="lg">
              {tc("actions.continue")}
            </Button>
          </div>
        </form>
      ) : (
        <Card className="space-y-4 p-5">
          <h2 id={`${uid}-sign-title`} tabIndex={-1} className="flex items-center gap-2 text-lg font-bold focus:outline-none">
            <LockKeyhole size={18} className="text-brand-700" aria-hidden /> {t("form.sign.title")}
          </h2>
          {contactHint ? (
            <p className="text-sm text-slate-600">{t("form.sign.body", { destination: contactHint })}</p>
          ) : (
            <p className="text-sm text-red-700">{t("form.errors.no_contact")}</p>
          )}
          <Field id={`${uid}-signer`} label={t("form.sign.signerName")} hint={t("form.sign.signerHint")}>
            <Input value={signer} onChange={(e) => setSigner(e.target.value)} autoComplete="name" maxLength={120} required />
          </Field>
          {challenge ? (
            <>
              <p className="text-sm text-slate-700" role="status">
                {t("form.sign.codeSent", { destination: challenge.masked })}
              </p>
              <Field id={`${uid}-code`} label={t("form.sign.code")}>
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  className="max-w-40 text-lg tracking-[0.3em]"
                  required
                />
              </Field>
            </>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            {/* Back to the questions keeps the answers. */}
            <Button type="button" variant="secondary" onClick={() => setStep("form")} disabled={busy}>
              <ArrowLeft size={16} aria-hidden /> {t("form.sign.back")}
            </Button>
            {challenge ? (
              <>
                <Button type="button" onClick={submit} disabled={busy || code.length !== 6}>
                  {busy ? <LoaderCircle size={16} className="animate-spin" aria-hidden /> : <Send size={16} aria-hidden />}
                  {busy ? t("form.sign.submitting") : t("form.sign.submit")}
                </Button>
                <Button type="button" variant="ghost" onClick={sendCode} disabled={busy}>
                  {t("form.sign.resend")}
                </Button>
              </>
            ) : (
              <Button type="button" onClick={sendCode} disabled={busy || !contactHint}>
                {busy ? <LoaderCircle size={16} className="animate-spin" aria-hidden /> : null}
                {busy ? t("form.sign.sending") : t("form.sign.sendCode")}
              </Button>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
