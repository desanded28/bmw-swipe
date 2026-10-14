import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { requireStaff } from "@/lib/auth";

export const metadata: Metadata = { title: "My security" };

/**
 * The signed-in user's password, two-step verification and sessions (WP6). Every member manages
 * their own account. Placeholder until the package builds it.
 */
export default async function AccountSecurityPage() {
  await requireStaff();
  return <PageHeader title="My security" description="Coming soon." />;
}
