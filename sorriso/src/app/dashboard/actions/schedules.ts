"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { locations, practitioners, schedules } from "@/db/schema";
import { CALENDAR_NAMES } from "@/i18n/calendar-names";
import { zodErrorMap } from "@/i18n/zod";
import { auditStaff } from "@/lib/audit";
import { dashboardAction } from "@/lib/dashboard";
import { newId } from "@/lib/ids";
import { hhmmToMinutes } from "@/lib/time";
import { fail, ok, type ActionResult } from "./_shared";

/** Practitioners' weekly working hours (WP2). */

const scheduleSchema = z
  .array(
    z.object({
      weekday: z.number().int().min(0).max(6),
      locationId: z.string().min(1).max(40),
      start: z.string().max(5),
      end: z.string().max(5),
    }),
  )
  .max(70);

/** Replace a practitioner's weekly hours. Needs team.manage; audited as settings.update. */
export async function saveSchedule(practitionerId: string, rows: z.input<typeof scheduleSchema>): Promise<ActionResult> {
  return dashboardAction(
    async (s, t, locale) => {
      const parsed = scheduleSchema.parse(rows, { error: zodErrorMap(locale) });
      const day = (wd: number) => CALENDAR_NAMES[locale].weekdays[wd];
      const [p] = await db
        .select({ id: practitioners.id })
        .from(practitioners)
        .where(and(eq(practitioners.id, practitionerId), eq(practitioners.orgId, s.org.id)));
      if (!p) return fail(t("errors.practitionerNotFound"), "not_found");
      const orgLocations = new Set(
        (await db.select({ id: locations.id }).from(locations).where(eq(locations.orgId, s.org.id))).map((l) => l.id),
      );
      const values: (typeof schedules.$inferInsert)[] = [];
      for (const r of parsed) {
        const start = hhmmToMinutes(r.start);
        const end = hhmmToMinutes(r.end);
        if (start == null || end == null || end <= start) return fail(t("validation.scheduleHours", { day: day(r.weekday) }), "invalid");
        if (!orgLocations.has(r.locationId)) return fail(t("errors.unknownOffice"), "not_found");
        values.push({ id: newId(), practitionerId, locationId: r.locationId, weekday: r.weekday, startMinute: start, endMinute: end });
      }
      // Overlapping windows on the same day would double-count availability.
      for (const a of values)
        for (const b of values)
          if (a !== b && a.weekday === b.weekday && a.startMinute < b.endMinute && b.startMinute < a.endMinute)
            return fail(t("validation.scheduleOverlap", { day: day(a.weekday) }), "invalid");
      await db.transaction(async (tx) => {
        await tx.delete(schedules).where(eq(schedules.practitionerId, practitionerId));
        if (values.length) await tx.insert(schedules).values(values);
      });
      await auditStaff(s, "settings.update", { type: "practitioner", id: practitionerId }, { metadata: { schedule: values.length } });
      return ok(t("done.hoursSaved"));
    },
    { permission: "team.manage" },
  );
}
