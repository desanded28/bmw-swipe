"use client";

import { AlertTriangle, Printer, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useRef, useState, type ReactNode } from "react";
import type { ActionResult } from "@/app/dashboard/actions/_shared";
import { addRegisterEntry, removeRegisterEntry, savePrivacySettings } from "@/app/dashboard/actions/privacy";
import type { PrivacySettings, RetentionSettings } from "@/db/schema";
import { useT } from "@/i18n/provider";
import { SubmitButton } from "../dashboard/ActionForm";
import { useRunAction } from "../dashboard/useRunAction";
import { Button, Card, Field, Input, Select, Textarea } from "../ui";
import { FormStatus } from "./PatientForms";

type Limit = { min: number; max: number; default: number; unit: "days" | "months" | "hours" };

/** Whether WhatsApp can actually be used on this server (see whatsappStatus in the page). */
export type WhatsAppStatus = { kind: "live" | "noTemplates" | "notConnected" | "demo"; templates: number };

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-slate-200/70">
      <legend className="sr-only">{title}</legend>
      <h2 className="mb-3 text-lg font-bold" aria-hidden>
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </fieldset>
  );
}

function Toggle({ name, label, defaultChecked, onChange, children }: { name: string; label: string; defaultChecked: boolean; onChange?: (v: boolean) => void; children?: ReactNode }) {
  return (
    <div>
      <label className="flex items-start gap-2 text-sm font-medium">
        <input type="checkbox" name={name} defaultChecked={defaultChecked} onChange={(e) => onChange?.(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-brand-700" />
        <span>{label}</span>
      </label>
      {children ? <div className="ml-6 mt-1.5">{children}</div> : null}
    </div>
  );
}

function Warning({ children }: { children: ReactNode }) {
  return (
    <p className="flex gap-2 rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-900 ring-1 ring-amber-200">
      <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

/**
 * The practice's privacy settings. Saving needs a fresh second factor and is audited with the
 * names of the changed settings; every number is clamped to its legal range on the server.
 */
export function PrivacySettingsForm({
  settings,
  limits,
  sessionLimits,
  whatsappStatus,
}: {
  settings: PrivacySettings;
  limits: Record<keyof RetentionSettings, Limit>;
  sessionLimits: { min: number; max: number };
  whatsappStatus: WhatsAppStatus;
}) {
  const t = useT("privacyAdmin");
  const tc = useT("common");
  const [state, action] = useActionState<ActionResult | null, FormData>(savePrivacySettings, null);
  const [detailed, setDetailed] = useState(settings.messageContentLevel === "detailed");
  const [whatsapp, setWhatsapp] = useState(settings.whatsappEnabled);
  const [ics, setIcs] = useState(settings.icsFeedsEnabled);

  return (
    <form action={action} className="space-y-6">
      <Section title={t("settingsPrivacy.sections.messages")}>
        <Field label={t("settingsPrivacy.messageContentLevel.label")}>
          <Select name="messageContentLevel" defaultValue={settings.messageContentLevel} onChange={(e) => setDetailed(e.target.value === "detailed")}>
            <option value="discreet">{t("settingsPrivacy.messageContentLevel.discreet")}</option>
            <option value="detailed">{t("settingsPrivacy.messageContentLevel.detailed")}</option>
          </Select>
        </Field>
        {detailed ? <Warning>{t("settingsPrivacy.messageContentLevel.warning")}</Warning> : null}
        <Toggle name="whatsappEnabled" label={t("settingsPrivacy.whatsapp.label")} defaultChecked={settings.whatsappEnabled} onChange={setWhatsapp}>
          <p className={whatsappStatus.kind === "live" ? "text-xs text-slate-500" : "text-xs font-medium text-amber-800"}>
            {whatsappStatus.kind === "live"
              ? t("settingsPrivacy.whatsapp.status.live", { count: whatsappStatus.templates })
              : t(`settingsPrivacy.whatsapp.status.${whatsappStatus.kind}`)}
          </p>
          {whatsapp ? <div className="mt-1.5"><Warning>{t("settingsPrivacy.whatsapp.warning")}</Warning></div> : null}
        </Toggle>
        <Toggle name="marketingEnabled" label={t("settingsPrivacy.marketing.label")} defaultChecked={settings.marketingEnabled}>
          <p className="text-xs text-slate-500">{t("settingsPrivacy.marketing.hint")}</p>
        </Toggle>
        <Toggle name="staffWaLinks" label={t("settingsPrivacy.staffWaLinks.label")} defaultChecked={settings.staffWaLinks}>
          <p className="text-xs text-slate-500">{t("settingsPrivacy.staffWaLinks.hint")}</p>
        </Toggle>
      </Section>

      <Section title={t("settingsPrivacy.sections.reminders")}>
        <Toggle name="riskBasedReminders" label={t("settingsPrivacy.risk.label")} defaultChecked={settings.riskBasedReminders}>
          <p className="text-xs leading-relaxed text-slate-600">{t("settingsPrivacy.risk.lia")}</p>
        </Toggle>
      </Section>

      <Section title={t("settingsPrivacy.sections.calendar")}>
        <Toggle name="icsFeedsEnabled" label={t("settingsPrivacy.ics.label")} defaultChecked={settings.icsFeedsEnabled} onChange={setIcs}>
          <p className="text-xs text-slate-500">{t("settingsPrivacy.ics.hint")}</p>
        </Toggle>
        <Field label={t("settingsPrivacy.ics.detail")} className="max-w-sm">
          <Select name="icsDetail" defaultValue={settings.icsDetail} disabled={!ics}>
            <option value="none">{t("settingsPrivacy.ics.none")}</option>
            <option value="initials">{t("settingsPrivacy.ics.initials")}</option>
          </Select>
        </Field>
      </Section>

      <Section title={t("settingsPrivacy.sections.embed")}>
        <Field label={t("settingsPrivacy.embed.label")} hint={t("settingsPrivacy.embed.hint")}>
          <Textarea name="embedOrigins" rows={3} defaultValue={settings.embedOrigins.join("\n")} spellCheck={false} placeholder={t("settingsPrivacy.embed.placeholder")} />
        </Field>
      </Section>

      <Section title={t("settingsPrivacy.sections.security")}>
        <Toggle name="requireMfa" label={t("settingsPrivacy.requireMfa.label")} defaultChecked={settings.requireMfa}>
          <p className="text-xs text-slate-500">{t("settingsPrivacy.requireMfa.hint")}</p>
        </Toggle>
        <Field label={t("settingsPrivacy.sessionHours.label")} hint={t("settingsPrivacy.sessionHours.hint", { min: sessionLimits.min, max: sessionLimits.max })} className="max-w-xs">
          <Input name="sessionHours" type="number" min={sessionLimits.min} max={sessionLimits.max} defaultValue={settings.sessionHours} required />
        </Field>
      </Section>

      <Section title={t("settingsPrivacy.sections.retention")}>
        <p className="text-sm text-slate-600">{t("settingsPrivacy.retention.intro")}</p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {(Object.keys(limits) as (keyof RetentionSettings)[]).map((key) => {
            const l = limits[key];
            return (
              <Field key={key} label={t(`settingsPrivacy.retention.fields.${key}`)} hint={t("settingsPrivacy.retention.range", { min: l.min, max: l.max })}>
                <Input name={`retention.${key}`} type="number" min={l.min} max={l.max} step={1} defaultValue={settings.retention[key]} required />
              </Field>
            );
          })}
        </div>
        <fieldset>
          <legend className="mb-1.5 block text-[13px] font-semibold text-slate-700">{t("settingsPrivacy.erasureDefault.label")}</legend>
          <div className="flex flex-wrap gap-4 text-sm">
            {(["restrict", "anonymise"] as const).map((v) => (
              <label key={v} className="flex items-center gap-2">
                <input type="radio" name="erasureDefault" value={v} defaultChecked={settings.erasureDefault === v} className="h-4 w-4 accent-brand-700" />
                {t(`settingsPrivacy.erasureDefault.${v}`)}
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-slate-500">{t("settingsPrivacy.erasureDefault.hint")}</p>
        </fieldset>
      </Section>

      <div className="sticky bottom-0 flex flex-wrap items-center gap-3 rounded-2xl bg-white/95 p-4 shadow-card ring-1 ring-slate-200/70 backdrop-blur">
        <SubmitButton label={tc("actions.save")} />
        <span className="text-xs text-slate-500">{t("settingsPrivacy.stepUp")}</span>
        <FormStatus state={state} />
      </div>
    </form>
  );
}

/** Add a free row (an activity outside Sorriso) to the register. */
export function RegisterEntryForm({ columns }: { columns: { key: string; label: string }[] }) {
  const t = useT("privacyAdmin");
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action] = useActionState<ActionResult | null, FormData>(async (prev, fd) => {
    const res = await addRegisterEntry(prev, fd);
    if (res.ok) {
      formRef.current?.reset();
      router.refresh();
    }
    return res;
  }, null);
  return (
    <Card className="p-5 print:hidden">
      <h2 className="font-bold">{t("register.add.title")}</h2>
      <p className="mb-3 mt-0.5 text-sm text-slate-500">{t("register.add.hint")}</p>
      <form ref={formRef} action={action} className="space-y-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {columns.map((c) => (
            <Field key={c.key} label={c.label}>
              {c.key === "activity" ? <Input name={c.key} required maxLength={600} /> : <Textarea name={c.key} rows={2} maxLength={600} />}
            </Field>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton label={t("register.add.submit")} />
          <FormStatus state={state} />
        </div>
      </form>
    </Card>
  );
}

export function RemoveRegisterEntry({ id, label }: { id: string; label: string }) {
  const t = useT("privacyAdmin");
  const { run, pending } = useRunAction();
  return (
    <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => run(() => removeRegisterEntry(id))} aria-label={`${t("register.add.remove")}: ${label}`} className="print:hidden">
      <Trash2 size={14} aria-hidden /> {t("register.add.remove")}
    </Button>
  );
}

/** Print the page (the browser's "save as PDF" gives the PDF); navigation is hidden in print. */
export function PrintButton({ label }: { label: string }) {
  return (
    <Button type="button" variant="secondary" onClick={() => window.print()} className="print:hidden">
      <Printer size={16} aria-hidden /> {label}
    </Button>
  );
}
