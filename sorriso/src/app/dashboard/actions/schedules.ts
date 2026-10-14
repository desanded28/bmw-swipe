"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { locations, practitioners, schedules } from "@/db/schema";
import { newId } from "@/lib/ids";
import { hhmmToMinutes } from "@/lib/time";
import { fail, guard, ok, type ActionResult } from "./_shared";

/** Practitioners' weekly working hours (WP2). */

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const scheduleSchema = z.array(
  z.object({
    weekday: z.number().int().min(0).max(6),
    locationId: z.string().min(1),
    start: z.string(),
    end: z.string(),
  }),
);

export async function saveSchedule(practitionerId: string, rows: z.input<typeof scheduleSchema>): Promise<ActionResult> {
  return guard(
    async (s) => {
      const parsed = scheduleSchema.parse(rows);
      const [p] = await db
        .select({ id: practitioners.id })
        .from(practitioners)
        .where(and(eq(practitioners.id, practitionerId), eq(practitioners.orgId, s.org.id)));
      if (!p) return fail("Practitioner not found.");
      const orgLocations = new Set(
        (await db.select({ id: locations.id }).from(locations).where(eq(locations.orgId, s.org.id))).map((l) => l.id),
      );
      const values: (typeof schedules.$inferInsert)[] = [];
      for (const r of parsed) {
        const start = hhmmToMinutes(r.start);
        const end = hhmmToMinutes(r.end);
        if (start == null || end == null || end <= start) return fail(`Check the hours on ${WEEKDAYS[r.weekday]}.`);
        if (!orgLocations.has(r.locationId)) return fail("Unknown office.");
        values.push({ id: newId(), practitionerId, locationId: r.locationId, weekday: r.weekday, startMinute: start, endMinute: end });
      }
      // Overlapping windows on the same day would double-count availability.
      for (const a of values)
        for (const b of values)
          if (a !== b && a.weekday === b.weekday && a.startMinute < b.endMinute && b.startMinute < a.endMinute)
            return fail(`Two time windows overlap on ${WEEKDAYS[a.weekday]}.`);
      await db.transaction(async (tx) => {
        await tx.delete(schedules).where(eq(schedules.practitionerId, practitionerId));
        if (values.length) await tx.insert(schedules).values(values);
      });
      return ok("Working hours saved.");
    },
    { permission: "team.manage" },
  );
}
