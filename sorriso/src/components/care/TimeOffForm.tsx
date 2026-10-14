"use client";

import { CalendarClock, CircleCheck, LoaderCircle } from "lucide-react";
import { useActionState, useCallback, useState } from "react";
import { useFormStatus } from "react-dom";
import { addTimeOff } from "@/app/dashboard/actions/timeoff";
import type { ActionResult } from "@/app/dashboard/actions/_shared";
import { useT } from "@/i18n/provider";
import { Button, Field, Input, Select } from "../ui";
import { RebookDrawer } from "./RebookDrawer";

export type TimeOffFormProps = {
  /** Values like "practitioner:<id>", "location:<id>", "room:<id>" or "org". One entry = fixed scope. */
  scopes: { value: string; label: string }[];
  /** Today in the practice's time zone (YYYY-MM-DD): the earliest date offered. */
  today: string;
};

/**
 * Block time for a practitioner, an office, a chair or the whole practice. When the block covers
 * booked visits, the result offers "Rebook N patients" (the rebooking drawer). Props are
 * self-contained and frozen (rendered by the team, practitioner and offices pages).
 */
export function TimeOffForm({ scopes, today }: TimeOffFormProps) {
  const t = useT("care");
  const [state, formAction] = useActionState<ActionResult | null, FormData>(addTimeOff, null);
  const [drawer, setDrawer] = useState<string | null>(null);
  const closeDrawer = useCallback(() => setDrawer(null), []);
  const result = state?.ok ? (state.data as { timeOffId: string; clashes: number } | undefined) : undefined;

  return (
    <form action={formAction} className="space-y-3">
      {scopes.length === 1 ? (
        <input type="hidden" name="scope" value={scopes[0].value} />
      ) : (
        <Field label={t("timeOff.who")}>
          <Select name="scope" defaultValue={scopes[0]?.value}>
            {scopes.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t("timeOff.from")}>
          <Input type="date" name="fromDate" defaultValue={today} min={today} required />
        </Field>
        <Field label={t("timeOff.until")}>
          <Input type="date" name="toDate" defaultValue={today} min={today} />
        </Field>
        <Field label={t("timeOff.startTime")} hint={t("timeOff.ignoredAllDay")}>
          <Input type="time" name="fromTime" defaultValue="09:00" step={900} />
        </Field>
        <Field label={t("timeOff.endTime")}>
          <Input type="time" name="toTime" defaultValue="13:00" step={900} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="allDay" defaultChecked className="h-4 w-4 accent-brand-700" /> {t("timeOff.allDay")}
      </label>
      <Field label={t("timeOff.reason")} hint={t("timeOff.reasonHint")}>
        <Input name="reason" placeholder={t("timeOff.reasonPlaceholder")} maxLength={200} />
      </Field>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Submit label={t("timeOff.submit")} />
        <span role="status" className="contents">
          {state ? (
            state.ok ? (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                <CircleCheck size={16} aria-hidden /> {state.message}
              </span>
            ) : (
              <span className="text-sm font-medium text-red-600">{state.error}</span>
            )
          ) : null}
        </span>
        {result && result.clashes > 0 ? (
          <Button type="button" variant="secondary" onClick={() => setDrawer(result.timeOffId)}>
            <CalendarClock size={16} aria-hidden /> {t("timeOff.rebook", { count: result.clashes })}
          </Button>
        ) : null}
      </div>
      {drawer ? <RebookDrawer timeOffId={drawer} onClose={closeDrawer} /> : null}
    </form>
  );
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle size={16} className="animate-spin" aria-hidden /> : null}
      {label}
    </Button>
  );
}
