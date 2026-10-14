import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import type { ReviewStatus } from "@/db/enums";
import { appointments, reviews } from "@/db/schema";
import type { AuditEvent } from "./audit";

/**
 * Patient reviews (WP7): submission with publication consent, the health-term flagger,
 * moderation. The two functions below also serve WP4's privacy center, where a patient sees and
 * withdraws their own reviews across practices.
 */

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
 * The author takes their review down: it leaves every public page for good. `actor` is who did
 * it (the patient through a manage link or a privacy-center session), for the audit log.
 *
 * STUB with its final signature (WP7): sets status 'withdrawn' (and the deprecated `published`
 * flag off); WP7 adds the audit row, clears the comment and records the consent withdrawal.
 */
export async function withdrawReview(reviewId: string, actor: AuditEvent["actor"]): Promise<void> {
  void actor;
  await db.update(reviews).set({ status: "withdrawn", published: false }).where(eq(reviews.id, reviewId));
}

/**
 * Reviews written about the visits of these patients, newest first. Not scoped by org on
 * purpose: the privacy center (F9 rule 3 exception) passes the patient ids that matched a
 * verified contact, across practices.
 */
export async function listPatientReviews(patientIds: readonly string[]): Promise<PatientReview[]> {
  if (!patientIds.length) return [];
  return db
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
}
