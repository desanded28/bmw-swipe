"use server";

import { REVIEW_REPORT_GROUNDS, type ReviewReportGround } from "@/db/enums";
import { DEFAULT_LOCALE, type Locale } from "@/i18n/config";
import { getStaffLocale, getT } from "@/i18n/server";
import { replyAsPractice, reportAsPractice, type PracticeReviewError } from "@/lib/reviews";
import { fail, guard, ok, type ActionResult } from "./_shared";

/**
 * The practice's side of reviews (WP7): a public reply, and a report (or, after a decision, the
 * practice's one appeal). Nothing else: no practice action can publish, hide, edit or delete a
 * review. Only Sorriso's moderators change a review's status (src/lib/reviews.ts); the practice's
 * report hides it while they check. Both writes are audited (review.reply, review.report) in the
 * same transaction, by src/lib/reviews.ts.
 */

/** The staff member's language. Outside a request (tests, scripts) the default: never fails the action. */
async function staffLocale(): Promise<Locale> {
  try {
    return await getStaffLocale();
  } catch {
    return DEFAULT_LOCALE;
  }
}

async function messageFor(code: PracticeReviewError): Promise<string> {
  const t = getT(await staffLocale(), "reviews");
  switch (code) {
    case "not_found":
      return t("reportForm.notFound");
    case "only_published":
      return t("reply.onlyPublished");
    case "too_long":
      return t("reply.tooLong");
    case "confirm_required":
      return t("reply.confirmRequired");
    case "already":
      return t("reportForm.already");
    case "final":
      return t("reportForm.final");
    case "details_required":
      return t("reportForm.detailsRequired");
  }
}

/**
 * Publish, change or (with an empty text) remove the practice's public reply. `confirmed` is the
 * staff member's statement that the reply reveals nothing about the patient's health or
 * treatment: without it nothing is published.
 */
export async function replyToReview(id: string, reply: string, confirmed: boolean = false): Promise<ActionResult> {
  return guard(
    async (s) => {
      const res = await replyAsPractice(s, { reviewId: id, reply, confirmed: confirmed === true });
      if (!res.ok) return fail(await messageFor(res.code), res.code);
      const t = getT(await staffLocale(), "reviews");
      return ok(res.removed ? t("reply.removed") : t("reply.saved"));
    },
    { permission: "reviews.reply" },
  );
}

/** Report a review to Sorriso's moderators (it is hidden until they decide), or appeal their decision once. */
export async function reportReview(id: string, ground: string, details: string): Promise<ActionResult> {
  return guard(
    async (s) => {
      if (!(REVIEW_REPORT_GROUNDS as readonly string[]).includes(ground)) return fail(await messageFor("details_required"), "invalid");
      const res = await reportAsPractice(s, { reviewId: id, ground: ground as ReviewReportGround, details });
      if (!res.ok) return fail(await messageFor(res.code), res.code);
      const t = getT(await staffLocale(), "reviews");
      return ok(res.appeal ? t("reportForm.appealSent") : t("reportForm.sent"));
    },
    { permission: "reviews.report" },
  );
}
