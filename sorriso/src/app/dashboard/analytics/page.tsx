import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/permissions";

export const metadata: Metadata = { title: "Analytics" };

/** Practice analytics with inline SVG charts and a CSV export (WP2). Placeholder until the package builds it. */
export default async function AnalyticsPage() {
  await requirePermission("analytics.read");
  return <PageHeader title="Analytics" description="Coming soon." />;
}
