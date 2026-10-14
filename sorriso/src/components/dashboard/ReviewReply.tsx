"use client";

import { Flag, MessageSquareReply, ShieldAlert } from "lucide-react";
import { useId, useState } from "react";
import { replyToReview, reportReview } from "@/app/dashboard/actions/reviews";
import { REVIEW_REPORT_GROUNDS, type ReviewReportGround, type ReviewStatus } from "@/db/enums";
import { useT } from "@/i18n/provider";
import { scanHealthTerms } from "@/lib/health-terms";
import { FindingsPreview } from "../marketplace/Highlighted";
import { REPLY_TEMPLATES, type ReplyTemplates } from "../marketplace/review-templates";
import { Button, Select, Textarea } from "../ui";
import { useRunAction } from "./useRunAction";

const REPLY_MAX = 1000;

/**
 * The practice's tools under a review: a public reply with guardrails (a just-in-time warning, the
 * health-term check on the reply, neutral templates in the review's language, and a confirmation
 * without which nothing is published), and a report to Sorriso's moderators, or the practice's
 * one appeal after a decision. Nothing here can hide or publish a review.
 */
export function ReviewReply({
  id,
  reply,
  status,
  canReply,
  canReport,
  canAppeal = false,
  templates,
}: {
  id: string;
  reply: string | null;
  status: ReviewStatus;
  canReply: boolean;
  canReport: boolean;
  /** A decision on this review can still be appealed (once). */
  canAppeal?: boolean;
  /** Neutral reply templates, already in the review's language. */
  templates: ReplyTemplates;
}) {
  const t = useT("reviews");
  const tc = useT("common");
  const [mode, setMode] = useState<"idle" | "reply" | "report">("idle");
  const [text, setText] = useState(reply ?? "");
  const [confirmed, setConfirmed] = useState(false);
  const [ground, setGround] = useState<ReviewReportGround>("defamation");
  const [details, setDetails] = useState("");
  const { run, pending } = useRunAction();
  const uid = useId();
  const findings = scanHealthTerms(text).filter((f) => f.severity === "hold");
  const reportable = status === "published" || canAppeal;
  const replyable = canReply && status === "published";
  if (!replyable && !(canReport && reportable)) return null;

  if (mode === "reply") {
    return (
      <div className="mt-3 space-y-3 rounded-xl bg-white p-3 ring-1 ring-slate-200">
        <div role="note" className="flex gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
          <ShieldAlert size={16} className="mt-0.5 shrink-0" aria-hidden />
          <div>
            <p className="font-semibold">{t("reply.warningTitle")}</p>
            <p>{t("reply.warning")}</p>
          </div>
        </div>
        <div>
          <label htmlFor={`${uid}tpl`} className="mb-1 block text-[13px] font-semibold text-slate-700">
            {t("reply.templates")}
          </label>
          <Select
            id={`${uid}tpl`}
            value=""
            aria-describedby={`${uid}tplhint`}
            onChange={(e) => {
              const key = e.target.value as keyof ReplyTemplates;
              if (key in templates) setText(templates[key]);
            }}
          >
            <option value="">{t("reply.templateNone")}</option>
            {REPLY_TEMPLATES.map((k) => (
              <option key={k} value={k}>
                {t(`reply.templateNames.${k}`)}
              </option>
            ))}
          </Select>
          <p id={`${uid}tplhint`} className="mt-1 text-xs text-slate-500">
            {t("reply.templateLanguage")}
          </p>
        </div>
        <div>
          <label htmlFor={`${uid}text`} className="mb-1 block text-[13px] font-semibold text-slate-700">
            {t("reply.label")}
          </label>
          <Textarea id={`${uid}text`} rows={3} maxLength={REPLY_MAX} value={text} onChange={(e) => setText(e.target.value)} aria-describedby={findings.length ? `${uid}flag` : undefined} />
          <div aria-live="polite">
            {findings.length ? (
              <div id={`${uid}flag`} className="mt-2 text-sm text-red-800">
                <p>{t("reply.flagged")}</p>
                <FindingsPreview text={text} findings={findings} />
              </div>
            ) : null}
          </div>
        </div>
        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-brand-700" />
          {t("reply.confirm")}
        </label>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={pending || !confirmed || !text.trim()}
            onClick={() => run(() => replyToReview(id, text, confirmed), (r) => r.ok && setMode("idle"))}
          >
            {t("reply.publish")}
          </Button>
          {reply ? (
            <Button size="sm" variant="danger" disabled={pending} onClick={() =>
                run(
                  () => replyToReview(id, "", false),
                  (r) => {
                    if (!r.ok) return;
                    setText("");
                    setMode("idle");
                  },
                )
              }>
              {t("reply.remove")}
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" onClick={() => setMode("idle")}>
            {tc("actions.cancel")}
          </Button>
        </div>
      </div>
    );
  }

  if (mode === "report") {
    return (
      <div className="mt-3 space-y-3 rounded-xl bg-white p-3 ring-1 ring-slate-200">
        <p className="font-semibold">{canAppeal ? t("reportForm.appealTitle") : t("reportForm.title")}</p>
        <p className="text-xs text-slate-600">{t("reportForm.note")}</p>
        <div>
          <label htmlFor={`${uid}ground`} className="mb-1 block text-[13px] font-semibold text-slate-700">
            {t("reportForm.ground")}
          </label>
          <Select id={`${uid}ground`} value={ground} onChange={(e) => setGround(e.target.value as ReviewReportGround)}>
            {REVIEW_REPORT_GROUNDS.map((g) => (
              <option key={g} value={g}>
                {t(`grounds.${g}`)}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor={`${uid}details`} className="mb-1 block text-[13px] font-semibold text-slate-700">
            {t("reportForm.details")}
          </label>
          <Textarea id={`${uid}details`} rows={3} maxLength={2000} value={details} onChange={(e) => setDetails(e.target.value)} aria-describedby={`${uid}dhint`} />
          <p id={`${uid}dhint`} className="mt-1 text-xs text-slate-500">
            {t("reportForm.detailsHint")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" disabled={pending || details.trim().length < 5} onClick={() => run(() => reportReview(id, ground, details), (r) => r.ok && setMode("idle"))}>
            {canAppeal ? t("reportForm.submitAppeal") : t("reportForm.submit")}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setMode("idle")}>
            {tc("actions.cancel")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2 flex flex-wrap gap-4 text-xs font-semibold">
      {replyable ? (
        <button type="button" className="inline-flex items-center gap-1 text-brand-700 hover:underline" onClick={() => setMode("reply")}>
          <MessageSquareReply size={13} aria-hidden /> {reply ? t("reply.edit") : t("reply.action")}
        </button>
      ) : null}
      {canReport && reportable ? (
        <button type="button" className="inline-flex items-center gap-1 text-slate-600 hover:text-ink" onClick={() => setMode("report")}>
          <Flag size={13} aria-hidden /> {canAppeal ? t("reportForm.appealAction") : t("reportForm.action")}
        </button>
      ) : null}
    </div>
  );
}
