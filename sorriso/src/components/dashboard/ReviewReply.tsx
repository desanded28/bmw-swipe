"use client";

import { useState } from "react";
import { replyToReview, setReviewPublished } from "@/app/dashboard/actions/reviews";
import { Button, Textarea } from "../ui";
import { useRunAction } from "./useRunAction";

export function ReviewReply({ id, reply, published, canManage }: { id: string; reply: string | null; published: boolean; canManage: boolean }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(reply ?? "");
  const { run, pending } = useRunAction();
  if (!canManage) return null;
  return (
    <div className="mt-2">
      {open ? (
        <div className="space-y-2">
          <Textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Public reply from the practice" />
          <div className="flex gap-2">
            <Button size="sm" disabled={pending} onClick={() => run(() => replyToReview(id, text), (r) => r.ok && setOpen(false))}>
              Publish reply
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-3 text-xs font-semibold">
          <button type="button" className="text-brand-700 hover:underline" onClick={() => setOpen(true)}>
            {reply ? "Edit reply" : "Reply"}
          </button>
          <button type="button" className="text-slate-500 hover:text-ink" disabled={pending} onClick={() => run(() => setReviewPublished(id, !published))}>
            {published ? "Hide" : "Publish"}
          </button>
        </div>
      )}
    </div>
  );
}
