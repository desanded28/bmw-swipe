import type { Metadata } from "next";
import { LogRequestForm } from "@/components/privacy-admin/RequestForms";
import { RequestInbox, type InboxFilter } from "@/components/privacy-admin/RequestViews";
import { PageHeader } from "@/components/ui";
import { PRIVACY_REQUEST_TYPES, type PrivacyRequestType } from "@/db/enums";
import { getStaffLocale, getT } from "@/i18n/server";
import { auditStaff } from "@/lib/audit";
import { can, requirePermission } from "@/lib/permissions";
import { inboxRow, listPrivacyRequests } from "@/lib/privacy/requests";
import { todayIn } from "@/lib/time";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getStaffLocale(), "privacyAdmin")("requests.title") };
}

/**
 * The privacy-requests inbox: requests to exercise data protection rights with their statutory
 * deadline (one month, Art. 12(3)), filters, and a form to log requests received by phone, email,
 * letter or at the desk. Filters are in the URL; they carry no personal data. The list names the
 * requesters, so each look at it is audited (patient.search, with counts only).
 */
export default async function PrivacyRequestsPage({ searchParams }: { searchParams: Promise<{ status?: string; type?: string; overdue?: string }> }) {
  const s = await requirePermission("privacy.requests");
  const locale = await getStaffLocale();
  const t = getT(locale, "privacyAdmin");
  const sp = await searchParams;
  const filter: InboxFilter = {
    status: sp.status === "closed" || sp.status === "all" ? sp.status : "open",
    type: (PRIVACY_REQUEST_TYPES as readonly string[]).includes(sp.type ?? "") ? (sp.type as PrivacyRequestType) : null,
    overdue: sp.overdue === "1",
  };
  const now = new Date();
  const rows = await listPrivacyRequests(s.org.id, { status: filter.status, type: (filter.type as PrivacyRequestType | null) ?? undefined, overdue: filter.overdue, now });
  await auditStaff(s, "patient.search", undefined, { metadata: { results: rows.length, inbox: true, linked: rows.filter((r) => r.patient?.id).length } });
  const o = { locale, tz: s.org.timezone, now, canSeeRestricted: can(s.role, "patient.restricted.read") };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader title={t("requests.title")} description={t("requests.description")} />
      <RequestInbox t={t} rows={rows.map((r) => inboxRow(t, r, o))} filter={filter} base="/dashboard/privacy" />
      <LogRequestForm today={todayIn(s.org.timezone, now)} defaultLocale={s.org.defaultLocale} />
    </div>
  );
}
