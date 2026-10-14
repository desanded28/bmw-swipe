"use client";

import type { CalendarEventBadgesProps } from "./contracts";

/**
 * Small badges on calendar events and appointment rows: no-show risk, minor, new patient,
 * anamnesis missing, red flag (clinicians only). STUB (WP8): renders nothing yet.
 */
export function CalendarEventBadges({ appt, compact }: CalendarEventBadgesProps) {
  void appt;
  void compact;
  return null;
}
