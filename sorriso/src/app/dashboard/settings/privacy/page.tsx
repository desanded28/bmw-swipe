import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/permissions";

export const metadata: Metadata = { title: "Privacy settings" };

/**
 * Message content level, WhatsApp, retention, embed origins, MFA and the notice preview (WP5).
 * Placeholder until the package builds it.
 */
export default async function PrivacySettingsPage() {
  await requirePermission("privacy.settings");
  return <PageHeader title="Privacy settings" description="Coming soon." />;
}
