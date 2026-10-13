"use client";

import { ChevronLeft, ChevronRight, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { fmtDay, zonedDate } from "@/lib/datefmt";
import { addDays, diffDays } from "@/lib/time";
import { cx } from "../ui";

export type SlotDTO = {
  start: string;
  end: string;
  time: string;
  practitionerId: string;
  locationId: string;
};
export type PickedSlot = SlotDTO & { date: string };

type Availability = {
  dates: { date: string; slots: SlotDTO[] }[];
  nextAvailable: string | null;
};

const VISIBLE_PER_DAY = 8;



export function SlotPicker({
  clinicSlug,
  serviceId,
  practitionerId,
  locationId,
  timezone,
  today,
  maxAdvanceDays,
  practitionerNames,
  locationNames,
  selectedStart,
  onSelect,
  days = 7,
}: {
  clinicSlug: string;
  serviceId: string;
  practitionerId?: string;
  locationId?: string;
  timezone: string;
  today: string;
  maxAdvanceDays: number;
  practitionerNames?: Record<string, string>;
  /** Shown under each time when several offices are in play. */
  locationNames?: Record<string, string>;
  selectedStart?: string | null;
  onSelect: (slot: PickedSlot) => void;
  days?: number;
}) {
  const [from, setFrom] = useState(today);
  // The latest response, tagged with the query it answers; anything else means "loading".
  const [result, setResult] = useState<{ key: string; data?: Availability; error?: string } | null>(null);
  const [expanded, setExpanded] = useState<{ key: string; days: Record<string, boolean> }>({ key: "", days: {} });

  // A new service / practitioner / office starts again from today.
  const [queryKey, setQueryKey] = useState(`${serviceId}|${practitionerId}|${locationId}`);
  const currentKey = `${serviceId}|${practitionerId}|${locationId}`;
  if (queryKey !== currentKey) {
    setQueryKey(currentKey);
    setFrom(today);
  }

  const requestKey = `${clinicSlug}|${currentKey}|${from}|${days}`;
  const loading = result?.key !== requestKey;
  const data = result?.data ?? null;
  const error = !loading ? (result?.error ?? null) : null;
  const isExpanded = (date: string) => expanded.key === requestKey && expanded.days[date];

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ serviceId, from, days: String(days) });
    if (practitionerId) params.set("practitionerId", practitionerId);
    if (locationId) params.set("locationId", locationId);
    fetch(`/api/v1/clinics/${clinicSlug}/availability?${params}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.error?.message ?? "Could not load availability");
        return res.json() as Promise<Availability>;
      })
      .then((json) => setResult({ key: requestKey, data: json }))
      .catch((err: Error) => {
        if (err.name !== "AbortError") setResult({ key: requestKey, error: err.message });
      });
    return () => controller.abort();
  }, [clinicSlug, serviceId, practitionerId, locationId, from, days, requestKey]);

  const lastDay = addDays(today, maxAdvanceDays);
  const canPrev = from > today;
  const canNext = addDays(from, days) <= lastDay;
  const total = data?.dates.reduce((n, d) => n + d.slots.length, 0) ?? 0;
  const showNames = Boolean(!practitionerId && practitionerNames && Object.keys(practitionerNames).length > 1);
  const showOffices = Boolean(!locationId && locationNames && Object.keys(locationNames).length > 1);
  const caption = (s: SlotDTO) =>
    [showNames ? practitionerNames![s.practitionerId]?.split(" ").slice(-1)[0] : null, showOffices ? locationNames![s.locationId] : null]
      .filter(Boolean)
      .join(" · ");

  const jumpTo = (iso: string) => {
    const date = zonedDate(iso, timezone);
    // Keep the grid aligned on whole pages from today.
    const offset = Math.floor(diffDays(date, today) / days) * days;
    setFrom(addDays(today, offset));
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setFrom(addDays(from, -days) < today ? today : addDays(from, -days))}
          disabled={!canPrev || loading}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-40"
          aria-label="Previous days"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          {fmtDay(from, "short")} – {fmtDay(addDays(from, days - 1), "short")}
          {loading ? <LoaderCircle size={15} className="animate-spin text-slate-400" /> : null}
        </div>
        <button
          type="button"
          onClick={() => setFrom(addDays(from, days))}
          disabled={!canNext || loading}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-40"
          aria-label="Next days"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {error ? (
        <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>
      ) : (
        <div className={cx("relative transition-opacity", loading && "opacity-50")}>
          <div className="scrollbar-thin -mx-1 flex gap-2 overflow-x-auto px-1 pb-2 sm:grid sm:grid-cols-7 sm:overflow-visible">
            {(data?.dates ?? Array.from({ length: days }, (_, i) => ({ date: addDays(from, i), slots: [] }))).map(
              (d) => {
                const isOpen = isExpanded(d.date);
                const visible = isOpen ? d.slots : d.slots.slice(0, VISIBLE_PER_DAY);
                return (
                  <div key={d.date} className="min-w-[88px] flex-1 sm:min-w-0">
                    <div className="mb-2 text-center">
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        {d.date === today ? "Today" : fmtDay(d.date, "wd")}
                      </div>
                      <div className="text-sm font-bold text-slate-800">{fmtDay(d.date, "short")}</div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {visible.map((s) => {
                        const active = selectedStart === s.start;
                        return (
                          <button
                            key={`${s.start}-${s.practitionerId}`}
                            type="button"
                            onClick={() => onSelect({ ...s, date: d.date })}
                            className={cx(
                              "rounded-lg px-2 py-1.5 text-sm font-semibold transition-colors",
                              active
                                ? "bg-brand-700 text-white"
                                : "bg-brand-50 text-brand-800 hover:bg-brand-100",
                            )}
                            title={[practitionerNames?.[s.practitionerId], locationNames?.[s.locationId]].filter(Boolean).join(" · ") || undefined}
                          >
                            {s.time}
                            {showNames || showOffices ? (
                              <span className={cx("block truncate text-[10px] font-medium", active ? "text-white/80" : "text-brand-700/70")}>
                                {caption(s)}
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                      {d.slots.length > VISIBLE_PER_DAY && !isOpen ? (
                        <button
                          type="button"
                          onClick={() => setExpanded((e) => ({ key: requestKey, days: { ...(e.key === requestKey ? e.days : {}), [d.date]: true } }))}
                          className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100"
                        >
                          +{d.slots.length - VISIBLE_PER_DAY} more
                        </button>
                      ) : null}
                      {!loading && d.slots.length === 0 ? (
                        <div className="rounded-lg bg-slate-50 py-1.5 text-center text-sm text-slate-300">—</div>
                      ) : null}
                    </div>
                  </div>
                );
              },
            )}
          </div>
          {!loading && data && total === 0 ? (
            <div className="mt-3 rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-600">
              No free slots in these days.
              {data.nextAvailable ? (
                <>
                  {" "}
                  Next availability:{" "}
                  <button
                    type="button"
                    className="font-semibold text-brand-700 underline underline-offset-2"
                    onClick={() => jumpTo(data.nextAvailable!)}
                  >
                    {fmtDay(zonedDate(data.nextAvailable, timezone), "weekday")}
                  </button>
                </>
              ) : (
                " Try another practitioner or office, or join the waitlist below."
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
