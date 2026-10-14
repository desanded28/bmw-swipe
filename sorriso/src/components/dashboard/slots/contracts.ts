/**
 * Contracts of the dashboard slots that the care package (WP8) fills in and the dashboard (WP2)
 * and patient pages (WP5) render. [frozen: packages only add fields]
 *
 *   CalendarEventBadges     on calendar events and AppointmentList rows       (client)
 *   AppointmentCarePanel    inside AppointmentDrawer                           (client)
 *   PatientCarePanel        on /dashboard/patients/[id]                        (async server component)
 *
 * WP2 builds a CareAppointment from its ApptDTO plus the flags from loadCareFlags()
 * (src/lib/risk.ts), which leaves out whatever the viewer may not see.
 *
 * Pure types and constants: safe in client components (type imports only from server modules).
 */
import type { AppointmentStatus, RiskLevel } from "@/db/enums";
import type { Permission } from "@/lib/permissions";

/**
 * The appointment's anamnesis (medical history form):
 *   none      no form is expected for this visit;
 *   missing   a form is expected and the patient hasn't filled it in yet;
 *   complete  the patient submitted it.
 */
export type AnamnesisStatus = "none" | "missing" | "complete";

/** What WP8 adds to an appointment, filtered by the viewer's permissions (loadCareFlags). */
export type CareFlags = {
  /** No-show risk for an upcoming visit; null when not computed or not shown. */
  riskLevel: RiskLevel | null;
  /** Reason keys in the care namespace (care.risk.*); empty when riskLevel is null. */
  riskReasons: string[];
  /** null when care features are off or the status is unknown. */
  anamnesis: AnamnesisStatus | null;
  /**
   * The anamnesis flags something the clinician must see before treating (allergy,
   * anticoagulants...). Health data: null unless the viewer has patient.clinical.read, so
   * reception (calendar.read only) never sees it.
   */
  redFlag: boolean | null;
};

/** Flags for an appointment WP8 knows nothing about, or a viewer who may see none of them. */
export const NO_CARE_FLAGS: Readonly<CareFlags> = { riskLevel: null, riskReasons: [], anamnesis: null, redFlag: null };

export type CareAppointment = CareFlags & {
  id: string;
  status: AppointmentStatus;
  /** ISO instants, as in ApptDTO. */
  start: string;
  end: string;
  patientId: string;
  serviceId: string;
  practitionerId: string;
  isNewPatient: boolean;
  /** The patient was a minor on the day of the visit (appointments.minorFlag). */
  minorFlag: boolean;
};

export type AppointmentCarePanelProps = {
  appt: CareAppointment;
  /** The viewer may act on it (recall interval, form reminder, rebooking): recalls.manage. */
  canManage: boolean;
};

export type CalendarEventBadgesProps = {
  appt: CareAppointment;
  /** Icon-only, for small calendar events. */
  compact?: boolean;
};

export type PatientCarePanelProps = {
  orgId: string;
  patientId: string;
  /**
   * The viewer's permissions (permissionsFor(role)). Without patient.clinical.read the panel shows
   * no clinical content (anamnesis answers, red flags). Defaults to none.
   */
  permissions?: readonly Permission[];
};
