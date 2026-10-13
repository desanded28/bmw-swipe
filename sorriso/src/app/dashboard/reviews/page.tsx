import { desc, eq } from "drizzle-orm";
import { BadgeCheck } from "lucide-react";
import type { Metadata } from "next";
import { ReviewReply } from "@/components/dashboard/ReviewReply";
import { Avatar, Badge, Card, EmptyState, PageHeader, Stars } from "@/components/ui";
import { db } from "@/db";
import { practitioners, reviews } from "@/db/schema";
import { MANAGERS, requireStaff } from "@/lib/auth";
import { fmtDay, zonedDate } from "@/lib/datefmt";
import { practitionerName } from "@/lib/format";

export const metadata: Metadata = { title: "Reviews" };

export default async function ReviewsPage() {
  const s = await requireStaff();
  const rows = await db
    .select({ r: reviews, p: practitioners })
    .from(reviews)
    .innerJoin(practitioners, eq(practitioners.id, reviews.practitionerId))
    .where(eq(reviews.orgId, s.org.id))
    .orderBy(desc(reviews.createdAt))
    .limit(200);
  const byP = new Map<string, { p: (typeof rows)[number]["p"]; sum: number; n: number }>();
  for (const { r, p } of rows) {
    const cur = byP.get(p.id) ?? { p, sum: 0, n: 0 };
    cur.sum += r.rating;
    cur.n += 1;
    byP.set(p.id, cur);
  }
  const canManage = MANAGERS.includes(s.role);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Reviews" description="Only patients with a completed visit can leave a review, so every one is verified." />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[...byP.values()].map(({ p, sum, n }) => (
          <Card key={p.id} className="flex items-center gap-3 p-4">
            <Avatar name={p.name} color={p.color} size={38} />
            <div>
              <p className="text-sm font-semibold">{practitionerName(p)}</p>
              <p className="flex items-center gap-1 text-xs text-slate-500">
                <Stars value={sum / n} size={12} /> {(sum / n).toFixed(1)} · {n}
              </p>
            </div>
          </Card>
        ))}
      </div>
      {rows.length === 0 ? (
        <EmptyState title="No reviews yet">Mark visits as completed — patients get a review request two hours later.</EmptyState>
      ) : (
        <Card className="divide-y divide-slate-100">
          {rows.map(({ r, p }) => (
            <div key={r.id} className={r.published ? "p-4" : "bg-slate-50 p-4 opacity-70"}>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Stars value={r.rating} />
                <span className="font-semibold">{r.authorName}</span>
                <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
                  <BadgeCheck size={12} /> verified
                </span>
                <span className="text-xs text-slate-500">· {practitionerName(p)}</span>
                {!r.published ? <Badge tone="amber">Hidden</Badge> : null}
                <span className="ml-auto text-xs text-slate-400">{fmtDay(zonedDate(r.createdAt, s.org.timezone), "weekday")}</span>
              </div>
              {r.comment ? <p className="mt-1.5 text-sm text-slate-700">{r.comment}</p> : null}
              {r.reply ? <p className="mt-2 rounded-lg bg-slate-50 p-2.5 text-sm text-slate-600">↳ {r.reply}</p> : null}
              <ReviewReply id={r.id} reply={r.reply} published={r.published} canManage={canManage} />
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
