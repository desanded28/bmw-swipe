import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { auditLog, messages } from "@/db/schema";
import type { AppointmentDetails } from "../appointments";
import { contactHash, type ProvenContact } from "../contact";

/**
 * Which of the patient's contacts a POST from their manage link (/a/<token>: confirm, cancel,
 * reschedule) proves, if any (src/lib/contact.ts markContactVerified: an explicit act through a
 * link delivered only to that contact). Only when exactly one contact can be holding the link:
 *
 * - The appointment was booked by staff or from a waitlist offer. Online, widget and API bookings
 *   also hand the link to the browser that booked (publicAppointment().manageUrl), and that proves
 *   nothing about the phone or email typed into the form.
 * - Staff never copied the link (appointment.link.issue): they may have passed it on to anyone.
 * - Every message that carried it went to one and the same contact. A message whose text retention
 *   has redacted can't say which link it carried, so it rules the proof out too.
 *
 * Never call it for a GET: mail scanners and link previews open links without the patient.
 */
export async function manageLinkContact(d: Pick<AppointmentDetails, "appointment" | "org">, token: string): Promise<ProvenContact | null> {
  if (d.appointment.source !== "staff" && d.appointment.source !== "waitlist") return null;
  const [copied] = await db
    .select({ id: auditLog.id })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.orgId, d.org.id),
        eq(auditLog.action, "appointment.link.issue"),
        eq(auditLog.entityType, "appointment"),
        eq(auditLog.entityId, d.appointment.id),
      ),
    )
    .limit(1);
  if (copied) return null;

  const sent = await db
    .select({ channel: messages.channel, to: messages.to, body: messages.body, html: messages.html, redactedAt: messages.redactedAt })
    .from(messages)
    .where(and(eq(messages.appointmentId, d.appointment.id), eq(messages.direction, "outbound"), ne(messages.status, "failed")));
  const link = `/a/${token}`;
  const reached = new Map<string, ProvenContact>();
  for (const m of sent) {
    if (m.redactedAt) return null;
    if (!m.body.includes(link) && !m.html?.includes(link)) continue;
    const contact: ProvenContact = m.channel === "email" ? { kind: "email", value: m.to } : { kind: "phone", value: m.to.replace(/^whatsapp:/, "") };
    const hash = contactHash(contact.kind, contact.value);
    if (!hash) return null;
    reached.set(hash, contact);
  }
  return reached.size === 1 ? [...reached.values()][0] : null;
}
