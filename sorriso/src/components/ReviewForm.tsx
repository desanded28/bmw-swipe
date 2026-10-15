"use client";

import { LoaderCircle, ShieldAlert, Star } from "lucide-react";
import { useActionState, useId, useState } from "react";
import type { ReviewAuthorDisplay } from "@/db/enums";
import { useT } from "@/i18n/provider";
import { scanHealthTerms } from "@/lib/health-terms";
import { FindingsPreview } from "./marketplace/Highlighted";
import { Button, cx, Textarea } from "./ui";

export type ReviewFormState = { error?: string } | null;

const COMMENT_MAX = 2000;

/**
 * The patient's review form (create or edit). Rating as a radio group, an optional comment
 * checked live by the health-term flagger (the server checks again), the name display choice
 * ("Verified patient" by default) and, for a new review, the unticked publication consent with
 * the exact frozen text consents.review_publication.label.
 */
export function ReviewForm({
  action,
  mode = "create",
  practice,
  practitioner,
  firstInitialName,
  initial,
}: {
  action: (prev: ReviewFormState, formData: FormData) => Promise<ReviewFormState>;
  mode?: "create" | "edit";
  practice: string;
  practitioner: string;
  /** "Giulia R." when the author may show their name; null for a child (always pseudonymous). */
  firstInitialName: string | null;
  initial?: { rating: number; comment: string | null; display: ReviewAuthorDisplay };
}) {
  const t = useT("reviews");
  const tc = useT("consents");
  const [state, formAction, pending] = useActionState(action, null);
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState(initial?.comment ?? "");
  /** A send was tried without a rating: the form says so instead of keeping the button disabled. */
  const [missingRating, setMissingRating] = useState(false);
  const id = useId();
  const findings = scanHealthTerms(comment);
  const holds = findings.filter((f) => f.severity === "hold");
  const shown = hover || rating;

  return (
    <form
      action={formAction}
      className="space-y-5"
      onSubmit={(e) => {
        if (rating > 0) return;
        e.preventDefault();
        setMissingRating(true);
        document.getElementById(`${id}rating1`)?.focus();
      }}
    >
      <fieldset aria-describedby={`${id}ratingValue${missingRating && rating === 0 ? ` ${id}ratingError` : ""}`}>
        <legend className="mb-1.5 text-[13px] font-semibold text-slate-700">{t("form.ratingLegend")}</legend>
        <div className="flex flex-wrap items-center gap-1" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((i) => (
            <label key={i} className="cursor-pointer rounded-lg p-1 focus-within:ring-2 focus-within:ring-brand-600" onMouseEnter={() => setHover(i)}>
              <input
                id={`${id}rating${i}`}
                type="radio"
                name="rating"
                value={i}
                checked={rating === i}
                onChange={() => {
                  setRating(i);
                  setMissingRating(false);
                }}
                className="sr-only"
              />
              <span className="sr-only">{t("form.ratingOption", { count: i })}</span>
              {/* Unselected outlines in slate-500: at least 3:1 against white (WCAG 1.4.11). */}
              <Star size={34} aria-hidden className={cx("transition", shown >= i ? "fill-amber-400 text-amber-600" : "text-slate-500")} />
            </label>
          ))}
          <span id={`${id}ratingValue`} className="ml-2 text-sm font-medium text-slate-700">
            {rating ? t("form.ratingChosen", { count: rating }) : t("form.ratingNone")}
          </span>
        </div>
        {missingRating && rating === 0 ? (
          <p id={`${id}ratingError`} role="alert" className="mt-1.5 text-sm font-medium text-red-700">
            {t("form.ratingRequired")}
          </p>
        ) : null}
      </fieldset>

      <div>
        <label htmlFor={`${id}comment`} className="mb-1.5 block text-[13px] font-semibold text-slate-700">
          {t("form.comment")}
        </label>
        <Textarea
          id={`${id}comment`}
          name="comment"
          rows={5}
          maxLength={COMMENT_MAX}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={t("form.commentPlaceholder")}
          aria-describedby={`${id}hint${holds.length ? ` ${id}warn` : ""}`}
        />
        <p id={`${id}hint`} className="mt-1 text-xs text-slate-500">
          {t("form.commentHint")}
        </p>
        <div aria-live="polite">
          {holds.length ? (
            <div id={`${id}warn`} className="mt-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
              <p className="flex items-start gap-2 font-medium">
                <ShieldAlert size={16} className="mt-0.5 shrink-0" aria-hidden /> {t("form.holdWarning")}
              </p>
              <FindingsPreview text={comment} findings={holds} />
            </div>
          ) : findings.length ? (
            <p className="mt-2 text-xs text-slate-600">{t("form.treatmentNote")}</p>
          ) : null}
        </div>
      </div>

      <fieldset>
        <legend className="mb-1.5 text-[13px] font-semibold text-slate-700">{t("form.display")}</legend>
        <div className="space-y-1.5 text-sm text-slate-700">
          <label className="flex items-center gap-2">
            <input type="radio" name="display" value="pseudonym" defaultChecked={initial?.display !== "first_initial" || !firstInitialName} className="h-4 w-4 accent-brand-700" />
            {t("form.displayPseudonym")}
          </label>
          {firstInitialName ? (
            <label className="flex items-center gap-2">
              <input type="radio" name="display" value="first_initial" defaultChecked={initial?.display === "first_initial"} className="h-4 w-4 accent-brand-700" />
              {t("form.displayFirstInitial", { name: firstInitialName })}
            </label>
          ) : null}
        </div>
      </fieldset>

      {mode === "create" ? (
        <fieldset className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
          <legend className="sr-only">{t("form.consentLegend")}</legend>
          <label className="flex items-start gap-2.5 text-sm text-slate-800">
            <input type="checkbox" name="consent" value="yes" required className="mt-0.5 h-4 w-4 shrink-0 accent-brand-700" aria-describedby={`${id}consent`} />
            <span>{tc("review_publication.label", { practice, practitioner })}</span>
          </label>
          <p id={`${id}consent`} className="mt-2 pl-6.5 text-xs text-slate-600">
            {tc("review_publication.description")}
          </p>
        </fieldset>
      ) : null}

      {state?.error ? (
        <p role="alert" className="text-sm font-medium text-red-700">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? <LoaderCircle size={16} className="animate-spin" aria-hidden /> : null}
        {mode === "create" ? t("form.submit") : t("form.update")}
      </Button>
    </form>
  );
}
