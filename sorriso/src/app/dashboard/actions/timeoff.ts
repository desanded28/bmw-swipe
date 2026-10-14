"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { appointments, locations, practitioners, rooms, timeOff } from "@/db/schema";
import { newId } from "@/lib/ids";
import { hhmmToMinutes, zonedToUtc } from "@/lib/time";
import { fail, guard, ok, optional, str, type ActionResult } from "./_shared";

/**
 * Time off and closures (WP8: offering to rebook the appointments a block displaces).
 * appointment.write is held by every role, so any staff member may block time, as before.
 */

/** Block a practitioner, an office, a chair or the whole practice for a period. */
export async function addTimeOff(_prev: unknown, fd: FormData): Promise<ActionResult> {
  return guard(
    async (s) => {
      const scope = str(fd, "scope"); // practitioner:<id> | location:<id> | room:<id> | org
      const [kind, targetId] = scope.split(":");
      const fromDate = str(fd, "fromDate");
      const toDate = str(fd, "toDate") || fromDate;
      const allDay = fd.get("allDay") === "on";
      const fromMin = allDay ? 0 : hhmmToMinutes(str(fd, "fromTime"));
      const toMin = allDay ? 24 * 60 : hhmmToMinutes(str(fd, "toTime"));
      if (!fromDate || fromMin == null || toMin == null) return fail("Choose dates and times.");
      const tz = s.org.timezone;
      const startsAt = zonedToUtc(fromDate, fromMin, tz);
      const endsAt = zonedToUtc(toDate, toMin, tz);
      if (endsAt <= startsAt) return fail("The end must be after the start.");

      const row = { id: newId(), orgId: s.org.id, startsAt, endsAt, reason: optional(fd, "reason") } as typeof timeOff.$inferInsert;
      if (kind === "practitioner") {
        const [p] = await db
          .select({ id: practitioners.id })
          .from(practitioners)
          .where(and(eq(practitioners.id, targetId), eq(practitioners.orgId, s.org.id)));
        if (!p) return fail("Practitioner not found.");
        row.practitionerId = targetId;
      } else if (kind === "location") {
        const [l] = await db
          .select({ id: locations.id })
          .from(locations)
          .where(and(eq(locations.id, targetId), eq(locations.orgId, s.org.id)));
        if (!l) return fail("Office not found.");
        row.locationId = targetId;
      } else if (kind === "room") {
        const [r] = await db
          .select({ id: rooms.id, locationId: rooms.locationId })
          .from(rooms)
          .innerJoin(locations, eq(locations.id, rooms.locationId))
          .where(and(eq(rooms.id, targetId), eq(locations.orgId, s.org.id)));
        if (!r) return fail("Chair not found.");
        row.roomId = targetId;
        row.locationId = r.locationId;
      } else if (kind !== "org") return fail("Choose who is unavailable.");

      // Warn about existing appointments that now fall inside the block.
      const clash = await db
        .select({ n: sql<number>`count(*)` })
        .from(appointments)
        .where(
          and(
            eq(appointments.orgId, s.org.id),
            inArray(appointments.status, ["scheduled", "requested"]),
            sql`${appointments.startsAt} < ${endsAt.getTime()} and ${appointments.endsAt} > ${startsAt.getTime()}`,
            row.practitionerId ? eq(appointments.practitionerId, row.practitionerId) : undefined,
            row.roomId ? eq(appointments.roomId, row.roomId) : row.locationId ? eq(appointments.locationId, row.locationId) : undefined,
          ),
        );
      await db.insert(timeOff).values(row);
      const n = Number(clash[0]?.n ?? 0);
      return ok(
        n
          ? `Blocked. Heads-up: ${n} existing appointment${n > 1 ? "s" : ""} fall in this period — move or cancel them from the calendar.`
          : "Blocked.",
      );
    },
    { permission: "appointment.write" },
  );
}

export async function deleteTimeOff(id: string): Promise<ActionResult> {
  return guard(
    async (s) => {
      await db.delete(timeOff).where(and(eq(timeOff.id, id), eq(timeOff.orgId, s.org.id)));
      return ok("Removed.");
    },
    { permission: "appointment.write" },
  );
}
