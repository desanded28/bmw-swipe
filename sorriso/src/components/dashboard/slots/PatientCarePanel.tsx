import { PatientCareView } from "@/components/care/PatientCareView";
import { requireStaff } from "@/lib/auth";
import { loadPatientCare } from "@/lib/recalls";
import type { PatientCarePanelProps } from "./contracts";

/**
 * Care overview on the patient page: recalls, the parent or guardian, medical-history forms (how
 * many alerts each raised only with patient.clinical.read; which alerts and the answers only by
 * opening the form, audited) and a link to the duplicates queue when this record may duplicate
 * another. A restricted patient's care data shows only after the viewer gave a reason, checked
 * here as well as by the page. Async server component: it loads its own data, scoped by orgId,
 * through src/lib (components can't import @/db), and hands serialisable data to a client view.
 * Never render it from a client component.
 */
export async function PatientCarePanel({ orgId, patientId, permissions = [] }: PatientCarePanelProps) {
  const s = await requireStaff();
  if (s.org.id !== orgId) return null;
  const care = await loadPatientCare(orgId, patientId, permissions, { viewer: { userId: s.user.id } });
  if (!care) return null;
  return (
    <PatientCareView
      data={{
        patientId,
        recalls: care.recalls.map((r) => ({
          id: r.id,
          serviceName: r.serviceName,
          dueDate: r.dueDate,
          status: r.status,
          intervalMonths: r.intervalMonths,
          confirmed: r.confirmed,
        })),
        minor: care.minor,
        viaGuardian: care.viaGuardian,
        guardian: care.guardian,
        submissions: care.submissions.map((sub) => ({
          id: sub.id,
          signedAt: sub.signedAt.toISOString(),
          signerName: sub.signerName,
          exportedAt: sub.exportedAt?.toISOString() ?? null,
          alerts: sub.alerts,
        })),
        duplicate: care.duplicate
          ? { ofName: care.duplicate.ofName, ofRestricted: care.duplicate.ofRestricted, flaggedBy: care.duplicate.flaggedBy }
          : null,
        canReadClinical: permissions.includes("patient.clinical.read"),
      }}
    />
  );
}
