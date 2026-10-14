"use client";

import { Send } from "lucide-react";
import { useState } from "react";
import { simulateReply } from "@/app/dashboard/actions/messages";
import type { Locale } from "@/i18n/config";
import { useT } from "@/i18n/provider";
import { Button, Field, Input, Select } from "../ui";
import { useRunAction } from "./useRunAction";

/**
 * Demo mode only (the page renders it only then, and the action refuses otherwise): pretend one of
 * the practice's patients answered a reminder. Example replies are in the patient's language.
 */
export function ReplySimulator({
  patients,
  samples,
}: {
  patients: { phone: string; label: string; locale: Locale }[];
  /** Typical replies per language (src/lib/inbound.ts SAMPLE_REPLIES). */
  samples: Partial<Record<Locale, readonly string[]>>;
}) {
  const t = useT("reminders");
  const tc = useT("common");
  const { run, pending } = useRunAction();
  const [phone, setPhone] = useState(patients[0]?.phone ?? "");
  const [body, setBody] = useState(samples[patients[0]?.locale ?? "it"]?.[0] ?? "SI");
  const [channel, setChannel] = useState<"sms" | "whatsapp">("sms");
  const locale = patients.find((p) => p.phone === phone)?.locale ?? "it";
  const examples = [...(samples[locale] ?? []), "👍", "STOP"];
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => simulateReply(phone, body, channel));
      }}
    >
      <Field label={t("simulator.patient")}>
        <Select value={phone} onChange={(e) => setPhone(e.target.value)}>
          {patients.map((p) => (
            <option key={p.phone} value={p.phone}>
              {p.label}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-[1fr_120px] gap-2">
        <Field label={t("simulator.reply")}>
          <Input value={body} onChange={(e) => setBody(e.target.value)} maxLength={500} lang={locale} />
        </Field>
        <Field label={t("simulator.via")}>
          <Select value={channel} onChange={(e) => setChannel(e.target.value as "sms" | "whatsapp")}>
            <option value="sms">{tc("channels.sms")}</option>
            <option value="whatsapp">{tc("channels.whatsapp")}</option>
          </Select>
        </Field>
      </div>
      <div role="group" aria-label={t("simulator.examples")} className="flex flex-wrap gap-1.5">
        {examples.map((text) => (
          <button
            key={text}
            type="button"
            lang={locale}
            aria-pressed={body === text}
            onClick={() => setBody(text)}
            className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold hover:bg-slate-200 focus-visible:outline-2 focus-visible:outline-brand-600 aria-pressed:bg-brand-100 aria-pressed:text-brand-900"
          >
            {text}
          </button>
        ))}
      </div>
      <Button type="submit" disabled={pending || !phone || !body.trim()}>
        <Send size={15} aria-hidden /> {t("simulator.submit")}
      </Button>
    </form>
  );
}
