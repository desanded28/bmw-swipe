"use client";

import { Copy, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { saveSchedule } from "@/app/dashboard/actions";
import { Button, Select } from "../ui";
import { useRunAction } from "./AppointmentDrawer";

type Row = { key: number; weekday: number; locationId: string; start: string; end: string };
const DAYS: [number, string][] = [
  [1, "Monday"],
  [2, "Tuesday"],
  [3, "Wednesday"],
  [4, "Thursday"],
  [5, "Friday"],
  [6, "Saturday"],
  [0, "Sunday"],
];
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
        {DAYS.map(([wd, label]) => {
          const dayRows = rows.filter((r) => r.weekday === wd).sort((a, b) => a.start.localeCompare(b.start));
          return (
            <div key={wd} className="grid gap-2 p-3 sm:grid-cols-[110px_1fr]">
              <p className="pt-1.5 text-sm font-semibold">{label}</p>
              <div className="space-y-2">
                {dayRows.length === 0 ? <p className="pt-1.5 text-sm text-slate-400">Not working</p> : null}
                {dayRows.map((r) => (
                  <div key={r.key} className="flex flex-wrap items-center gap-2">
                    <input
                      type="time"
                      step={900}
                      value={r.start}
                      onChange={(e) => update(rows.map((x) => (x.key === r.key ? { ...x, start: e.target.value } : x)))}
                      className="h-9 rounded-lg px-2 text-sm ring-1 ring-slate-200"
                      aria-label="From"
                    />
                    <span className="text-slate-400">–</span>
                    <input
                      type="time"
                      step={900}
                      value={r.end}
                      onChange={(e) => update(rows.map((x) => (x.key === r.key ? { ...x, end: e.target.value } : x)))}
                      className="h-9 rounded-lg px-2 text-sm ring-1 ring-slate-200"
                      aria-label="To"
                    />
                    <Select
                      className="!h-9 !w-auto !py-0"
                      value={r.locationId}
                      onChange={(e) => update(rows.map((x) => (x.key === r.key ? { ...x, locationId: e.target.value } : x)))}
                      aria-label="Office"
                    >
                      {locations.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </Select>
                    <button type="button" onClick={() => update(rows.filter((x) => x.key !== r.key))} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Remove">
                      <Trash2 size={15} />
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
                  <Plus size={13} /> Add hours
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
          Save working hours
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            const monday = rows.filter((r) => r.weekday === 1);
            update([...rows.filter((r) => r.weekday === 1 || r.weekday === 0 || r.weekday === 6), ...[2, 3, 4, 5].flatMap((wd) => monday.map((m) => ({ ...m, key: ++seq, weekday: wd })))]);
          }}
        >
          <Copy size={14} /> Copy Monday to Tue–Fri
        </Button>
        {dirty ? <span className="text-xs font-medium text-amber-700">Unsaved changes</span> : null}
      </div>
    </div>
  );
}
