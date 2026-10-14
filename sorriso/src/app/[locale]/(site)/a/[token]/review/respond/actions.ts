"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { TextActionState } from "@/components/marketplace/TextActionForm";
import { toLocale } from "@/i18n/config";
import { lhref } from "@/i18n/href";
import { getT } from "@/i18n/server";
import { rateLimitByIp } from "@/lib/rate-limit";
import { appealAsAuthor, authorModerationView, recordAuthorResponse, REPORT_TEXT_MAX, withdrawReview } from "@/lib/reviews";

/** The author's side of moderation, through the signed link: reply, appeal once, or delete the review. */

async function limited(): Promise<boolean> {
  return !(await rateLimitByIp(await headers(), "review-moderation", 20, 10 * 60_000)).ok;
}

function message(rawLocale: string, code: "link_invalid" | "closed" | "too_long" | "required" | "rate_limited"): TextActionState {
  const t = getT(toLocale(rawLocale), "reviews");
  if (code === "too_long") return { error: t("errors.tooLong", { max: REPORT_TEXT_MAX }) };
  if (code === "required") return { error: t("respond.responseRequired") };
  if (code === "rate_limited") return { error: t("errors.rateLimited") };
  return { error: t("respond.invalid") };
}

export async function respondAction(token: string, rawLocale: string, _prev: TextActionState, fd: FormData): Promise<TextActionState> {
  if (await limited()) return message(rawLocale, "rate_limited");
  const res = await recordAuthorResponse(token, String(fd.get("response") ?? ""));
  if (!res.ok) return message(rawLocale, res.code);
  return { ok: true, message: getT(toLocale(rawLocale), "reviews")("respond.sent") };
}

export async function appealAction(token: string, rawLocale: string, _prev: TextActionState, fd: FormData): Promise<TextActionState> {
  if (await limited()) return message(rawLocale, "rate_limited");
  const res = await appealAsAuthor(token, String(fd.get("appeal") ?? ""));
  if (!res.ok) return message(rawLocale, res.code);
  return { ok: true, message: getT(toLocale(rawLocale), "reviews")("respond.appealSent") };
}

/** The author prefers to delete the review: withdrawn for good, consent withdrawn, reports closed. */
export async function withdrawFromModerationAction(token: string, rawLocale: string): Promise<void> {
  const locale = toLocale(rawLocale);
  if (!(await limited())) {
    const view = await authorModerationView(token);
    if (view && view.review.status !== "withdrawn") await withdrawReview(view.review.id, { type: "patient_link", id: null });
  }
  redirect(lhref(locale, `/a/${token}/review/respond?deleted=1`));
}
