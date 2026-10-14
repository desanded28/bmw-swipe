import { eq } from "drizzle-orm";
import { Download } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AuditChainStatus } from "@/components/privacy-admin/AuditChainStatus";
import { auditActionLabel } from "@/components/privacy-admin/PrivacyPanel";
import { Button, Card, EmptyState, Input, PageHeader, Select } from "@/components/ui";
import { db } from "@/db";
import { memberships, users } from "@/db/schema";
import { fmtWhen } from "@/i18n/datefmt";
import { getStaffLocale, getT } from "@/i18n/server";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, verifyAuditChain } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions";
import { RETENTION_LIMITS } from "@/lib/privacy/settings";
import { monthsAgo } from "@/lib/privacy/retention";
import { filterQuery, loadAuditRows, parseAuditFilter } from "./query";
import { ComplianceBanner } from "@/components/privacy-admin/ComplianceBanner";
import { gatePage } from "@/lib/privacy/gates";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getStaffLocale(), "privacyAdmin")("audit.title") };
}

const PAGE = 100;

/**
 * The practice's access and activity log (audit.read): filters by who, action, record and date,
 * the integrity of the hash chain (verifyAuditChain), and a CSV export of the filtered entries.
 */
export default async function AuditLogPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const s = await requirePermission("audit.read");
  const banner = await gatePage(s);
  const locale = await getStaffLocale();
  const t = getT(locale, "privacyAdmin");
  const tz = s.org.timezone;
  const f = parseAuditFilter(await searchParams);
  const now = new Date();

  const [rows, staff, chain] = await Promise.all([
    loadAuditRows(s.org.id, f, tz, PAGE + 1),
    db.select({ id: users.id, name: users.name }).from(memberships).innerJoin(users, eq(users.id, memberships.userId)).where(eq(memberships.orgId, s.org.id)),
    // An anchor younger than the shortest audit retention means a prefix was deleted outside retention.
    verifyAuditChain(s.org.id, { keptSince: monthsAgo(now, RETENTION_LIMITS.auditMonths.min) }),
  ]);
  const page = rows.slice(0, PAGE);
  const older = rows.length > PAGE ? page.at(-1)!.row.seq : null;
  const q = filterQuery(f);
  const entityLabel = (type: string | null) => {
    if (!type) return "—";
    const key = `audit.entities.${type}` as const;
    return t.has(key) ? t(key) : type;
  };
  const actorLabel = (r: (typeof rows)[number]) => {
    if (r.row.actorType === "user") return r.name ?? t("audit.unknownUser");
    const key = `audit.actorTypes.${r.row.actorType}` as const;
    return t.has(key) ? t(key) : r.row.actorType;
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <ComplianceBanner state={banner} />
      <PageHeader
        title={t("audit.title")}
        description={t("audit.description")}
        actions={
          <a href={`/dashboard/audit/export?${q}`} className="inline-flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold ring-1 ring-inset ring-slate-200 hover:bg-slate-50" title={t("audit.exportHint")}>
            <Download size={16} aria-hidden /> {t("audit.export")}
          </a>
        }
      />
      <AuditChainStatus t={t} result={chain} />

      <form method="get" className="grid grid-cols-1 gap-3 rounded-2xl bg-white p-4 shadow-card ring-1 ring-slate-200/70 sm:grid-cols-2 lg:grid-cols-6">
        <label className="block lg:col-span-1">
          <span className="mb-1.5 block text-[13px] font-semibold text-slate-700">{t("audit.filters.actor")}</span>
          <Select name="actor" defaultValue={f.actor ?? ""}>
            <option value="">{t("audit.filters.anyone")}</option>
            {staff.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
        </label>
        <label className="block lg:col-span-1">
          <span className="mb-1.5 block text-[13px] font-semibold text-slate-700">{t("audit.filters.action")}</span>
          <Select name="action" defaultValue={f.action ?? ""}>
            <option value="">{t("audit.filters.anyAction")}</option>
            {AUDIT_ACTIONS.map((a) => (
              <option key={a} value={a}>
                {auditActionLabel(t, a)}
              </option>
            ))}
          </Select>
        </label>
        <label className="block lg:col-span-1">
          <span className="mb-1.5 block text-[13px] font-semibold text-slate-700">{t("audit.filters.entity")}</span>
          <Select name="entity" defaultValue={f.entityType ?? ""}>
            <option value="">{t("audit.filters.anyEntity")}</option>
            {AUDIT_ENTITY_TYPES.map((e) => (
              <option key={e} value={e}>
                {entityLabel(e)}
              </option>
            ))}
          </Select>
        </label>
        <label className="block lg:col-span-1">
          <span className="mb-1.5 block text-[13px] font-semibold text-slate-700">{t("audit.filters.entityId")}</span>
          <Input name="entityId" defaultValue={f.entityId ?? ""} autoComplete="off" spellCheck={false} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold text-slate-700">{t("audit.filters.from")}</span>
          <Input name="from" type="date" defaultValue={f.from ?? ""} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold text-slate-700">{t("audit.filters.to")}</span>
          <Input name="to" type="date" defaultValue={f.to ?? ""} />
        </label>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-6">
          <Button type="submit">{t("audit.filters.apply")}</Button>
          <Link href="/dashboard/audit" className="inline-flex h-10 items-center rounded-xl px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100">
            {t("audit.filters.reset")}
          </Link>
        </div>
      </form>

      {page.length === 0 ? (
        <EmptyState title={t("audit.empty")} />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-2.5">
                  {t("audit.columns.at")}
                </th>
                <th scope="col" className="px-4 py-2.5">
                  {t("audit.columns.actor")}
                </th>
                <th scope="col" className="px-4 py-2.5">
                  {t("audit.columns.action")}
                </th>
                <th scope="col" className="px-4 py-2.5">
                  {t("audit.columns.entity")}
                </th>
                <th scope="col" className="px-4 py-2.5">
                  {t("audit.columns.details")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {page.map((r) => (
                <tr key={r.row.id} className="align-top">
                  <td className="whitespace-nowrap px-4 py-2 text-slate-600">
                    <time dateTime={r.row.at.toISOString()}>{fmtWhen(r.row.at, tz, locale, "short")}</time>
                  </td>
                  <td className="px-4 py-2">{actorLabel(r)}</td>
                  <td className="px-4 py-2 font-medium">{auditActionLabel(t, r.row.action)}</td>
                  <td className="px-4 py-2">
                    {r.row.entityType === "patient" && r.row.entityId ? (
                      <Link href={`/dashboard/patients/${r.row.entityId}`} className="text-brand-700 hover:underline">
                        {entityLabel(r.row.entityType)} <span className="font-mono text-xs">{r.row.entityId}</span>
                      </Link>
                    ) : (
                      <>
                        {entityLabel(r.row.entityType)} {r.row.entityId ? <span className="font-mono text-xs text-slate-500">{r.row.entityId}</span> : null}
                      </>
                    )}
                  </td>
                  <td className="max-w-xs px-4 py-2 text-xs text-slate-600">
                    {r.row.reason ? <p className="mb-0.5 text-slate-800">{t("audit.reason", { reason: r.row.reason })}</p> : null}
                    {r.row.metadata ? (
                      <p className="break-words font-mono">
                        {Object.entries(r.row.metadata)
                          .map(([k, v]) => `${k}=${v}`)
                          .join(" · ")}
                      </p>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      <nav className="flex justify-between text-sm font-semibold" aria-label={t("audit.title")}>
        {f.before ? (
          <Link href={`/dashboard/audit?${q}`} className="text-brand-700 hover:underline">
            ← {t("audit.newer")}
          </Link>
        ) : (
          <span />
        )}
        {older ? (
          <Link href={`/dashboard/audit?${new URLSearchParams({ ...Object.fromEntries(q), before: String(older) })}`} className="text-brand-700 hover:underline">
            {t("audit.older")} →
          </Link>
        ) : null}
      </nav>
    </div>
  );
}
