"use client";

import { KeyRound, Mail, MessageCircle, Send, Smartphone } from "lucide-react";
import { useActionState, useId, useState } from "react";
import type { Channel, Locale } from "@/db/enums";
import { ENDONYM, LOCALES } from "@/i18n/config";
import { useLocale, useT } from "@/i18n/provider";
import { Field, Input, Select, cx } from "../ui";
import { DIAL_CODES } from "./dial";
import { FormMessage, SubmitButton, type PrivacyAction, type PrivacyFormState } from "./ActionForm";

const CHANNEL_ICON = { sms: MessageCircle, whatsapp: MessageCircle, email: Mail } as const;

/**
 * Language and channel of the patient's messages. Choosing WhatsApp shows its just-in-time notice
 * and the confirmation from the `consents` namespace (recorded as a whatsapp_channel grant), unless
 * it was given before.
 */
export function PreferencesForm({
  action,
  hidden,
  current,
  channels,
  whatsappConsented,
}: {
  action: PrivacyAction;
  /** What identifies the record to the action: { patientId } (privacy center) or { token } (appointment link). */
  hidden: Record<string, string>;
  current: { locale: Locale; channel: Channel };
  channels: Channel[];
  whatsappConsented: boolean;
}) {
  const t = useT("privacy");
  const tc = useT("consents");
  const tcommon = useT("common");
  const locale = useLocale();
  const id = useId();
  const [state, formAction] = useActionState(action, null);
  const [channel, setChannel] = useState<Channel>(channels.includes(current.channel) ? current.channel : (channels[0] ?? "sms"));
  const askWhatsApp = channel === "whatsapp" && !whatsappConsented;
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <Field label={t("me.preferences.language")}>
        <Select name="messageLocale" defaultValue={current.locale} className="max-w-xs">
          {LOCALES.map((l) => (
            <option key={l} value={l} lang={l}>
              {ENDONYM[l]}
            </option>
          ))}
        </Select>
      </Field>
      <fieldset>
        <legend className="mb-2 text-[13px] font-semibold text-slate-700">{t("me.preferences.channel")}</legend>
        <div className="flex flex-wrap gap-2">
          {channels.map((c) => {
            const Icon = CHANNEL_ICON[c];
            return (
              <label
                key={c}
                className={cx(
                  "flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-4 text-sm font-semibold ring-1",
                  "has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-brand-600",
                  channel === c ? "bg-brand-50 text-brand-800 ring-2 ring-brand-600" : "bg-white text-slate-700 ring-line-strong",
                )}
              >
                <input type="radio" name="channel" value={c} checked={channel === c} onChange={() => setChannel(c)} className="sr-only" />
                <Icon size={16} aria-hidden /> {tcommon(`channels.${c}`)}
              </label>
            );
          })}
        </div>
      </fieldset>
      {askWhatsApp ? (
        <div className="space-y-2">
          <p id={`${id}wa`} className="rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600 ring-1 ring-slate-200">
            {tc("whatsapp_channel.description")}
          </p>
          <label className="flex items-start gap-3 text-sm text-slate-700">
            <input type="checkbox" name="whatsapp" value="1" aria-describedby={`${id}wa`} aria-required className="mt-0.5 h-5 w-5 shrink-0 accent-brand-700" />
            <span>{tc("whatsapp_channel.label")}</span>
          </label>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton label={t("me.preferences.save")} pending={tcommon("actions.saving")} variant="secondary" size="sm" />
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export type ContactChangeState = (NonNullable<PrivacyFormState> & { ticket?: string }) | null;

/**
 * Correct a phone number or email address in two steps: a code to the new contact, then the
 * code. `others` are this person's other records holding the same contact (other practices), which
 * the patient can update in one go.
 */
export function ContactChangeForm({
  requestAction,
  confirmAction,
  patientId,
  others,
}: {
  requestAction: (prev: ContactChangeState, fd: FormData) => Promise<ContactChangeState>;
  confirmAction: (prev: ContactChangeState, fd: FormData) => Promise<ContactChangeState>;
  patientId: string;
  /** Other records of the same person, with the practice's name. */
  others: { id: string; practice: string }[];
}) {
  const t = useT("privacy");
  const locale = useLocale();
  const id = useId();
  const [kind, setKind] = useState<"phone" | "email">("phone");
  const [sent, request] = useActionState(requestAction, null);
  const [done, confirm] = useActionState(confirmAction, null);
  const ticket = done?.ok ? null : (done?.ticket ?? (sent?.ok ? sent.ticket : null));

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">{t("me.contact.intro")}</p>
      <form action={request} className="space-y-3">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="patientIds" value={patientId} />
        <fieldset>
          <legend className="mb-2 text-[13px] font-semibold text-slate-700">{t("me.contact.kind")}</legend>
          <div className="flex flex-wrap gap-2">
            {(["phone", "email"] as const).map((k) => (
              <label
                key={k}
                className={cx(
                  "flex min-h-10 cursor-pointer items-center gap-2 rounded-xl px-3 text-sm font-semibold ring-1",
                  "has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-brand-600",
                  kind === k ? "bg-brand-50 text-brand-800 ring-2 ring-brand-600" : "bg-white text-slate-700 ring-line-strong",
                )}
              >
                <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="sr-only" />
                {k === "phone" ? <Smartphone size={15} aria-hidden /> : <Mail size={15} aria-hidden />} {t(`me.contact.kinds.${k}`)}
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <label htmlFor={`${id}value`} className="mb-1.5 block text-[13px] font-semibold text-slate-700">
            {t("me.contact.newValue")}
          </label>
          <div className="flex gap-2">
            {kind === "phone" ? (
              <Select name="dial" defaultValue="39" aria-label={t("center.signIn.countryCode")} className="max-w-24 shrink-0">
                {DIAL_CODES.map((code) => (
                  <option key={code} value={code}>
                    {t("center.signIn.dialOption", { code })}
                  </option>
                ))}
              </Select>
            ) : null}
            <Input
              id={`${id}value`}
              name="value"
              required
              type={kind === "email" ? "email" : "tel"}
              inputMode={kind === "email" ? "email" : "tel"}
              autoComplete={kind === "email" ? "email" : "tel-national"}
              className="max-w-sm"
            />
          </div>
        </div>
        {others.length ? (
          <fieldset className="space-y-1">
            <legend className="text-[13px] font-semibold text-slate-700">{t("me.contact.applyAll")}</legend>
            {others.map((o) => (
              <label key={o.id} className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" name="patientIds" value={o.id} defaultChecked className="h-4 w-4 accent-brand-700" />
                {o.practice}
              </label>
            ))}
          </fieldset>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton label={<><Send size={15} aria-hidden /> {t("me.contact.send")}</>} pending={t("center.signIn.sending")} variant="secondary" size="sm" />
          <FormMessage state={sent} />
        </div>
      </form>

      {ticket ? (
        <form action={confirm} className="space-y-3 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200/70">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="ticket" value={ticket} />
          <Field label={t("me.contact.code")}>
            <Input name="code" required inputMode="numeric" autoComplete="one-time-code" maxLength={7} className="max-w-40 text-center font-mono tracking-[0.3em]" />
          </Field>
          <div className="flex flex-wrap items-center gap-3">
            <SubmitButton label={<><KeyRound size={15} aria-hidden /> {t("me.contact.confirm")}</>} pending={t("verify.checking")} size="sm" />
            <FormMessage state={done} />
          </div>
        </form>
      ) : done?.ok ? (
        <FormMessage state={done} />
      ) : null}
    </div>
  );
}
