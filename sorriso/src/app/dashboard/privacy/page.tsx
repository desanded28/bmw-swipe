import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/permissions";

export const metadata: Metadata = { title: "Privacy requests" };

/**
 * The privacy-requests inbox: access, rectification, erasure, restriction, objection (WP5).
 * Placeholder until the package builds it.
 */
export default async function PrivacyRequestsPage() {
  await requirePermission("privacy.requests");
  return <PageHeader title="Privacy requests" description="Coming soon." />;
}
