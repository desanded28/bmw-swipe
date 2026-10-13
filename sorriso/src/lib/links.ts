import type { Appointment } from "@/db/schema";
import { hmac, sha256Hex } from "./crypto";
import { newToken } from "./ids";

/**
 * Patient self-service links (/a/<token>).
 *
 * The raw token is never stored in clear: lookups use its sha256 (manageTokenHash) and an
 * encrypted copy (manageTokenEnc) lets reminders re-send the same link. Links expire
 * 60 days after the visit (14 days after a cancellation) to limit exposure of
 * appointment details if a message is forwarded or a phone changes hands.
 */

export function hashToken(token: string): string {
  return sha256Hex(token);
}

export function issueManageToken(): { token: string; hash: string } {
  const token = newToken();
  return { token, hash: hashToken(token) };
}

/** The raw token for building links, or null for appointments created before tokens were encrypted. */
export function manageTokenOf(a: Pick<Appointment, "manageTokenEnc">): string | null {
  return a.manageTokenEnc ?? null;
}

const DAY = 86_400_000;

export function manageLinkValidUntil(a: Pick<Appointment, "status" | "endsAt" | "cancelledAt">): Date {
  const afterVisit = a.endsAt.getTime() + 60 * DAY;
  if (a.status === "cancelled" && a.cancelledAt) return new Date(Math.min(a.cancelledAt.getTime() + 14 * DAY, afterVisit));
  return new Date(afterVisit);
}

export function isManageLinkValid(a: Pick<Appointment, "status" | "endsAt" | "cancelledAt">, now = new Date()): boolean {
  return now.getTime() <= manageLinkValidUntil(a).getTime();
}

/**
 * Unsubscribe links must keep working after the manage link expires (RFC 8058 / mailbox
 * provider rules), so they use a separate HMAC signature with no expiry.
 */
export function unsubscribeToken(patientId: string, channel: "email" | "sms" | "whatsapp"): string {
  return `${patientId}.${channel}.${hmac(`${patientId}:${channel}`, "token").slice(0, 32)}`;
}

export function verifyUnsubscribeToken(token: string): { patientId: string; channel: "email" | "sms" | "whatsapp" } | null {
  const [patientId, channel, sig] = token.split(".");
  if (!patientId || !sig || !["email", "sms", "whatsapp"].includes(channel)) return null;
  const expected = unsubscribeToken(patientId, channel as "email");
  return expected === token ? { patientId, channel: channel as "email" | "sms" | "whatsapp" } : null;
}
