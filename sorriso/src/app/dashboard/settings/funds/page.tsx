import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/permissions";

export const metadata: Metadata = { title: "Health funds" };

/**
 * The health funds and insurers the practice accepts, direct or indirect (WP7). Placeholder until
 * the package builds it.
 */
export default async function HealthFundsPage() {
  await requirePermission("catalog.manage");
  return <PageHeader title="Health funds" description="Coming soon." />;
}
