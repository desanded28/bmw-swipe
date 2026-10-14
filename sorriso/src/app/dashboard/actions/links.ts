"use server";

import { appointmentLinks } from "@/lib/appointments";
import { rateLimit } from "@/lib/rate-limit";
import { securityTexts } from "@/lib/security/staff-locale";
import { fail, guard, ok, ownAppointment, type ActionResult } from "./_shared";

/**
 * Patient links handed out by staff. Each one is a credential for the patient's appointment page,
 * so issuing is audited (appointment.link.issue) and rate-limited per staff member: copying links
 * one at a time is normal front-desk work, harvesting hundreds is not.
 */

const LINKS_PER_HOUR = 120;

/**
 * The patient's self-service page for one appointment, for staff to open or copy (the token is
 * stored encrypted). Returns ok(message, { url }) with the absolute URL; audited as
 * appointment.link.issue.
 */
export async function issuePatientLink(id: string): Promise<ActionResult> {
  return guard(
    async (s) => {
      const t = await securityTexts(s);
      const limit = await rateLimit(`patient-link:${s.user.id}`, LINKS_PER_HOUR, 60 * 60_000);
      if (!limit.ok) return fail(t("errors.rateLimited"), "rate_limited");
      const d = await ownAppointment(s.org.id, id);
      const { manageUrl } = appointmentLinks(d);
      return ok(t("links.issued"), { url: manageUrl });
    },
    { permission: "appointment.write", audit: "appointment.link.issue", entity: { type: "appointment", id } },
  );
}
