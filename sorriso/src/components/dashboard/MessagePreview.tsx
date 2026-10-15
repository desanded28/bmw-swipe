"use client";

import { AlertTriangle, ShieldCheck } from "lucide-react";
import { useId, useState } from "react";
import type { Locale } from "@/i18n/config";
import { useT } from "@/i18n/provider";
import { Badge, Field, Select, cx } from "../ui";

/** One SMS as it will be sent, with what it costs (computed on the server: src/lib/messaging/sms-encoding.ts). */
export type SmsPreview = {
  text: string;
  encoding: "GSM-7" | "UCS-2";
  /** Septets (GSM-7) or UTF-16 units (UCS-2). */
  units: number;
  segments: number;
  withinBudget: boolean;
  /** The ASCII fallback changed the text (accents removed). */
  ascii: boolean;
};

export type MessagePreviewData = {
  smsAsk: SmsPreview;
  sms: SmsPreview;
  reply: { patient: string; answer: string };
  email: { subject: string; html: string };
};

/**
 * The reminder as a patient receives it, in any of the 8 languages and at the practice's current
 * content level. Every text is rendered on the server (patient texts are a server-only namespace);
 * this component only switches between them.
 */
export function MessagePreview({
  previews,
  locales,
  initialLocale,
  level,
}: {
  previews: Partial<Record<Locale, MessagePreviewData>>;
  locales: readonly Locale[];
  initialLocale: Locale;
  level: "discreet" | "detailed";
}) {
  const t = useT("reminders");
  const tc = useT("common");
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const p = previews[locale] ?? previews[initialLocale];
  const statusId = useId();
  if (!p) return null;
  const language = tc(`languages.${locale}`);

  const bubble = (sms: SmsPreview, label: string) => (
    <figure className="space-y-1.5">
      <figcaption className="text-xs font-semibold text-slate-600">{label}</figcaption>
      <div className="max-w-[92%] rounded-2xl rounded-bl-sm bg-white p-3 text-[13px] leading-snug shadow-sm [overflow-wrap:anywhere]" lang={locale}>
        {sms.text}
      </div>
      <p className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
        <Badge tone={sms.withinBudget ? "slate" : "amber"}>{t("preview.segments", { count: sms.segments })}</Badge>
        <span>{t("preview.characters", { count: sms.units, encoding: sms.encoding })}</span>
        {sms.ascii ? <span>· {t("preview.asciiOn")}</span> : null}
        {!sms.withinBudget ? (
          <span className="inline-flex items-center gap-1 font-semibold text-amber-800">
            <AlertTriangle size={13} aria-hidden /> {t("preview.overBudget")}
          </span>
        ) : null}
      </p>
    </figure>
  );

  return (
    <div className="space-y-5">
      <Field label={t("preview.languageLabel")}>
        <Select value={locale} onChange={(e) => setLocale(e.target.value as Locale)} aria-describedby={statusId}>
          {locales.map((l) => (
            <option key={l} value={l}>
              {tc(`languages.${l}`)}
            </option>
          ))}
        </Select>
      </Field>

      <p id={statusId} className={cx("flex gap-2 rounded-xl p-3 text-xs", level === "detailed" ? "bg-amber-50 text-amber-900" : "bg-brand-50 text-brand-900")}>
        <ShieldCheck size={16} className="shrink-0" aria-hidden />
        <span>{t(level === "detailed" ? "preview.detailed" : "preview.discreet")}</span>
      </p>

      {/* On this slate-100 panel, captions are slate-600: slate-500 is only 4.34:1 there. */}
      <div className="space-y-4 rounded-2xl bg-slate-100 p-4">
        {bubble(p.smsAsk, t("preview.reminderAsk"))}
        <figure className="space-y-1.5">
          <figcaption className="text-right text-xs font-semibold text-slate-600">{t("preview.patientReply")}</figcaption>
          <div className="ml-auto w-fit rounded-2xl rounded-br-sm bg-brand-700 px-3 py-2 text-[13px] text-white" lang={locale}>
            {p.reply.patient}
          </div>
        </figure>
        <figure className="space-y-1.5">
          <figcaption className="text-xs font-semibold text-slate-600">{t("preview.automaticAnswer")}</figcaption>
          <div className="max-w-[92%] rounded-2xl rounded-bl-sm bg-white p-3 text-[13px] leading-snug shadow-sm [overflow-wrap:anywhere]" lang={locale}>
            {p.reply.answer}
          </div>
        </figure>
        {bubble(p.sms, t("preview.reminder"))}
      </div>

      <div className="overflow-hidden rounded-2xl ring-1 ring-slate-200">
        <p className="border-b border-slate-100 bg-white px-4 py-3 text-sm">
          <span className="font-bold">{t("preview.emailTitle")}</span>
          <span className="mt-0.5 block text-slate-600 [overflow-wrap:anywhere]" lang={locale}>
            {t("preview.subject", { subject: p.email.subject })}
          </span>
        </p>
        <iframe
          title={t("preview.emailFrame", { language })}
          srcDoc={p.email.html}
          className="h-[520px] w-full border-0 bg-slate-100"
          sandbox=""
        />
      </div>
      <p className="text-xs text-slate-500">{t("preview.sampleNote")}</p>
    </div>
  );
}
