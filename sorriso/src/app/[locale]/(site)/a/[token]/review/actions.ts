"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { PrivacyFormState } from "@/components/privacy/ActionForm";
import type { ReviewFormState } from "@/components/ReviewForm";
import { REVIEW_AUTHOR_DISPLAY, type ReviewAuthorDisplay } from "@/db/enums";
import { toLocale, type Locale } from "@/i18n/config";
import { lhref } from "@/i18n/href";
import { getT } from "@/i18n/server";
import { getAppointmentDetails } from "@/lib/appointments";
import { isManageLinkValid } from "@/lib/links";
import { getPatientSession } from "@/lib/privacy/patient-session";
import { requestLinkStepUp, reviewActing, reviewReturnPath } from "@/lib/privacy/privacy-center";
import { rateLimitByIp } from "@/lib/rate-limit";
import { COMMENT_MAX, reviewForAppointment, submitReview, updateReview, withdrawReview, type ReviewActing, type ReviewError } from "@/lib/reviews";

/**
 * The author's review actions through their visit link: publish (with the publication consent),
 * edit and delete while the link is valid. Rate limited per network.
 *
 * Who acts is decided by reviewActing (privacy-center.ts): the link alone for the patient's own
 * booking (or a guardian's booking of a child under 14); when someone else booked, only a
 * privacy-center session opened with a one-time code to the patient's own contact
 * (reviewStepUpAction). Without one nothing is published, changed or deleted (not_patient).
 */

const TOKEN_SHAPE = /^[A-Za-z0-9_-]{8,128}$/;

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
    case "not_patient":
      return t("errors.notPatient");
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

/** The visit behind a valid link and who may act on its review now (null: nobody, without the step-up). */
async function linkActing(token: string): Promise<{ d: NonNullable<Awaited<ReturnType<typeof getAppointmentDetails>>>; acting: ReviewActing | null } | null> {
  const d = TOKEN_SHAPE.test(token) ? await getAppointmentDetails({ token }) : null;
  if (!d || !isManageLinkValid(d.appointment)) return null;
  return { d, acting: await reviewActing(d, await getPatientSession()) };
}

export async function submitReviewAction(token: string, rawLocale: string, _prev: ReviewFormState, fd: FormData): Promise<ReviewFormState> {
  const locale = toLocale(rawLocale);
  if (await limited()) return { error: errorText(locale, "rate_limited") };
  const acting = (await linkActing(token))?.acting ?? null;
  const res = await submitReview(token, { ...formInput(fd, locale), consent: fd.get("consent") === "yes", acting, headers: await headers() });
  if (!res.ok) return { error: errorText(locale, res.code) };
  redirect(lhref(locale, `/a/${token}/review?done=1`));
}

export async function updateReviewAction(token: string, rawLocale: string, _prev: ReviewFormState, fd: FormData): Promise<ReviewFormState> {
  const locale = toLocale(rawLocale);
  if (await limited()) return { error: errorText(locale, "rate_limited") };
  const acting = (await linkActing(token))?.acting ?? null;
  const res = await updateReview(token, { ...formInput(fd, locale), acting });
  if (!res.ok) return { error: errorText(locale, res.code) };
  redirect(lhref(locale, `/a/${token}/review?done=1`));
}

/** Delete (withdraw) the review: it leaves every page for good and the consent is withdrawn. */
export async function deleteReviewAction(token: string, rawLocale: string): Promise<void> {
  const locale = toLocale(rawLocale);
  if (await limited()) redirect(lhref(locale, `/a/${token}/review`));
  const link = await linkActing(token);
  // Someone else's booking without the patient's step-up: nothing is deleted.
  if (!link?.acting) redirect(lhref(locale, `/a/${token}/review`));
  const review = await reviewForAppointment(link.d.appointment.id);
  if (review) await withdrawReview(review.id, link.acting.actor, link.acting.actorRelation);
  redirect(lhref(locale, `/a/${token}/review?deleted=1`));
}

/**
 * The step-up for a visit someone else booked: a one-time code to the patient's own contact
 * (linkStepUpContacts, never the booker's), then the privacy center's code form, which opens a
 * session and comes back to this review page.
 */
export async function reviewStepUpAction(token: string, rawLocale: string, _prev: PrivacyFormState, fd: FormData): Promise<PrivacyFormState> {
  const locale = toLocale(rawLocale);
  const d = TOKEN_SHAPE.test(token) ? await getAppointmentDetails({ token }) : null;
  if (!d || !isManageLinkValid(d.appointment)) return { ok: false, message: errorText(locale, "link_invalid") };
  const kind = String(fd.get("kind") ?? "") === "email" ? "email" : "phone";
  const r = await requestLinkStepUp({ d, kind, locale, headers: await headers(), returnTo: reviewReturnPath(token) });
  if (!r.ok) return { ok: false, message: r.reason === "rate_limited" ? errorText(locale, "rate_limited") : getT(locale, "reviews")("page.stepUp.noContact") };
  redirect(lhref(locale, `/privacy/verify?t=${r.ticket}`));
}
