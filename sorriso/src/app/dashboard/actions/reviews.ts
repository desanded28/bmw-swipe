"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { reviews } from "@/db/schema";
import { guard, ok, type ActionResult } from "./_shared";

/** The practice's side of reviews (WP7: replies with guardrails, reporting instead of hiding). */

export async function replyToReview(id: string, reply: string): Promise<ActionResult> {
  return guard(
    async (s) => {
      await db
        .update(reviews)
        .set({ reply: reply.trim() || null })
        .where(and(eq(reviews.id, id), eq(reviews.orgId, s.org.id)));
      return ok("Reply saved.");
    },
    { permission: "reviews.reply" },
  );
}

/**
 * Publish or hide a review. Writes `status` (true -> 'published', false -> 'under_review') and
 * keeps the deprecated `published` flag in step for code that still reads it. WP7 replaces
 * hiding with reporting: practices can't change a review's status there.
 */
export async function setReviewPublished(id: string, published: boolean): Promise<ActionResult> {
  return guard(
    async (s) => {
      await db
        .update(reviews)
        .set({ published, status: published ? "published" : "under_review" })
        .where(and(eq(reviews.id, id), eq(reviews.orgId, s.org.id)));
      return ok(published ? "Review published." : "Review hidden.");
    },
    { permission: "reviews.report" },
  );
}
