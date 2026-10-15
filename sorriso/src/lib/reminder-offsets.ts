/**
 * How long before an appointment a reminder rule may send: from 15 minutes to 14 days. Shared by
 * the rules editor (checked before saving) and saveReminderSettings (checked again on the server).
 * No server imports: client components use it.
 */
export const REMINDER_OFFSET_MIN_MINUTES = 15;
export const REMINDER_OFFSET_MAX_MINUTES = 14 * 24 * 60;

export function isValidReminderOffset(minutes: number): boolean {
  return Number.isInteger(minutes) && minutes >= REMINDER_OFFSET_MIN_MINUTES && minutes <= REMINDER_OFFSET_MAX_MINUTES;
}
