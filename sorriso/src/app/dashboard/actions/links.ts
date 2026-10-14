"use server";

import { appointmentLinks } from "@/lib/appointments";
import { guard, ok, ownAppointment, type ActionResult } from "./_shared";

/** Patient links handed out by staff (WP6: re-issuing expired links, rate limits). */

/**
 * The patient's self-service page for one appointment, for staff to open or copy (the token is
 * stored encrypted). Returns ok(undefined, { url }) with the absolute URL; audited as
 * appointment.link.issue.
 */
export async function issuePatientLink(id: string): Promise<ActionResult> {
  return guard(
    async (s) => {
      const d = await ownAppointment(s.org.id, id);
      const { manageUrl } = appointmentLinks(d);
      return ok(undefined, { url: manageUrl });
    },
    { permission: "appointment.write", audit: "appointment.link.issue", entity: { type: "appointment", id } },
  );
}
