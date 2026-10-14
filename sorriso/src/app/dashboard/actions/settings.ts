"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { organizations } from "@/db/schema";
import { fail, guard, ok, optional, str, updateSettings, type ActionResult } from "./_shared";

/** Practice profile and booking rules (WP5). */

export async function saveProfile(_prev: unknown, fd: FormData): Promise<ActionResult> {
  return guard(
    async (s) => {
      const name = str(fd, "name");
      if (!name) return fail("Practice name is required.");
      const color = str(fd, "brandColor");
      await db
        .update(organizations)
        .set({
          name,
          description: optional(fd, "description"),
          phone: optional(fd, "phone"),
          email: optional(fd, "email"),
          website: optional(fd, "website"),
          brandColor: /^#[0-9a-f]{6}$/i.test(color) ? color : s.org.brandColor,
          listed: fd.get("listed") === "on",
        })
        .where(eq(organizations.id, s.org.id));
      return ok("Profile saved.");
    },
    { permission: "settings.manage" },
  );
}

export async function saveBookingPolicy(_prev: unknown, fd: FormData): Promise<ActionResult> {
  return guard(
    async (s) => {
      const num = (k: string, min: number, max: number) => Math.max(min, Math.min(max, Math.round(Number(str(fd, k)) || 0)));
      await updateSettings(s.org.id, (cur) => ({
        ...cur,
        booking: {
          minNoticeMinutes: num("minNoticeHours", 0, 24 * 14) * 60,
          maxAdvanceDays: num("maxAdvanceDays", 1, 365),
          slotStepMinutes: [5, 10, 15, 20, 30, 60].includes(Number(str(fd, "slotStepMinutes"))) ? Number(str(fd, "slotStepMinutes")) : 15,
          cancelUntilHours: num("cancelUntilHours", 0, 24 * 7),
          requireApproval: fd.get("requireApproval") === "on",
        },
      }));
      return ok("Booking rules saved.");
    },
    { permission: "settings.manage" },
  );
}
