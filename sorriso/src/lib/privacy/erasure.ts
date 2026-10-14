import { and, desc, eq, gt, gte, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import { db, type Tx } from "@/db";
import {
  appointments,
  auditLog,
  consents,
  formSubmissions,
  messages,
  patients,
  privacyRequests,
  recalls,
  reminders,
  reviews,
  waitlist,
  type Patient,
} from "@/db/schema";
import { audit, type AuditEvent } from "../audit";
import { isRestricted } from "../contact";
import { logError, maskEmail, maskPhone } from "../log";
import { deleteProviderMessage } from "../messaging/providers";
import { isDateString } from "../time";
import { messageDate, notifyPatientDirect } from "./requests";

/**
 * Erasure (Art. 17) and restriction (Art. 18) of a patient record.
 *
 * erasePatient() has two modes, chosen by the practice for each request:
 *  - anonymise: pseudonymisation, in one transaction. Identity, contacts, notes and free text are
 *    removed; the appointment skeleton (dates, service, practitioner, status) stays for the
 *    clinical record's index and statistics, under the placeholder name "Paziente cancellato".
 *    Strictly this is pseudonymisation, not anonymisation (the practice may still hold the
 *    clinical record elsewhere), and it is described that way to the patient.
 *  - restrict: the practice must keep the data on a legal ground (Art. 17(3)(b)/(c)/(e), e.g.
 *    the 10-year retention of clinical records): the record is restricted until `retainUntil`,
 *    future visits are cancelled and nothing is sent to the patient any more.
 *
 * Scope (critique 18): only rows linked to this record by patientId or appointmentId — never
 * rows matched by phone or email, which families share.
 *
 * Restriction (Art. 18): a restricted record receives no messages (contact.ts), is read-only,
 * and is hidden from staff without patient.restricted.read; those who have it must give a reason
 * for every access, audited as patient.restricted_access (grantRestrictedAccess). Lifting it
 * notifies the patient first (Art. 18(3)).
 *
 * Runs outside Next too (the retention job), so no "server-only" imports: callers pass the
 * permission decisions in.
 */

/** The placeholder identity of an erased record (first + last name reads "Paziente cancellato"). */
export const ERASED_FIRST_NAME = "Paziente";
export const ERASED_LAST_NAME = "cancellato";
export const ERASED_NAME = `${ERASED_FIRST_NAME} ${ERASED_LAST_NAME}`;

export type ErasureMode = "anonymise" | "restrict";

export type ErasureErrorCode =
  | "not_found"
  | "already_erased"
  | "erased"
  | "not_restricted"
  | "reason_required"
  | "retain_until_required"
  | "invalid_retain_until"
  | "forms_not_exported"
  | "notice_required";

/** `code` is a key of privacyAdmin.patient.errors. */
export class ErasureError extends Error {
  constructor(public code: ErasureErrorCode) {
    super(`Erasure: ${code}`);
    this.name = "ErasureError";
  }
}

export type ErasureActor = AuditEvent["actor"];

export type ErasureOptions = {
  mode: ErasureMode;
  /** Why (the request, the legal ground): stored encrypted in the audit row, never logged. */
  reason: string;
  /** restrict: YYYY-MM-DD until which the record must be kept. */
  retainUntil?: string | null;
  actor: ErasureActor;
  headers?: Headers;
  now?: Date;
  /**
   * Anamnesis forms not yet exported to the clinical record may be part of it (Art. 17(3)(b)/(c)),
   * so they are never deleted: 'fail' refuses the erasure (staff export them first or restrict),
   * 'restrict' restricts the record instead (the retention job).
   */
  unexportedForms?: "fail" | "restrict";
};

export type ErasureResult = { mode: ErasureMode; counts: Record<string, number> };

const today = (now: Date) => now.toISOString().slice(0, 10);

/** Mask a stored message address: "+39•••4567", "m•••@d•••". */
export function maskAddress(value: string | null): string | null {
  if (!value) return value;
  const v = value.replace(/^whatsapp:/, "");
  return v.includes("@") ? maskEmail(v) : maskPhone(v);
}

/** The record and every duplicate merged into it (tombstones): an erasure covers them all. */
async function lineage(tx: Tx, orgId: string, patientId: string): Promise<string[]> {
  const ids = [patientId];
  let frontier = [patientId];
  for (let hop = 0; frontier.length && hop < 5; hop++) {
    const rows = await tx
      .select({ id: patients.id })
      .from(patients)
      .where(and(eq(patients.orgId, orgId), inArray(patients.mergedIntoId, frontier)));
    frontier = rows.map((r) => r.id).filter((id) => !ids.includes(id));
    ids.push(...frontier);
  }
  return ids;
}

/** Cancel future visits and every pending reminder of these appointments, telling no one. */
async function cancelFuture(tx: Tx, orgId: string, apptIds: string[], now: Date): Promise<{ appointments: number; reminders: number }> {
  if (!apptIds.length) return { appointments: 0, reminders: 0 };
  const cancelled = await tx
    .update(appointments)
    .set({ status: "cancelled", cancelledAt: now, cancelledBy: "staff", needsAttention: false, updatedAt: now })
    .where(
      and(
        eq(appointments.orgId, orgId),
        inArray(appointments.id, apptIds),
        inArray(appointments.status, ["scheduled", "requested"]),
        gt(appointments.startsAt, now),
      ),
    );
  const rem = await tx
    .update(reminders)
    .set({ status: "cancelled" })
    .where(and(inArray(reminders.appointmentId, apptIds), eq(reminders.status, "pending")));
  return { appointments: cancelled.rowsAffected, reminders: rem.rowsAffected };
}

type ProviderCopy = { id: string; provider: string; providerId: string };

/**
 * Erase or restrict one patient of `orgId`. Throws ErasureError for a refused request; the
 * whole change commits or nothing does. Audited as patient.erase (anonymise) or patient.restrict.
 */
export async function erasePatient(orgId: string, patientId: string, opts: ErasureOptions): Promise<ErasureResult> {
  const now = opts.now ?? new Date();
  const reason = opts.reason.trim();
  if (!reason) throw new ErasureError("reason_required");
  if (opts.mode === "restrict") {
    if (!opts.retainUntil) throw new ErasureError("retain_until_required");
    if (!isDateString(opts.retainUntil) || opts.retainUntil <= today(now)) throw new ErasureError("invalid_retain_until");
  }

  const providerCopies: ProviderCopy[] = [];
  const result = await db.transaction(async (tx): Promise<ErasureResult> => {
    const [p] = await tx
      .select()
      .from(patients)
      .where(and(eq(patients.orgId, orgId), eq(patients.id, patientId)));
    if (!p) throw new ErasureError("not_found");
    if (p.erasedAt) throw new ErasureError("already_erased");

    const ids = await lineage(tx, orgId, patientId);
    const apptIds = (
      await tx
        .select({ id: appointments.id })
        .from(appointments)
        .where(and(eq(appointments.orgId, orgId), inArray(appointments.patientId, ids)))
    ).map((a) => a.id);

    let mode = opts.mode;
    const [{ unexported }] = await tx
      .select({ unexported: sql<number>`count(*)` })
      .from(formSubmissions)
      .where(and(eq(formSubmissions.orgId, orgId), inArray(formSubmissions.patientId, ids), isNull(formSubmissions.exportedAt)));
    if (mode === "anonymise" && unexported > 0) {
      if ((opts.unexportedForms ?? "fail") === "fail") throw new ErasureError("forms_not_exported");
      mode = "restrict";
    }

    const counts: Record<string, number> = {};
    const future = await cancelFuture(tx, orgId, apptIds, now);
    counts.appointmentsCancelled = future.appointments;
    counts.remindersCancelled = future.reminders;

    if (mode === "restrict") {
      await tx
        .update(patients)
        .set({ restrictedAt: p.restrictedAt ?? now, restrictionReason: reason.slice(0, 500), retainUntil: opts.retainUntil ?? p.retainUntil })
        .where(and(eq(patients.orgId, orgId), inArray(patients.id, ids)));
      // Not clinical, and the patient asked to leave: the waitlist goes, recalls stop.
      counts.waitlistDeleted = (await tx.delete(waitlist).where(and(eq(waitlist.orgId, orgId), inArray(waitlist.patientId, ids)))).rowsAffected;
      counts.recallsDismissed = (
        await tx
          .update(recalls)
          .set({ status: "dismissed", updatedAt: now })
          .where(and(eq(recalls.orgId, orgId), inArray(recalls.patientId, ids), inArray(recalls.status, ["due", "sent", "call"])))
      ).rowsAffected;
      await audit(
        {
          orgId,
          actor: opts.actor,
          action: "patient.restrict",
          entity: { type: "patient", id: patientId },
          reason,
          metadata: { erasureRequest: true, retainUntil: opts.retainUntil ?? null, requested: opts.mode, ...counts },
          headers: opts.headers,
          at: now,
        },
        tx,
      );
      return { mode, counts };
    }

    // ---- pseudonymise
    if (apptIds.length) {
      counts.appointmentsScrubbed = (
        await tx
          .update(appointments)
          .set({
            patientNote: null,
            internalNote: null,
            cancelReason: null,
            bookedByName: null,
            bookedByPhone: null,
            bookedByEmail: null,
            // Old links stop working: lookups use the hash, reminders the encrypted token.
            manageTokenHash: null,
            manageTokenEnc: null,
            manageToken: sql`'revoked:' || ${appointments.id}`,
            updatedAt: now,
          })
          .where(and(eq(appointments.orgId, orgId), inArray(appointments.id, apptIds)))
      ).rowsAffected;
    }

    const linked = or(inArray(messages.patientId, ids), apptIds.length ? inArray(messages.appointmentId, apptIds) : undefined);
    const msgs = await tx
      .select({ id: messages.id, to: messages.to, from: messages.from, provider: messages.provider, providerId: messages.providerId, providerDeletedAt: messages.providerDeletedAt })
      .from(messages)
      .where(and(eq(messages.orgId, orgId), linked));
    for (const m of msgs) {
      await tx
        .update(messages)
        .set({ body: "", subject: null, html: null, to: maskAddress(m.to) ?? "", from: maskAddress(m.from), redactedAt: now })
        .where(eq(messages.id, m.id));
      if (m.providerId && !m.providerDeletedAt) providerCopies.push({ id: m.id, provider: m.provider, providerId: m.providerId });
    }
    counts.messagesRedacted = msgs.length;

    counts.waitlistDeleted = (await tx.delete(waitlist).where(and(eq(waitlist.orgId, orgId), inArray(waitlist.patientId, ids)))).rowsAffected;
    counts.recallsDeleted = (await tx.delete(recalls).where(and(eq(recalls.orgId, orgId), inArray(recalls.patientId, ids)))).rowsAffected;
    counts.formsDeleted = (
      await tx.delete(formSubmissions).where(and(eq(formSubmissions.orgId, orgId), inArray(formSubmissions.patientId, ids)))
    ).rowsAffected;

    // The ledger stays as proof of what was consented (Art. 7(1), 17(3)(e)), unlinked from the
    // record; retention deletes it after consentMonths.
    counts.consentsUnlinked = (
      await tx
        .update(consents)
        .set({ patientId: null })
        .where(and(eq(consents.orgId, orgId), inArray(consents.patientId, ids)))
    ).rowsAffected;

    if (apptIds.length) {
      counts.reviewsPseudonymised = (
        await tx
          .update(reviews)
          .set({ authorName: ERASED_NAME, authorDisplay: "pseudonym", comment: null })
          .where(and(eq(reviews.orgId, orgId), inArray(reviews.appointmentId, apptIds)))
      ).rowsAffected;
    }

    // The request's free text may name the patient; its type and dates stay for accountability.
    await tx
      .update(privacyRequests)
      .set({ details: null })
      .where(and(eq(privacyRequests.orgId, orgId), inArray(privacyRequests.patientId, ids)));

    await tx
      .update(patients)
      .set({
        firstName: ERASED_FIRST_NAME,
        lastName: ERASED_LAST_NAME,
        email: null,
        phone: null,
        birthDate: null,
        notes: null,
        guardianName: null,
        guardianRelation: null,
        guardianPhone: null,
        guardianEmail: null,
        emailOptIn: false,
        smsOptIn: false,
        preferredChannel: "email",
        noShowCount: 0,
        contactVerifiedAt: null,
        verifiedContacts: [],
        restrictionReason: null,
        retainUntil: null,
        possibleDuplicateOfId: null,
        erasedAt: now,
      })
      .where(and(eq(patients.orgId, orgId), inArray(patients.id, ids)));
    counts.patients = ids.length;

    await audit(
      {
        orgId,
        actor: opts.actor,
        action: "patient.erase",
        entity: { type: "patient", id: patientId },
        reason,
        metadata: { mode: "anonymise", ...counts },
        headers: opts.headers,
        at: now,
      },
      tx,
    );
    return { mode, counts };
  });

  // Network calls stay outside the transaction (it holds the write lock).
  for (const m of providerCopies) {
    try {
      await deleteProviderMessage(m.provider, m.providerId);
      await db.update(messages).set({ providerDeletedAt: new Date() }).where(eq(messages.id, m.id));
    } catch (err) {
      logError("erasure", err, { step: "provider-delete", messageId: m.id });
    }
  }
  return result;
}

// ---------------------------------------------------------------- restriction (Art. 18)

type RestrictionInput = { reason: string; retainUntil?: string | null; actor: ErasureActor; headers?: Headers; now?: Date };

async function loadPatient(tx: Tx, orgId: string, patientId: string): Promise<Patient> {
  const [p] = await tx
    .select()
    .from(patients)
    .where(and(eq(patients.orgId, orgId), eq(patients.id, patientId)));
  if (!p) throw new ErasureError("not_found");
  return p;
}

/**
 * Restrict processing (Art. 18(1)): the data is kept but not used — no messages, no changes, and
 * only staff with patient.restricted.read can open it, giving a reason each time. Appointments are
 * left as they are (the front desk decides); a restriction in place of erasure goes through
 * erasePatient(mode 'restrict'). Calling it again updates the reason.
 */
export async function restrictPatient(orgId: string, patientId: string, i: RestrictionInput): Promise<void> {
  const now = i.now ?? new Date();
  const reason = i.reason.trim();
  if (!reason) throw new ErasureError("reason_required");
  if (i.retainUntil && !isDateString(i.retainUntil)) throw new ErasureError("invalid_retain_until");
  await db.transaction(async (tx) => {
    const p = await loadPatient(tx, orgId, patientId);
    if (p.erasedAt) throw new ErasureError("erased");
    await tx
      .update(patients)
      .set({ restrictedAt: p.restrictedAt ?? now, restrictionReason: reason.slice(0, 500), retainUntil: i.retainUntil ?? p.retainUntil })
      .where(and(eq(patients.orgId, orgId), eq(patients.id, patientId)));
    await audit(
      {
        orgId,
        actor: i.actor,
        action: "patient.restrict",
        entity: { type: "patient", id: patientId },
        reason,
        metadata: { retainUntil: i.retainUntil ?? null, update: Boolean(p.restrictedAt) },
        headers: i.headers,
        at: now,
      },
      tx,
    );
  });
}

/**
 * Lift a restriction. Art. 18(3): the patient is told before it is lifted — by email or SMS to
 * their own contact; when there is none, staff must confirm they informed them another way
 * (`informedOtherwise`), or it fails with notice_required.
 */
export async function unrestrictPatient(
  orgId: string,
  patientId: string,
  i: { reason?: string | null; informedOtherwise?: boolean; actor: ErasureActor; headers?: Headers; now?: Date },
): Promise<{ notified: boolean }> {
  const now = i.now ?? new Date();
  const p = await loadPatient(db, orgId, patientId);
  if (p.erasedAt) throw new ErasureError("erased");
  if (!p.restrictedAt) throw new ErasureError("not_restricted");
  const notified = await notifyPatientDirect({
    orgId,
    patient: p,
    kind: "restrictionLifted",
    vars: { since: messageDate(p.restrictedAt, p.locale) },
    now,
  });
  if (!notified && !i.informedOtherwise) throw new ErasureError("notice_required");
  await db.transaction(async (tx) => {
    await tx
      .update(patients)
      .set({ restrictedAt: null, restrictionReason: null })
      .where(and(eq(patients.orgId, orgId), eq(patients.id, patientId)));
    await audit(
      {
        orgId,
        actor: i.actor,
        action: "patient.unrestrict",
        entity: { type: "patient", id: patientId },
        reason: i.reason ?? null,
        metadata: { notified, informedOtherwise: Boolean(i.informedOtherwise) },
        headers: i.headers,
        at: now,
      },
      tx,
    );
  });
  return { notified };
}

/** How long a reason given to open a restricted record covers further views by the same person. */
export const RESTRICTED_ACCESS_WINDOW_MS = 15 * 60_000;

type Viewer = { user: { id: string }; org: { id: string } };

/**
 * Record why a restricted (or erased) record is being opened: an audit row
 * patient.restricted_access with the reason (encrypted). The caller checks
 * patient.restricted.read first. Throws reason_required without a reason.
 */
export async function grantRestrictedAccess(
  s: Viewer,
  patientId: string,
  reason: string,
  opts: { headers?: Headers; now?: Date } = {},
): Promise<void> {
  const text = reason.trim();
  if (text.length < 3) throw new ErasureError("reason_required");
  const p = await loadPatient(db, s.org.id, patientId);
  if (!isRestricted(p)) throw new ErasureError("not_restricted");
  await audit({
    orgId: s.org.id,
    actor: { type: "user", id: s.user.id },
    action: "patient.restricted_access",
    entity: { type: "patient", id: patientId },
    reason: text,
    headers: opts.headers,
    at: opts.now,
  });
}

/** Did this person give a reason for this record within the access window? */
export async function hasRestrictedAccess(s: Viewer, patientId: string, now: Date = new Date()): Promise<boolean> {
  const [row] = await db
    .select({ id: auditLog.id })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.orgId, s.org.id),
        eq(auditLog.entityType, "patient"),
        eq(auditLog.entityId, patientId),
        eq(auditLog.action, "patient.restricted_access"),
        eq(auditLog.actorId, s.user.id),
        isNotNull(auditLog.reason),
        gte(auditLog.at, new Date(now.getTime() - RESTRICTED_ACCESS_WINDOW_MS)),
      ),
    )
    .orderBy(desc(auditLog.at))
    .limit(1);
  return Boolean(row);
}

/**
 * What a viewer may see of a patient: everything, a placeholder (restricted or erased record and
 * no patient.restricted.read), or the record after a reason was given (`needsReason`).
 */
export function restrictedView(p: Pick<Patient, "restrictedAt" | "erasedAt">, canReadRestricted: boolean): "open" | "placeholder" | "needs_reason" {
  if (!isRestricted(p)) return "open";
  return canReadRestricted ? "needs_reason" : "placeholder";
}
