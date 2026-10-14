import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/permissions";

export const metadata: Metadata = { title: "Audit log" };

/** The practice's access and activity log, with chain verification (WP5). Placeholder until the package builds it. */
export default async function AuditLogPage() {
  await requirePermission("audit.read");
  return <PageHeader title="Audit log" description="Coming soon." />;
}
