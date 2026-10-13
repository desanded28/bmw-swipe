import { and, eq, gt, inArray, lt } from "drizzle-orm";
import type { Metadata } from "next";
import { CalendarBoard, type Block, type HoursWindow } from "@/components/dashboard/CalendarBoard";
import { db } from "@/db";
import { schedules, timeOff } from "@/db/schema";
import { requireStaff } from "@/lib/auth";
import { listAppointments, loadResources } from "@/lib/dashboard";
import { addDays, isDateString, startOfWeek, todayIn, weekdayOf, zonedToUtc } from "@/lib/time";

export const metadata: Metadata = { title: "Calendar" };

type SP = Promise<{ date?: string; view?: string; location?: string; by?: string; p?: string; cancelled?: string }>;

export default async function CalendarPage({ searchParams }: { searchParams: SP }) {
  const s = await requireStaff();
  const sp = await searchParams;
  const tz = s.org.timezone;
  const today = todayIn(tz);
  const date = isDateString(sp.date) ? sp.date : today;
  const view = sp.view === "week" ? "week" : "day";
  const groupBy = sp.by === "room" ? "room" : "practitioner";
  const resources = await loadResources(s.org.id, tz);
  const locationId = resources.locations.some((l) => l.id === sp.location) ? sp.location! : "all";
  const selected = (sp.p ?? "").split(",").filter((id) => resources.practitioners.some((p) => p.id === id));

  const firstDay = view === "week" ? startOfWeek(date) : date;
  let days = view === "week" ? Array.from({ length: 7 }, (_, i) => addDays(firstDay, i)) : [date];

  const from = zonedToUtc(days[0], 0, tz);
  const to = zonedToUtc(addDays(days.at(-1)!, 1), 0, tz);
  const practitionerIds = resources.practitioners.map((p) => p.id);

  const [appointments, scheduleRows, blockRows] = await Promise.all([
    listAppointments(s.org.id, {
      from,
      to,
      locationId: locationId === "all" ? undefined : locationId,
      includeCancelled: sp.cancelled === "1",
    }),
    practitionerIds.length ? db.select().from(schedules).where(inArray(schedules.practitionerId, practitionerIds)) : [],
    db.select().from(timeOff).where(and(eq(timeOff.orgId, s.org.id), lt(timeOff.startsAt, to), gt(timeOff.endsAt, from))),
  ]);

  const hours: HoursWindow[] = days.flatMap((d) =>
    scheduleRows
      .filter((r) => r.weekday === weekdayOf(d) && (!r.validFrom || d >= r.validFrom) && (!r.validUntil || d <= r.validUntil))
      .map((r) => ({ practitionerId: r.practitionerId, locationId: r.locationId, date: d, start: r.startMinute, end: r.endMinute })),
  );

  // Week view: hide Sunday unless someone works or is booked then.
  if (view === "week") {
    const sunday = days[6];
    const used = hours.some((h) => h.date === sunday) || appointments.some((a) => a.start.slice(0, 10) === sunday);
    if (!used) days = days.slice(0, 6);
  }

  const starts = hours.map((h) => h.start);
  const ends = hours.map((h) => h.end);
  const gridStart = Math.min(8 * 60, ...starts.map((m) => Math.floor(m / 60) * 60));
  const gridEnd = Math.max(19 * 60, ...ends.map((m) => Math.ceil(m / 60) * 60));

  const blocks: Block[] = blockRows.map((b) => ({
    id: b.id,
    practitionerId: b.practitionerId,
    locationId: b.locationId,
    roomId: b.roomId,
    start: b.startsAt.toISOString(),
    end: b.endsAt.toISOString(),
    reason: b.reason,
  }));

  return (
    <CalendarBoard
      resources={resources}
      view={view}
      date={date}
      days={days}
      today={today}
      locationId={locationId}
      groupBy={groupBy}
      selected={selected}
      showCancelled={sp.cancelled === "1"}
      appointments={appointments}
      hours={hours}
      blocks={blocks}
      gridStart={gridStart}
      gridEnd={gridEnd}
    />
  );
}
