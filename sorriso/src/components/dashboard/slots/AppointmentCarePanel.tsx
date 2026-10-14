"use client";

import type { AppointmentCarePanelProps } from "./contracts";

/**
 * Care details inside the appointment drawer: risk and its reasons, anamnesis status (and red
 * flags for clinicians), recall interval, rebooking. STUB (WP8): renders nothing yet.
 */
export function AppointmentCarePanel({ appt, canManage }: AppointmentCarePanelProps) {
  void appt;
  void canManage;
  return null;
}
