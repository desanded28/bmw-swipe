"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReviewFormState } from "@/components/ReviewForm";
import { REVIEW_AUTHOR_DISPLAY, type ReviewAuthorDisplay } from "@/db/enums";
import { toLocale, type Locale } from "@/i18n/config";
import { lhref } from "@/i18n/href";
import { getT } from "@/i18n/server";
import { getAppointmentDetails } from "@/lib/appointments";
import { isManageLinkValid } from "@/lib/links";
import { rateLimitByIp } from "@/lib/rate-limit";
import { COMMENT_MAX, reviewForAppointment, submitReview, updateReview, withdrawReview, type ReviewError } from "@/lib/reviews";

/**
 * The author's review actions through their visit link: publish (with the publication consent),
 * edit and delete while the link is valid. Rate limited per network.
 */

const LIMIT = 20;
const WINDOW_MS = 10 * 60_000;

function errorText(locale: Locale, code: ReviewError | "rate_limited"): string {
  const t = getT(locale, "reviews");
  switch (code) {
    case "link_invalid":
      return t("errors.linkInvalid");
    case "not_completed":
      return t("page.notCompleted");
    case "already_reviewed":
      return t("errors.alreadyReviewed");
    case "consent_required":
      return t("errors.consentRequired");
    case "rating_invalid":
      return t("errors.ratingRequired");
    case "too_long":
      return t("errors.tooLong", { max: COMMENT_MAX });
    case "guardian_required":
      return t("errors.guardianRequired");
    case "closed":
      return t("errors.closed");
    case "rate_limited":
      return t("errors.rateLimited");
  }
}

function formInput(fd: FormData, locale: Locale) {
  const display = String(fd.get("display") ?? "");
  return {
    rating: Number(fd.get("rating")),
    comment: String(fd.get("comment") ?? ""),
    display: ((REVIEW_AUTHOR_DISPLAY as readonly string[]).includes(display) ? display : "pseudonym") as ReviewAuthorDisplay,
    locale,
  };
}

async function limited(): Promise<boolean> {
  return !(await rateLimitByIp(await headers(), "review-form", LIMIT, WINDOW_MS)).ok;
}

export async function submitReviewAction(token: string, rawLocale: string, _prev: ReviewFormState, fd: FormData): Promise<ReviewFormState> {
  const locale = toLocale(rawLocale);
  if (await limited()) return { error: errorText(locale, "rate_limited") };
  const res = await submitReview(token, { ...formInput(fd, locale), consent: fd.get("consent") === "yes", headers: await headers() });
  if (!res.ok) return { error: errorText(locale, res.code) };
  redirect(lhref(locale, `/a/${token}/review?done=1`));
}

export async function updateReviewAction(token: string, rawLocale: string, _prev: ReviewFormState, fd: FormData): Promise<ReviewFormState> {
  const locale = toLocale(rawLocale);
  if (await limited()) return { error: errorText(locale, "rate_limited") };
  const res = await updateReview(token, formInput(fd, locale));
  if (!res.ok) return { error: errorText(locale, res.code) };
  redirect(lhref(locale, `/a/${token}/review?done=1`));
}

/** Delete (withdraw) the review: it leaves every page for good and the consent is withdrawn. */
export async function deleteReviewAction(token: string, rawLocale: string): Promise<void> {
  const locale = toLocale(rawLocale);
  if (await limited()) redirect(lhref(locale, `/a/${token}/review`));
  const d = await getAppointmentDetails({ token });
  if (d && isManageLinkValid(d.appointment)) {
    const review = await reviewForAppointment(d.appointment.id);
    if (review) await withdrawReview(review.id, { type: "patient_link", id: null });
  }
  redirect(lhref(locale, `/a/${token}/review?deleted=1`));
}
