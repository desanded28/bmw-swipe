"use client";

import { ChevronLeft, ChevronRight, LoaderCircle } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { fmtDay, zonedDate } from "@/i18n/datefmt";
import { rich } from "@/i18n/rich";
import { useLocale, useT } from "@/i18n/provider";
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

export type Availability = {
  dates: { date: string; slots: SlotDTO[] }[];
  nextAvailable: string | null;
};

const VISIBLE_PER_DAY = 8;

/**
 * A week of free times. Each day is a labelled group; each time is a toggle button whose name reads
 * the whole slot ("Wednesday 15 October, 10:30, Dr. Rossi"), since the visual grid gives the day and
 * practitioner only by position. Loading, results and range changes are announced through one
 * polite status region; navigation buttons stay focusable while loading (aria-disabled), so keyboard
 * focus is never dropped.
 */
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
  initialData,
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
  /** The first week (from `today`), already loaded on the server: rendered at once, not fetched again. */
  initialData?: Availability;
}) {
  const t = useT("booking");
  const te = useT("errors");
  const locale = useLocale();
  const uid = useId();
  const [from, setFrom] = useState(today);
  const firstKey = `${clinicSlug}|${serviceId}|${practitionerId}|${locationId}|${today}|${days}|0`;
  // The latest response, tagged with the query it answers; anything else means "loading".
  const [result, setResult] = useState<{ key: string; data?: Availability; error?: boolean } | null>(
    initialData ? { key: firstKey, data: initialData } : null,
  );
  /** The request already answered by initialData: the first effect run skips it. */
  const prefetched = useRef(initialData ? firstKey : null);
  const [expanded, setExpanded] = useState<{ key: string; days: Record<string, boolean> }>({ key: "", days: {} });
  const [attempt, setAttempt] = useState(0);
  /** A slot button to focus once rendered (after "+N more" replaced itself with the extra times). */
  const [focusTarget, setFocusTarget] = useState<string | null>(null);

  // A new service / practitioner / office starts again from today.
  const [queryKey, setQueryKey] = useState(`${serviceId}|${practitionerId}|${locationId}`);
  const currentKey = `${serviceId}|${practitionerId}|${locationId}`;
  if (queryKey !== currentKey) {
    setQueryKey(currentKey);
    setFrom(today);
  }

  const requestKey = `${clinicSlug}|${currentKey}|${from}|${days}|${attempt}`;
  const loading = result?.key !== requestKey;
  const data = loading ? null : (result?.data ?? null);
  const failed = !loading && Boolean(result?.error);
  const isExpanded = (date: string) => expanded.key === requestKey && expanded.days[date];

  useEffect(() => {
    if (prefetched.current === requestKey) {
      prefetched.current = null;
      return;
    }
    const controller = new AbortController();
    const params = new URLSearchParams({ serviceId, from, days: String(days) });
    if (practitionerId) params.set("practitionerId", practitionerId);
    if (locationId) params.set("locationId", locationId);
    fetch(`/api/v1/clinics/${clinicSlug}/availability?${params}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<Availability>;
      })
      .then((json) => setResult({ key: requestKey, data: json }))
      .catch((err: Error) => {
        if (err.name !== "AbortError") setResult({ key: requestKey, error: true });
      });
    return () => controller.abort();
  }, [clinicSlug, serviceId, practitionerId, locationId, from, days, requestKey]);

  useEffect(() => {
    if (!focusTarget) return;
    document.getElementById(focusTarget)?.focus();
  }, [focusTarget]);

  const lastDay = addDays(today, maxAdvanceDays);
  const to = addDays(from, days - 1);
  const canPrev = from > today;
  const canNext = addDays(from, days) <= lastDay;
  const total = data?.dates.reduce((n, d) => n + d.slots.length, 0) ?? 0;
  const showNames = Boolean(!practitionerId && practitionerNames && Object.keys(practitionerNames).length > 1);
  const showOffices = Boolean(!locationId && locationNames && Object.keys(locationNames).length > 1);
  const range = { from: fmtDay(from, "short", locale), to: fmtDay(to, "short", locale) };

  const caption = (s: SlotDTO) =>
    [showNames ? practitionerNames![s.practitionerId]?.split(" ").slice(-1)[0] : null, showOffices ? locationNames![s.locationId] : null]
      .filter(Boolean)
      .join(" · ");

  /** The full reading of a slot: day, date, time, and who (and where, when several offices are offered). */
  const slotLabel = (date: string, s: SlotDTO) => {
    const day = fmtDay(date, "medium", locale);
    const name = practitionerNames?.[s.practitionerId];
    const office = showOffices ? locationNames?.[s.locationId] : undefined;
    if (!name) return t("slots.slotLabelPlain", { date: day, time: s.time });
    const who = office ? t("slots.whoAt", { name, office }) : name;
    return t("slots.slotLabel", { date: day, time: s.time, who });
  };

  const status = loading
    ? t("slots.loading")
    : failed
      ? ""
      : total > 0
        ? t("slots.loaded", { count: total, ...range })
        : t("slots.none", range);

  const jumpTo = (iso: string) => {
    const date = zonedDate(iso, timezone);
    // Keep the grid aligned on whole pages from today.
    const offset = Math.floor(diffDays(date, today) / days) * days;
    setFrom(addDays(today, offset));
  };

  const navButton =
    "inline-flex h-10 w-10 items-center justify-center rounded-full bg-white ring-1 ring-line-strong hover:bg-slate-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-40";

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => {
            if (canPrev && !loading) setFrom(addDays(from, -days) < today ? today : addDays(from, -days));
          }}
          aria-disabled={!canPrev || loading}
          className={navButton}
          aria-label={t("slots.previous")}
        >
          <ChevronLeft size={18} aria-hidden />
        </button>
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          {t("slots.range", range)}
          {loading ? <LoaderCircle size={15} className="animate-spin text-slate-500" aria-hidden /> : null}
        </p>
        <button
          type="button"
          onClick={() => {
            if (canNext && !loading) setFrom(addDays(from, days));
          }}
          aria-disabled={!canNext || loading}
          className={navButton}
          aria-label={t("slots.next")}
        >
          <ChevronRight size={18} aria-hidden />
        </button>
      </div>

      <p role="status" className="sr-only">
        {status}
      </p>

      {failed ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-red-50 p-4 text-sm text-red-700">
          {te("slotsLoadFailed")}
          <button
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
            className="rounded-lg bg-white px-3 py-1.5 font-semibold text-red-700 ring-1 ring-red-200 hover:bg-red-50"
          >
            {t("slots.retry")}
          </button>
        </div>
      ) : (
        <div className={cx("relative transition-opacity", loading && "opacity-60")} aria-busy={loading}>
          <div className="scrollbar-thin -mx-1 flex gap-2 overflow-x-auto px-1 pb-2 sm:grid sm:grid-cols-7 sm:overflow-visible">
            {(data?.dates ?? Array.from({ length: days }, (_, i) => ({ date: addDays(from, i), slots: [] as SlotDTO[] }))).map(
              (d) => {
                const isOpen = isExpanded(d.date);
                const visible = isOpen ? d.slots : d.slots.slice(0, VISIBLE_PER_DAY);
                const headerId = `${uid}-day-${d.date}`;
                const hiddenCount = d.slots.length - VISIBLE_PER_DAY;
                return (
                  <div key={d.date} role="group" aria-labelledby={headerId} className="min-w-[88px] flex-1 sm:min-w-0">
                    <p id={headerId} className="mb-2 text-center">
                      <span className="block text-xs font-medium uppercase tracking-wide text-slate-600">
                        {d.date === today ? t("slots.today") : fmtDay(d.date, "wd", locale)}
                      </span>
                      <span className="block text-sm font-bold text-slate-800">{fmtDay(d.date, "short", locale)}</span>
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {visible.map((s, i) => {
                        const active = selectedStart === s.start;
                        const text = caption(s);
                        return (
                          <button
                            key={`${s.start}-${s.practitionerId}-${s.locationId}`}
                            id={`${uid}-slot-${d.date}-${i}`}
                            type="button"
                            onClick={() => onSelect({ ...s, date: d.date })}
                            aria-pressed={active}
                            aria-label={slotLabel(d.date, s)}
                            className={cx(
                              "min-h-10 rounded-lg px-2 py-1.5 text-sm font-semibold transition-colors",
                              active ? "bg-brand-700 text-white" : "bg-brand-50 text-brand-800 hover:bg-brand-100",
                            )}
                          >
                            {s.time}
                            {showNames || showOffices ? (
                              <span className={cx("block truncate text-[11px] font-medium", active ? "text-white" : "text-brand-800")}>
                                {text}
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                      {hiddenCount > 0 && !isOpen ? (
                        <button
                          type="button"
                          onClick={() => {
                            setExpanded((e) => ({ key: requestKey, days: { ...(e.key === requestKey ? e.days : {}), [d.date]: true } }));
                            setFocusTarget(`${uid}-slot-${d.date}-${VISIBLE_PER_DAY}`);
                          }}
                          aria-label={t("slots.moreLabel", { count: hiddenCount, date: fmtDay(d.date, "medium", locale) })}
                          className="min-h-9 rounded-lg px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                        >
                          {t("slots.more", { count: hiddenCount })}
                        </button>
                      ) : null}
                      {!loading && d.slots.length === 0 ? (
                        <p className="rounded-lg bg-slate-50 py-1.5 text-center text-sm text-slate-500">
                          <span aria-hidden>—</span>
                          <span className="sr-only">{t("slots.noneDay")}</span>
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              },
            )}
          </div>
          {!loading && data && total === 0 ? (
            <div className="mt-3 rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-700">
              {data.nextAvailable
                ? rich(
                    t,
                    "slots.emptyNext",
                    {
                      next: (chunk) => (
                        <button
                          type="button"
                          className="font-semibold text-brand-700 underline underline-offset-2"
                          onClick={() => jumpTo(data.nextAvailable!)}
                        >
                          {chunk}
                        </button>
                      ),
                    },
                    { date: fmtDay(zonedDate(data.nextAvailable, timezone), "medium", locale) },
                  )
                : t("slots.emptyHint")}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
