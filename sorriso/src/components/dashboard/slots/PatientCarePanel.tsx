import type { PatientCarePanelProps } from "./contracts";

/**
 * Care overview on the patient page: recalls, risk history, anamnesis submissions (answers only
 * with patient.clinical.read). Async server component: it loads its own data, scoped by orgId,
 * through src/lib (components can't import @/db). Never render it from a client component.
 * STUB (WP8): renders nothing yet.
 */
export async function PatientCarePanel({ orgId, patientId, permissions = [] }: PatientCarePanelProps) {
  void orgId;
  void patientId;
  void permissions;
  return null;
}
