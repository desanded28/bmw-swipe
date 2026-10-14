/** Helpers for the practitioner calendar feed (src/app/api/ics/practitioner/[token]/route.ts). */

/** The feed covers the past 7 days and the next 30. */
export const FEED_PAST_DAYS = 7;
export const FEED_AHEAD_DAYS = 30;
/** Feed URLs expire 12 months after they are issued. */
export const FEED_TOKEN_TTL_MS = 365 * 86_400_000;

/** "Giulia Maria", "Rossi" -> "G. R." (first letter of the first name and of the surname). */
export function patientInitials(firstName: string, lastName: string): string {
  const letter = (s: string) => [...s.trim()][0]?.toLocaleUpperCase() ?? "";
  return [letter(firstName), letter(lastName)]
    .filter(Boolean)
    .map((c) => `${c}.`)
    .join(" ");
}
