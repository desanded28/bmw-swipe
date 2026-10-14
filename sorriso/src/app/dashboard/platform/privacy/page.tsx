import type { Metadata } from "next";
import { RequestInbox, type InboxFilter } from "@/components/privacy-admin/RequestViews";
import { PageHeader } from "@/components/ui";
import { PRIVACY_REQUEST_TYPES, type PrivacyRequestType } from "@/db/enums";
import { getStaffLocale, getT } from "@/i18n/server";
import { requirePlatformAdmin } from "@/lib/auth";
import { inboxRow, listPrivacyRequests } from "@/lib/privacy/requests";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getStaffLocale(), "privacyAdmin")("requests.platformTitle") };
}

/**
 * Sorriso's own privacy inbox (critique 4: owned by WP5, carved out of the platform area):
 * requests about processing for which Sorriso is controller — marketplace bookings, reviews, the
 * privacy center — stored with org_id NULL. Platform admins only; every access is audited.
 */
export default async function PlatformPrivacyPage({ searchParams }: { searchParams: Promise<{ status?: string; type?: string; overdue?: string }> }) {
  await requirePlatformAdmin();
  const locale = await getStaffLocale();
  const t = getT(locale, "privacyAdmin");
  const sp = await searchParams;
  const filter: InboxFilter = {
    status: sp.status === "closed" || sp.status === "all" ? sp.status : "open",
    type: (PRIVACY_REQUEST_TYPES as readonly string[]).includes(sp.type ?? "") ? (sp.type as PrivacyRequestType) : null,
    overdue: sp.overdue === "1",
  };
  const now = new Date();
  const rows = await listPrivacyRequests(null, { status: filter.status, type: (filter.type as PrivacyRequestType | null) ?? undefined, overdue: filter.overdue, now });
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader title={t("requests.platformTitle")} description={t("requests.platformDescription")} />
      <RequestInbox t={t} rows={rows.map((r) => inboxRow(t, r, { locale, tz: "Europe/Rome", now, canSeeRestricted: true }))} filter={filter} base="/dashboard/platform/privacy" />
    </div>
  );
}
