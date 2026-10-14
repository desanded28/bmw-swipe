/**
 * Serialisable shapes the care server actions return to the care client components (WP8), and
 * the few constants both sides share. Pure: safe in client components. Dates are ISO strings
 * (instants) or YYYY-MM-DD (days).
 */
import type { AppointmentStatus, Locale, RecallStatus, SignedVia } from "@/db/enums";
import type { FormSchema } from "@/db/schema";
import type { AnamnesisStatus } from "../dashboard/slots/contracts";

/** The recall intervals a clinician can pick after a visit (months). src/lib/recalls.ts uses the same list. */
export const RECALL_INTERVALS = [3, 4, 6, 9, 12, 18, 24] as const;

/**
 * The picker's options: RECALL_INTERVALS plus the interval currently set when the list lacks it
 * (services may suggest any 1–60 months; recalls store 3–24), in order.
 */
export function recallOptions(current: string | number | null | undefined): number[] {
  const n = Number(current);
  const list: number[] = [...RECALL_INTERVALS];
  if (!Number.isInteger(n) || n < RECALL_INTERVALS[0] || n > RECALL_INTERVALS[RECALL_INTERVALS.length - 1] || list.includes(n)) return list;
  return [...list, n].sort((a, b) => a - b);
}

/** Results of the care actions: data on success, a localised error otherwise. */
export type CareResult<T> = { ok: true; data: T; message?: string } | { ok: false; error: string; code?: string };

/** What the appointment drawer's care panel loads for one visit (loadAppointmentCare). */
export type AppointmentCareData = {
  status: AppointmentStatus;
  timezone: string;
  recall: { id: string; intervalMonths: number; dueDate: string; status: RecallStatus; confirmed: boolean } | null;
  /** The interval to pre-fill the picker with (the patient's, else the treatment's suggestion). */
  suggestedMonths: number | null;
  /** The viewer is a clinician (patient.clinical.read) who may set recalls (recalls.manage). */
  canSetInterval: boolean;
  /** The viewer may read the medical history (patient.clinical.read). */
  canReadClinical: boolean;
  anamnesis: {
    status: AnamnesisStatus | null;
    signedAt: string | null;
    /** Red-flag field ids: null unless the viewer has patient.clinical.read. */
    redFlags: string[] | null;
    /** The practice collects it online and the visit is upcoming. */
    canInvite: boolean;
  };
  /** needed: a closure covers the visit; offerSent: the patient was offered new times for it. */
  rebook: { needed: boolean; offerSent: boolean; callRequested: boolean };
};

/** A signed medical history, for the clinical team (loadAnamnesis). */
export type AnamnesisSheetData = {
  id: string;
  version: string;
  locale: Locale;
  signedAt: string;
  signerName: string | null;
  signedVia: SignedVia | null;
  exportedAt: string | null;
  redFlags: string[];
  answers: Record<string, string | string[]>;
  schema: FormSchema;
  patient: { firstName: string; lastName: string; birthDate: string | null };
  visit: { start: string; timezone: string } | null;
  clinic: string;
};

/** One visit a closure covers, for the "Rebook N patients" drawer. */
export type ClashItem = {
  id: string;
  start: string;
  timezone: string;
  /** Empty when `masked` (a restricted patient the viewer may not see): show a placeholder. */
  patientName: string;
  masked: boolean;
  practitionerName: string;
  locationName: string;
  needsAttention: boolean;
  offerSent: boolean;
  callRequested: boolean;
  reachable: boolean;
};

/** The manage page's care card (formsCardStatus). */
export type ManageCareCard = {
  /** signedOn: the day the form was signed, in the office's time zone (YYYY-MM-DD). */
  anamnesis: { status: AnamnesisStatus | null; signedOn: string | null; canFill: boolean } | null;
  rebookNeeded: boolean;
};

/** A patient's care overview (PatientCarePanel), already filtered for the viewer. */
export type PatientCareData = {
  patientId: string;
  recalls: { id: string; serviceName: string; dueDate: string; status: RecallStatus; intervalMonths: number; confirmed: boolean }[];
  minor: boolean;
  viaGuardian: boolean;
  guardian: { name: string | null; relation: "parent" | "legal_guardian" | null; phone: string | null; email: string | null } | null;
  /** alerts: how many medical alerts the form raised (never which); null without patient.clinical.read. */
  submissions: { id: string; signedAt: string; signerName: string | null; exportedAt: string | null; alerts: number | null }[];
  /** ofRestricted: the other record is restricted and the viewer may not see its name (ofName is null). */
  duplicate: { ofName: string | null; ofRestricted: boolean; flaggedBy: number } | null;
  canReadClinical: boolean;
};
