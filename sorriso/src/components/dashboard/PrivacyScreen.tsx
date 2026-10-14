"use client";

import { EyeOff } from "lucide-react";
import { useSyncExternalStore, type ReactNode } from "react";
import { useT } from "@/i18n/provider";
import { cx } from "../ui";

/**
 * Front-desk privacy screen: while it is on, patient names on the calendar and in appointment
 * lists are blurred until the pointer is over their event or row, or keyboard focus is in it, so
 * a patient standing at the desk can't read the day's list off the screen.
 *
 * A per-device convenience: the choice is kept in localStorage (never sent anywhere). Storage can
 * be unavailable (private windows, blocked site data), so every access is wrapped and an
 * in-memory value takes over for the rest of the visit.
 */

const STORAGE_KEY = "sorriso.dashboard.privacyScreen";
const CHANGE_EVENT = "sorriso:privacy-screen";
let memory = false;

function read(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return memory;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

/** Whether the privacy screen is on (always off during server rendering and hydration). */
export function usePrivacyScreen(): boolean {
  return useSyncExternalStore(subscribe, read, () => false);
}

export function setPrivacyScreen(on: boolean) {
  memory = on;
  try {
    if (on) window.localStorage.setItem(STORAGE_KEY, "1");
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage blocked: the in-memory value applies until the page is reloaded.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** The calendar toolbar's toggle button. */
export function PrivacyScreenToggle({ className }: { className?: string }) {
  const t = useT("calendar");
  const on = usePrivacyScreen();
  return (
    <button
      type="button"
      aria-pressed={on}
      title={t("privacyScreen.hint")}
      onClick={() => setPrivacyScreen(!on)}
      className={cx(
        "inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-semibold ring-1 ring-inset transition-colors",
        on ? "bg-ink text-white ring-ink" : "bg-white text-slate-700 ring-slate-300 hover:bg-slate-50",
        className,
      )}
    >
      <EyeOff size={15} aria-hidden />
      {t("privacyScreen.label")}
    </button>
  );
}

/**
 * A patient's name. Under the privacy screen it is blurred until its event or row (the nearest
 * ancestor with the `group/pii` class) is hovered or holds keyboard focus. Screen readers still
 * read it: the screen protects against onlookers, not against the person using the computer.
 */
export function Pii({ children, className }: { children: ReactNode; className?: string }) {
  const on = usePrivacyScreen();
  return (
    <span
      className={cx(
        on &&
          "blur-[5px] transition-[filter] duration-150 select-none group-hover/pii:blur-none group-focus-within/pii:blur-none group-hover/pii:select-auto",
        className,
      )}
    >
      {children}
    </span>
  );
}
