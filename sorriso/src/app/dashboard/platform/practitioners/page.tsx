import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import { AlboActions } from "@/components/marketplace/AlboActions";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { db } from "@/db";
import { organizations, practitioners } from "@/db/schema";
import { fmtDay, zonedDate } from "@/i18n/datefmt";
import { getStaffLocale, getT } from "@/i18n/server";
import { requirePlatformAdmin } from "@/lib/auth";
import { practitionerName } from "@/lib/format";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getStaffLocale(), "marketplace")("platform.alboQueue.metaTitle") };
}

/** The FNOMCeO public register of physicians and dentists (looked up by hand: no automated requests). */
const FNOMCEO_REGISTER = "https://portale.fnomceo.it/cerca-prof/index.php";

/**
 * Albo verification queue (platform admins): practitioners who declared an Albo degli Odontoiatri
 * registration. A moderator looks it up in the public register, then confirms it here; only then
 * do the verified badge and the legal specialisations appear on the public profile.
 */
export default async function AlboQueuePage() {
  await requirePlatformAdmin();
  const locale = await getStaffLocale();
  const t = getT(locale, "marketplace");
  const select = { p: practitioners, orgName: organizations.name };
  const [pending, verified] = await Promise.all([
    db
      .select(select)
      .from(practitioners)
      .innerJoin(organizations, eq(organizations.id, practitioners.orgId))
      .where(and(isNotNull(practitioners.alboNumber), isNull(practitioners.alboVerifiedAt)))
      .orderBy(desc(practitioners.createdAt))
      .limit(200),
    db
      .select(select)
      .from(practitioners)
      .innerJoin(organizations, eq(organizations.id, practitioners.orgId))
      .where(isNotNull(practitioners.alboVerifiedAt))
      .orderBy(desc(practitioners.alboVerifiedAt))
      .limit(30),
  ]);

  const row = ({ p, orgName }: (typeof pending)[number]) => (
    <li key={p.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
      <div className="min-w-0">
        <p className="font-semibold">{practitionerName(p)}</p>
        <p className="text-sm text-slate-600">{t("platform.alboQueue.practice", { name: orgName })}</p>
        <p className="text-sm text-slate-700">{t("platform.alboQueue.registration", { province: p.alboProvince ?? "—", number: p.alboNumber ?? "—" })}</p>
        <p className="text-xs text-slate-600">
          {t("platform.alboQueue.specializations", {
            list: p.specializations?.length ? p.specializations.map((s) => t(`specializations.${s}`)).join(", ") : t("platform.alboQueue.none"),
          })}
        </p>
        {p.alboVerifiedAt ? (
          <p className="text-xs text-emerald-700">{t("platform.alboQueue.verifiedOn", { date: fmtDay(zonedDate(p.alboVerifiedAt, "Europe/Rome"), "long", locale) })}</p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <a href={FNOMCEO_REGISTER} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
          {t("platform.alboQueue.lookup")} <ExternalLink size={13} aria-hidden />
        </a>
        <AlboActions practitionerId={p.id} verified={Boolean(p.alboVerifiedAt)} />
      </div>
    </li>
  );

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={t("platform.alboQueue.title")} description={t("platform.alboQueue.description")} />
      <h2 className="mb-2 text-lg font-bold">{t("platform.alboQueue.pendingTitle")}</h2>
      {pending.length ? (
        <Card>
          <ul className="divide-y divide-slate-100">{pending.map(row)}</ul>
        </Card>
      ) : (
        <EmptyState title={t("platform.alboQueue.empty")} />
      )}
      <h2 className="mb-2 mt-8 text-lg font-bold">{t("platform.alboQueue.verifiedTitle")}</h2>
      {verified.length ? (
        <Card>
          <ul className="divide-y divide-slate-100">{verified.map(row)}</ul>
        </Card>
      ) : (
        <EmptyState title={t("platform.alboQueue.empty")} />
      )}
    </div>
  );
}
