"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { runRemindersNow, saveReminderSettings } from "@/app/dashboard/actions";
import type { ReminderRule } from "@/db/schema";
import { Button, Select } from "../ui";
import { useRunAction } from "./AppointmentDrawer";

type Settings = {
  rules: ReminderRule[];
  sendBookingConfirmation: boolean;
  requestReviews: boolean;
  autoOfferToWaitlist: boolean;
};

type EditableRule = ReminderRule & { amount: number; unit: "hours" | "days" };

function toEditable(r: ReminderRule): EditableRule {
  const days = r.offsetMinutes % 1440 === 0;
  return { ...r, unit: days ? "days" : "hours", amount: days ? r.offsetMinutes / 1440 : Math.round((r.offsetMinutes / 60) * 4) / 4 };
}

export function RulesEditor({ initial, canManage }: { initial: Settings; canManage: boolean }) {
  const [rules, setRules] = useState<EditableRule[]>(() => initial.rules.map(toEditable));
  const [flags, setFlags] = useState({
    sendBookingConfirmation: initial.sendBookingConfirmation,
    requestReviews: initial.requestReviews,
    autoOfferToWaitlist: initial.autoOfferToWaitlist,
  });
  const { run, pending } = useRunAction();
  const set = (id: string, patch: Partial<EditableRule>) => setRules(rules.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  return (
    <div>
      <div className="space-y-2">
        {rules.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-white p-3 ring-1 ring-slate-200">
            <Select className="!h-9 !w-auto !py-0" value={r.channel} disabled={!canManage} onChange={(e) => set(r.id, { channel: e.target.value as ReminderRule["channel"] })}>
              <option value="email">Email</option>
              <option value="sms">Text (SMS, or WhatsApp if preferred)</option>
              <option value="whatsapp">WhatsApp</option>
            </Select>
            <input
              type="number"
              min={1}
              step={r.unit === "hours" ? 0.25 : 1}
              disabled={!canManage}
              value={r.amount}
              onChange={(e) => set(r.id, { amount: Number(e.target.value) })}
              className="h-9 w-20 rounded-lg px-2 text-sm ring-1 ring-slate-200"
              aria-label="How long before"
            />
            <Select className="!h-9 !w-auto !py-0" value={r.unit} disabled={!canManage} onChange={(e) => set(r.id, { unit: e.target.value as "hours" | "days" })}>
              <option value="hours">hours before</option>
              <option value="days">days before</option>
            </Select>
            <label className="ml-2 flex items-center gap-1.5 text-sm">
              <input type="checkbox" className="h-4 w-4 accent-brand-700" disabled={!canManage} checked={r.askConfirmation} onChange={(e) => set(r.id, { askConfirmation: e.target.checked })} />
              Ask to confirm (SI/NO)
            </label>
            {r.channel !== "email" ? (
              <label className="flex items-center gap-1.5 text-sm text-slate-600">
                <input type="checkbox" className="h-4 w-4 accent-brand-700" disabled={!canManage} checked={r.fallbackToEmail} onChange={(e) => set(r.id, { fallbackToEmail: e.target.checked })} />
                Email if no mobile
              </label>
            ) : null}
            {canManage ? (
              <button type="button" className="ml-auto rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Remove rule" onClick={() => setRules(rules.filter((x) => x.id !== r.id))}>
                <Trash2 size={15} />
              </button>
            ) : null}
          </div>
        ))}
      </div>
      {canManage && rules.length < 6 ? (
        <button
          type="button"
          className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline"
          onClick={() =>
            setRules([...rules, { id: `r${Date.now()}`, channel: "sms", amount: 3, unit: "hours", offsetMinutes: 180, askConfirmation: false, fallbackToEmail: false }])
          }
        >
          <Plus size={14} /> Add reminder
        </button>
      ) : null}

      <div className="mt-6 space-y-2 text-sm">
        {(
          [
            ["sendBookingConfirmation", "Send a booking confirmation with a calendar invite right after booking"],
            ["autoOfferToWaitlist", "Offer freed-up slots to matching waitlist patients automatically"],
            ["requestReviews", "Ask for a verified review 2 hours after a visit is marked completed"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex items-center gap-2">
            <input type="checkbox" className="h-4 w-4 accent-brand-700" disabled={!canManage} checked={flags[key]} onChange={(e) => setFlags({ ...flags, [key]: e.target.checked })} />
            {label}
          </label>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {canManage ? (
          <Button
            disabled={pending}
            onClick={() =>
              run(() =>
                saveReminderSettings({
                  rules: rules.map(({ amount, unit, ...r }) => ({ ...r, offsetMinutes: Math.round(amount * (unit === "days" ? 1440 : 60)) })),
                  ...flags,
                }),
              )
            }
          >
            Save reminder rules
          </Button>
        ) : null}
        <Button variant="secondary" disabled={pending} onClick={() => run(() => runRemindersNow())}>
          Send due reminders now
        </Button>
      </div>
    </div>
  );
}
