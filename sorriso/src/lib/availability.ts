import { and, asc, eq, gt, inArray, lt, ne } from "drizzle-orm";
import { db, type Tx } from "@/db";
import {
  appointments,
  locations,
  organizations,
  practitionerServices,
  practitioners,
  rooms,
  schedules,
  services,
  timeOff,
  type Location,
  type OrgSettings,
  type Organization,
  type Practitioner,
  type Room,
  type Schedule,
  type Service,
  type TimeOff,
} from "@/db/schema";
import { resolveSettings } from "./settings";
import { addDays, addMinutes, weekdayOf, zonedParts, zonedToUtc } from "./time";

/**
 * Availability engine.
 *
 * A slot is bookable when:
 *   1. the practitioner has working hours at that location covering it,
 *   2. the practitioner has no other appointment (at ANY location) overlapping it,
 *      including cleanup buffers on both sides,
 *   3. no time-off applies (practitioner, location-wide, or org-wide closure),
 *   4. a chair/room at the location is free for the whole duration (if the service needs one),
 *   5. booking policy allows it (minimum notice, maximum advance) — online only.
 */

export type Slot = {
  start: Date;
  end: Date;
  practitionerId: string;
  locationId: string;
  roomId: string | null;
};

type BusyAppointment = {
  id: string;
  practitionerId: string;
  locationId: string;
  roomId: string | null;
  startsAt: Date;
  blockedUntil: Date;
};

export type AvailabilityContext = {
  org: Organization;
  settings: OrgSettings;
  service: Service;
  practitioners: Practitioner[];
  locations: Map<string, Location>;
  schedules: Schedule[];
  appointments: BusyAppointment[];
  timeOff: TimeOff[];
  roomsByLocation: Map<string, Room[]>;
};

export type SlotRejection =
  | "in_past"
  | "too_soon"
  | "too_far"
  | "outside_hours"
  | "practitioner_busy"
  | "time_off"
  | "no_room"
  | "not_offered";

export const REJECTION_LABELS: Record<SlotRejection, string> = {
  in_past: "That time is in the past.",
  too_soon: "That time is too soon to book online.",
  too_far: "That time is too far in the future to book online.",
  outside_hours: "The practitioner doesn't work at this location at that time.",
  practitioner_busy: "The practitioner already has an appointment at that time.",
  time_off: "The practitioner or office is unavailable (time off / closure).",
  no_room: "No chair is free at this office at that time.",
  not_offered: "This practitioner doesn't offer that service.",
};

export async function loadAvailabilityContext(
  params: {
    orgId: string;
    serviceId: string;
    practitionerIds?: string[];
    locationId?: string;
    rangeStart: Date;
    rangeEnd: Date;
    /** Online: only practitioners linked to the service. Staff can override. */
    requireServiceLink?: boolean;
  },
  tx: Tx = db,
): Promise<AvailabilityContext | null> {
  const { orgId, serviceId, rangeStart, rangeEnd } = params;
  const requireServiceLink = params.requireServiceLink ?? true;

  const [org] = await tx.select().from(organizations).where(eq(organizations.id, orgId));
  const [service] = await tx
    .select()
    .from(services)
    .where(and(eq(services.id, serviceId), eq(services.orgId, orgId)));
  if (!org || !service) return null;

  let practitionerRows: Practitioner[];
  if (requireServiceLink) {
    practitionerRows = await tx
      .select({ p: practitioners })
      .from(practitioners)
      .innerJoin(practitionerServices, eq(practitionerServices.practitionerId, practitioners.id))
      .where(
        and(
          eq(practitioners.orgId, orgId),
          eq(practitioners.active, true),
          eq(practitionerServices.serviceId, serviceId),
        ),
      )
      .orderBy(asc(practitioners.name))
      .then((rows) => rows.map((r) => r.p));
  } else {
    practitionerRows = await tx
      .select()
      .from(practitioners)
      .where(and(eq(practitioners.orgId, orgId), eq(practitioners.active, true)))
      .orderBy(asc(practitioners.name));
  }
  if (params.practitionerIds?.length) {
    const wanted = new Set(params.practitionerIds);
    practitionerRows = practitionerRows.filter((p) => wanted.has(p.id));
  }

  const locationRows = await tx
    .select()
    .from(locations)
    .where(and(eq(locations.orgId, orgId), eq(locations.active, true)));
  const locationMap = new Map(
    locationRows.filter((l) => !params.locationId || l.id === params.locationId).map((l) => [l.id, l]),
  );

  const practitionerIds = practitionerRows.map((p) => p.id);
  const scheduleRows = practitionerIds.length
    ? (await tx.select().from(schedules).where(inArray(schedules.practitionerId, practitionerIds))).filter((s) =>
        locationMap.has(s.locationId),
      )
    : [];

  // All live appointments in the org overlapping the range: needed for practitioner
  // conflicts at other offices and for chair occupancy by other practitioners.
  const appointmentRows = await tx
    .select({
      id: appointments.id,
      practitionerId: appointments.practitionerId,
      locationId: appointments.locationId,
      roomId: appointments.roomId,
      startsAt: appointments.startsAt,
      blockedUntil: appointments.blockedUntil,
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.orgId, orgId),
        ne(appointments.status, "cancelled"),
        lt(appointments.startsAt, rangeEnd),
        gt(appointments.blockedUntil, rangeStart),
      ),
    );

  const timeOffRows = await tx
    .select()
    .from(timeOff)
    .where(and(eq(timeOff.orgId, orgId), lt(timeOff.startsAt, rangeEnd), gt(timeOff.endsAt, rangeStart)));

  const locationIds = [...locationMap.keys()];
  const roomRows = locationIds.length
    ? await tx
        .select()
        .from(rooms)
        .where(and(inArray(rooms.locationId, locationIds), eq(rooms.active, true)))
        .orderBy(asc(rooms.name))
    : [];
  const roomsByLocation = new Map<string, Room[]>();
  for (const r of roomRows) {
    const list = roomsByLocation.get(r.locationId) ?? [];
    list.push(r);
    roomsByLocation.set(r.locationId, list);
  }

  return {
    org,
    settings: resolveSettings(org.settings),
    service,
    practitioners: practitionerRows,
    locations: locationMap,
    schedules: scheduleRows,
    appointments: appointmentRows,
    timeOff: timeOffRows,
    roomsByLocation,
  };
}

function scheduleValidOn(s: Schedule, date: string): boolean {
  if (s.validFrom && date < s.validFrom) return false;
  if (s.validUntil && date > s.validUntil) return false;
  return true;
}

function intervalsOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && bStart < aEnd;
}

export type EvaluateInput = {
  practitionerId: string;
  locationId: string;
  start: Date;
  /** Defaults to service duration. */
  durationMinutes?: number;
  roomId?: string | null;
  ignoreAppointmentId?: string;
  requireWorkingHours?: boolean;
  enforcePolicy?: boolean;
  now?: Date;
};

export type Evaluation = { ok: true; roomId: string | null } | { ok: false; reason: SlotRejection };

/** Check a single candidate slot against everything we know. */
export function evaluateSlot(ctx: AvailabilityContext, input: EvaluateInput): Evaluation {
  const now = input.now ?? new Date();
  const duration = input.durationMinutes ?? ctx.service.durationMinutes;
  const start = input.start.getTime();
  const end = start + duration * 60_000;
  const blockEnd = end + ctx.service.bufferMinutes * 60_000;
  const location = ctx.locations.get(input.locationId);

  if (input.enforcePolicy) {
    if (start < now.getTime()) return { ok: false, reason: "in_past" };
    if (start < now.getTime() + ctx.settings.booking.minNoticeMinutes * 60_000) return { ok: false, reason: "too_soon" };
    if (start > now.getTime() + ctx.settings.booking.maxAdvanceDays * 86_400_000) return { ok: false, reason: "too_far" };
  }

  if (!ctx.practitioners.some((p) => p.id === input.practitionerId)) return { ok: false, reason: "not_offered" };

  if (input.requireWorkingHours) {
    if (!location) return { ok: false, reason: "outside_hours" };
    const s = zonedParts(input.start, location.timezone);
    const e = zonedParts(new Date(end), location.timezone);
    const endMinutes = e.date === s.date ? e.minutes : e.minutes + 24 * 60;
    const covered = ctx.schedules.some(
      (sch) =>
        sch.practitionerId === input.practitionerId &&
        sch.locationId === input.locationId &&
        sch.weekday === s.weekday &&
        scheduleValidOn(sch, s.date) &&
        sch.startMinute <= s.minutes &&
        endMinutes <= sch.endMinute,
    );
    if (!covered) return { ok: false, reason: "outside_hours" };
  }

  const practitionerBusy = ctx.appointments.some(
    (a) =>
      a.id !== input.ignoreAppointmentId &&
      a.practitionerId === input.practitionerId &&
      intervalsOverlap(start, blockEnd, a.startsAt.getTime(), a.blockedUntil.getTime()),
  );
  if (practitionerBusy) return { ok: false, reason: "practitioner_busy" };

  const blockedByTimeOff = ctx.timeOff.some(
    (t) =>
      intervalsOverlap(start, blockEnd, t.startsAt.getTime(), t.endsAt.getTime()) &&
      !t.roomId &&
      (t.practitionerId === input.practitionerId ||
        (!t.practitionerId && (!t.locationId || t.locationId === input.locationId))),
  );
  if (blockedByTimeOff) return { ok: false, reason: "time_off" };

  if (!ctx.service.requiresRoom) return { ok: true, roomId: null };
  const locationRooms = ctx.roomsByLocation.get(input.locationId) ?? [];
  if (locationRooms.length === 0) return { ok: true, roomId: null };

  const roomFree = (roomId: string) =>
    !ctx.appointments.some(
      (a) =>
        a.id !== input.ignoreAppointmentId &&
        a.roomId === roomId &&
        intervalsOverlap(start, blockEnd, a.startsAt.getTime(), a.blockedUntil.getTime()),
    ) &&
    !ctx.timeOff.some(
      (t) => t.roomId === roomId && intervalsOverlap(start, blockEnd, t.startsAt.getTime(), t.endsAt.getTime()),
    );

  if (input.roomId) {
    return roomFree(input.roomId) ? { ok: true, roomId: input.roomId } : { ok: false, reason: "no_room" };
  }
  const room = locationRooms.find((r) => roomFree(r.id));
  return room ? { ok: true, roomId: room.id } : { ok: false, reason: "no_room" };
}

/** Generate every bookable slot between fromDate and fromDate + days (exclusive). */
export function findSlots(
  ctx: AvailabilityContext,
  opts: { fromDate: string; days: number; now?: Date; enforcePolicy?: boolean; stepMinutes?: number },
): Slot[] {
  const now = opts.now ?? new Date();
  const step = Math.max(5, opts.stepMinutes ?? ctx.settings.booking.slotStepMinutes);
  const duration = ctx.service.durationMinutes;
  const out: Slot[] = [];

  for (let i = 0; i < opts.days; i++) {
    const date = addDays(opts.fromDate, i);
    const weekday = weekdayOf(date);
    for (const sch of ctx.schedules) {
      if (sch.weekday !== weekday || !scheduleValidOn(sch, date)) continue;
      const location = ctx.locations.get(sch.locationId);
      if (!location) continue;
      for (let m = sch.startMinute; m + duration <= sch.endMinute; m += step) {
        const start = zonedToUtc(date, m, location.timezone);
        const res = evaluateSlot(ctx, {
          practitionerId: sch.practitionerId,
          locationId: sch.locationId,
          start,
          enforcePolicy: opts.enforcePolicy ?? true,
          requireWorkingHours: false, // we're iterating inside working hours already
          now,
        });
        if (res.ok) {
          out.push({
            start,
            end: addMinutes(start, duration),
            practitionerId: sch.practitionerId,
            locationId: sch.locationId,
            roomId: res.roomId,
          });
        }
      }
    }
  }

  out.sort((a, b) => a.start.getTime() - b.start.getTime() || a.practitionerId.localeCompare(b.practitionerId));
  // Overlapping schedule rows could yield duplicates; keep the first.
  const seen = new Set<string>();
  return out.filter((s) => {
    const key = `${s.practitionerId}|${s.locationId}|${s.start.getTime()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Pad the queried range so locations in other time zones are fully covered. */
export function rangeForDates(fromDate: string, days: number, tz: string) {
  return {
    rangeStart: new Date(zonedToUtc(fromDate, 0, tz).getTime() - 86_400_000),
    rangeEnd: new Date(zonedToUtc(addDays(fromDate, days), 0, tz).getTime() + 86_400_000),
  };
}

export async function getAvailability(
  params: {
    orgId: string;
    serviceId: string;
    fromDate: string;
    days: number;
    practitionerIds?: string[];
    locationId?: string;
    timezone: string;
    now?: Date;
  },
  tx: Tx = db,
): Promise<{ ctx: AvailabilityContext; slots: Slot[] } | null> {
  const days = Math.min(Math.max(params.days, 1), 62);
  const ctx = await loadAvailabilityContext(
    {
      orgId: params.orgId,
      serviceId: params.serviceId,
      practitionerIds: params.practitionerIds,
      locationId: params.locationId,
      ...rangeForDates(params.fromDate, days, params.timezone),
    },
    tx,
  );
  if (!ctx) return null;
  if (!ctx.service.onlineBookable || !ctx.service.active) return { ctx, slots: [] };
  return { ctx, slots: findSlots(ctx, { fromDate: params.fromDate, days, now: params.now, enforcePolicy: true }) };
}

/**
 * Collapse slots across practitioners for "any available practitioner" booking:
 * one entry per start time, assigned to the practitioner with the lightest day.
 */
export function collapseAnyPractitioner(ctx: AvailabilityContext, slots: Slot[]): Slot[] {
  const load = new Map<string, number>();
  for (const a of ctx.appointments) {
    const loc = ctx.locations.get(a.locationId);
    const key = `${a.practitionerId}|${zonedParts(a.startsAt, loc?.timezone ?? ctx.org.timezone).date}`;
    load.set(key, (load.get(key) ?? 0) + 1);
  }
  const byStart = new Map<string, Slot>();
  for (const s of slots) {
    const loc = ctx.locations.get(s.locationId);
    const key = `${s.locationId}|${s.start.getTime()}`;
    const current = byStart.get(key);
    const day = zonedParts(s.start, loc?.timezone ?? ctx.org.timezone).date;
    const weight = load.get(`${s.practitionerId}|${day}`) ?? 0;
    if (!current) {
      byStart.set(key, s);
      continue;
    }
    const currentWeight = load.get(`${current.practitionerId}|${day}`) ?? 0;
    if (weight < currentWeight) byStart.set(key, s);
  }
  return [...byStart.values()].sort((a, b) => a.start.getTime() - b.start.getTime());
}
