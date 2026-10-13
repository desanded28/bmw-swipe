import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { patients, type Locale } from "@/db/schema";
import type { AuditEvent } from "../audit";

/**
 * A patient's data export (Art. 15 access, Art. 20 portability).
 *
 * STUB with its final signature (WP5 builds the ZIP: patient.json, CSV per table, summary.html
 * with the Art. 15(1)(a)-(h) information, fhir.json). Today it returns the patient row as
 * JSON whatever the format. Callers audit the export (patient.export / privacy_center.export).
 */

export type PatientExport = { filename: string; contentType: string; body: Uint8Array };

export async function buildPatientExport(
  orgId: string,
  patientId: string,
  opts: { locale: Locale; format: "json" | "zip"; actor: AuditEvent["actor"] },
): Promise<PatientExport> {
  void opts;
  const [patient] = await db
    .select()
    .from(patients)
    .where(and(eq(patients.orgId, orgId), eq(patients.id, patientId)));
  if (!patient) throw new Error("Patient not found");
  return {
    filename: `patient-${patientId}.json`,
    contentType: "application/json; charset=utf-8",
    body: new TextEncoder().encode(JSON.stringify({ patient }, null, 2)),
  };
}
