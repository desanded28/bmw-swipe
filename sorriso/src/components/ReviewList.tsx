import { BadgeCheck, MessageSquareReply } from "lucide-react";
import { fmtDay, zonedDate } from "@/lib/datefmt";
import { Stars } from "./ui";

type ReviewItem = {
  id: string;
  rating: number;
  comment: string | null;
  authorName: string;
  reply: string | null;
  createdAt: Date;
  practitionerTitle?: string;
  practitionerName?: string;
};

export function ReviewList({ reviews, showPractitioner = false }: { reviews: ReviewItem[]; showPractitioner?: boolean }) {
  return (
    <div className="divide-y divide-slate-100">
      {reviews.map((r) => (
        <div key={r.id} className="py-4 first:pt-0">
          <div className="flex flex-wrap items-center gap-2">
            <Stars value={r.rating} />
            <span className="text-sm font-semibold">{r.authorName}</span>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
              <BadgeCheck size={13} /> Verified visit
            </span>
            <span className="text-xs text-slate-400">
              {fmtDay(zonedDate(r.createdAt, "Europe/Rome"), "short")} {r.createdAt.getUTCFullYear()}
            </span>
          </div>
          {showPractitioner && r.practitionerName ? (
            <p className="mt-0.5 text-xs text-slate-500">
              Visit with {r.practitionerTitle} {r.practitionerName}
            </p>
          ) : null}
          {r.comment ? <p className="mt-1.5 text-sm text-slate-700">{r.comment}</p> : null}
          {r.reply ? (
            <div className="mt-2 flex gap-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
              <MessageSquareReply size={15} className="mt-0.5 shrink-0 text-slate-400" />
              <span>
                <span className="font-semibold text-slate-700">Practice reply: </span>
                {r.reply}
              </span>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
