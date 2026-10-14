import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { requirePlatformAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Platform" };

/**
 * Sorriso staff only: Albo verification queue, review moderation, the platform privacy inbox (WP7,
 * platform/privacy/** WP5). Placeholder until the package builds it.
 */
export default async function PlatformPage() {
  await requirePlatformAdmin();
  return <PageHeader title="Platform" description="Coming soon." />;
}
