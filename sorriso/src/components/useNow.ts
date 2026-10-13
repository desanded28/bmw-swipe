"use client";

import { useSyncExternalStore } from "react";

const MINUTE = 60_000;

function subscribe(onChange: () => void) {
  const t = setInterval(onChange, MINUTE);
  return () => clearInterval(t);
}

/**
 * Current time, rounded to the minute and refreshed every minute.
 * Returns null during server rendering and hydration so markup never depends
 * on the clock of a different machine; the real value arrives right after.
 */
export function useNow(): number | null {
  return useSyncExternalStore(
    subscribe,
    () => Math.floor(Date.now() / MINUTE) * MINUTE,
    () => null,
  );
}
