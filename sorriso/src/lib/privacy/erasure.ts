import { and, desc, eq, gt, gte, inArray, isNotNull, isNull, or, sql, type SQL } from "drizzle-orm";
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
  reviewReports,
  reviews,
  waitlist,
  type Patient,
  type PrivacyRequest,
} from "@/db/schema";
import { audit, type AuditEvent } from "../audit";
import { isRestricted } from "../contact";
import { logError, maskEmail, maskPhone } from "../log";
import { deleteProviderMessage } from "../messaging/providers";
import { isDateString } from "../time";
import { currentConsents, withdrawConsent } from "./consent";
import { ERASED_FIRST_NAME, ERASED_LAST_NAME, ERASED_NAME } from "./erased";
import { PLATFORM_CONSENT_PURPOSES } from "./roles";
import {
  completePrivacyRequest,
  contactsOf,
  DECISION_KIND,
  getPrivacyRequest,
  isOpenRequest,
  messageDate,
  notifyPatientDirect,
  joinContacts,
  notifyRequester,
} from "./requests";

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
 *    future visits are cancelled and nothing is sent to the patient any more. The erasure is only
 *    deferred: the record is marked (patients.erasureRequestedAt) and the retention job
 *    pseudonymises it the day after `retainUntil`, whatever the practice's erasureDefault.
 *
 * Answering the request (opts.answer): the request is closed in the same transaction and the
 * answer is sent afterwards to the contact the record had, so erasing never leaves staff unable
 * to answer (Art. 12(3)-(4), 19). Other open requests of the patient keep their text, and that
 * contact in their (encrypted) answerContact, until they are answered; closed ones lose their free
 * text and contact.
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
export { ERASED_FIRST_NAME, ERASED_LAST_NAME, ERASED_NAME };

export type ErasureMode = "anonymise" | "restrict";

/**
 * Before patients.erasureRequestedAt existed, a deferred erasure was marked by this prefix on
 * restrictionReason ("erasure:<reason>"). Migration 0003 copied those marks into the column; the
 * prefix is still read (isDeferredErasure, restrictionReasonView) and no longer written.
 */
export const ERASURE_DEFERRED_PREFIX = "erasure:";

/** restrictionReason codes written by the retention job (shown translated, never as is). */
export const RETENTION_REASONS = { inactive: "retention:inactive", never_seen: "retention:never_seen" } as const;

/**
 * A restricted record whose erasure was requested and deferred to retainUntil (erasePatient in
 * 'restrict' mode): the retention job pseudonymises it once that date has passed.
 */
export function isDeferredErasure(p: Pick<Patient, "restrictedAt" | "restrictionReason" | "erasureRequestedAt">): boolean {
  return Boolean(p.restrictedAt && (p.erasureRequestedAt || p.restrictionReason?.startsWith(ERASURE_DEFERRED_PREFIX)));
}

/**
 * A restriction reason for display: a deferred erasure marked the old way (with the reason staff
 * gave), a retention code (to translate), or the free text staff typed.
 */
export function restrictionReasonView(reason: string | null): { kind: "erasure" | "retention_inactive" | "retention_never_seen" | "text"; text: string | null } {
  if (!reason) return { kind: "text", text: null };
  if (reason.startsWith(ERASURE_DEFERRED_PREFIX)) return { kind: "erasure", text: reason.slice(ERASURE_DEFERRED_PREFIX.length).trim() || null };
  if (reason === RETENTION_REASONS.inactive) return { kind: "retention_inactive", text: null };
  if (reason === RETENTION_REASONS.never_seen) return { kind: "retention_never_seen", text: null };
  return { kind: "text", text: reason };
}

export type ErasureErrorCode =
  | "not_found"
  | "already_erased"
  | "erased"
  | "not_restricted"
  | "reason_required"
  | "retain_until_required"
  | "invalid_retain_until"
  | "forms_not_exported"
  | "notice_required"
  | "answer_required"
  | "request_invalid"
  | "request_closed";

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
   * so they are not deleted while it must be kept: 'fail' refuses the erasure (staff export them
   * first or restrict), 'restrict' restricts the record instead (the retention job), 'delete'
   * deletes them anyway — only once the record's own keep-until date has passed (a deferred
   * erasure carried out by the retention job).
   */
  unexportedForms?: "fail" | "restrict" | "delete";
  /**
   * The privacy request this erasure answers (open, of this patient): it is closed with
   * `text` as the answer — granted when pseudonymised, granted in part when kept and restricted —
   * and the answer is sent to the patient's contact before it is removed.
   */
  answer?: { requestId: string; text: string };
};

export type ErasureResult = {
  mode: ErasureMode;
  counts: Record<string, number>;
  /** When opts.answer was given: whether the answer reached the requester. */
  answered?: { requestId: string; notified: boolean };
};

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
 * Blank the text of the messages linked to these records (by patient or appointment) and mask
 * their addresses; returns how many, and the provider copies still to delete.
 */
async function redactLinkedMessages(
  tx: Tx,
  orgId: string,
  ids: string[],
  apptIds: string[],
  now: Date,
  onlyUnredacted = false,
): Promise<{ count: number; copies: ProviderCopy[] }> {
  const linked = or(inArray(messages.patientId, ids), apptIds.length ? inArray(messages.appointmentId, apptIds) : undefined);
  const conditions: (SQL | undefined)[] = [eq(messages.orgId, orgId), linked];
  if (onlyUnredacted) conditions.push(isNull(messages.redactedAt));
  const msgs = await tx
    .select({ id: messages.id, to: messages.to, from: messages.from, provider: messages.provider, providerId: messages.providerId, providerDeletedAt: messages.providerDeletedAt })
    .from(messages)
    .where(and(...conditions));
  const copies: ProviderCopy[] = [];
  for (const m of msgs) {
    await tx
      .update(messages)
      .set({ body: "", subject: null, html: null, to: maskAddress(m.to) ?? "", from: maskAddress(m.from), redactedAt: now })
      .where(eq(messages.id, m.id));
    if (m.providerId && !m.providerDeletedAt) copies.push({ id: m.id, provider: m.provider, providerId: m.providerId });
  }
  return { count: msgs.length, copies };
}

/** Delete provider copies (network calls: outside any transaction). Failures are logged, not thrown. */
async function deleteCopies(copies: ProviderCopy[]) {
  for (const m of copies) {
    try {
      await deleteProviderMessage(m.provider, m.providerId);
      await db.update(messages).set({ providerDeletedAt: new Date() }).where(eq(messages.id, m.id));
    } catch (err) {
      logError("erasure", err, { step: "provider-delete", messageId: m.id });
    }
  }
}

const NO_REQUEST_TEXT = { details: null, decisionReason: null, extensionReason: null, answerContact: null } as const;

/**
 * Reviews stay (rating, date) under a pseudonym; every free text about them goes: the comment, the
 * practice's public reply (often "Dear Mr …"), the removal reason, and the reports' details, the
 * patient's own response and the statement of reasons.
 */
async function pseudonymiseReviews(tx: Tx, orgId: string, apptIds: string[]): Promise<Record<string, number>> {
  if (!apptIds.length) return {};
  const reviewIds = (
    await tx
      .select({ id: reviews.id })
      .from(reviews)
      .where(and(eq(reviews.orgId, orgId), inArray(reviews.appointmentId, apptIds)))
  ).map((r) => r.id);
  if (!reviewIds.length) return {};
  return {
    reviewsPseudonymised: (
      await tx
        .update(reviews)
        .set({ authorName: ERASED_NAME, authorDisplay: "pseudonym", comment: null, reply: null, removedReason: null })
        .where(and(eq(reviews.orgId, orgId), inArray(reviews.id, reviewIds)))
    ).rowsAffected,
    reviewReportsScrubbed: (
      await tx
        .update(reviewReports)
        .set({ details: null, patientResponse: null, decisionReason: null })
        .where(and(eq(reviewReports.orgId, orgId), inArray(reviewReports.reviewId, reviewIds)))
    ).rowsAffected,
  };
}

/**
 * Unlink Sorriso's own consent rows (org_id NULL) from these records: they stay as proof (Art.
 * 7(1)) and the platform retention deletes them consentMonths after unlinkedAt.
 */
async function unlinkPlatformConsents(tx: Tx, ids: string[], now: Date): Promise<number> {
  return (
    await tx
      .update(consents)
      .set({ patientId: null, unlinkedAt: now })
      .where(and(isNull(consents.orgId), inArray(consents.patientId, ids)))
  ).rowsAffected;
}

/** Remove the no-show risk score stored on these records' visits (profiling of a restricted or erased record). */
export async function clearStoredRisk(tx: Tx, orgId: string, ids: string[]): Promise<number> {
  if (!ids.length) return 0;
  return (
    await tx
      .update(appointments)
      .set({ riskLevel: null, riskReasons: [], riskComputedAt: null })
      .where(and(eq(appointments.orgId, orgId), inArray(appointments.patientId, ids), isNotNull(appointments.riskComputedAt)))
  ).rowsAffected;
}

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
  const answerText = opts.answer?.text.trim() ?? "";
  if (opts.answer && answerText.length < 3) throw new ErasureError("answer_required");

  const providerCopies: ProviderCopy[] = [];
  // Set inside the transaction (declared this way so TypeScript doesn't narrow them to null):
  // the record before the change, whose contact receives the answer, and the request answered.
  let before = null as Patient | null;
  let answered = null as PrivacyRequest | null;
  const result = await db.transaction(async (tx): Promise<ErasureResult> => {
    const [p] = await tx
      .select()
      .from(patients)
      .where(and(eq(patients.orgId, orgId), eq(patients.id, patientId)));
    if (!p) throw new ErasureError("not_found");
    if (p.erasedAt) throw new ErasureError("already_erased");
    before = p;

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
      // Signed forms only: an unsigned row just records that an invitation was sent (no answers).
      .where(
        and(eq(formSubmissions.orgId, orgId), inArray(formSubmissions.patientId, ids), isNotNull(formSubmissions.signedAt), isNull(formSubmissions.exportedAt)),
      );
    if (mode === "anonymise" && unexported > 0) {
      const policy = opts.unexportedForms ?? "fail";
      if (policy === "fail") throw new ErasureError("forms_not_exported");
      if (policy === "restrict") mode = "restrict";
    }

    let answerId: string | null = null;
    if (opts.answer) {
      const r = await getPrivacyRequest(orgId, opts.answer.requestId, tx);
      if (!r || !r.patientId || !ids.includes(r.patientId)) throw new ErasureError("request_invalid");
      if (!isOpenRequest(r)) throw new ErasureError("request_closed");
      answerId = r.id;
    }
    // Closed once the record shows the change (completePrivacyRequest checks it): granted when
    // pseudonymised, granted in part when kept and restricted.
    const closeRequest = async () => {
      if (!answerId) return;
      answered = await completePrivacyRequest(tx, {
        orgId,
        id: answerId,
        decision: mode === "anonymise" ? "granted" : "partially_granted",
        reason: answerText,
        actor: opts.actor,
        headers: opts.headers,
        now,
      });
    };

    const counts: Record<string, number> = {};
    const future = await cancelFuture(tx, orgId, apptIds, now);
    counts.appointmentsCancelled = future.appointments;
    counts.remindersCancelled = future.reminders;

    if (mode === "restrict") {
      // A restriction asked for in place of erasure is marked (erasureRequestedAt), so it is
      // carried out after retainUntil; one forced by unexported forms (the retention job) is not.
      const deferred = opts.mode === "restrict";
      await tx
        .update(patients)
        .set({
          restrictedAt: p.restrictedAt ?? now,
          restrictionReason: reason.slice(0, 500),
          retainUntil: opts.retainUntil ?? p.retainUntil,
          ...(deferred ? { erasureRequestedAt: p.erasureRequestedAt ?? now } : {}),
        })
        .where(and(eq(patients.orgId, orgId), inArray(patients.id, ids)));
      // Not clinical, and the patient asked to leave: the waitlist goes, recalls stop.
      counts.waitlistDeleted = (await tx.delete(waitlist).where(and(eq(waitlist.orgId, orgId), inArray(waitlist.patientId, ids)))).rowsAffected;
      counts.recallsDismissed = (
        await tx
          .update(recalls)
          .set({ status: "dismissed", updatedAt: now })
          .where(and(eq(recalls.orgId, orgId), inArray(recalls.patientId, ids), inArray(recalls.status, ["due", "sent", "call"])))
      ).rowsAffected;
      // Profiling stops with the restriction (Art. 18(2)): no stored risk score stays on the visits.
      counts.risksCleared = await clearStoredRisk(tx, orgId, ids);
      await closeRequest();
      await audit(
        {
          orgId,
          actor: opts.actor,
          action: "patient.restrict",
          entity: { type: "patient", id: patientId },
          reason,
          metadata: { erasureRequest: true, retainUntil: opts.retainUntil ?? null, requested: opts.mode, requestId: answerId, ...counts },
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

    const redacted = await redactLinkedMessages(tx, orgId, ids, apptIds, now);
    providerCopies.push(...redacted.copies);
    counts.messagesRedacted = redacted.count;

    counts.waitlistDeleted = (await tx.delete(waitlist).where(and(eq(waitlist.orgId, orgId), inArray(waitlist.patientId, ids)))).rowsAffected;
    counts.recallsDeleted = (await tx.delete(recalls).where(and(eq(recalls.orgId, orgId), inArray(recalls.patientId, ids)))).rowsAffected;
    counts.formsDeleted = (
      await tx.delete(formSubmissions).where(and(eq(formSubmissions.orgId, orgId), inArray(formSubmissions.patientId, ids)))
    ).rowsAffected;

    // The ledger stays as proof of what was consented (Art. 7(1), 17(3)(e)), unlinked from the
    // record; retention deletes it consentMonths after unlinkedAt. Sorriso's own rows about the
    // record (org_id NULL: platform_booking_art9, review_publication) are unlinked too, so the
    // platform's retention clock starts for them as well.
    counts.consentsUnlinked = (
      await tx
        .update(consents)
        .set({ patientId: null, unlinkedAt: now })
        .where(and(eq(consents.orgId, orgId), inArray(consents.patientId, ids)))
    ).rowsAffected;
    counts.platformConsentsUnlinked = await unlinkPlatformConsents(tx, ids, now);

    Object.assign(counts, await pseudonymiseReviews(tx, orgId, apptIds));

    // Privacy requests keep their type, dates and decision (accountability). Closed ones lose
    // their free text, which may name the patient. Open ones are still to be answered: they keep
    // it, and the contact the record had in answerContact (encrypted), until answered (or 30 days
    // after closing).
    const contacts = contactsOf(p);
    for (const r of await tx
      .select({ id: privacyRequests.id, status: privacyRequests.status, answerContact: privacyRequests.answerContact })
      .from(privacyRequests)
      .where(and(eq(privacyRequests.orgId, orgId), inArray(privacyRequests.patientId, ids)))) {
        // The request answered now is handled once its answer is sent.
      if (r.id === answerId) continue;
      await tx
        .update(privacyRequests)
        .set(isOpenRequest(r) ? { answerContact: joinContacts(contacts, r.answerContact) } : NO_REQUEST_TEXT)
        .where(eq(privacyRequests.id, r.id));
    }

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
        erasureRequestedAt: null,
        possibleDuplicateOfId: null,
        erasedAt: now,
      })
      .where(and(eq(patients.orgId, orgId), inArray(patients.id, ids)));
    counts.patients = ids.length;
    counts.risksCleared = await clearStoredRisk(tx, orgId, ids);
    await closeRequest();

    await audit(
      {
        orgId,
        actor: opts.actor,
        action: "patient.erase",
        entity: { type: "patient", id: patientId },
        reason,
        metadata: { mode: "anonymise", requestId: answerId, ...counts },
        headers: opts.headers,
        at: now,
      },
      tx,
    );
    return { mode, counts };
  });

  // Network calls stay outside the transaction (it holds the write lock).
  await deleteCopies(providerCopies);
  if (answered && before) result.answered = await sendAnswer(orgId, answered, before, result.mode, now);
  return result;
}

/**
 * Send the answer of the request an erasure closed, to the contact the record had. After a
 * pseudonymisation the answer is erased like every other message of the record (masked address,
 * no text) and the request loses its free text; if it could not be sent, the request keeps the
 * answer and that contact (answerContact, encrypted) so staff can send it by hand, until the
 * retention job clears them ERASED_REQUEST_TEXT_DAYS after closing.
 */
async function sendAnswer(
  orgId: string,
  r: PrivacyRequest,
  before: Patient,
  mode: ErasureMode,
  now: Date,
): Promise<{ requestId: string; notified: boolean }> {
  const notified = await notifyRequester(r, DECISION_KIND[r.decision ?? "granted"], { now, patient: before }).catch((err: unknown) => {
    logError("erasure", err, { step: "answer", requestId: r.id });
    return false;
  });
  if (mode === "anonymise") {
    try {
      const ids = await lineage(db, orgId, before.id);
      const redacted = await db.transaction((tx) => redactLinkedMessages(tx, orgId, ids, [], now, true));
      await db
        .update(privacyRequests)
        .set(notified ? NO_REQUEST_TEXT : { answerContact: joinContacts(contactsOf(before), r.answerContact) })
        .where(and(eq(privacyRequests.orgId, orgId), eq(privacyRequests.id, r.id)));
      await deleteCopies(redacted.copies);
    } catch (err) {
      logError("erasure", err, { step: "answer-redaction", requestId: r.id });
    }
  }
  return { requestId: r.id, notified };
}

// ---------------------------------------------------------------- Sorriso's own data (platform inbox)

/**
 * Carry out a request made to Sorriso as controller of its marketplace (the platform inbox) for
 * one patient record. The practice's copy is not touched: it stays the practice's, under Art.
 * 9(2)(h).
 * - 'stop' (restriction, objection): every Sorriso consent still standing (platform_booking_art9,
 *   review_publication) gets a withdrawal row, so Sorriso's own processing stops, and the
 *   record's published reviews are taken down (kept, unpublished).
 * - 'erase' (erasure): Sorriso's consent rows are unlinked from the record (kept as proof, deleted
 *   by the platform retention) and the record's reviews are pseudonymised.
 * Audited in the platform chain (consent.record rows, and patient.erase for 'erase').
 */
export async function erasePlatformData(
  patientId: string,
  i: { mode: "stop" | "erase"; actor: ErasureActor; requestId?: string | null; headers?: Headers; now?: Date },
): Promise<Record<string, number>> {
  const now = i.now ?? new Date();
  return db.transaction(async (tx) => {
    const [p] = await tx.select().from(patients).where(eq(patients.id, patientId));
    if (!p) throw new ErasureError("not_found");
    const ids = await lineage(tx, p.orgId, p.id);
    const apptIds = (
      await tx
        .select({ id: appointments.id })
        .from(appointments)
        .where(and(eq(appointments.orgId, p.orgId), inArray(appointments.patientId, ids)))
    ).map((a) => a.id);
    const counts: Record<string, number> = {};
    if (i.mode === "erase") {
      counts.platformConsentsUnlinked = await unlinkPlatformConsents(tx, ids, now);
      Object.assign(counts, await pseudonymiseReviews(tx, p.orgId, apptIds));
      await audit(
        {
          orgId: null,
          actor: i.actor,
          action: "patient.erase",
          entity: { type: "patient", id: p.id },
          reason: "platform",
          metadata: { scope: "platform", requestId: i.requestId ?? null, ...counts },
          headers: i.headers,
          at: now,
        },
        tx,
      );
      return counts;
    }
    counts.withdrawals = 0;
    if (!p.erasedAt && !p.mergedIntoId) {
      const ledger = await currentConsents(p.id, tx);
      for (const purpose of PLATFORM_CONSENT_PURPOSES) {
        if (ledger[purpose]?.granted === false) continue;
        await withdrawConsent(tx, { orgId: p.orgId, patientId: p.id, purpose, locale: p.locale, method: "staff_recorded", source: "staff", actorRelation: "staff", actor: i.actor, headers: i.headers, now });
        counts.withdrawals++;
      }
    }
    if (apptIds.length) {
      counts.reviewsUnpublished = (
        await tx
          .update(reviews)
          .set({ status: "withdrawn", published: false, decidedAt: now })
          .where(and(eq(reviews.orgId, p.orgId), inArray(reviews.appointmentId, apptIds), inArray(reviews.status, ["pending", "published", "under_review"])))
      ).rowsAffected;
    }
    return counts;
  });
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
 * erasePatient(mode 'restrict'). Calling it again updates the reason; a deferred erasure stays
 * one (erasureRequestedAt is kept: it is still carried out after retainUntil).
 */
export async function restrictPatient(orgId: string, patientId: string, i: RestrictionInput): Promise<void> {
  const now = i.now ?? new Date();
  const reason = i.reason.trim();
  if (!reason) throw new ErasureError("reason_required");
  if (i.retainUntil && !isDateString(i.retainUntil)) throw new ErasureError("invalid_retain_until");
  await db.transaction(async (tx) => {
    const p = await loadPatient(tx, orgId, patientId);
    if (p.erasedAt) throw new ErasureError("erased");
    // A record still marked the old way (prefix only) keeps its deferred erasure in the column.
    const deferredSince = p.erasureRequestedAt ?? (isDeferredErasure(p) ? (p.restrictedAt ?? now) : null);
    await tx
      .update(patients)
      .set({ restrictedAt: p.restrictedAt ?? now, restrictionReason: reason.slice(0, 500), retainUntil: i.retainUntil ?? p.retainUntil, erasureRequestedAt: deferredSince })
      .where(and(eq(patients.orgId, orgId), eq(patients.id, patientId)));
    // Restricted data may only be stored (Art. 18(2)): no risk score stays on the visits.
    const risksCleared = await clearStoredRisk(tx, orgId, [patientId]);
    await audit(
      {
        orgId,
        actor: i.actor,
        action: "patient.restrict",
        entity: { type: "patient", id: patientId },
        reason,
        metadata: { retainUntil: i.retainUntil ?? null, update: Boolean(p.restrictedAt), risksCleared },
        headers: i.headers,
        at: now,
      },
      tx,
    );
  });
}

/**
 * Lift a restriction, with the reason (at least 3 characters, stored encrypted in the audit row).
 * Art. 18(3): the patient is told before it is lifted — by email or SMS to their own contact; when
 * there is none, staff must confirm they informed them another way (`informedOtherwise`), or it
 * fails with notice_required. Lifting a deferred erasure (the patient withdrew the request) ends it.
 */
export async function unrestrictPatient(
  orgId: string,
  patientId: string,
  i: { reason: string; informedOtherwise?: boolean; actor: ErasureActor; headers?: Headers; now?: Date },
): Promise<{ notified: boolean }> {
  const now = i.now ?? new Date();
  const reason = (i.reason ?? "").trim();
  if (reason.length < 3) throw new ErasureError("reason_required");
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
      .set({ restrictedAt: null, restrictionReason: null, erasureRequestedAt: null })
      .where(and(eq(patients.orgId, orgId), eq(patients.id, patientId)));
    await audit(
      {
        orgId,
        actor: i.actor,
        action: "patient.unrestrict",
        entity: { type: "patient", id: patientId },
        reason: reason.slice(0, 500),
        metadata: { notified, informedOtherwise: Boolean(i.informedOtherwise), deferredErasure: isDeferredErasure(p) },
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
