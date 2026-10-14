"use client";

import { Copy, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { saveSchedule } from "@/app/dashboard/actions/schedules";
import { CALENDAR_NAMES } from "@/i18n/calendar-names";
import { capitalizeFirst } from "@/i18n/datefmt";
import { useLocale, useT } from "@/i18n/provider";
import { Button, Select } from "../ui";
import { useRunAction } from "./useRunAction";

type Row = { key: number; weekday: number; locationId: string; start: string; end: string };
/** Monday first; weekday numbers as in the database (0 = Sunday). */
const WEEK = [1, 2, 3, 4, 5, 6, 0];
let seq = 0;

/** Weekly working hours: any number of windows per day, each at a specific office. */
export function ScheduleEditor({
  practitionerId,
  initial,
  locations,
}: {
  practitionerId: string;
  initial: { weekday: number; locationId: string; start: string; end: string }[];
  locations: { id: string; name: string }[];
}) {
  const t = useT("calendar");
  const locale = useLocale();
  const dayName = (wd: number) => capitalizeFirst(CALENDAR_NAMES[locale].weekdays[wd], locale);
  const [rows, setRows] = useState<Row[]>(() => initial.map((r) => ({ ...r, key: ++seq })));
  const [dirty, setDirty] = useState(false);
  const { run, pending } = useRunAction();
  const update = (next: Row[]) => {
    setRows(next);
    setDirty(true);
  };
  const defaultLocation = locations[0]?.id ?? "";

  return (
    <div>
      <div className="divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200">
        {WEEK.map((wd) => {
          const label = dayName(wd);
          const dayRows = rows.filter((r) => r.weekday === wd).sort((a, b) => a.start.localeCompare(b.start));
          return (
            <div key={wd} role="group" aria-label={t("schedule.hours", { day: label })} className="grid gap-2 p-3 sm:grid-cols-[110px_1fr]">
              <p className="pt-1.5 text-sm font-semibold">{label}</p>
              <div className="space-y-2">
                {dayRows.length === 0 ? <p className="pt-1.5 text-sm text-slate-500">{t("schedule.notWorking")}</p> : null}
                {dayRows.map((r) => (
                  <div key={r.key} className="flex flex-wrap items-center gap-2">
                    <input
                      type="time"
                      step={900}
                      value={r.start}
                      onChange={(e) => update(rows.map((x) => (x.key === r.key ? { ...x, start: e.target.value } : x)))}
                      className="h-9 rounded-lg px-2 text-sm ring-1 ring-slate-300"
                      aria-label={t("schedule.from")}
                    />
                    <span className="text-slate-500" aria-hidden>
                      –
                    </span>
                    <input
                      type="time"
                      step={900}
                      value={r.end}
                      onChange={(e) => update(rows.map((x) => (x.key === r.key ? { ...x, end: e.target.value } : x)))}
                      className="h-9 rounded-lg px-2 text-sm ring-1 ring-slate-300"
                      aria-label={t("schedule.to")}
                    />
                    <Select
                      className="!h-9 !w-auto !py-0"
                      value={r.locationId}
                      onChange={(e) => update(rows.map((x) => (x.key === r.key ? { ...x, locationId: e.target.value } : x)))}
                      aria-label={t("schedule.office")}
                    >
                      {locations.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </Select>
                    <button
                      type="button"
                      onClick={() => update(rows.filter((x) => x.key !== r.key))}
                      className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-700"
                      aria-label={t("schedule.remove")}
                    >
                      <Trash2 size={15} aria-hidden />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    const last = dayRows.at(-1);
                    update([
                      ...rows,
                      last
                        ? { key: ++seq, weekday: wd, locationId: last.locationId, start: last.end < "14:00" ? "14:00" : last.end, end: last.end < "14:00" ? "18:00" : "20:00" }
                        : { key: ++seq, weekday: wd, locationId: defaultLocation, start: "09:00", end: "13:00" },
                    ]);
                  }}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline"
                >
                  <Plus size={13} aria-hidden /> {t("schedule.addHours")}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button
          disabled={pending || !dirty}
          onClick={() =>
            run(
              () => saveSchedule(practitionerId, rows.map(({ weekday, locationId, start, end }) => ({ weekday, locationId, start, end }))),
              (r) => r.ok && setDirty(false),
            )
          }
        >
          {t("schedule.save")}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            const monday = rows.filter((r) => r.weekday === 1);
            update([...rows.filter((r) => r.weekday === 1 || r.weekday === 0 || r.weekday === 6), ...[2, 3, 4, 5].flatMap((wd) => monday.map((m) => ({ ...m, key: ++seq, weekday: wd })))]);
          }}
        >
          <Copy size={14} aria-hidden /> {t("schedule.copyMonday")}
        </Button>
        {dirty ? (
          <span className="text-xs font-medium text-amber-800" role="status">
            {t("schedule.unsaved")}
          </span>
        ) : null}
      </div>
    </div>
  );
}
