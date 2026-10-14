"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { waitlist } from "@/db/schema";
import { auditStaff } from "@/lib/audit";
import { dashboardAction } from "@/lib/dashboard";
import { fail, ok, type ActionResult } from "./_shared";

/** Waitlist actions (WP2). */

/**
 * Take a patient off the waitlist. Needs appointment.write; audited as waitlist.update (entity
 * waitlist, with the patient's id so the patient's access log can list it). Only an active entry
 * can be removed; `closedAt` starts the retention clock. Another practice's id is not_found.
 */
export async function removeWaitlistEntry(id: string): Promise<ActionResult> {
  return dashboardAction(
    async (s, t) => {
      if (typeof id !== "string" || !id || id.length > 40) return fail(t("errors.not_found"), "not_found");
      const now = new Date();
      const [row] = await db
        .update(waitlist)
        .set({ status: "removed", closedAt: now })
        .where(and(eq(waitlist.id, id), eq(waitlist.orgId, s.org.id), eq(waitlist.status, "active")))
        .returning({ patientId: waitlist.patientId });
      if (!row) {
        const [existing] = await db
          .select({ id: waitlist.id })
          .from(waitlist)
          .where(and(eq(waitlist.id, id), eq(waitlist.orgId, s.org.id)));
        return existing ? fail(t("errors.waitlistClosed"), "not_allowed") : fail(t("errors.not_found"), "not_found");
      }
      await auditStaff(s, "waitlist.update", { type: "waitlist", id }, { metadata: { status: "removed", patientId: row.patientId } });
      return ok(t("done.waitlistRemoved"));
    },
    { permission: "appointment.write" },
  );
}
