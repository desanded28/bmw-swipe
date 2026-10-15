/**
 * The dashboard's idle warning (src/components/dashboard/SessionTimeout.tsx). No server imports:
 * the client component uses it; the idle limit itself is IDLE_TIMEOUT_MS in src/lib/auth.ts.
 */

/** The warning comes this long before the idle sign-out: enough to read it and click (WCAG 2.2.1 asks for 20 s). */
export const IDLE_WARNING_MS = 2 * 60_000;

/** How long after the last request the warning appears. */
export function idleWarningDelay(idleMs: number, warnMs: number = IDLE_WARNING_MS): number {
  return Math.max(0, idleMs - warnMs);
}
