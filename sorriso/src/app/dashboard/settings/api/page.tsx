import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { ApiKeys } from "@/components/dashboard/ApiKeys";
import { Card, PageHeader } from "@/components/ui";
import { db } from "@/db";
import { apiKeys } from "@/db/schema";
import { fmtDay, zonedDate } from "@/lib/datefmt";
import { requirePermission } from "@/lib/permissions";

export const metadata: Metadata = { title: "API" };

/** Partner API keys (WP6: scopes, expiry, last use). Moved here from the settings page. */
export default async function ApiSettingsPage() {
  const s = await requirePermission("apikeys.manage");
  const org = s.org;
  const keys = await db.select().from(apiKeys).where(eq(apiKeys.orgId, org.id)).orderBy(desc(apiKeys.createdAt));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="API" />
      <Card className="p-6">
        <h2 className="mb-1 text-lg font-bold">API keys</h2>
        <p className="mb-3 text-sm text-slate-500">
          For your practice-management software: read and sync appointments, book with front-desk powers.{" "}
          <Link href="/developers" target="_blank" className="font-semibold text-brand-700 hover:underline">
            API docs ↗
          </Link>
        </p>
        <ApiKeys
          keys={keys.map((k) => ({
            id: k.id,
            name: k.name,
            prefix: k.prefix,
            revoked: Boolean(k.revokedAt),
            lastUsed: k.lastUsedAt ? fmtDay(zonedDate(k.lastUsedAt, org.timezone), "weekday") : null,
          }))}
        />
      </Card>
    </div>
  );
}
