"use client";

import { Star } from "lucide-react";
import { useActionState, useState } from "react";
import { Button, Textarea, cx } from "./ui";

export function ReviewForm({ action }: { action: (prev: { error?: string } | null, formData: FormData) => Promise<{ error?: string }> }) {
  const [state, formAction, pending] = useActionState(action, null);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="rating" value={rating} />
      <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            aria-label={`${i} star${i > 1 ? "s" : ""}`}
            onMouseEnter={() => setHover(i)}
            onClick={() => setRating(i)}
            className="p-1"
          >
            <Star size={34} className={cx("transition", (hover || rating) >= i ? "fill-amber-400 text-amber-400" : "text-slate-300")} />
          </button>
        ))}
      </div>
      <Textarea name="comment" rows={4} placeholder="What went well? What could be better?" maxLength={2000} />
      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" name="showName" defaultChecked className="h-4 w-4 accent-brand-700" /> Show my first name and initial
      </label>
      {state?.error ? <p className="text-sm font-medium text-red-600">{state.error}</p> : null}
      <Button type="submit" disabled={pending || rating === 0}>
        Publish review
      </Button>
    </form>
  );
}
