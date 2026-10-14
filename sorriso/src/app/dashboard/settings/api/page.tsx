import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { ApiKeys } from "@/components/dashboard/ApiKeys";
import { Card, PageHeader } from "@/components/ui";
import { db } from "@/db";
import { apiKeys, users } from "@/db/schema";
import { fmtDay, zonedDate } from "@/i18n/datefmt";
import { lhref } from "@/i18n/href";
import { getStaffLocale, getT } from "@/i18n/server";
import { apiKeyExpiry } from "@/lib/api";
import { requirePermission } from "@/lib/permissions";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getStaffLocale(), "security")("api.metaTitle") };
}

/** Partner API keys: scopes, expiry, IP allow-lists, who created them and when they were last used. */
export default async function ApiSettingsPage() {
  const s = await requirePermission("apikeys.manage");
  const org = s.org;
  const locale = await getStaffLocale();
  const t = getT(locale, "security");
  const rows = await db
    .select({ key: apiKeys, creator: users.name })
    .from(apiKeys)
    .leftJoin(users, eq(users.id, apiKeys.createdByUserId))
    .where(eq(apiKeys.orgId, org.id))
    .orderBy(desc(apiKeys.createdAt));
  const now = Date.now();
  const day = (d: Date) => fmtDay(zonedDate(d, org.timezone), "short", locale);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={t("api.title")} />
      <Card className="p-6">
        <h2 className="mb-1 text-lg font-bold">{t("api.keysTitle")}</h2>
        <p className="mb-4 text-sm text-slate-500">
          {t("api.description")}{" "}
          <Link href={lhref(locale, "/developers")} target="_blank" className="font-semibold text-brand-700 hover:underline">
            {t("api.docs")} ↗
          </Link>
        </p>
        <ApiKeys
          keys={rows.map(({ key: k, creator }) => ({
            id: k.id,
            name: k.name,
            prefix: k.prefix,
            scopes: k.scopes,
            status: k.revokedAt ? "revoked" : apiKeyExpiry(k).getTime() <= now ? "expired" : "active",
            lastUsed: k.lastUsedAt ? day(k.lastUsedAt) : null,
            expires: fmtDay(zonedDate(apiKeyExpiry(k), org.timezone), "long", locale),
            createdBy: creator ?? null,
            allowedIps: k.allowedIps?.length ?? 0,
          }))}
        />
      </Card>
    </div>
  );
}
