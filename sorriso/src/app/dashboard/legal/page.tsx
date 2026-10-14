import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { requireStaff } from "@/lib/auth";

export const metadata: Metadata = { title: "Legal documents" };

/**
 * DPA, terms and staff instructions to accept (WP5). Every member must reach it (the staff
 * instructions are theirs to accept); accepting the DPA and terms needs legal.accept, checked by
 * the action. Placeholder until the package builds it.
 */
export default async function LegalPage() {
  await requireStaff();
  return <PageHeader title="Legal documents" description="Coming soon." />;
}
