"use client";

import type { PatientRelationSectionProps } from "./contracts";

/**
 * STUB (WP4): "Who is this appointment for? Me / A minor / Another adult", the guardian's details
 * for a minor and the booker's for another adult. Renders nothing and never calls onChange yet, so
 * the forms post no relation and the server checks none (PatientRelationSectionProps): a parent
 * booking for a child is not refused as a child booking alone. Consents are still recorded as the
 * patient's own, so recordConsent refuses them for a patient under 14 (guardian_required).
 */
export function PatientRelationSection(props: PatientRelationSectionProps) {
  void props;
  return null;
}
