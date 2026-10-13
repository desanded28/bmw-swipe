import { type Tx } from "@/db";
import {
  privacyRequests,
  type Locale,
  type PrivacyRequestChannel,
  type PrivacyRequestType,
} from "@/db/schema";
import { audit, type AuditEvent } from "../audit";
import { DEFAULT_TIMEZONE } from "../config";
import { newId } from "../ids";
import { pad, zonedParts, zonedToUtc } from "../time";

/**
 * Data-subject requests (Art. 15-22). Each one is answered within one month of receipt
 * (Art. 12(3)), extendable by two further months with reasons. orgId null = a request to
 * Sorriso as controller (marketplace bookings, reviews, the privacy center), handled in the
 * platform inbox.
 *
 * Scope of erasure (Art. 17): only the requesting patient's own rows — their patient record
 * and what is linked to it by patientId or appointmentId. Never rows matched only by a phone
 * number or email: families share phones, and wiping by contact would erase someone else's
 * messages. The result is pseudonymisation (the appointment skeleton stays for the clinical
 * record and statistics), not anonymisation, and is described as such to the patient.
 */

/**
 * The deadline: the same calendar date next month in Italy, clamped to that month's last day
 * (31 January -> 28/29 February), at the same wall-clock time.
 */
export function privacyRequestDueAt(receivedAt: Date, tz = DEFAULT_TIMEZONE): Date {
  const p = zonedParts(receivedAt, tz);
  const year = p.month === 12 ? p.year + 1 : p.year;
  const month = p.month === 12 ? 1 : p.month + 1;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = Math.min(p.day, lastDay);
  return zonedToUtc(`${year}-${pad(month)}-${pad(day)}`, p.minutes, tz);
}

const ACTOR_BY_CHANNEL: Partial<Record<PrivacyRequestChannel, AuditEvent["actor"]["type"]>> = {
  privacy_center: "patient_session",
  manage_link: "patient_link",
  api: "api_key",
};

export async function createPrivacyRequest(
  tx: Tx,
  i: {
    orgId: string | null;
    patientId: string | null;
    type: PrivacyRequestType;
    channel: PrivacyRequestChannel;
    /** Free text from the requester: stored encrypted, never logged. */
    details?: string | null;
    requesterLocale: Locale;
    /** contactHash() of the verified contact that filed it (privacy center, manage link). */
    contactHash?: string | null;
    /** Who filed or logged it; derived from the channel when omitted (staff pass their user). */
    actor?: AuditEvent["actor"];
    headers?: Headers;
    now?: Date;
  },
): Promise<{ id: string; dueAt: Date }> {
  const receivedAt = i.now ?? new Date();
  const dueAt = privacyRequestDueAt(receivedAt);
  const id = newId();
  await tx.insert(privacyRequests).values({
    id,
    orgId: i.orgId,
    patientId: i.patientId,
    type: i.type,
    channel: i.channel,
    status: "open",
    details: i.details?.trim() || null,
    contactHash: i.contactHash ?? null,
    requesterLocale: i.requesterLocale,
    receivedAt,
    dueAt,
    createdAt: receivedAt,
  });
  await audit(
    {
      orgId: i.orgId,
      actor: i.actor ?? { type: ACTOR_BY_CHANNEL[i.channel] ?? "system", id: null },
      action: "privacy_request.create",
      entity: { type: "privacy_request", id },
      metadata: { type: i.type, channel: i.channel, patientId: i.patientId },
      headers: i.headers,
      at: receivedAt,
    },
    tx,
  );
  return { id, dueAt };
}
