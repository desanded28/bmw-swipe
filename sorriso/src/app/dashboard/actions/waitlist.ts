"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { waitlist } from "@/db/schema";
import { guard, ok, type ActionResult } from "./_shared";

/** Waitlist actions (WP2). */

export async function removeWaitlistEntry(id: string): Promise<ActionResult> {
  return guard(
    async (s) => {
      await db.update(waitlist).set({ status: "removed" }).where(and(eq(waitlist.id, id), eq(waitlist.orgId, s.org.id)));
      return ok("Removed from the waitlist.");
    },
    { permission: "appointment.write" },
  );
}
