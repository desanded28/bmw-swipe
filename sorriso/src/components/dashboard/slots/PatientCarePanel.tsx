import { PatientCareView } from "@/components/care/PatientCareView";
import { loadPatientCare } from "@/lib/recalls";
import type { PatientCarePanelProps } from "./contracts";

/**
 * Care overview on the patient page: recalls, the parent or guardian, medical-history forms (red
 * flags and answers only with patient.clinical.read; opening one is audited) and a link to the
 * duplicates queue when this record may duplicate another. Async server component: it loads its
 * own data, scoped by orgId, through src/lib (components can't import @/db), and hands
 * serialisable data to a client view. Never render it from a client component.
 */
export async function PatientCarePanel({ orgId, patientId, permissions = [] }: PatientCarePanelProps) {
  const care = await loadPatientCare(orgId, patientId, permissions);
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
        submissions: care.submissions.map((s) => ({
          id: s.id,
          signedAt: s.signedAt.toISOString(),
          signerName: s.signerName,
          exportedAt: s.exportedAt?.toISOString() ?? null,
          redFlags: s.redFlags,
        })),
        duplicate: care.duplicate ? { ofName: care.duplicate.ofName, flaggedBy: care.duplicate.flaggedBy } : null,
        canReadClinical: permissions.includes("patient.clinical.read"),
      }}
    />
  );
}
