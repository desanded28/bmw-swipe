import type { Metadata } from "next";
import { listPatientRows } from "@/app/dashboard/actions/patients";
import { PatientSearch } from "@/components/privacy-admin/PatientSearch";
import { PageHeader } from "@/components/ui";
import { getStaffLocale, getT } from "@/i18n/server";
import { requirePermission } from "@/lib/permissions";
import { ComplianceBanner } from "@/components/privacy-admin/ComplianceBanner";
import { gatePage } from "@/lib/privacy/gates";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getStaffLocale(), "privacyAdmin")("patients.title") };
}

/**
 * The practice's patients. Restricted records show a badge, and only a placeholder to staff who
 * may not open them. Searching happens client-side through a POST server action (no names in
 * URLs) and is audited as patient.search without the term.
 */
export default async function PatientsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const s = await requirePermission("patient.read");
  const banner = await gatePage(s);
  const t = getT(await getStaffLocale(), "privacyAdmin");
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const initial = await listPatientRows("", page);
  return (
    <div className="mx-auto max-w-6xl">
      <ComplianceBanner state={banner} />
      <PageHeader title={t("patients.title")} />
      <PatientSearch initial={initial} />
    </div>
  );
}
