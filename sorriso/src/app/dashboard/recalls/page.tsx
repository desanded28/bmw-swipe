import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/permissions";

export const metadata: Metadata = { title: "Recalls" };

/** Due, overdue and to-call recalls with conversion counts (WP8). Placeholder until the package builds it. */
export default async function RecallsPage() {
  await requirePermission("recalls.manage");
  return <PageHeader title="Recalls" description="Coming soon." />;
}
