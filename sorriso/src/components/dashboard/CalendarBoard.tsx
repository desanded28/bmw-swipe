"use client";

import { Ban, Check, ChevronLeft, ChevronRight, CircleAlert, Clock, Hourglass, Plus, UserX } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Fragment, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { moveAppointment } from "@/app/dashboard/actions/appointments";
import { capitalizeFirst, fmtDay, fmtWhen } from "@/i18n/datefmt";
import { useLocale, useT } from "@/i18n/provider";
import { addDays, minutesToHHMM, zonedToUtc } from "@/lib/time";
import { Button, Select, cx } from "../ui";
import { useNow } from "../useNow";
import { AppointmentDrawer, StatusIcon, localDate, localTime, useModalDialog, useStatusLabel } from "./AppointmentDrawer";
import { AppointmentList } from "./AppointmentList";
import { NewAppointmentDrawer, type NewAppointmentDefaults } from "./NewAppointmentDrawer";
import { Pii, PrivacyScreenToggle } from "./PrivacyScreen";
import { CalendarEventBadges } from "./slots/CalendarEventBadges";
import { toCareAppointment, type ApptListDTO, type Resources } from "./types";
import { useRunAction } from "./useRunAction";

export type HoursWindow = { practitionerId: string; locationId: string; date: string; start: number; end: number };
export type Block = {
  id: string;
  practitionerId: string | null;
  locationId: string | null;
  roomId: string | null;
  start: string;
  end: string;
  reason: string | null;
};

type Column = {
  key: string;
  date: string;
  title: string;
  subtitle?: string;
  color?: string;
  practitionerId?: string;
  roomId?: string;
  locationId?: string;
  events: ApptListDTO[];
  open: { start: number; end: number }[];
  blocks: { start: number; end: number; reason: string | null }[];
};

const HOUR_PX = 80;
/** Mouse clicks snap to 15 minutes; keyboard slots step by 30. */
const SNAP = 15;
const SLOT = 30;
/** WCAG 2.5.8 target size: no event is drawn shorter than this. */
const MIN_EVENT_PX = 24;

function minutesOf(iso: string, tz: string) {
  const [h, m] = localTime(iso, tz).split(":").map(Number);
  return h * 60 + m;
}

/** Clip an absolute interval to one local day, in minutes. */
function clipToDay(startIso: string, endIso: string, date: string, tz: string) {
  const sDate = localDate(startIso, tz);
  const eDate = localDate(endIso, tz);
  if (eDate < date || sDate > date) return null;
  const start = sDate < date ? 0 : minutesOf(startIso, tz);
  const end = eDate > date ? 24 * 60 : minutesOf(endIso, tz);
  return end > start ? { start, end } : null;
}

function mergeIntervals(list: { start: number; end: number }[]) {
  const sorted = [...list].sort((a, b) => a.start - b.start);
  const out: { start: number; end: number }[] = [];
  for (const i of sorted) {
    const last = out.at(-1);
    if (last && i.start <= last.end) last.end = Math.max(last.end, i.end);
    else out.push({ ...i });
  }
  return out;
}

/** Side-by-side lanes for overlapping events. */
function layout(events: ApptListDTO[], tz: string) {
  const items = events
    .map((e) => ({ e, start: minutesOf(e.start, tz), end: Math.max(minutesOf(e.start, tz) + 10, minutesOf(e.end, tz) || 24 * 60) }))
    .sort((a, b) => a.start - b.start || b.end - a.end);
  const result = new Map<string, { lane: number; lanes: number }>();
  let cluster: typeof items = [];
  let clusterEnd = -1;
  const flush = () => {
    const laneEnds: number[] = [];
    const assigned = cluster.map((it) => {
      let lane = laneEnds.findIndex((end) => end <= it.start);
      if (lane === -1) lane = laneEnds.length;
      laneEnds[lane] = it.end;
      return { it, lane };
    });
    for (const { it, lane } of assigned) result.set(it.e.id, { lane, lanes: laneEnds.length });
    cluster = [];
  };
  for (const it of items) {
    if (cluster.length && it.start >= clusterEnd) flush();
    cluster.push(it);
    clusterEnd = Math.max(clusterEnd, it.end);
  }
  if (cluster.length) flush();
  return result;
}

type PendingMove = { appt: ApptListDTO; date: string; minutes: number; practitionerId?: string; roomId?: string; locationId: string };

/**
 * The practice calendar: day (by practitioner or chair) or week, as a time grid or a list.
 *
 * Keyboard: each column has one tab stop on its empty slots (arrow keys move by 30 minutes and
 * across columns, Enter books there); every appointment is a button (Enter opens it,
 * Shift+Enter opens it on the reschedule form). Dragging is a shortcut, never the only way.
 */
export function CalendarBoard(props: {
  resources: Resources;
  view: "day" | "week";
  display: "grid" | "list";
  date: string;
  days: string[];
  today: string;
  locationId: string;
  groupBy: "practitioner" | "room";
  selected: string[];
  showCancelled: boolean;
  appointments: ApptListDTO[];
  hours: HoursWindow[];
  blocks: Block[];
  gridStart: number;
  gridEnd: number;
  /** The viewer may book and move (appointment.write). */
  canWrite: boolean;
}) {
  const { resources, view, display, days, today, locationId, groupBy, selected, appointments, hours, blocks, gridStart, gridEnd, canWrite } = props;
  const t = useT("calendar");
  const locale = useLocale();
  const statusLabel = useStatusLabel();
  const tz = resources.timezone;
  const router = useRouter();
  const sp = useSearchParams();
  const { run } = useRunAction();
  const hintId = useId();
  const [open, setOpen] = useState<{ id: string; panel: "move" | null } | null>(null);
  const [creating, setCreating] = useState<NewAppointmentDefaults | null>(null);
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
  /** The slot each column's keyboard cursor is on (minutes), and the column focused last. */
  const [cursor, setCursor] = useState<Record<string, number>>({});
  const [focusCol, setFocusCol] = useState<string | null>(null);
  const now = useNow();
  const scroller = useRef<HTMLDivElement>(null);
  const scrolledFor = useRef<string | null>(null);

  // Scroll to the current time (or the morning) once per day/view, not on every refresh.
  useEffect(() => {
    const el = scroller.current;
    const key = `${props.date}|${view}|${now !== null}`;
    if (!el || scrolledFor.current === key) return;
    scrolledFor.current = key;
    const target = days.includes(today) && now ? minutesOf(new Date(now).toISOString(), tz) - 90 : gridStart;
    el.scrollTop = Math.max(0, ((target - gridStart) / 60) * HOUR_PX);
  }, [props.date, view, now, days, today, tz, gridStart]);

  const navigate = (patch: Record<string, string | null>) => {
    const params = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") params.delete(k);
      else params.set(k, v);
    }
    router.push(`/dashboard/calendar?${params.toString()}`);
  };

  const practitionerById = new Map(resources.practitioners.map((p) => [p.id, p]));
  const locationById = new Map(resources.locations.map((l) => [l.id, l]));
  const visiblePractitioners = resources.practitioners.filter((p) => !selected.length || selected.includes(p.id));
  const inLocation = (id: string | null) => locationId === "all" || !id || id === locationId;

  const blocksFor = (date: string, match: (b: Block) => boolean) =>
    blocks
      .filter(match)
      .map((b) => {
        const clip = clipToDay(b.start, b.end, date, tz);
        return clip ? { ...clip, reason: b.reason } : null;
      })
      .filter((x): x is { start: number; end: number; reason: string | null } => Boolean(x));

  const columns: Column[] = (() => {
    const dayAppts = (date: string) => appointments.filter((a) => localDate(a.start, tz) === date);
    if (view === "week") {
      return days.map((date) => {
        const ids = new Set(visiblePractitioners.map((p) => p.id));
        return {
          key: date,
          date,
          title: capitalizeFirst(fmtDay(date, "weekday", locale), locale),
          events: dayAppts(date).filter((a) => ids.has(a.practitioner.id) && inLocation(a.location.id)),
          open: mergeIntervals(hours.filter((h) => h.date === date && ids.has(h.practitionerId) && inLocation(h.locationId))),
          blocks: blocksFor(
            date,
            (b) => (!b.practitionerId && !b.roomId && inLocation(b.locationId)) || (selected.length === 1 && b.practitionerId === selected[0]),
          ),
          practitionerId: selected.length === 1 ? selected[0] : undefined,
          locationId: locationId !== "all" ? locationId : undefined,
        };
      });
    }
    const date = days[0];
    const appts = dayAppts(date);
    if (groupBy === "room") {
      const roomList = resources.rooms.filter((r) => inLocation(r.locationId));
      const cols: Column[] = roomList.map((r) => ({
        key: r.id,
        date,
        title: r.name,
        subtitle: locationId === "all" ? locationById.get(r.locationId)?.name : undefined,
        roomId: r.id,
        locationId: r.locationId,
        events: appts.filter((a) => a.room?.id === r.id),
        open: mergeIntervals(hours.filter((h) => h.date === date && h.locationId === r.locationId)),
        blocks: blocksFor(date, (b) => b.roomId === r.id || (!b.practitionerId && !b.roomId && (!b.locationId || b.locationId === r.locationId))),
      }));
      const unassigned = appts.filter((a) => !a.room && inLocation(a.location.id));
      if (unassigned.length)
        cols.push({ key: "none", date, title: t("board.noChair"), events: unassigned, open: [], blocks: [], locationId: locationId === "all" ? undefined : locationId });
      return cols;
    }
    return visiblePractitioners
      .map((p) => {
        const pHours = hours.filter((h) => h.date === date && h.practitionerId === p.id && inLocation(h.locationId));
        const events = appts.filter((a) => a.practitioner.id === p.id && inLocation(a.location.id));
        const officeNames = [...new Set(pHours.map((h) => locationById.get(h.locationId)?.name).filter((n): n is string => Boolean(n)))];
        return {
          key: p.id,
          date,
          title: p.name,
          subtitle: officeNames.length ? officeNames.join(" + ") : t("board.notWorking"),
          color: p.color,
          practitionerId: p.id,
          locationId: pHours[0]?.locationId ?? (locationId !== "all" ? locationId : undefined),
          events,
          open: mergeIntervals(pHours),
          blocks: blocksFor(
            date,
            (b) =>
              b.practitionerId === p.id ||
              (!b.practitionerId && !b.roomId && (!b.locationId || pHours.some((h) => h.locationId === b.locationId))),
          ),
        };
      })
      .filter((c) => c.open.length || c.events.length || selected.includes(c.key));
  })();

  const shownIds = new Set(columns.flatMap((c) => c.events.map((e) => e.id)));
  const shown = appointments.filter((a) => shownIds.has(a.id));

  const height = ((gridEnd - gridStart) / 60) * HOUR_PX;
  const yToMinutes = (y: number) => Math.max(gridStart, Math.min(gridEnd - SNAP, gridStart + Math.floor(((y / HOUR_PX) * 60) / SNAP) * SNAP));
  const slotTimes = Array.from({ length: Math.floor((gridEnd - gridStart) / SLOT) }, (_, i) => gridStart + i * SLOT);

  const locationForPractitionerAt = (practitionerId: string, date: string, minutes: number) =>
    hours.find((h) => h.practitionerId === practitionerId && h.date === date && h.start <= minutes && minutes < h.end)?.locationId;

  /** Defaults for a booking at `minutes` in a column (practitioner, chair, office prefilled). */
  function defaultsFor(col: Column, minutes: number): NewAppointmentDefaults {
    const practitionerId = col.practitionerId ?? (selected.length === 1 ? selected[0] : undefined);
    return {
      date: col.date,
      time: minutesToHHMM(minutes),
      practitionerId,
      roomId: col.roomId,
      locationId:
        col.locationId ??
        (practitionerId ? locationForPractitionerAt(practitionerId, col.date, minutes) : undefined) ??
        (locationId !== "all" ? locationId : resources.locations[0]?.id),
    };
  }

  /** Where a column's keyboard cursor starts: the first working hour, else the grid's start. */
  const cursorOf = (col: Column) => cursor[col.key] ?? Math.max(gridStart, Math.floor((col.open[0]?.start ?? gridStart) / SLOT) * SLOT);

  function onColumnClick(col: Column, e: React.MouseEvent<HTMLDivElement>) {
    if (!canWrite || (e.target as HTMLElement).closest("[data-event]")) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setCreating(defaultsFor(col, yToMinutes(e.clientY - rect.top)));
  }

  function focusSlot(grid: HTMLElement | null, colKey: string, minutes: number) {
    setCursor((c) => ({ ...c, [colKey]: minutes }));
    setFocusCol(colKey);
    grid?.querySelector<HTMLElement>(`[data-slot="${CSS.escape(`${colKey}|${minutes}`)}"]`)?.focus();
  }

  function onSlotKey(e: KeyboardEvent<HTMLButtonElement>, colIndex: number, minutes: number) {
    const col = columns[colIndex];
    const last = slotTimes.at(-1) ?? gridStart;
    let next: { col: number; minutes: number } | null = null;
    if (e.key === "ArrowDown") next = { col: colIndex, minutes: Math.min(last, minutes + SLOT) };
    else if (e.key === "ArrowUp") next = { col: colIndex, minutes: Math.max(gridStart, minutes - SLOT) };
    else if (e.key === "Home") next = { col: colIndex, minutes: gridStart };
    else if (e.key === "End") next = { col: colIndex, minutes: last };
    else if (e.key === "ArrowRight") next = { col: Math.min(columns.length - 1, colIndex + 1), minutes };
    else if (e.key === "ArrowLeft") next = { col: Math.max(0, colIndex - 1), minutes };
    if (!next) return;
    e.preventDefault();
    focusSlot(e.currentTarget.closest<HTMLElement>("[data-calendar-grid]"), columns[next.col]?.key ?? col.key, next.minutes);
  }

  function onDrop(col: Column, e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/appointment");
    const grab = Number(e.dataTransfer.getData("text/grab-offset") || 0);
    const appt = appointments.find((a) => a.id === id);
    if (!appt) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const minutes = yToMinutes(e.clientY - rect.top - grab);
    const practitionerId = col.practitionerId ?? appt.practitioner.id;
    const loc =
      col.locationId && col.roomId
        ? col.locationId
        : (locationForPractitionerAt(practitionerId, col.date, minutes) ?? appt.location.id);
    if (
      col.date === localDate(appt.start, tz) &&
      minutes === minutesOf(appt.start, tz) &&
      practitionerId === appt.practitioner.id &&
      (!col.roomId || col.roomId === appt.room?.id)
    )
      return;
    setPendingMove({ appt, date: col.date, minutes, practitionerId: col.practitionerId, roomId: col.roomId, locationId: loc });
  }

  /** The toolbar's "New appointment": prefilled from the column (and slot) focused last. */
  function newFromToolbar() {
    const col = columns.find((c) => c.key === focusCol);
    if (col) return setCreating(defaultsFor(col, cursorOf(col)));
    setCreating({
      date: props.date,
      time: "09:00",
      locationId: locationId !== "all" ? locationId : undefined,
      practitionerId: selected.length === 1 ? selected[0] : undefined,
    });
  }

  const label =
    view === "day"
      ? capitalizeFirst(fmtDay(days[0], "long", locale), locale)
      : t("board.weekRange", { from: fmtDay(days[0], "short", locale), to: fmtDay(days.at(-1)!, "short", locale), year: days.at(-1)!.slice(0, 4) });
  const step = view === "day" ? 1 : 7;
  const openAppt = open ? (appointments.find((a) => a.id === open.id) ?? null) : null;
  const counts = {
    total: shown.filter((a) => a.status !== "cancelled").length,
    confirmed: shown.filter((a) => a.status === "completed" || (a.status === "scheduled" && a.confirmation === "confirmed")).length,
    pending: shown.filter((a) => a.status === "scheduled" && a.confirmation === "pending" && now !== null && Date.parse(a.start) > now).length,
  };
  // Week columns are days already; day columns name the practitioner or chair and the day.
  const columnLabel = (c: Column) =>
    view === "week" ? capitalizeFirst(fmtDay(c.date, "medium", locale), locale) : t("board.column", { title: c.title, date: fmtDay(c.date, "medium", locale) });

  return (
    <div className={cx("flex flex-col", display === "grid" && "h-[calc(100dvh-4rem)] min-h-[560px]")}>
      {/* toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-2" role="group" aria-label={t("board.toolbar")}>
        <Button variant="secondary" size="sm" onClick={() => navigate({ date: today })}>
          {t("board.today")}
        </Button>
        <div className="flex">
          <button
            type="button"
            aria-label={view === "day" ? t("board.previousDay") : t("board.previousWeek")}
            className="rounded-l-lg p-1.5 ring-1 ring-slate-300 hover:bg-white"
            onClick={() => navigate({ date: addDays(props.date, -step) })}
          >
            <ChevronLeft size={18} aria-hidden />
          </button>
          <button
            type="button"
            aria-label={view === "day" ? t("board.nextDay") : t("board.nextWeek")}
            className="-ml-px rounded-r-lg p-1.5 ring-1 ring-slate-300 hover:bg-white"
            onClick={() => navigate({ date: addDays(props.date, step) })}
          >
            <ChevronRight size={18} aria-hidden />
          </button>
        </div>
        <h1 className="mr-1 text-lg font-bold" aria-live="polite">
          {label}
        </h1>
        <input
          type="date"
          aria-label={t("board.goToDate")}
          value={props.date}
          onChange={(e) => e.target.value && navigate({ date: e.target.value })}
          className="h-8 rounded-lg px-2 text-sm ring-1 ring-slate-300"
        />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Segmented label={t("board.display")} value={display} options={[["grid", t("board.grid")], ["list", t("board.list")]]} onChange={(v) => navigate({ display: v === "list" ? "list" : null })} />
          <Segmented label={t("board.view")} value={view} options={[["day", t("board.day")], ["week", t("board.week")]]} onChange={(v) => navigate({ view: v })} />
          {view === "day" ? (
            <Segmented
              label={t("board.columns")}
              value={groupBy}
              options={[["practitioner", t("board.byPractitioner")], ["room", t("board.byChair")]]}
              onChange={(v) => navigate({ by: v })}
            />
          ) : null}
          <Select
            className="!h-8 !w-auto !py-0 !text-[13px]"
            value={locationId}
            onChange={(e) => navigate({ location: e.target.value === "all" ? null : e.target.value })}
            aria-label={t("board.office")}
          >
            <option value="all">{t("board.allOffices")}</option>
            {resources.locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
          <label className="flex items-center gap-1.5 text-[13px] font-medium text-slate-700">
            <input type="checkbox" className="h-4 w-4 accent-brand-700" checked={props.showCancelled} onChange={(e) => navigate({ cancelled: e.target.checked ? "1" : null })} />
            {t("board.showCancelled")}
          </label>
          <PrivacyScreenToggle />
          {canWrite ? (
            <Button size="sm" onClick={newFromToolbar}>
              <Plus size={15} aria-hidden /> {t("board.newAppointment")}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-1.5" role="group" aria-label={t("board.practitioners")}>
        {resources.practitioners.map((p) => {
          const on = !selected.length || selected.includes(p.id);
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={on}
              onClick={() => {
                const next = selected.includes(p.id) ? selected.filter((x) => x !== p.id) : [...selected, p.id];
                navigate({ p: next.length && next.length < resources.practitioners.length ? next.join(",") : null });
              }}
              className={cx(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 transition",
                on ? "bg-white text-slate-800 ring-slate-300" : "bg-transparent text-slate-600 ring-slate-200 line-through decoration-slate-400",
              )}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: on ? p.color : "#cbd5e1" }} aria-hidden />
              {p.name}
            </button>
          );
        })}
        {selected.length ? (
          <button type="button" className="text-xs font-semibold text-slate-600 hover:text-ink" onClick={() => navigate({ p: null })}>
            {t("board.showAll")}
          </button>
        ) : null}
        <p className="ml-auto text-xs text-slate-600">
          {t("board.total", { count: counts.total })}
          {" · "}
          <span className="text-emerald-800">{t("board.confirmedOrDone", { count: counts.confirmed })}</span>
          {counts.pending ? (
            <>
              {" · "}
              {t("board.awaiting", { count: counts.pending })}
            </>
          ) : null}
        </p>
      </div>

      {display === "list" ? (
        <AppointmentList appointments={shown} resources={resources} showDate quickActions={canWrite} empty={t("board.listEmpty")} />
      ) : (
        <div className="min-h-0 flex-1 overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-slate-200/70" role="region" aria-label={t("board.regionLabel")} aria-describedby={hintId}>
          {columns.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-10 text-center text-sm text-slate-600">
              <Ban size={28} className="text-slate-400" aria-hidden />
              <p>
                {view === "day"
                  ? locationId !== "all"
                    ? t("board.emptyDayOffice")
                    : t("board.emptyDay")
                  : locationId !== "all"
                    ? t("board.emptyWeekOffice")
                    : t("board.emptyWeek")}
              </p>
              <button type="button" className="font-semibold text-brand-700 hover:underline" onClick={() => navigate({ date: addDays(props.date, step) })}>
                {view === "day" ? t("board.goNextDay") : t("board.goNextWeek")}
              </button>
            </div>
          ) : (
            <div ref={scroller} data-calendar-grid className="scrollbar-thin h-full overflow-auto">
              <div className="grid min-w-full" style={{ gridTemplateColumns: `56px repeat(${columns.length}, minmax(${view === "week" ? 120 : 170}px, 1fr))` }}>
                {/* header */}
                <div className="sticky left-0 top-0 z-30 border-b border-r border-slate-100 bg-white" />
                {columns.map((c) => (
                  <div key={c.key} className={cx("sticky top-0 z-20 border-b border-r border-slate-100 px-3 py-2", c.date === today && view === "week" ? "bg-brand-50" : "bg-white")}>
                    <p className="flex items-center gap-1.5 truncate text-sm font-bold">
                      {c.color ? <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.color }} aria-hidden /> : null}
                      {c.title}
                    </p>
                    <p className="truncate text-[11px] font-medium text-slate-600">
                      {c.subtitle ?? t("board.columnCount", { count: c.events.filter((e) => e.status !== "cancelled").length })}
                    </p>
                  </div>
                ))}

                {/* time gutter */}
                <div className="sticky left-0 z-10 border-r border-slate-100 bg-white" style={{ height }} aria-hidden>
                  {Array.from({ length: (gridEnd - gridStart) / 60 }, (_, i) => (
                    <div key={i} className="relative" style={{ height: HOUR_PX }}>
                      <span className="absolute -top-2 right-2 text-[11px] font-medium text-slate-500">{i === 0 ? "" : minutesToHHMM(gridStart + i * 60)}</span>
                    </div>
                  ))}
                </div>

                {columns.map((c, colIndex) => {
                  const lanes = layout(c.events, tz);
                  const nowMinutes = now && c.date === today ? minutesOf(new Date(now).toISOString(), tz) : null;
                  const colCursor = cursorOf(c);
                  const colName = columnLabel(c);
                  return (
                    <div
                      key={c.key}
                      className={cx("relative border-r border-slate-100 bg-slate-50/80", canWrite && "cursor-copy")}
                      style={{
                        height,
                        backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${HOUR_PX - 1}px, rgb(226 232 240) ${HOUR_PX - 1}px, rgb(226 232 240) ${HOUR_PX}px)`,
                      }}
                      onClick={(e) => onColumnClick(c, e)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => onDrop(c, e)}
                      onFocus={() => setFocusCol(c.key)}
                    >
                      {c.open.map((o, i) => (
                        <div
                          key={i}
                          className="pointer-events-none absolute inset-x-0 bg-white"
                          style={{
                            top: ((Math.max(o.start, gridStart) - gridStart) / 60) * HOUR_PX,
                            height: ((Math.min(o.end, gridEnd) - Math.max(o.start, gridStart)) / 60) * HOUR_PX,
                            backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${HOUR_PX / 2 - 1}px, rgb(241 245 249) ${HOUR_PX / 2 - 1}px, rgb(241 245 249) ${HOUR_PX / 2}px)`,
                          }}
                        />
                      ))}
                      {c.blocks.map((b, i) => (
                        <div
                          key={`b${i}`}
                          className="bg-hatch pointer-events-none absolute inset-x-0 border-y border-slate-200"
                          style={{
                            top: ((Math.max(b.start, gridStart) - gridStart) / 60) * HOUR_PX,
                            height: ((Math.min(b.end, gridEnd) - Math.max(b.start, gridStart)) / 60) * HOUR_PX,
                          }}
                        >
                          <span className="m-1 inline-block rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">{b.reason ?? t("board.unavailable")}</span>
                        </div>
                      ))}
                      {canWrite
                        ? slotTimes.map((m) => {
                            const time = minutesToHHMM(m);
                            return (
                              <button
                                key={`s${m}`}
                                type="button"
                                data-slot={`${c.key}|${m}`}
                                tabIndex={m === colCursor ? 0 : -1}
                                aria-label={t("board.slot", { time, column: colName })}
                                className="group/slot pointer-events-none absolute inset-x-0 z-[3] flex items-start rounded-md px-1.5 py-0.5 text-left text-[11px] font-semibold text-brand-800 opacity-0 outline-none focus-visible:bg-brand-50/90 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-600"
                                style={{ top: ((m - gridStart) / 60) * HOUR_PX, height: (SLOT / 60) * HOUR_PX }}
                                onFocus={() => {
                                  setFocusCol(c.key);
                                  if (cursor[c.key] !== m) setCursor((cur) => ({ ...cur, [c.key]: m }));
                                }}
                                onKeyDown={(e) => onSlotKey(e, colIndex, m)}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCreating(defaultsFor(c, m));
                                }}
                              >
                                <Plus size={12} className="mr-0.5 mt-px" aria-hidden />
                                {time}
                              </button>
                            );
                          })
                        : null}
                      {nowMinutes != null && nowMinutes >= gridStart && nowMinutes <= gridEnd ? (
                        <div className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-red-600" style={{ top: ((nowMinutes - gridStart) / 60) * HOUR_PX }}>
                          <span className="absolute -left-1 -top-[5px] h-2 w-2 rounded-full bg-red-600" />
                          <span className="sr-only">{t("board.nowLine", { time: minutesToHHMM(nowMinutes) })}</span>
                        </div>
                      ) : null}
                      {c.events.map((a) => {
                        const start = minutesOf(a.start, tz);
                        const end = Math.max(start + 15, minutesOf(a.end, tz) || 24 * 60);
                        const pos = lanes.get(a.id) ?? { lane: 0, lanes: 1 };
                        const color = a.practitioner.color;
                        const movable = canWrite && (a.status === "scheduled" || a.status === "requested");
                        const px = Math.max(MIN_EVENT_PX, ((end - start) / 60) * HOUR_PX - 2);
                        const bufferEnd = a.status === "cancelled" ? end : Math.max(end, minutesOf(a.blockedUntil, tz) || 24 * 60);
                        const time = localTime(a.start, tz);
                        const status = statusLabel(a);
                        const withPractitioner = view === "week" || groupBy === "room";
                        const aria = withPractitioner
                          ? t("event.labelWithPractitioner", { time, patient: a.patient.name, service: a.service.name, practitioner: a.practitioner.name, status })
                          : t("event.label", { time, patient: a.patient.name, service: a.service.name, status });
                        const descId = `${hintId}-${a.id}`;
                        return (
                          <Fragment key={a.id}>
                            {bufferEnd > end ? (
                              <div
                                data-buffer
                                title={t("board.buffer")}
                                className="bg-hatch pointer-events-auto absolute z-[4] rounded-b-md"
                                style={{
                                  top: ((end - gridStart) / 60) * HOUR_PX,
                                  height: ((bufferEnd - end) / 60) * HOUR_PX - 1,
                                  left: `calc(${(pos.lane / pos.lanes) * 100}% + 2px)`,
                                  width: `calc(${100 / pos.lanes}% - 4px)`,
                                }}
                                onClick={(e) => e.stopPropagation()}
                              />
                            ) : null}
                            <button
                              type="button"
                              data-event
                              data-appt-id={a.id}
                              aria-label={aria}
                              aria-describedby={descId}
                              aria-keyshortcuts={movable ? "Shift+Enter" : undefined}
                              title={aria}
                              draggable={movable}
                              onDragStart={(e) => {
                                e.dataTransfer.setData("text/appointment", a.id);
                                e.dataTransfer.setData("text/grab-offset", String(e.clientY - e.currentTarget.getBoundingClientRect().top));
                                e.dataTransfer.effectAllowed = "move";
                              }}
                              onClick={() => setOpen({ id: a.id, panel: null })}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && e.shiftKey && movable) {
                                  e.preventDefault();
                                  setOpen({ id: a.id, panel: "move" });
                                }
                              }}
                              onFocus={() => setFocusCol(c.key)}
                              className={cx(
                                "group/pii absolute z-[5] min-h-6 overflow-hidden rounded-md border-l-[3px] px-1.5 text-left text-[12px] leading-tight shadow-sm transition hover:z-20 hover:shadow-md focus-visible:z-20",
                                px <= 30 ? "py-0.5" : "py-1",
                                a.status === "cancelled" && "opacity-60 line-through",
                                a.status === "completed" && "opacity-80",
                                a.status === "requested" && "outline-dashed outline-1 outline-amber-600",
                                a.needsAttention && "ring-2 ring-red-500",
                                movable && "cursor-grab active:cursor-grabbing",
                              )}
                              style={{
                                top: ((start - gridStart) / 60) * HOUR_PX + 1,
                                height: px,
                                left: `calc(${(pos.lane / pos.lanes) * 100}% + 2px)`,
                                width: `calc(${100 / pos.lanes}% - 4px)`,
                                borderLeftColor: color,
                                background: a.status === "no_show" ? "#fee2e2" : `color-mix(in srgb, ${color} 13%, white)`,
                              }}
                            >
                              <span className="flex items-center gap-1 font-semibold text-slate-900" aria-hidden>
                                <StatusIcon a={a} />
                                <span className="truncate">
                                  {time} <Pii>{a.patient.name}</Pii>
                                </span>
                              </span>
                              {px > 34 ? (
                                <span className="block truncate text-slate-700" aria-hidden>
                                  {a.service.name}
                                  {withPractitioner ? ` · ${a.practitioner.name.split(" ").slice(-1)[0]}` : ""}
                                  {/* Status as text as well as the icon (short events: on this line, cut first if narrow). */}
                                  {px <= 52 ? <span className="text-[11px] font-medium"> · {status}</span> : null}
                                </span>
                              ) : null}
                              {px > 52 ? (
                                <span className="block truncate text-[11px] font-medium text-slate-700" aria-hidden>
                                  {status}
                                </span>
                              ) : null}
                              <span id={descId} className="absolute bottom-0.5 right-1 flex items-center gap-0.5">
                                <CalendarEventBadges appt={toCareAppointment(a)} compact />
                                {a.hasNotes ? <span className="sr-only">{t("event.hasNotes")}</span> : null}
                              </span>
                            </button>
                          </Fragment>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600">
        <Legend icon={<Check size={12} className="text-emerald-700" aria-hidden />}>{t("legend.confirmed")}</Legend>
        <Legend icon={<Clock size={12} aria-hidden />}>{t("legend.awaiting")}</Legend>
        <Legend icon={<Hourglass size={12} className="text-amber-700" aria-hidden />}>{t("legend.request")}</Legend>
        <Legend icon={<CircleAlert size={12} className="text-red-600" aria-hidden />}>{t("legend.attention")}</Legend>
        <Legend icon={<UserX size={12} className="text-red-600" aria-hidden />}>{t("legend.noShow")}</Legend>
        <Legend icon={<Ban size={12} className="text-slate-500" aria-hidden />}>{t("legend.cancelled")}</Legend>
        <span id={hintId}>{canWrite ? t("board.hint") : null}</span>
      </div>

      {openAppt ? (
        <AppointmentDrawer key={openAppt.id} appt={openAppt} resources={resources} initialPanel={open?.panel ?? null} onClose={() => setOpen(null)} />
      ) : null}
      {creating ? <NewAppointmentDrawer resources={resources} defaults={creating} onClose={() => setCreating(null)} /> : null}
      {pendingMove ? (
        <MoveDialog
          move={pendingMove}
          tz={locationById.get(pendingMove.locationId)?.timezone ?? tz}
          practitionerName={practitionerById.get(pendingMove.practitionerId ?? pendingMove.appt.practitioner.id)?.name ?? ""}
          roomName={resources.rooms.find((r) => r.id === pendingMove.roomId)?.name}
          locationName={locationById.get(pendingMove.locationId)?.name ?? ""}
          onCancel={() => setPendingMove(null)}
          onConfirm={(notify, force) => {
            const m = pendingMove;
            run(
              () =>
                moveAppointment({
                  id: m.appt.id,
                  date: m.date,
                  time: minutesToHHMM(m.minutes),
                  practitionerId: m.practitionerId,
                  locationId: m.locationId,
                  roomId: m.roomId,
                  notifyPatient: notify,
                  force,
                }),
              (r) => {
                if (r.ok) setPendingMove(null);
              },
            );
          }}
        />
      ) : null}
    </div>
  );
}

function Legend({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="flex items-center gap-1">
      {icon}
      {children}
    </span>
  );
}

/** A small group of toggle buttons (aria-pressed) with an accessible group name. */
function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-lg bg-slate-100 p-0.5" role="group" aria-label={label}>
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={cx("rounded-md px-2.5 py-1 text-[13px] font-semibold", value === v ? "bg-white text-ink shadow-sm" : "text-slate-600 hover:text-ink")}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

/** Confirmation after dragging an appointment to a new place (a modal <dialog>). */
function MoveDialog({
  move,
  tz,
  practitionerName,
  roomName,
  locationName,
  onCancel,
  onConfirm,
}: {
  move: PendingMove;
  tz: string;
  practitionerName: string;
  roomName?: string;
  locationName: string;
  onCancel: () => void;
  onConfirm: (notify: boolean, force: boolean) => void;
}) {
  const t = useT("calendar");
  const tc = useT("common");
  const locale = useLocale();
  const titleId = useId();
  const { ref, props: dialogProps } = useModalDialog(onCancel, `[data-appt-id="${move.appt.id}"]`);
  const [notify, setNotify] = useState(true);
  const [force, setForce] = useState(false);
  const when = fmtWhen(zonedToUtc(move.date, move.minutes, tz), tz, locale);
  const vars = { when, practitioner: practitionerName, office: locationName };
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl bg-white p-6 text-ink shadow-pop backdrop:bg-slate-900/30 open:animate-fade-up"
      {...dialogProps}
    >
      <h2 id={titleId} className="text-lg font-bold">
        {t("move.title")}
      </h2>
      <p className="group/pii mt-2 text-sm text-slate-700">
        <Pii className="font-semibold text-ink">{t("move.summary", { patient: move.appt.patient.name, service: move.appt.service.name })}</Pii>
      </p>
      <p className="mt-1 text-sm text-slate-700">{roomName ? t("move.toChair", { ...vars, chair: roomName }) : t("move.to", vars)}</p>
      <label className="mt-4 flex items-center gap-2 text-sm">
        <input type="checkbox" className="h-4 w-4 accent-brand-700" checked={notify} onChange={(e) => setNotify(e.target.checked)} /> {t("move.notify")}
      </label>
      <label className="mt-2 flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" className="h-4 w-4 accent-brand-700" checked={force} onChange={(e) => setForce(e.target.checked)} /> {t("move.force")}
      </label>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          {tc("actions.cancel")}
        </Button>
        <Button data-autofocus onClick={() => onConfirm(notify, force)}>
          {t("move.confirm")}
        </Button>
      </div>
    </dialog>
  );
}
