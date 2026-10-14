import { and, count, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { BadgeCheck, Gavel, Inbox } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, PageHeader } from "@/components/ui";
import { db } from "@/db";
import { practitioners, reviewReports, reviews } from "@/db/schema";
import { getStaffLocale, getT } from "@/i18n/server";
import { requirePlatformAdmin } from "@/lib/auth";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getStaffLocale(), "marketplace")("platform.metaTitle") };
}

/** Sorriso staff only: the Albo verification queue, review moderation and Sorriso's privacy inbox (WP5). */
export default async function PlatformPage() {
  await requirePlatformAdmin();
  const t = getT(await getStaffLocale(), "marketplace");
  const [[albo], [reports], [held]] = await Promise.all([
    db
      .select({ n: count() })
      .from(practitioners)
      .where(and(isNotNull(practitioners.alboNumber), isNull(practitioners.alboVerifiedAt))),
    db.select({ n: count() }).from(reviewReports).where(inArray(reviewReports.status, ["open", "awaiting_patient"])),
    db.select({ n: count() }).from(reviews).where(eq(reviews.status, "under_review")),
  ]);
  const sections = [
    { href: "/dashboard/platform/practitioners", icon: BadgeCheck, title: t("platform.albo"), body: t("platform.alboBody"), pending: albo?.n ?? 0 },
    { href: "/dashboard/platform/reviews", icon: Gavel, title: t("platform.reviews"), body: t("platform.reviewsBody"), pending: Math.max(reports?.n ?? 0, held?.n ?? 0) },
    { href: "/dashboard/platform/privacy", icon: Inbox, title: t("platform.privacy"), body: t("platform.privacyBody"), pending: null },
  ];
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={t("platform.title")} description={t("platform.description")} />
      <ul className="grid gap-4 md:grid-cols-3">
        {sections.map(({ href, icon: Icon, title, body, pending }) => (
          <li key={href}>
            <Link href={href} className="block h-full rounded-2xl focus-visible:outline-2 focus-visible:outline-brand-600">
              <Card className="h-full p-5 hover:ring-brand-300">
                <p className="flex items-center gap-2 font-bold">
                  <Icon size={18} className="text-brand-700" aria-hidden /> {title}
                </p>
                <p className="mt-1 text-sm text-slate-600">{body}</p>
                {pending ? (
                  <Badge tone="amber" className="mt-3">
                    {t("platform.pending", { count: pending })}
                  </Badge>
                ) : null}
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
