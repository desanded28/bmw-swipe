"use client";

import { Ban, Check, ChevronLeft, ChevronRight, CircleAlert, Clock, Hourglass, Plus, UserX } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Fragment, useEffect, useRef, useState } from "react";
import { moveAppointment } from "@/app/dashboard/actions";
import { fmtDay } from "@/lib/datefmt";
import { addDays, minutesToHHMM } from "@/lib/time";
import { Button, Select, cx } from "../ui";
import { useNow } from "../useNow";
import { AppointmentDrawer, localDate, localTime, useRunAction } from "./AppointmentDrawer";
import { NewAppointmentDrawer, type NewAppointmentDefaults } from "./NewAppointmentDrawer";
import type { ApptDTO, Resources } from "./types";

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
  events: ApptDTO[];
  open: { start: number; end: number }[];
  blocks: { start: number; end: number; reason: string | null }[];
};

const HOUR_PX = 80;
const SNAP = 15;

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
function layout(events: ApptDTO[], tz: string) {
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

export function CalendarBoard(props: {
  resources: Resources;
  view: "day" | "week";
  date: string;
  days: string[];
  today: string;
  locationId: string;
  groupBy: "practitioner" | "room";
  selected: string[];
  showCancelled: boolean;
  appointments: ApptDTO[];
  hours: HoursWindow[];
  blocks: Block[];
  gridStart: number;
  gridEnd: number;
}) {
  const { resources, view, days, today, locationId, groupBy, selected, appointments, hours, blocks, gridStart, gridEnd } = props;
  const tz = resources.timezone;
  const router = useRouter();
  const sp = useSearchParams();
  const { run } = useRunAction();
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState<NewAppointmentDefaults | null>(null);
  const [pendingMove, setPendingMove] = useState<{ appt: ApptDTO; date: string; minutes: number; practitionerId?: string; roomId?: string; locationId: string } | null>(null);
  const now = useNow();
  const scroller = useRef<HTMLDivElement>(null);
  const scrolledFor = useRef<string | null>(null);

  // Scroll to the current time (or the morning) once per day/view — not on every refresh.
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
          title: fmtDay(date, "weekday"),
          events: dayAppts(date).filter((a) => ids.has(a.practitioner.id)),
          open: mergeIntervals(hours.filter((h) => h.date === date && ids.has(h.practitionerId) && inLocation(h.locationId))),
          blocks: blocksFor(
            date,
            (b) => (!b.practitionerId && !b.roomId && inLocation(b.locationId)) || (selected.length === 1 && b.practitionerId === selected[0]),
          ),
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
        cols.push({ key: "none", date, title: "No chair", events: unassigned, open: [], blocks: [], locationId: locationId === "all" ? undefined : locationId });
      return cols;
    }
    return visiblePractitioners
      .map((p) => {
        const pHours = hours.filter((h) => h.date === date && h.practitionerId === p.id && inLocation(h.locationId));
        const events = appts.filter((a) => a.practitioner.id === p.id && inLocation(a.location.id));
        const officeNames = [...new Set(pHours.map((h) => locationById.get(h.locationId)?.name).filter(Boolean))];
        return {
          key: p.id,
          date,
          title: p.name,
          subtitle: officeNames.length ? officeNames.join(" + ") : "Not working",
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

  const height = ((gridEnd - gridStart) / 60) * HOUR_PX;
  const yToMinutes = (y: number) => Math.max(gridStart, Math.min(gridEnd - SNAP, gridStart + Math.floor(((y / HOUR_PX) * 60) / SNAP) * SNAP));

  const locationForPractitionerAt = (practitionerId: string, date: string, minutes: number) =>
    hours.find((h) => h.practitionerId === practitionerId && h.date === date && h.start <= minutes && minutes < h.end)?.locationId;

  function onColumnClick(col: Column, e: React.MouseEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest("[data-event]")) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const minutes = yToMinutes(e.clientY - rect.top);
    const practitionerId = col.practitionerId ?? (selected.length === 1 ? selected[0] : undefined);
    setCreating({
      date: col.date,
      time: minutesToHHMM(minutes),
      practitionerId,
      roomId: col.roomId,
      locationId:
        col.locationId ??
        (practitionerId ? locationForPractitionerAt(practitionerId, col.date, minutes) : undefined) ??
        (locationId !== "all" ? locationId : resources.locations[0]?.id),
    });
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
    if (col.date === localDate(appt.start, tz) && minutes === minutesOf(appt.start, tz) && practitionerId === appt.practitioner.id && (!col.roomId || col.roomId === appt.room?.id)) return;
    setPendingMove({ appt, date: col.date, minutes, practitionerId: col.practitionerId, roomId: col.roomId, locationId: loc });
  }

  const label = view === "day" ? fmtDay(days[0], "long") : `${fmtDay(days[0], "short")} – ${fmtDay(days.at(-1)!, "short")} ${days.at(-1)!.slice(0, 4)}`;
  const step = view === "day" ? 1 : 7;
  const openAppt = appointments.find((a) => a.id === openId) ?? null;
  const counts = {
    total: appointments.filter((a) => a.status !== "cancelled").length,
    confirmed: appointments.filter((a) => a.status === "completed" || (a.status === "scheduled" && a.confirmation === "confirmed")).length,
    pending: appointments.filter((a) => a.status === "scheduled" && a.confirmation === "pending" && now !== null && Date.parse(a.start) > now).length,
  };

  return (
    <div className="flex h-[calc(100dvh-4rem)] min-h-[560px] flex-col lg:h-[calc(100dvh-4rem)]">
      {/* toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" onClick={() => navigate({ date: today })}>
          Today
        </Button>
        <div className="flex">
          <button type="button" aria-label="Previous" className="rounded-l-lg p-1.5 ring-1 ring-slate-200 hover:bg-white" onClick={() => navigate({ date: addDays(props.date, -step) })}>
            <ChevronLeft size={18} />
          </button>
          <button type="button" aria-label="Next" className="-ml-px rounded-r-lg p-1.5 ring-1 ring-slate-200 hover:bg-white" onClick={() => navigate({ date: addDays(props.date, step) })}>
            <ChevronRight size={18} />
          </button>
        </div>
        <h1 className="mr-1 text-lg font-bold">{label}</h1>
        <input
          type="date"
          aria-label="Go to date"
          value={props.date}
          onChange={(e) => e.target.value && navigate({ date: e.target.value })}
          className="h-8 rounded-lg px-2 text-sm ring-1 ring-slate-200"
        />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Segmented
            value={view}
            options={[
              ["day", "Day"],
              ["week", "Week"],
            ]}
            onChange={(v) => navigate({ view: v })}
          />
          {view === "day" ? (
            <Segmented
              value={groupBy}
              options={[
                ["practitioner", "By practitioner"],
                ["room", "By chair"],
              ]}
              onChange={(v) => navigate({ by: v })}
            />
          ) : null}
          <Select className="!h-8 !w-auto !py-0 !text-[13px]" value={locationId} onChange={(e) => navigate({ location: e.target.value === "all" ? null : e.target.value })} aria-label="Office">
            <option value="all">All offices</option>
            {resources.locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
          <label className="flex items-center gap-1.5 text-[13px] font-medium text-slate-600">
            <input type="checkbox" className="h-4 w-4 accent-brand-700" checked={props.showCancelled} onChange={(e) => navigate({ cancelled: e.target.checked ? "1" : null })} />
            Cancelled
          </label>
          <Button size="sm" onClick={() => setCreating({ date: props.date, time: "09:00", locationId: locationId !== "all" ? locationId : undefined, practitionerId: selected.length === 1 ? selected[0] : undefined })}>
            <Plus size={15} /> New
          </Button>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {resources.practitioners.map((p) => {
          const on = !selected.length || selected.includes(p.id);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                const next = selected.includes(p.id) ? selected.filter((x) => x !== p.id) : [...selected, p.id];
                navigate({ p: next.length && next.length < resources.practitioners.length ? next.join(",") : null });
              }}
              className={cx(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 transition",
                on ? "bg-white text-slate-800 ring-slate-300" : "bg-transparent text-slate-400 ring-slate-200",
              )}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: on ? p.color : "#cbd5e1" }} />
              {p.name}
            </button>
          );
        })}
        {selected.length ? (
          <button type="button" className="text-xs font-semibold text-slate-500 hover:text-ink" onClick={() => navigate({ p: null })}>
            Show all
          </button>
        ) : null}
        <span className="ml-auto text-xs text-slate-500">
          {counts.total} appointments · <span className="text-emerald-700">{counts.confirmed} confirmed or done</span>
          {counts.pending ? <> · {counts.pending} awaiting</> : null}
        </span>
      </div>

      {/* grid */}
      <div className="min-h-0 flex-1 overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-slate-200/70">
        {columns.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-10 text-center text-sm text-slate-500">
            <Ban size={28} className="text-slate-300" />
            Nobody is scheduled {view === "day" ? "on this day" : "this week"}
            {locationId !== "all" ? " at this office" : ""}.
            <button type="button" className="font-semibold text-brand-700" onClick={() => navigate({ date: addDays(props.date, step) })}>
              Next {view === "day" ? "day" : "week"} →
            </button>
          </div>
        ) : (
          <div ref={scroller} className="scrollbar-thin h-full overflow-auto">
            <div className="grid min-w-full" style={{ gridTemplateColumns: `56px repeat(${columns.length}, minmax(${view === "week" ? 120 : 170}px, 1fr))` }}>
              {/* header */}
              <div className="sticky left-0 top-0 z-30 border-b border-r border-slate-100 bg-white" />
              {columns.map((c) => (
                <div key={c.key} className={cx("sticky top-0 z-20 border-b border-r border-slate-100 px-3 py-2", c.date === today && view === "week" ? "bg-brand-50" : "bg-white")}>
                  <p className="flex items-center gap-1.5 truncate text-sm font-bold">
                    {c.color ? <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.color }} /> : null}
                    {c.title}
                  </p>
                  <p className="truncate text-[11px] font-medium text-slate-500">
                    {c.subtitle ?? `${c.events.filter((e) => e.status !== "cancelled").length} appointments`}
                  </p>
                </div>
              ))}

              {/* time gutter */}
              <div className="sticky left-0 z-10 border-r border-slate-100 bg-white" style={{ height }}>
                {Array.from({ length: (gridEnd - gridStart) / 60 }, (_, i) => (
                  <div key={i} className="relative" style={{ height: HOUR_PX }}>
                    <span className="absolute -top-2 right-2 text-[11px] font-medium text-slate-400">{i === 0 ? "" : minutesToHHMM(gridStart + i * 60)}</span>
                  </div>
                ))}
              </div>

              {columns.map((c) => {
                const lanes = layout(c.events, tz);
                const nowMinutes = now && c.date === today ? minutesOf(new Date(now).toISOString(), tz) : null;
                return (
                  <div
                    key={c.key}
                    className="relative cursor-copy border-r border-slate-100 bg-slate-50/80"
                    style={{
                      height,
                      backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${HOUR_PX - 1}px, rgb(226 232 240) ${HOUR_PX - 1}px, rgb(226 232 240) ${HOUR_PX}px)`,
                    }}
                    onClick={(e) => onColumnClick(c, e)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => onDrop(c, e)}
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
                        <span className="m-1 inline-block rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">{b.reason ?? "Unavailable"}</span>
                      </div>
                    ))}
                    {nowMinutes != null && nowMinutes >= gridStart && nowMinutes <= gridEnd ? (
                      <div className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-red-500" style={{ top: ((nowMinutes - gridStart) / 60) * HOUR_PX }}>
                        <span className="absolute -left-1 -top-[5px] h-2 w-2 rounded-full bg-red-500" />
                      </div>
                    ) : null}
                    {c.events.map((a) => {
                      const start = minutesOf(a.start, tz);
                      const end = Math.max(start + 15, minutesOf(a.end, tz) || 24 * 60);
                      const pos = lanes.get(a.id) ?? { lane: 0, lanes: 1 };
                      const color = a.practitioner.color;
                      const draggable = a.status === "scheduled" || a.status === "requested";
                      const short = end - start <= 20;
                      const bufferEnd = a.status === "cancelled" ? end : Math.max(end, minutesOf(a.blockedUntil, tz) || 24 * 60);
                      return (
                        <Fragment key={a.id}>
                        {bufferEnd > end ? (
                          <div
                            data-buffer
                            title="Cleanup buffer"
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
                          draggable={draggable}
                          onDragStart={(e) => {
                            e.dataTransfer.setData("text/appointment", a.id);
                            e.dataTransfer.setData("text/grab-offset", String(e.clientY - e.currentTarget.getBoundingClientRect().top));
                            e.dataTransfer.effectAllowed = "move";
                          }}
                          onClick={() => setOpenId(a.id)}
                          className={cx(
                            "absolute z-[5] overflow-hidden rounded-md border-l-[3px] px-1.5 text-left text-[12px] leading-tight shadow-sm transition hover:z-20 hover:shadow-md",
                            short ? "py-0.5" : "py-1",
                            a.status === "cancelled" && "opacity-50 line-through",
                            a.status === "completed" && "opacity-75",
                            a.status === "requested" && "outline-dashed outline-1 outline-amber-500",
                            a.needsAttention && "ring-2 ring-red-400",
                            draggable && "cursor-grab active:cursor-grabbing",
                          )}
                          style={{
                            top: ((start - gridStart) / 60) * HOUR_PX + 1,
                            height: ((end - start) / 60) * HOUR_PX - 2,
                            left: `calc(${(pos.lane / pos.lanes) * 100}% + 2px)`,
                            width: `calc(${100 / pos.lanes}% - 4px)`,
                            borderLeftColor: color,
                            background: a.status === "no_show" ? "#fee2e2" : `color-mix(in srgb, ${color} 13%, white)`,
                          }}
                          title={`${localTime(a.start, tz)}–${localTime(a.end, tz)} ${a.patient.name} · ${a.service.name} · ${a.practitioner.name}`}
                        >
                          <span className="flex items-center gap-1 font-semibold text-slate-800">
                            <StatusIcon a={a} />
                            <span className="truncate">
                              {localTime(a.start, tz)} {a.patient.name}
                            </span>
                          </span>
                          {!short ? (
                            <span className="block truncate text-slate-600">
                              {a.service.name}
                              {view === "week" || groupBy === "room" ? ` · ${a.practitioner.name.split(" ").slice(-1)[0]}` : ""}
                            </span>
                          ) : null}
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

      <div className="mt-2 flex flex-wrap gap-4 text-[11px] text-slate-500">
        <span className="flex items-center gap-1">
          <Check size={12} className="text-emerald-600" /> confirmed
        </span>
        <span className="flex items-center gap-1">
          <Clock size={12} /> awaiting confirmation
        </span>
        <span className="flex items-center gap-1">
          <Hourglass size={12} className="text-amber-600" /> online request
        </span>
        <span className="flex items-center gap-1">
          <CircleAlert size={12} className="text-red-500" /> patient replied — needs attention
        </span>
        <span className="flex items-center gap-1">
          <UserX size={12} className="text-red-500" /> no-show
        </span>
        <span>Click an empty slot to book · drag an appointment to move it</span>
      </div>

      {openAppt ? <AppointmentDrawer key={openAppt.id + openAppt.status + openAppt.confirmation + openAppt.start} appt={openAppt} resources={resources} onClose={() => setOpenId(null)} /> : null}
      {creating ? <NewAppointmentDrawer resources={resources} defaults={creating} onClose={() => setCreating(null)} /> : null}
      {pendingMove ? (
        <MoveDialog
          move={pendingMove}
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

function StatusIcon({ a }: { a: ApptDTO }) {
  if (a.needsAttention) return <CircleAlert size={12} className="shrink-0 text-red-500" />;
  if (a.status === "requested") return <Hourglass size={12} className="shrink-0 text-amber-600" />;
  if (a.status === "no_show") return <UserX size={12} className="shrink-0 text-red-500" />;
  if (a.status === "cancelled") return <Ban size={12} className="shrink-0 text-slate-400" />;
  if (a.confirmation === "confirmed" || a.status === "completed") return <Check size={12} className="shrink-0 text-emerald-600" />;
  return <Clock size={12} className="shrink-0 text-slate-400" />;
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-lg bg-slate-100 p-0.5">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={cx("rounded-md px-2.5 py-1 text-[13px] font-semibold", value === v ? "bg-white text-ink shadow-sm" : "text-slate-500 hover:text-ink")}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function MoveDialog({
  move,
  practitionerName,
  roomName,
  locationName,
  onCancel,
  onConfirm,
}: {
  move: { appt: ApptDTO; date: string; minutes: number };
  practitionerName: string;
  roomName?: string;
  locationName: string;
  onCancel: () => void;
  onConfirm: (notify: boolean, force: boolean) => void;
}) {
  const [notify, setNotify] = useState(true);
  const [force, setForce] = useState(false);
  const when = `${fmtDay(move.date, "medium")} at ${minutesToHHMM(move.minutes)}`;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4" onClick={onCancel}>
      <div className="animate-fade-up w-full max-w-md rounded-2xl bg-white p-6 shadow-pop" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold">Move appointment?</h2>
        <p className="mt-2 text-sm text-slate-600">
          <span className="font-semibold text-ink">{move.appt.patient.name}</span> — {move.appt.service.name}
        </p>
        <p className="mt-1 text-sm text-slate-600">
          to <span className="font-semibold text-ink">{when}</span> with {practitionerName}, {locationName}
          {roomName ? ` · ${roomName}` : ""}
        </p>
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-brand-700" checked={notify} onChange={(e) => setNotify(e.target.checked)} /> Notify the patient
        </label>
        <label className="mt-2 flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" className="h-4 w-4 accent-brand-700" checked={force} onChange={(e) => setForce(e.target.checked)} /> Allow overlap / outside working hours
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm(notify, force)}>Move</Button>
        </div>
      </div>
    </div>
  );
}
