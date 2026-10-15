"use client";

import { Plus, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import { runRemindersNow, saveInboundNumber, saveReminderSettings } from "@/app/dashboard/actions/reminders";
import type { ReminderRule } from "@/db/schema";
import { useT } from "@/i18n/provider";
import { isValidReminderOffset } from "@/lib/reminder-offsets";
import { Button, Field, Input, Select } from "../ui";
import { useRunAction } from "./useRunAction";

type Settings = {
  rules: ReminderRule[];
  sendBookingConfirmation: boolean;
  requestReviews: boolean;
  autoOfferToWaitlist: boolean;
  smsAsciiFallback: boolean;
};

/** "sms" and "whatsapp" rules both mean "a text": the patient's channel decides (reminders.ts). */
type EditableRule = Omit<ReminderRule, "channel"> & { channel: "email" | "text"; amount: number; unit: "hours" | "days" };

function toEditable(r: ReminderRule): EditableRule {
  const days = r.offsetMinutes % 1440 === 0;
  return {
    ...r,
    channel: r.channel === "email" ? "email" : "text",
    unit: days ? "days" : "hours",
    amount: days ? r.offsetMinutes / 1440 : Math.round((r.offsetMinutes / 60) * 4) / 4,
  };
}

function toRule({ amount, unit, channel, ...r }: EditableRule): ReminderRule {
  return { ...r, channel: channel === "email" ? "email" : "sms", offsetMinutes: Math.round(amount * (unit === "days" ? 1440 : 60)) };
}

// max-w-full: a long option (the SMS channel) would otherwise make the select wider than a phone screen.
const control = "!h-9 !w-auto max-w-full !py-0";

export function RulesEditor({
  initial,
  canManage,
  canRun,
  riskEnabled,
}: {
  initial: Settings;
  canManage: boolean;
  canRun: boolean;
  /** privacy.riskBasedReminders: without it, rules limited by risk never send. */
  riskEnabled: boolean;
}) {
  const t = useT("reminders");
  const [rules, setRules] = useState<EditableRule[]>(() => initial.rules.map(toEditable));
  const [flags, setFlags] = useState({
    sendBookingConfirmation: initial.sendBookingConfirmation,
    requestReviews: initial.requestReviews,
    autoOfferToWaitlist: initial.autoOfferToWaitlist,
    smsAsciiFallback: initial.smsAsciiFallback,
  });
  const { run, pending } = useRunAction();
  const baseId = useId();
  /** The first rule whose time is out of range, after a save attempt (its number, from 1). */
  const [invalid, setInvalid] = useState<number | null>(null);
  const set = (id: string, patch: Partial<EditableRule>) => setRules(rules.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const save = () => {
    const bad = rules.findIndex((r) => !isValidReminderOffset(toRule(r).offsetMinutes));
    if (bad >= 0) {
      setInvalid(bad + 1);
      document.getElementById(`${baseId}-${bad}-amount`)?.focus();
      return;
    }
    setInvalid(null);
    run(() => saveReminderSettings({ rules: rules.map(toRule), ...flags }));
  };
  const hasRiskRules = rules.some((r) => r.onlyIfRisk);

  return (
    <div>
      {!canManage ? <p className="mb-3 text-sm text-slate-500">{t("rules.readOnly")}</p> : null}
      <ol className="space-y-2">
        {rules.map((r, i) => {
          const id = `${baseId}-${i}`;
          const number = i + 1;
          return (
            <li key={r.id} className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
              {/* min-w-0: a fieldset is at least as wide as its content by default (min-inline-size: min-content). */}
              <fieldset className="flex min-w-0 flex-wrap items-center gap-2" disabled={!canManage}>
                <legend className="sr-only">{t("rules.rule", { number })}</legend>
                <label className="sr-only" htmlFor={`${id}-channel`}>
                  {t("rules.channelLabel")}
                </label>
                <Select id={`${id}-channel`} className={control} value={r.channel} onChange={(e) => set(r.id, { channel: e.target.value as EditableRule["channel"] })}>
                  <option value="email">{t("rules.channelEmail")}</option>
                  <option value="text">{t("rules.channelText")}</option>
                </Select>
                <label className="sr-only" htmlFor={`${id}-amount`}>
                  {t("rules.amountLabel")}
                </label>
                <Input
                  id={`${id}-amount`}
                  type="number"
                  inputMode="decimal"
                  min={r.unit === "hours" ? 0.25 : 1}
                  max={r.unit === "hours" ? 336 : 14}
                  step={r.unit === "hours" ? 0.25 : 1}
                  value={r.amount}
                  onChange={(e) => set(r.id, { amount: Number(e.target.value) })}
                  aria-invalid={invalid === number || undefined}
                  aria-describedby={invalid === number ? `${baseId}-invalid` : undefined}
                  className="!h-9 !w-20 !px-2"
                />
                <label className="sr-only" htmlFor={`${id}-unit`}>
                  {t("rules.unitLabel")}
                </label>
                <Select id={`${id}-unit`} className={control} value={r.unit} onChange={(e) => set(r.id, { unit: e.target.value as "hours" | "days" })}>
                  <option value="hours">{t("rules.hoursBefore")}</option>
                  <option value="days">{t("rules.daysBefore")}</option>
                </Select>
                <label className="sr-only" htmlFor={`${id}-risk`}>
                  {t("rules.riskLabel")}
                </label>
                <Select
                  id={`${id}-risk`}
                  className={control}
                  value={r.onlyIfRisk ?? ""}
                  onChange={(e) => set(r.id, { onlyIfRisk: (e.target.value || undefined) as ReminderRule["onlyIfRisk"] })}
                >
                  <option value="">{t("rules.riskAll")}</option>
                  <option value="medium">{t("rules.riskMedium")}</option>
                  <option value="high">{t("rules.riskHigh")}</option>
                </Select>
                <label className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-brand-700"
                    checked={r.askConfirmation}
                    onChange={(e) => set(r.id, { askConfirmation: e.target.checked })}
                  />
                  {t("rules.askConfirmation")}
                </label>
                {r.channel !== "email" ? (
                  <label className="flex items-center gap-1.5 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-brand-700"
                      checked={r.fallbackToEmail}
                      onChange={(e) => set(r.id, { fallbackToEmail: e.target.checked })}
                    />
                    {t("rules.fallbackToEmail")}
                  </label>
                ) : null}
                {canManage ? (
                  <button
                    type="button"
                    className="ml-auto rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-brand-600"
                    aria-label={t("rules.remove", { number })}
                    onClick={() => setRules(rules.filter((x) => x.id !== r.id))}
                  >
                    <Trash2 size={15} aria-hidden />
                  </button>
                ) : null}
              </fieldset>
            </li>
          );
        })}
      </ol>
      {invalid != null ? (
        <p id={`${baseId}-invalid`} role="alert" className="mt-2 text-sm font-semibold text-red-700">
          {t("rules.invalidOffset", { number: invalid })}
        </p>
      ) : null}
      {canManage ? (
        rules.length < 6 ? (
          <button
            type="button"
            className="mt-2 inline-flex items-center gap-1 rounded text-sm font-semibold text-brand-700 hover:underline focus-visible:outline-2 focus-visible:outline-brand-600"
            onClick={() =>
              setRules([
                ...rules,
                { id: `r${Date.now().toString(36)}`, channel: "text", amount: 3, unit: "hours", offsetMinutes: 180, askConfirmation: false, fallbackToEmail: false },
              ])
            }
          >
            <Plus size={14} aria-hidden /> {t("rules.add")}
          </button>
        ) : (
          <p className="mt-2 text-xs text-slate-500">{t("rules.max")}</p>
        )
      ) : null}
      {hasRiskRules ? (
        <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
          {riskEnabled ? t("rules.riskObjection") : t("rules.riskOff")}
        </p>
      ) : null}

      <fieldset className="mt-6 space-y-3 text-sm" disabled={!canManage}>
        <legend className="mb-2 font-semibold text-slate-800">{t("rules.flagsTitle")}</legend>
        {(
          [
            ["sendBookingConfirmation", null],
            ["autoOfferToWaitlist", null],
            ["requestReviews", "rules.requestReviewsHint"],
            ["smsAsciiFallback", "rules.smsAsciiFallbackHint"],
          ] as const
        ).map(([key, hint]) => (
          <label key={key} className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 accent-brand-700"
              checked={flags[key]}
              onChange={(e) => setFlags({ ...flags, [key]: e.target.checked })}
            />
            <span>
              {t(`rules.${key}`)}
              {hint ? <span className="mt-0.5 block text-xs text-slate-500">{t(hint)}</span> : null}
            </span>
          </label>
        ))}
      </fieldset>

      <div className="mt-6 flex flex-wrap gap-2">
        {canManage ? (
          <Button disabled={pending} onClick={save}>
            {t("rules.save")}
          </Button>
        ) : null}
        {canRun ? (
          <Button variant="secondary" disabled={pending} onClick={() => run(() => runRemindersNow())}>
            {t("rules.runNow")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The practice's own reply number (organizations.inboundNumber): replies to it are matched to this
 * practice only. Editable by the owner.
 */
export function InboundNumberEditor({ initial, canEdit }: { initial: string | null; canEdit: boolean }) {
  const t = useT("reminders");
  const [value, setValue] = useState(initial ?? "");
  const { run, pending } = useRunAction();
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => saveInboundNumber(value));
      }}
    >
      <Field label={t("inbound.label")} hint={canEdit ? t("inbound.hint") : t("inbound.ownerOnly")}>
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={!canEdit}
          inputMode="tel"
          autoComplete="off"
          spellCheck={false}
          maxLength={40}
          placeholder={t("inbound.placeholder")}
        />
      </Field>
      {canEdit ? (
        <Button type="submit" variant="secondary" disabled={pending}>
          {t("inbound.save")}
        </Button>
      ) : null}
    </form>
  );
}
