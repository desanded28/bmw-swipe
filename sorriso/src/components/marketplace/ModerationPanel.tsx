"use client";

import { Gavel, MessageCircleQuestion } from "lucide-react";
import { useId, useState } from "react";
import { askReviewAuthor, decideHeldReviewAction, decideReviewReport } from "@/app/dashboard/actions/platform";
import { useT } from "@/i18n/provider";
import { useRunAction } from "../dashboard/useRunAction";
import { Button, Textarea } from "../ui";

const REASON_MIN = 20;

/**
 * A moderator's controls for one report (or one held review): ask the author for their side, then
 * keep or remove with a statement of reasons, which is sent to both sides (DSA Art. 17).
 */
export function ModerationPanel({ kind, id, canAsk }: { kind: "report" | "held"; id: string; canAsk: boolean }) {
  const t = useT("reviews");
  const { run, pending } = useRunAction();
  const [reason, setReason] = useState("");
  const uid = useId();
  const decide = (decision: "keep" | "remove") =>
    run(() => (kind === "report" ? decideReviewReport(id, decision, reason) : decideHeldReviewAction(id, decision, reason)));
  const ready = reason.trim().length >= REASON_MIN;

  return (
    <div className="mt-3 space-y-3 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
      {canAsk ? (
        <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => askReviewAuthor(id))}>
          <MessageCircleQuestion size={14} aria-hidden /> {t("moderation.askPatient")}
        </Button>
      ) : null}
      <div>
        <label htmlFor={`${uid}reason`} className="mb-1 block text-[13px] font-semibold text-slate-700">
          {t("moderation.reason")}
        </label>
        <Textarea id={`${uid}reason`} rows={3} maxLength={2000} value={reason} onChange={(e) => setReason(e.target.value)} aria-describedby={`${uid}hint`} />
        <p id={`${uid}hint`} className="mt-1 text-xs text-slate-500">
          {t("moderation.reasonHint")}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={pending || !ready} onClick={() => decide("keep")}>
          <Gavel size={14} aria-hidden /> {t("moderation.keep")}
        </Button>
        <Button size="sm" variant="danger" disabled={pending || !ready} onClick={() => decide("remove")}>
          <Gavel size={14} aria-hidden /> {t("moderation.remove")}
        </Button>
      </div>
    </div>
  );
}
