import { CalendarOff } from "lucide-react";
import { addTimeOff, deleteTimeOff } from "@/app/dashboard/actions";
import type { TimeOff } from "@/db/schema";
import { fmtDay, zonedDate, zonedTime } from "@/lib/datefmt";
import { Field, Input, Select } from "../ui";
import { ActionButton } from "./ActionButton";
import { ActionForm } from "./ActionForm";

export function TimeOffForm({
  scopes,
  today,
}: {
  /** value like "practitioner:<id>" / "location:<id>" / "room:<id>" / "org". One entry = fixed scope. */
  scopes: { value: string; label: string }[];
  today: string;
}) {
  return (
    <ActionForm action={addTimeOff} submitLabel="Block time" className="space-y-3">
      {scopes.length === 1 ? (
        <input type="hidden" name="scope" value={scopes[0].value} />
      ) : (
        <Field label="Who / what is unavailable">
          <Select name="scope" defaultValue={scopes[0]?.value}>
            {scopes.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="From">
          <Input type="date" name="fromDate" defaultValue={today} min={today} required />
        </Field>
        <Field label="Until (inclusive)">
          <Input type="date" name="toDate" defaultValue={today} min={today} />
        </Field>
        <Field label="Start time" hint="Ignored if all day">
          <Input type="time" name="fromTime" defaultValue="09:00" step={900} />
        </Field>
        <Field label="End time">
          <Input type="time" name="toTime" defaultValue="13:00" step={900} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="allDay" defaultChecked className="h-4 w-4 accent-brand-700" /> All day (whole days from–until)
      </label>
      <Field label="Reason" hint="Shown in the calendar">
        <Input name="reason" placeholder="Holiday, congress, maintenance…" />
      </Field>
    </ActionForm>
  );
}

export function TimeOffList({ items, tz, label }: { items: (TimeOff & { label?: string })[]; tz: string; label?: (t: TimeOff) => string }) {
  if (!items.length) return <p className="text-sm text-slate-500">Nothing planned.</p>;
  return (
    <ul className="divide-y divide-slate-100">
      {items.map((t) => {
        const sd = zonedDate(t.startsAt, tz);
        const endInclusive = new Date(t.endsAt.getTime() - 1);
        const ed = zonedDate(endInclusive, tz);
        const allDay = zonedTime(t.startsAt, tz) === "00:00" && zonedTime(t.endsAt, tz) === "00:00";
        const when = allDay
          ? sd === ed
            ? fmtDay(sd, "weekday")
            : `${fmtDay(sd, "weekday")} – ${fmtDay(ed, "weekday")}`
          : `${fmtDay(sd, "weekday")} ${zonedTime(t.startsAt, tz)} – ${sd === zonedDate(t.endsAt, tz) ? "" : `${fmtDay(zonedDate(t.endsAt, tz), "weekday")} `}${zonedTime(t.endsAt, tz)}`;
        return (
          <li key={t.id} className="flex items-center justify-between gap-3 py-2.5">
            <div className="flex items-start gap-2.5">
              <CalendarOff size={16} className="mt-0.5 shrink-0 text-slate-400" />
              <div>
                <p className="text-sm font-semibold">{when}</p>
                <p className="text-xs text-slate-500">{[label?.(t), t.reason].filter(Boolean).join(" · ") || "Unavailable"}</p>
              </div>
            </div>
            <ActionButton action={deleteTimeOff.bind(null, t.id)} variant="ghost" confirm="Remove this block?">
              Remove
            </ActionButton>
          </li>
        );
      })}
    </ul>
  );
}
