import { and, asc, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { db, type Tx } from "@/db";
import type { Locale, ReviewAuthorDisplay, ReviewReportGround, ReviewReportStatus, ReviewStatus } from "@/db/enums";
import { appointments, organizations, practitioners, reviewReports, reviews, users, type Review, type ReviewReport } from "@/db/schema";
import { DEFAULT_LOCALE, isLocale } from "@/i18n/config";
import { fmtDay, zonedDate } from "@/i18n/datefmt";
import { lhref } from "@/i18n/href";
import { getT } from "@/i18n/t";
import { getAppointmentDetails, type AppointmentDetails } from "./appointments";
import { audit, type AuditEvent } from "./audit";
import { absoluteUrl, APP_NAME } from "./config";
import { ageOn, GUARDIAN_ROUTING_AGE, isMinor } from "./contact";
import { decrypt, encrypt, hmac, isEncrypted } from "./crypto";
import { reviewFlags, scanHealthTerms } from "./health-terms";
import { newId } from "./ids";
import { isManageLinkValid, manageLinkValidUntil } from "./links";
import { logError } from "./log";
import { deliver, sendPatientMessage } from "./messaging";
import { DEFAULT_BRAND_COLOR, renderEmailLayout } from "./messaging/layout";
import { ConsentError, recordConsent, withdrawConsent } from "./privacy/consent";

/**
 * Patient reviews (WP7): publication consent, the health-term check, editing and withdrawal by
 * the author, the practice's replies and reports, and moderation by Sorriso.
 *
 * Who decides what:
 *  - the author publishes (with consent), edits while their link is valid, and withdraws at any
 *    time (here through the link, or through WP4's privacy center);
 *  - the practice replies and reports, nothing else: no practice action can change a review's
 *    status except that its report hides the review while moderators check it;
 *  - Sorriso's moderators (platform admins) ask the author for their side, then keep or remove
 *    the review with a statement of reasons sent to both sides (DSA Art. 17); each side can
 *    appeal once (DSA Art. 20), and a different moderator decides the appeal.
 *
 * Health data: comments the flagger holds are stored encrypted (AAD "reviews.comment") until a
 * moderator publishes them, and so are removed ones; the practice's report details, the author's
 * reply to the moderators and the moderators' statements of reasons (review_reports.decision_reason,
 * reviews.removed_reason: they often describe what was wrong) are always encrypted. Published
 * comments are plain text (they are public). The practice sees a comment only while that text is
 * the public one. Practice replies go through the same flagger and can't carry health or contact
 * details.
 * Audit: review.reply, review.report, review.moderate (with the statement of reasons as reason),
 * review.withdraw; publication consent is in the ledger (consent.record).
 */

export const COMMENT_MAX = 2000;
export const REPLY_MAX = 1000;
export const REPORT_TEXT_MAX = 2000;
export const REASON_MIN = 20;
export const REASON_MAX = 2000;
/** The author has this long to reply to a moderation request. */
export const AUTHOR_RESPONSE_DAYS = 7;
/** Appeals are accepted for six months after a decision (DSA Art. 20(1)). */
export const APPEAL_DAYS = 183;
/** Stored in reviews.author_name for pseudonymous reviews; never shown (the label is translated). */
export const PSEUDONYM_AUTHOR_NAME = "Verified patient";

const DAY_MS = 86_400_000;
const COMMENT_AAD = "reviews.comment";
const DETAILS_AAD = "review_reports.details";
const RESPONSE_AAD = "review_reports.patient_response";
const DECISION_AAD = "review_reports.decision_reason";
const REMOVED_AAD = "reviews.removed_reason";
/** reporterContactHash markers for reports nobody filed by hand. */
const AUTO_CHECK = "auto";
const AUTHOR_APPEAL = "author";

// ---------------------------------------------------------------- stored texts

/** A held comment is encrypted; a published one is plain (it is public anyway). */
function storedComment(comment: string | null, held: boolean): string | null {
  return comment && held ? encrypt(comment, COMMENT_AAD) : comment;
}

/** The stored form of a comment held for moderation (encrypted). For seeds and imports. */
export function heldCommentValue(comment: string): string {
  return encrypt(comment, COMMENT_AAD);
}

/** A report's stored details (encrypted JSON). For seeds and imports. */
export function reportDetailsValue(text: string): string {
  return encodeDetails({ text });
}

/** A moderator's statement of reasons as stored on a report (encrypted). For seeds and imports. */
export function decisionReasonValue(reason: string): string {
  return encrypt(reason, DECISION_AAD);
}

/** The statement of reasons as stored on a removed review (encrypted). For seeds and imports. */
export function removedReasonValue(reason: string): string {
  return encrypt(reason, REMOVED_AAD);
}

export function readComment(value: string | null): string | null {
  if (value == null) return null;
  try {
    return decrypt(value, COMMENT_AAD);
  } catch (err) {
    logError("reviews", err, { step: "decrypt_comment" });
    return null;
  }
}

type ReportDetails = { text: string | null; name?: string; email?: string; locale?: Locale };

function encodeDetails(d: ReportDetails): string {
  return encrypt(JSON.stringify(d), DETAILS_AAD);
}

export function readReportDetails(value: string | null): ReportDetails {
  if (!value) return { text: null };
  try {
    const plain = decrypt(value, DETAILS_AAD);
    try {
      const parsed = JSON.parse(plain) as ReportDetails;
      return typeof parsed === "object" && parsed ? parsed : { text: plain };
    } catch {
      return { text: plain };
    }
  } catch (err) {
    logError("reviews", err, { step: "decrypt_details" });
    return { text: null };
  }
}

export function readAuthorResponse(value: string | null): string | null {
  return readEncrypted(value, RESPONSE_AAD, "decrypt_response");
}

function readEncrypted(value: string | null, aad: string, step: string): string | null {
  if (!value) return null;
  try {
    return decrypt(value, aad);
  } catch (err) {
    logError("reviews", err, { step });
    return null;
  }
}

/** A moderator's statement of reasons as stored on review_reports (encrypted). */
export function readDecisionReason(value: string | null): string | null {
  return readEncrypted(value, DECISION_AAD, "decrypt_decision_reason");
}

/** The statement of reasons stored on a removed review (encrypted). */
export function readRemovedReason(value: string | null): string | null {
  return readEncrypted(value, REMOVED_AAD, "decrypt_removed_reason");
}

/** A report row with its statement of reasons readable (for pages and emails, never stored back). */
function withReadableReason(r: ReviewReport): ReviewReport {
  return { ...r, decisionReason: readDecisionReason(r.decisionReason) };
}

/** Trim, normalise newlines, cap; empty becomes null. */
function cleanText(value: unknown, max: number): string | null | "too_long" {
  const text = String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .trim();
  if (!text) return null;
  return text.length > max ? "too_long" : text;
}

// ---------------------------------------------------------------- signed moderation links

/**
 * A link for the author to answer a moderation request and to appeal a decision. It names one
 * report and expires; it is separate from the visit's manage link, which may have expired.
 */
export function reviewLinkToken(reportId: string, expiresAt: Date): string {
  const exp = Math.floor(expiresAt.getTime() / 1000).toString(36);
  return `${reportId}_${exp}_${linkSignature(reportId, exp)}`;
}

function linkSignature(reportId: string, exp: string): string {
  return hmac(`review-report:${reportId}:${exp}`, "token").slice(0, 32);
}

export function verifyReviewLinkToken(token: string, now: Date = new Date()): { reportId: string } | null {
  const m = /^([0-9A-Za-z]{6,40})_([0-9a-z]{1,12})_([0-9a-f]{32})$/.exec(token);
  if (!m) return null;
  const [, reportId, exp, sig] = m;
  if (linkSignature(reportId, exp) !== sig) return null;
  if (parseInt(exp, 36) * 1000 < now.getTime()) return null;
  return { reportId };
}

export function reviewLinkUrl(locale: Locale, reportId: string, expiresAt: Date): string {
  return absoluteUrl(lhref(locale, `/a/${reviewLinkToken(reportId, expiresAt)}/review/respond`));
}

// ---------------------------------------------------------------- the author

export type ReviewInput = {
  rating: number;
  comment: string | null;
  display: ReviewAuthorDisplay;
  locale: Locale;
};

export type ReviewError =
  | "link_invalid"
  | "not_completed"
  | "already_reviewed"
  | "consent_required"
  | "rating_invalid"
  | "too_long"
  | "guardian_required"
  | "closed"
  | "not_patient";

export type ReviewResult = { ok: true; reviewId: string; status: ReviewStatus } | { ok: false; code: ReviewError };

/** The review written about this visit, as its author sees it (comment decrypted). */
export async function reviewForAppointment(appointmentId: string) {
  const [r] = await db.select().from(reviews).where(eq(reviews.appointmentId, appointmentId));
  return r ? { ...r, comment: readComment(r.comment) } : null;
}

/** "Giulia R." for the first-name-and-initial display. */
export function firstInitialName(p: { firstName: string; lastName: string }): string {
  const initial = p.lastName.trim().charAt(0).toUpperCase();
  return initial ? `${p.firstName.trim()} ${initial}.` : p.firstName.trim();
}

/** Children's reviews never carry their name, whatever was chosen. */
function displayFor(d: AppointmentDetails, chosen: ReviewAuthorDisplay, now: Date): ReviewAuthorDisplay {
  return isMinor(d.patient, now) ? "pseudonym" : chosen;
}

function validate(input: ReviewInput): ReviewError | { comment: string | null } {
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) return "rating_invalid";
  const comment = cleanText(input.comment, COMMENT_MAX);
  if (comment === "too_long") return "too_long";
  return { comment };
}

/** Who writes, edits or deletes a review, for the consent ledger and the audit log. */
export type ReviewActing = { actor: AuditEvent["actor"]; actorRelation: "self" | "parent" | "legal_guardian" };

/**
 * Who holds the visit link when the link alone is enough to act on the visit's review: the
 * patient's own booking (or, for a child under 14, their parent or guardian, to whom the link and
 * messages go). Null when someone else booked: for another adult, or for a minor who is now 14 or
 * older (who consents to publication themselves, Art. 2-quinquies Codice privacy). That person
 * holds the link too (the confirmation page shows it), so the review, its text and the
 * publication consent then need the step-up: a one-time code to the patient's own contact
 * (privacy-center.ts reviewActing), the same rule as linkRecord() for the privacy page.
 */
export function reviewLinkActing(d: Pick<AppointmentDetails, "appointment" | "patient">, now: Date = new Date()): ReviewActing | null {
  const age = ageOn(d.patient.birthDate, now);
  const child = age !== null && age < GUARDIAN_ROUTING_AGE;
  const bookedFor = d.appointment.bookedFor;
  if (bookedFor === "other_adult" || (bookedFor === "minor" && !child)) return null;
  return {
    actor: { type: "patient_link", id: d.appointment.id },
    actorRelation: child && d.patient.guardianRelation ? d.patient.guardianRelation : "self",
  };
}

/**
 * Publish a review of a completed visit through the patient's link. Requires the explicit,
 * unticked consent (consents.review_publication), recorded in the ledger. A comment with health
 * or contact details is held for moderation (under_review), otherwise published at once.
 *
 * For a child under 14 the link went to the parent or guardian (recipientFor), so they are the
 * ones consenting; without a guardian on file the review is refused (guardian_required). When
 * someone else booked (reviewLinkActing is null) only the patient may write it, after the step-up:
 * the caller passes `acting` (privacy-center.ts reviewActing); without it the review is refused
 * (not_patient), so the ledger never records the booker's consent as the patient's own.
 */
export async function submitReview(
  token: string,
  input: ReviewInput & { consent: boolean; acting?: ReviewActing | null; headers?: Headers; now?: Date },
): Promise<ReviewResult> {
  const now = input.now ?? new Date();
  const d = await getAppointmentDetails({ token });
  if (!d || !isManageLinkValid(d.appointment, now)) return { ok: false, code: "link_invalid" };
  const acting = input.acting ?? reviewLinkActing(d, now);
  if (!acting) return { ok: false, code: "not_patient" };
  if (d.appointment.status !== "completed") return { ok: false, code: "not_completed" };
  if (!input.consent) return { ok: false, code: "consent_required" };
  const checked = validate(input);
  if (typeof checked === "string") return { ok: false, code: checked };

  const actorRelation = acting.actorRelation;
  const flags = reviewFlags(checked.comment);
  const status: ReviewStatus = flags.length ? "under_review" : "published";
  const display = displayFor(d, input.display, now);
  const id = newId();
  try {
    await db.transaction(async (tx) => {
      const [existing] = await tx.select({ id: reviews.id }).from(reviews).where(eq(reviews.appointmentId, d.appointment.id));
      if (existing) throw new ReviewFlowError("already_reviewed");
      await tx.insert(reviews).values({
        id,
        orgId: d.org.id,
        practitionerId: d.practitioner.id,
        appointmentId: d.appointment.id,
        rating: input.rating,
        comment: storedComment(checked.comment, status !== "published"),
        authorName: display === "first_initial" ? firstInitialName(d.patient) : PSEUDONYM_AUTHOR_NAME,
        authorDisplay: display,
        locale: input.locale,
        flags,
        status,
        published: status === "published",
        publishedAt: status === "published" ? now : null,
        createdAt: now,
      });
      const consentId = await recordConsent(tx, {
        orgId: d.org.id,
        patientId: d.patient.id,
        purpose: "review_publication",
        granted: true,
        locale: input.locale,
        method: "web_checkbox",
        source: "review",
        actorRelation,
        actor: acting.actor,
        appointmentId: d.appointment.id,
        headers: input.headers,
        now,
      });
      await tx.update(reviews).set({ consentId }).where(eq(reviews.id, id));
    });
  } catch (err) {
    if (err instanceof ReviewFlowError) return { ok: false, code: err.code };
    if (err instanceof ConsentError && err.code === "guardian_required") return { ok: false, code: "guardian_required" };
    throw err;
  }
  return { ok: true, reviewId: id, status };
}

class ReviewFlowError extends Error {
  constructor(public code: ReviewError) {
    super(code);
    this.name = "ReviewFlowError";
  }
}

const OPEN_STATUSES = ["open", "awaiting_patient"] as const;
const isOpen = (r: Pick<ReviewReport, "status">) => (OPEN_STATUSES as readonly string[]).includes(r.status);

/**
 * Is the practice's report about this review being handled? Only that hides a review while the
 * moderators check it: a notice from the public and an appeal leave it as it is.
 */
async function hidingReport(tx: Tx, reviewId: string): Promise<ReviewReport | null> {
  const [r] = await tx
    .select()
    .from(reviewReports)
    .where(
      and(
        eq(reviewReports.reviewId, reviewId),
        inArray(reviewReports.status, [...OPEN_STATUSES]),
        isNull(reviewReports.appealOfId),
        isNotNull(reviewReports.reporterUserId),
      ),
    )
    .limit(1);
  return r ?? null;
}

/**
 * The author edits their review while their link is valid. The new text goes through the same
 * check; a review under the practice's report stays hidden until the moderators decide. A text
 * that isn't published at once is stored encrypted, like any held text.
 */
export async function updateReview(token: string, input: ReviewInput & { acting?: ReviewActing | null; now?: Date }): Promise<ReviewResult> {
  const now = input.now ?? new Date();
  const d = await getAppointmentDetails({ token });
  if (!d || !isManageLinkValid(d.appointment, now)) return { ok: false, code: "link_invalid" };
  // Only the author: the patient (step-up when someone else booked; see reviewLinkActing).
  if (!(input.acting ?? reviewLinkActing(d, now))) return { ok: false, code: "not_patient" };
  const checked = validate(input);
  if (typeof checked === "string") return { ok: false, code: checked };
  const [r] = await db.select().from(reviews).where(eq(reviews.appointmentId, d.appointment.id));
  if (!r) return { ok: false, code: "link_invalid" };
  if (r.status === "removed" || r.status === "withdrawn") return { ok: false, code: "closed" };

  const flags = reviewFlags(checked.comment);
  const reported = await hidingReport(db, r.id);
  const status: ReviewStatus = flags.length || reported ? "under_review" : "published";
  const display = displayFor(d, input.display, now);
  await db
    .update(reviews)
    .set({
      rating: input.rating,
      comment: storedComment(checked.comment, status !== "published"),
      authorDisplay: display,
      authorName: display === "first_initial" ? firstInitialName(d.patient) : PSEUDONYM_AUTHOR_NAME,
      locale: input.locale,
      flags,
      status,
      published: status === "published",
      publishedAt: status === "published" ? (r.publishedAt ?? now) : r.publishedAt,
      editedAt: now,
    })
    .where(eq(reviews.id, r.id));
  return { ok: true, reviewId: r.id, status };
}

/**
 * The author takes their review down: it leaves every public page for good, its text is
 * cleared, the publication consent is withdrawn in the ledger and the action is audited.
 * `actor` is who did it: the patient through their link (patient_link) or a privacy-center
 * session (patient_session). Open reports about it are closed. Idempotent.
 */
export async function withdrawReview(reviewId: string, actor: AuditEvent["actor"]): Promise<void> {
  const [row] = await db
    .select({ review: reviews, patientId: appointments.patientId })
    .from(reviews)
    .innerJoin(appointments, eq(appointments.id, reviews.appointmentId))
    .where(eq(reviews.id, reviewId));
  if (!row || row.review.status === "withdrawn") return;
  const { review, patientId } = row;
  const locale = isLocale(review.locale) ? review.locale : DEFAULT_LOCALE;
  await db.transaction(async (tx) => {
    await tx
      .update(reviews)
      .set({ status: "withdrawn", published: false, comment: null, reply: null, decidedAt: new Date() })
      .where(eq(reviews.id, reviewId));
    await tx
      .update(reviewReports)
      .set({ status: "closed" })
      .where(and(eq(reviewReports.reviewId, reviewId), inArray(reviewReports.status, ["open", "awaiting_patient"])));
    try {
      await withdrawConsent(tx, {
        orgId: review.orgId,
        patientId,
        purpose: "review_publication",
        locale,
        method: "web_checkbox",
        source: actor.type === "patient_session" ? "privacy_center" : "manage_link",
        actor,
      });
    } catch (err) {
      // An erased or merged-away record can't take a ledger row; the withdrawal itself stands.
      if (!(err instanceof ConsentError)) throw err;
    }
    await audit({ orgId: review.orgId, actor, action: "review.withdraw", entity: { type: "review", id: reviewId } }, tx);
  });
}

/** A review as its author sees it in the privacy center. */
export type PatientReview = {
  id: string;
  orgId: string;
  rating: number;
  comment: string | null;
  status: ReviewStatus;
  createdAt: Date;
};

/**
 * Reviews written about the visits of these patients, newest first. Not scoped by org on
 * purpose: the privacy center (F9 rule 3 exception) passes the patient ids that matched a
 * verified contact, across practices.
 */
export async function listPatientReviews(patientIds: readonly string[]): Promise<PatientReview[]> {
  if (!patientIds.length) return [];
  const rows = await db
    .select({
      id: reviews.id,
      orgId: reviews.orgId,
      rating: reviews.rating,
      comment: reviews.comment,
      status: reviews.status,
      createdAt: reviews.createdAt,
    })
    .from(reviews)
    .innerJoin(appointments, eq(appointments.id, reviews.appointmentId))
    .where(inArray(appointments.patientId, [...patientIds]))
    .orderBy(desc(reviews.createdAt));
  return rows.map((r) => ({ ...r, comment: readComment(r.comment) }));
}

/** The last day the author can edit or delete through the visit's link. */
export function editableUntil(d: Pick<AppointmentDetails, "appointment">): Date {
  return manageLinkValidUntil(d.appointment);
}

// ---------------------------------------------------------------- the practice

type PracticeActor = { user: { id: string }; org: { id: string } };

export type PracticeReviewError =
  | "not_found"
  | "only_published"
  | "too_long"
  | "confirm_required"
  | "health_terms"
  | "already"
  | "final"
  | "details_required";

/**
 * The practice's public reply (empty removes it). Only under a published review, and only after
 * the staff member confirmed it reveals nothing about the patient's health or treatment. The
 * health-term flagger runs here too, whatever the browser did: a reply with health or contact
 * details (a "hold" finding) is refused, since a practice may never publish them about a patient;
 * treatment names and symptoms ("warn") pass and are recorded in the audit entry.
 */
export async function replyAsPractice(
  s: PracticeActor,
  i: { reviewId: string; reply: string; confirmed: boolean; now?: Date },
): Promise<{ ok: true; removed: boolean } | { ok: false; code: PracticeReviewError }> {
  const now = i.now ?? new Date();
  const [r] = await db.select().from(reviews).where(and(eq(reviews.id, i.reviewId), eq(reviews.orgId, s.org.id)));
  if (!r) return { ok: false, code: "not_found" };
  const reply = cleanText(i.reply, REPLY_MAX);
  if (reply === "too_long") return { ok: false, code: "too_long" };
  if (reply && r.status !== "published") return { ok: false, code: "only_published" };
  const findings = scanHealthTerms(reply);
  if (findings.some((f) => f.severity === "hold")) return { ok: false, code: "health_terms" };
  if (reply && !i.confirmed) return { ok: false, code: "confirm_required" };
  const warned = [...new Set(findings.map((f) => f.rule))];
  await db.transaction(async (tx) => {
    await tx
      .update(reviews)
      .set({ reply, replyUpdatedAt: now, replyByUserId: s.user.id })
      .where(and(eq(reviews.id, r.id), eq(reviews.orgId, s.org.id)));
    await audit(
      {
        orgId: s.org.id,
        actor: { type: "user", id: s.user.id },
        action: "review.reply",
        entity: { type: "review", id: r.id },
        metadata: { removed: reply === null, ...(warned.length ? { flags: warned.join(",") } : {}) },
      },
      tx,
    );
  });
  return { ok: true, removed: reply === null };
}

/**
 * The practice's own reports about a review (originals filed from its dashboard) and the appeals
 * of them, by either side; newest first. Reports by anyone else (a notice from the public, the
 * automatic check) and their appeals are not the practice's.
 */
function practiceChain(history: readonly ReviewReport[]): ReviewReport[] {
  const isOwn = (h: ReviewReport) => h.reporterUserId != null && !h.appealOfId;
  const own = new Set(history.filter(isOwn).map((h) => h.id));
  return history.filter((h) => isOwn(h) || (h.appealOfId != null && own.has(h.appealOfId)));
}

/**
 * What the practice's next report about a review would be, from its own reports only:
 *  - the latest decision on its own report, if that decision kept the review (it went against the
 *    practice), was taken within APPEAL_DAYS and hasn't been appealed: that report (an appeal);
 *  - "final" when that decision was appealed (by either side) within APPEAL_DAYS;
 *  - otherwise null: a fresh report (it hides the review, the author is asked, the practice is
 *    told the outcome). That includes a review a notice from the public or the automatic check
 *    was decided on: those decisions aren't the practice's to appeal.
 */
function practiceAppealTarget(history: readonly ReviewReport[], now: Date): ReviewReport | "final" | null {
  const chain = practiceChain(history);
  const decided = chain.find((h) => !h.appealOfId && h.decidedAt);
  if (!decided?.decidedAt) return null;
  const within = (d: Date) => now.getTime() - d.getTime() <= APPEAL_DAYS * DAY_MS;
  const appeal = chain.find((h) => h.appealOfId === decided.id);
  if (appeal || decided.status === "appealed") return within(appeal?.decidedAt ?? decided.decidedAt) ? "final" : null;
  if (!within(decided.decidedAt)) return null;
  return decided.decision === "keep" ? decided : null;
}

/**
 * The practice reports a published review (DSA notice). A new report hides the review until a
 * moderator decides; it can be filed while a notice from the public about the same review is
 * open. Within six months of a decision that kept the review on the practice's own report, the
 * practice's next report is its one appeal (a different moderator reviews it; the review stays
 * published meanwhile); after an appeal the decision is final.
 */
export async function reportAsPractice(
  s: PracticeActor,
  i: { reviewId: string; ground: ReviewReportGround; details: string; now?: Date },
): Promise<{ ok: true; appeal: boolean; reportId: string } | { ok: false; code: PracticeReviewError }> {
  const now = i.now ?? new Date();
  const details = cleanText(i.details, REPORT_TEXT_MAX);
  if (details === "too_long") return { ok: false, code: "too_long" };
  if (!details || details.length < 5) return { ok: false, code: "details_required" };
  const [r] = await db.select().from(reviews).where(and(eq(reviews.id, i.reviewId), eq(reviews.orgId, s.org.id)));
  if (!r || r.status === "withdrawn") return { ok: false, code: "not_found" };

  const history = await db.select().from(reviewReports).where(eq(reviewReports.reviewId, r.id)).orderBy(desc(reviewReports.createdAt));
  if (practiceChain(history).some(isOpen)) return { ok: false, code: "already" };
  const appealable = practiceAppealTarget(history, now);
  if (appealable === "final") return { ok: false, code: "final" };
  // Held, removed or hidden reviews aren't public: there is nothing for the practice to report.
  if (r.status !== "published") return { ok: false, code: "not_found" };

  const reportId = newId();
  await db.transaction(async (tx) => {
    await tx.insert(reviewReports).values({
      id: reportId,
      reviewId: r.id,
      orgId: s.org.id,
      reporterUserId: s.user.id,
      ground: i.ground,
      details: encodeDetails({ text: details }),
      status: "open",
      appealOfId: appealable ? appealable.id : null,
      createdAt: now,
    });
    if (appealable) {
      await tx.update(reviewReports).set({ status: "appealed" }).where(eq(reviewReports.id, appealable.id));
    } else {
      await tx.update(reviews).set({ status: "under_review", published: false }).where(eq(reviews.id, r.id));
    }
    await audit(
      {
        orgId: s.org.id,
        actor: { type: "user", id: s.user.id },
        action: "review.report",
        entity: { type: "review", id: r.id },
        metadata: { reportId, ground: i.ground, appeal: Boolean(appealable) },
      },
      tx,
    );
  });
  return { ok: true, appeal: Boolean(appealable), reportId };
}

export type PracticeReviewRow = {
  id: string;
  rating: number;
  /**
   * Only while the stored text is the public one: a published review, or one the practice's report
   * hides while it is checked. Never a text the automatic check held (also after an edit), nor a
   * removed one.
   */
  comment: string | null;
  authorDisplay: ReviewAuthorDisplay;
  authorName: string | null;
  locale: Locale | null;
  status: ReviewStatus;
  flags: string[];
  reply: string | null;
  createdAt: Date;
  practitionerId: string;
  /** The latest of the practice's own reports about it, or the latest appeal of one of them. */
  report: {
    id: string;
    ground: ReviewReportGround;
    status: ReviewReportStatus;
    createdAt: Date;
    decision: "keep" | "remove" | null;
    decisionReason: string | null;
    byPractice: boolean;
  } | null;
  /** The practice can still appeal the decision on its own report (once). */
  canAppeal: boolean;
};

/**
 * The comment as the practice may read it. Held and removed texts are stored encrypted (see
 * storedComment and applyDecision); a plain text under review is the published one the
 * practice's report is hiding.
 */
function practiceVisibleComment(r: Review): string | null {
  if (!r.comment) return null;
  if (r.status === "published") return readComment(r.comment);
  if (r.status === "under_review" && r.publishedAt && !isEncrypted(r.comment)) return r.comment;
  return null;
}

/**
 * The practice's reviews page: every review of the org, with the state of the practice's own
 * reports. Decisions on notices from the public or on the automatic check (and their reasons,
 * which may describe health details) are not shown to the practice.
 */
export async function practiceReviews(orgId: string, now: Date = new Date()): Promise<PracticeReviewRow[]> {
  const rows = await db.select().from(reviews).where(eq(reviews.orgId, orgId)).orderBy(desc(reviews.createdAt)).limit(300);
  const ids = rows.map((r) => r.id);
  const reports = ids.length
    ? await db.select().from(reviewReports).where(and(eq(reviewReports.orgId, orgId), inArray(reviewReports.reviewId, ids))).orderBy(desc(reviewReports.createdAt))
    : [];
  return rows.map((r) => {
    const history = reports.filter((x) => x.reviewId === r.id);
    const chain = practiceChain(history);
    const latest = chain[0] ?? null;
    const target = practiceAppealTarget(history, now);
    return {
      id: r.id,
      rating: r.rating,
      comment: practiceVisibleComment(r),
      authorDisplay: r.authorDisplay,
      authorName: r.authorDisplay === "first_initial" ? r.authorName : null,
      locale: r.locale,
      status: r.status,
      flags: r.flags ?? [],
      reply: r.reply,
      createdAt: r.createdAt,
      practitionerId: r.practitionerId,
      report: latest
        ? {
            id: latest.id,
            ground: latest.ground,
            status: latest.status,
            createdAt: latest.createdAt,
            decision: latest.decision,
            decisionReason: readDecisionReason(latest.decisionReason),
            byPractice: latest.reporterUserId != null,
          }
        : null,
      canAppeal: Boolean(target && target !== "final" && r.status === "published" && !chain.some(isOpen)),
    };
  });
}

// ---------------------------------------------------------------- the public (DSA Art. 16 notices)

/** A published review that can be reported, for the notice form: its rating and practice only. */
export async function reviewForNotice(reviewId: string): Promise<{ id: string; rating: number; orgName: string } | null> {
  const [r] = await db
    .select({ id: reviews.id, rating: reviews.rating, orgName: organizations.name })
    .from(reviews)
    .innerJoin(organizations, eq(organizations.id, reviews.orgId))
    .where(and(eq(reviews.id, reviewId), eq(reviews.status, "published")));
  return r ?? null;
}

/**
 * A notice from anyone about a published review. It doesn't hide the review (otherwise anybody
 * could take reviews down); a moderator decides. The notifier's name and email are kept encrypted
 * in the report to confirm receipt and send the decision (DSA Art. 16(4)-(5)).
 */
export async function submitPublicNotice(i: {
  reviewId: string;
  ground: ReviewReportGround;
  explanation: string;
  name: string;
  email: string;
  locale: Locale;
  now?: Date;
}): Promise<{ ok: true; reportId: string } | { ok: false; code: "not_found" | "invalid" | "too_long" }> {
  const now = i.now ?? new Date();
  const explanation = cleanText(i.explanation, REPORT_TEXT_MAX);
  const name = cleanText(i.name, 120);
  const email = cleanText(i.email, 254);
  if (explanation === "too_long") return { ok: false, code: "too_long" };
  if (!explanation || !name || name === "too_long" || !email || email === "too_long" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, code: "invalid" };
  }
  const [r] = await db
    .select({ id: reviews.id, orgId: reviews.orgId, orgName: organizations.name })
    .from(reviews)
    .innerJoin(organizations, eq(organizations.id, reviews.orgId))
    .where(and(eq(reviews.id, i.reviewId), eq(reviews.status, "published")));
  if (!r) return { ok: false, code: "not_found" };
  const reportId = newId();
  await db.transaction(async (tx) => {
    await tx.insert(reviewReports).values({
      id: reportId,
      reviewId: r.id,
      orgId: r.orgId,
      reporterUserId: null,
      reporterContactHash: hmac(email.toLowerCase(), "contact"),
      ground: i.ground,
      details: encodeDetails({ text: explanation, name, email, locale: i.locale }),
      status: "open",
      createdAt: now,
    });
    await audit(
      {
        orgId: r.orgId,
        actor: { type: "system", id: null },
        action: "review.report",
        entity: { type: "review", id: r.id },
        metadata: { reportId, ground: i.ground, source: "public_notice" },
      },
      tx,
    );
  });
  const t = getT(i.locale, "reviewEmails");
  await platformEmail({
    to: email,
    locale: i.locale,
    subject: t("notice.receivedSubject"),
    intro: t("notice.receivedBody", { practice: r.orgName }),
    footer: t("notice.footer"),
  });
  return { ok: true, reportId };
}

// ---------------------------------------------------------------- moderation (platform admins)

type Moderator = { id: string };

export type ModerationError = "not_found" | "reason_required" | "not_allowed";

async function reviewContext(reviewId: string) {
  const [row] = await db
    .select({ review: reviews, orgName: organizations.name, orgEmail: organizations.email, orgPrivacyEmail: organizations.privacyEmail, orgLocale: organizations.defaultLocale })
    .from(reviews)
    .innerJoin(organizations, eq(organizations.id, reviews.orgId))
    .where(eq(reviews.id, reviewId));
  if (!row) return null;
  const details = await getAppointmentDetails({ id: row.review.appointmentId });
  return details ? { ...row, details } : null;
}

const dayLabel = (date: Date, tz: string, locale: Locale) => fmtDay(zonedDate(date, tz), "long", locale);

/**
 * Ask the author for their side (7 days). Sent through the patient's channel (guardian routing,
 * opt-outs, restriction respected); returns sent: false when they can't be reached, and the
 * moderator then decides on what they have. The message says the review is hidden only when it
 * is (the practice's report hides it; a notice from the public or an appeal doesn't).
 */
export async function askAuthor(admin: Moderator, reportId: string, now: Date = new Date()): Promise<{ ok: true; sent: boolean } | { ok: false; code: ModerationError }> {
  const [report] = await db.select().from(reviewReports).where(and(eq(reviewReports.id, reportId), eq(reviewReports.status, "open")));
  if (!report || report.patientAskedAt) return { ok: false, code: "not_found" };
  const ctx = await reviewContext(report.reviewId);
  if (!ctx) return { ok: false, code: "not_found" };
  const { details: d } = ctx;
  const due = new Date(now.getTime() + AUTHOR_RESPONSE_DAYS * DAY_MS);
  const locale = d.patient.locale;
  const url = reviewLinkUrl(locale, report.id, due);
  const res = await sendPatientMessage({
    orgId: d.org.id,
    patient: d.patient,
    ns: "reviewEmails",
    kind: ctx.review.status === "published" ? "moderationRequestVisible" : "moderationRequestHidden",
    vars: { practice: d.org.name, date: dayLabel(due, d.org.timezone, locale), url },
    url,
    appointmentId: d.appointment.id,
    now,
  });
  if (res.ok) {
    await db.update(reviewReports).set({ status: "awaiting_patient", patientAskedAt: now }).where(eq(reviewReports.id, report.id));
  }
  await audit({
    orgId: report.orgId,
    actor: { type: "platform_admin", id: admin.id },
    action: "review.moderate",
    entity: { type: "review", id: report.reviewId },
    metadata: { reportId: report.id, step: "ask_author", sent: res.ok },
  });
  return { ok: true, sent: res.ok };
}

/** Where a signed moderation link leads: the report, its review and what the author may do now. */
export async function authorModerationView(token: string, now: Date = new Date()) {
  const verified = verifyReviewLinkToken(token, now);
  if (!verified) return null;
  const [report] = await db.select().from(reviewReports).where(eq(reviewReports.id, verified.reportId));
  if (!report) return null;
  const ctx = await reviewContext(report.reviewId);
  if (!ctx) return null;
  const [appeal] = await db.select().from(reviewReports).where(eq(reviewReports.appealOfId, report.id));
  const responseDue = report.patientAskedAt ? new Date(report.patientAskedAt.getTime() + AUTHOR_RESPONSE_DAYS * DAY_MS) : null;
  const appealUntil = report.decidedAt ? new Date(report.decidedAt.getTime() + APPEAL_DAYS * DAY_MS) : null;
  return {
    report: withReadableReason(report),
    review: { ...ctx.review, comment: readComment(ctx.review.comment), removedReason: readRemovedReason(ctx.review.removedReason) },
    org: ctx.details.org,
    appeal: appeal ? withReadableReason(appeal) : null,
    responseDue,
    appealUntil,
    canRespond: report.status === "awaiting_patient" && !report.patientResponse && responseDue != null && now <= responseDue,
    canAppeal:
      report.status === "decided" && report.decision === "remove" && !report.appealOfId && !appeal && appealUntil != null && now <= appealUntil,
  };
}

/** The author's reply to a moderation request (through the signed link, within 7 days). */
export async function recordAuthorResponse(token: string, text: string, now: Date = new Date()): Promise<{ ok: true } | { ok: false; code: "link_invalid" | "closed" | "too_long" | "required" }> {
  const view = await authorModerationView(token, now);
  if (!view) return { ok: false, code: "link_invalid" };
  if (!view.canRespond) return { ok: false, code: "closed" };
  const response = cleanText(text, REPORT_TEXT_MAX);
  if (response === "too_long") return { ok: false, code: "too_long" };
  if (!response) return { ok: false, code: "required" };
  await db.transaction(async (tx) => {
    await tx
      .update(reviewReports)
      .set({ patientResponse: encrypt(response, RESPONSE_AAD), status: "open" })
      .where(eq(reviewReports.id, view.report.id));
    await audit(
      {
        orgId: view.report.orgId,
        actor: { type: "patient_link", id: null },
        action: "review.moderate",
        entity: { type: "review", id: view.report.reviewId },
        metadata: { reportId: view.report.id, step: "author_response" },
      },
      tx,
    );
  });
  return { ok: true };
}

/** The author's one appeal against the removal of their review (through the signed link). */
export async function appealAsAuthor(token: string, text: string, now: Date = new Date()): Promise<{ ok: true } | { ok: false; code: "link_invalid" | "closed" | "too_long" | "required" }> {
  const view = await authorModerationView(token, now);
  if (!view) return { ok: false, code: "link_invalid" };
  if (!view.canAppeal) return { ok: false, code: "closed" };
  const reason = cleanText(text, REPORT_TEXT_MAX);
  if (reason === "too_long") return { ok: false, code: "too_long" };
  if (!reason) return { ok: false, code: "required" };
  const id = newId();
  await db.transaction(async (tx) => {
    await tx.insert(reviewReports).values({
      id,
      reviewId: view.report.reviewId,
      orgId: view.report.orgId,
      reporterUserId: null,
      reporterContactHash: AUTHOR_APPEAL,
      ground: view.report.ground,
      details: encodeDetails({ text: reason }),
      status: "open",
      appealOfId: view.report.id,
      createdAt: now,
    });
    await tx.update(reviewReports).set({ status: "appealed" }).where(eq(reviewReports.id, view.report.id));
    await audit(
      {
        orgId: view.report.orgId,
        actor: { type: "patient_link", id: null },
        action: "review.report",
        entity: { type: "review", id: view.report.reviewId },
        metadata: { reportId: id, appeal: true, source: "author" },
      },
      tx,
    );
  });
  return { ok: true };
}

function moderationReason(reason: string): string | null {
  const text = cleanText(reason, REASON_MAX);
  return text && text !== "too_long" && text.length >= REASON_MIN ? text : null;
}

/** Apply a keep/remove decision to the review row. */
async function applyDecision(tx: Tx, review: Review, decision: "keep" | "remove", reason: string, now: Date) {
  if (decision === "keep") {
    await tx
      .update(reviews)
      .set({
        status: "published",
        published: true,
        publishedAt: review.publishedAt ?? now,
        comment: readComment(review.comment),
        removedReason: null,
        decidedAt: now,
      })
      .where(eq(reviews.id, review.id));
  } else {
    await tx
      .update(reviews)
      .set({
        status: "removed",
        published: false,
        removedReason: encrypt(reason, REMOVED_AAD),
        decidedAt: now,
        comment: storedComment(readComment(review.comment), true),
      })
      .where(eq(reviews.id, review.id));
  }
}

/**
 * Whether a decision on `report` changes the review row. Several reports about one review can be
 * open at once (the practice's and a notice from the public), so:
 *  - a removed review comes back only through an appeal of the decision that removed it (a later
 *    decision on another report, or an appeal of an older decision, leaves it removed);
 *  - "keep" doesn't publish a review another open report from the practice is hiding: that report
 *    still waits for its own decision.
 */
function decisionApplies(report: ReviewReport, review: Review, history: readonly ReviewReport[], decision: "keep" | "remove"): boolean {
  if (review.status === "removed") {
    const removal = history
      .filter((h) => h.decision === "remove" && h.decidedAt)
      .sort((a, b) => b.decidedAt!.getTime() - a.decidedAt!.getTime())[0];
    return Boolean(report.appealOfId && removal && report.appealOfId === removal.id);
  }
  const otherHiding = history.some((h) => h.id !== report.id && isOpen(h) && !h.appealOfId && h.reporterUserId != null);
  return !(decision === "keep" && otherHiding);
}

/**
 * Decide a report or an appeal: keep or remove the review, with a statement of reasons sent to
 * the author, to the practice when it reported, and to a member of the public who sent a notice.
 * An appeal must be decided by someone other than the moderator who took the first decision.
 * The decision is always recorded and sent; whether it changes the review is decisionApplies().
 */
export async function decideReport(
  admin: Moderator,
  i: { reportId: string; decision: "keep" | "remove"; reason: string; now?: Date },
): Promise<{ ok: true } | { ok: false; code: ModerationError }> {
  const now = i.now ?? new Date();
  const reason = moderationReason(i.reason);
  if (!reason) return { ok: false, code: "reason_required" };
  const [report] = await db
    .select()
    .from(reviewReports)
    .where(and(eq(reviewReports.id, i.reportId), inArray(reviewReports.status, ["open", "awaiting_patient"])));
  if (!report) return { ok: false, code: "not_found" };
  if (report.appealOfId) {
    const [original] = await db.select({ decidedBy: reviewReports.decidedByUserId }).from(reviewReports).where(eq(reviewReports.id, report.appealOfId));
    if (original?.decidedBy === admin.id) return { ok: false, code: "not_allowed" };
  }
  const ctx = await reviewContext(report.reviewId);
  if (!ctx || ctx.review.status === "withdrawn") return { ok: false, code: "not_found" };
  const isAppeal = Boolean(report.appealOfId);
  const history = await db.select().from(reviewReports).where(eq(reviewReports.reviewId, report.reviewId));
  const applies = decisionApplies(report, ctx.review, history, i.decision);

  await db.transaction(async (tx) => {
    await tx
      .update(reviewReports)
      .set({
        decision: i.decision,
        decisionReason: encrypt(reason, DECISION_AAD),
        decidedByUserId: admin.id,
        decidedAt: now,
        status: isAppeal ? "closed" : "decided",
      })
      .where(eq(reviewReports.id, report.id));
    if (applies) await applyDecision(tx, ctx.review, i.decision, reason, now);
    await audit(
      {
        orgId: report.orgId,
        actor: { type: "platform_admin", id: admin.id },
        action: "review.moderate",
        entity: { type: "review", id: report.reviewId },
        reason,
        metadata: { reportId: report.id, decision: i.decision, appeal: isAppeal, ground: report.ground, applied: applies },
      },
      tx,
    );
  });

  await notifyDecision({ ctx, report, decision: i.decision, reason, isAppeal, now });
  return { ok: true };
}

/**
 * Decide a review the automatic check held (no report): publish it or keep it off the site. The
 * decision is recorded as a report from the automatic check, so the author can appeal it like any
 * other.
 */
export async function decideHeldReview(
  admin: Moderator,
  i: { reviewId: string; decision: "keep" | "remove"; reason: string; now?: Date },
): Promise<{ ok: true } | { ok: false; code: ModerationError }> {
  const now = i.now ?? new Date();
  const reason = moderationReason(i.reason);
  if (!reason) return { ok: false, code: "reason_required" };
  const ctx = await reviewContext(i.reviewId);
  if (!ctx || ctx.review.status !== "under_review") return { ok: false, code: "not_found" };
  if (await hidingReport(db, ctx.review.id)) return { ok: false, code: "not_found" };
  const flags = ctx.review.flags ?? [];
  const reportId = newId();
  await db.transaction(async (tx) => {
    await tx.insert(reviewReports).values({
      id: reportId,
      reviewId: ctx.review.id,
      orgId: ctx.review.orgId,
      reporterUserId: null,
      reporterContactHash: AUTO_CHECK,
      ground: flags.some((f) => f.startsWith("health.")) ? "reviewer_health_data" : "other",
      details: null,
      status: "decided",
      decision: i.decision,
      decisionReason: encrypt(reason, DECISION_AAD),
      decidedByUserId: admin.id,
      decidedAt: now,
      createdAt: now,
    });
    await applyDecision(tx, ctx.review, i.decision, reason, now);
    await audit(
      {
        orgId: ctx.review.orgId,
        actor: { type: "platform_admin", id: admin.id },
        action: "review.moderate",
        entity: { type: "review", id: ctx.review.id },
        reason,
        metadata: { reportId, decision: i.decision, source: "auto_check", flags: flags.join(",") },
      },
      tx,
    );
  });
  const d = ctx.details;
  const locale = d.patient.locale;
  const appealUntil = new Date(now.getTime() + APPEAL_DAYS * DAY_MS);
  const url = reviewLinkUrl(locale, reportId, appealUntil);
  try {
    const base = { orgId: d.org.id, patient: d.patient, ns: "reviewEmails" as const, appointmentId: d.appointment.id, now };
    if (i.decision === "keep") await sendPatientMessage({ ...base, kind: "heldPublished", vars: { practice: d.org.name } });
    else {
      const vars = { practice: d.org.name, reason, date: dayLabel(appealUntil, d.org.timezone, locale), url };
      await sendPatientMessage({ ...base, kind: "heldRemoved", vars, url });
    }
  } catch (err) {
    logError("reviews", err, { step: "notify_held", reviewId: ctx.review.id });
  }
  return { ok: true };
}

async function notifyDecision(i: {
  ctx: NonNullable<Awaited<ReturnType<typeof reviewContext>>>;
  report: ReviewReport;
  decision: "keep" | "remove";
  reason: string;
  isAppeal: boolean;
  now: Date;
}) {
  const { ctx, report, decision, reason, isAppeal, now } = i;
  const d = ctx.details;
  const locale = d.patient.locale;
  const appealUntil = new Date(now.getTime() + APPEAL_DAYS * DAY_MS);
  const url = reviewLinkUrl(locale, report.id, appealUntil);
  const base = { orgId: d.org.id, patient: d.patient, ns: "reviewEmails" as const, url, appointmentId: d.appointment.id, now };
  try {
    if (isAppeal) {
      await sendPatientMessage({ ...base, kind: decision === "keep" ? "finalKept" : "finalRemoved", vars: { practice: d.org.name, reason, url } });
    } else if (decision === "keep") {
      await sendPatientMessage({ ...base, kind: "decisionKept", vars: { practice: d.org.name, reason, url } });
    } else {
      await sendPatientMessage({ ...base, kind: "decisionRemoved", vars: { practice: d.org.name, reason, date: dayLabel(appealUntil, d.org.timezone, locale), url } });
    }
  } catch (err) {
    logError("reviews", err, { step: "notify_author", reportId: report.id });
  }

  // The practice, when the report being decided is its own (a report or its appeal) or the author
  // appealed the decision on the practice's report: the staff member who reported, else the
  // practice's address.
  const original = report.appealOfId ? ((await db.select().from(reviewReports).where(eq(reviewReports.id, report.appealOfId)))[0] ?? null) : report;
  const practiceReporterId = report.reporterUserId ?? (original && !original.appealOfId ? original.reporterUserId : null);
  if (practiceReporterId) {
    const [reporter] = await db.select({ email: users.email, locale: users.locale }).from(users).where(eq(users.id, practiceReporterId));
    const to = reporter?.email ?? ctx.orgEmail ?? ctx.orgPrivacyEmail;
    const plocale = isLocale(reporter?.locale) ? reporter.locale : ctx.orgLocale;
    if (to) {
      const t = getT(plocale, "reviewEmails");
      // Only a decision that kept the review can be appealed by the practice; the author can appeal a removal.
      const note = isAppeal ? t("practice.final") : decision === "keep" ? t("practice.appeal") : t("practice.authorMayAppeal");
      await platformEmail({
        to,
        locale: plocale,
        orgId: d.org.id,
        subject: decision === "keep" ? t("practice.keptSubject") : t("practice.removedSubject"),
        intro: decision === "keep" ? t("practice.keptBody", { practice: d.org.name, reason }) : t("practice.removedBody", { practice: d.org.name, reason }),
        note,
        button: { label: t("practice.open"), url: absoluteUrl("/dashboard/reviews") },
        footer: t("practice.footer"),
      });
    }
  }
  // A member of the public whose notice is decided (or whose notice's decision the author appealed).
  if (original && !original.reporterUserId && original.reporterContactHash && original.reporterContactHash !== AUTO_CHECK && original.reporterContactHash !== AUTHOR_APPEAL) {
    const notice = readReportDetails(original.details);
    if (notice.email) {
      const nlocale = isLocale(notice.locale) ? notice.locale : DEFAULT_LOCALE;
      const t = getT(nlocale, "reviewEmails");
      await platformEmail({
        to: notice.email,
        locale: nlocale,
        subject: t("notice.decisionSubject"),
        intro: decision === "keep" ? t("notice.keptBody", { practice: d.org.name, reason }) : t("notice.removedBody", { practice: d.org.name, reason }),
        note: t("notice.redress"),
        footer: t("notice.footer"),
      });
    }
  }
}

/** An email from Sorriso itself (not a patient message): moderation decisions and notice receipts. */
async function platformEmail(i: {
  to: string;
  locale: Locale;
  orgId?: string | null;
  subject: string;
  intro: string;
  note?: string;
  button?: { label: string; url: string };
  footer: string;
}) {
  try {
    const { html, text } = renderEmailLayout({
      locale: i.locale,
      brandColor: DEFAULT_BRAND_COLOR,
      brandName: APP_NAME,
      intro: i.intro,
      note: i.note,
      buttons: i.button ? [i.button] : [],
      footerLines: [i.footer],
    });
    await deliver({ orgId: i.orgId ?? null, channel: "email", to: i.to, subject: i.subject, text, html, fromName: APP_NAME, locale: i.locale });
  } catch (err) {
    logError("reviews", err, { step: "platform_email" });
  }
}

// ---------------------------------------------------------------- the moderation queue

export type QueueReport = {
  report: ReviewReport;
  review: Review;
  comment: string | null;
  details: string | null;
  authorResponse: string | null;
  orgName: string;
  practitionerName: string;
  source: "practice" | "public" | "author";
  previous: ReviewReport | null;
  responseDue: Date | null;
  decideBy: Date;
};

/** Reports and appeals waiting for a decision, oldest first, and reviews held by the automatic check. */
export async function moderationQueue(): Promise<{ reports: QueueReport[]; held: { review: Review; comment: string | null; orgName: string; practitionerName: string }[] }> {
  const open = await db
    .select({ report: reviewReports, review: reviews, orgName: organizations.name, practitionerName: practitioners.name })
    .from(reviewReports)
    .innerJoin(reviews, eq(reviews.id, reviewReports.reviewId))
    .innerJoin(organizations, eq(organizations.id, reviewReports.orgId))
    .innerJoin(practitioners, eq(practitioners.id, reviews.practitionerId))
    .where(inArray(reviewReports.status, ["open", "awaiting_patient"]))
    .orderBy(asc(reviewReports.createdAt))
    .limit(200);
  const previousIds = open.map((o) => o.report.appealOfId).filter((x): x is string => Boolean(x));
  const previous = previousIds.length ? await db.select().from(reviewReports).where(inArray(reviewReports.id, previousIds)) : [];
  const reports: QueueReport[] = open.map(({ report, review, orgName, practitionerName }) => ({
    report,
    review,
    comment: readComment(review.comment),
    details: readReportDetails(report.details).text,
    authorResponse: readAuthorResponse(report.patientResponse),
    orgName,
    practitionerName,
    source: report.reporterUserId ? "practice" : report.reporterContactHash === AUTHOR_APPEAL ? "author" : "public",
    previous: ((x) => (x ? withReadableReason(x) : null))(previous.find((p) => p.id === report.appealOfId)),
    responseDue: report.patientAskedAt ? new Date(report.patientAskedAt.getTime() + AUTHOR_RESPONSE_DAYS * DAY_MS) : null,
    decideBy: new Date(report.createdAt.getTime() + AUTHOR_RESPONSE_DAYS * DAY_MS),
  }));

  const heldRows = await db
    .select({ review: reviews, orgName: organizations.name, practitionerName: practitioners.name })
    .from(reviews)
    .innerJoin(organizations, eq(organizations.id, reviews.orgId))
    .innerJoin(practitioners, eq(practitioners.id, reviews.practitionerId))
    .where(eq(reviews.status, "under_review"))
    .orderBy(asc(reviews.createdAt))
    .limit(200);
  const reported = new Set(reports.map((r) => r.review.id));
  const held = heldRows
    .filter((h) => !reported.has(h.review.id))
    .map((h) => ({ ...h, comment: readComment(h.review.comment) }));
  return { reports, held };
}
