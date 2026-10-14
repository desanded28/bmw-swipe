import { eq } from "drizzle-orm";
import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { StepUpForm } from "@/components/security/AccountSecurity";
import { Card } from "@/components/ui";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getStaffLocale, getT } from "@/i18n/server";
import { requireStaff, safeNext } from "@/lib/auth";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getStaffLocale(), "security")("stepUp.title") };
}

/** Re-authentication for sensitive pages and actions (requireStepUp sends people here), then back. */
export default async function StepUpPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const s = await requireStaff();
  const { next } = await searchParams;
  const back = safeNext(next);
  const t = getT(await getStaffLocale(), "security");
  const [user] = await db.select({ totp: users.totpEnabledAt }).from(users).where(eq(users.id, s.user.id));
  const mfa = Boolean(user?.totp);
  return (
    <div className="mx-auto max-w-md py-6">
      <Card className="p-7">
        <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700" aria-hidden>
          <ShieldCheck size={22} />
        </span>
        <h1 className="text-2xl font-bold tracking-tight">{t("stepUp.title")}</h1>
        <p className="mb-6 mt-1 text-sm text-slate-500">{t(mfa ? "stepUp.description" : "stepUp.descriptionPassword")}</p>
        <StepUpForm mfa={mfa} next={back} />
        <Link href={back} className="mt-5 inline-block text-sm font-semibold text-slate-500 hover:text-ink">
          {t("stepUp.back")}
        </Link>
      </Card>
    </div>
  );
}
