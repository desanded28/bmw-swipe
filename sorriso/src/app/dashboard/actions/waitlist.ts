"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { waitlist } from "@/db/schema";
import { auditStaff } from "@/lib/audit";
import { dashboardAction } from "@/lib/dashboard";
import { fail, ok, type ActionResult } from "./_shared";

/** Waitlist actions (WP2). */

/** Take a patient off the waitlist. Needs appointment.write; audited as patient.update. */
export async function removeWaitlistEntry(id: string): Promise<ActionResult> {
  return dashboardAction(
    async (s, t) => {
      const [row] = await db
        .update(waitlist)
        .set({ status: "removed" })
        .where(and(eq(waitlist.id, id), eq(waitlist.orgId, s.org.id)))
        .returning({ patientId: waitlist.patientId });
      if (!row) return fail(t("errors.not_found"), "not_found");
      await auditStaff(s, "patient.update", { type: "patient", id: row.patientId }, { metadata: { waitlist: "removed" } });
      return ok(t("done.waitlistRemoved"));
    },
    { permission: "appointment.write" },
  );
}
