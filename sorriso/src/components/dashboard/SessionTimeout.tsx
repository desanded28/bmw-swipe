"use client";

import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { keepSessionAlive } from "@/app/dashboard/actions/session";
import { useT } from "@/i18n/provider";
import { IDLE_WARNING_MS, idleWarningDelay } from "@/lib/session-timeout";
import { Button } from "../ui";

/**
 * Warns before the idle sign-out (WCAG 2.2.1) and extends the session with one click. Counted
 * from the last page load or navigation, which reached the server and slid the session; a save
 * in between slid it too, so the warning may come early, never late. Focus moves to "Stay signed
 * in" and goes back where it was afterwards, so a half-written text keeps its place.
 */
export function SessionTimeout({ idleMs }: { idleMs: number }) {
  const t = useT("dashboard");
  const id = useId();
  const pathname = usePathname();
  const [round, setRound] = useState(0);
  const [warning, setWarning] = useState(false);
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) {
    // A navigation reached the server: count again from now.
    setSeenPath(pathname);
    setWarning(false);
    setRound((r) => r + 1);
  }
  const stay = useRef<HTMLButtonElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      returnTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setWarning(true);
    }, idleWarningDelay(idleMs));
    return () => clearTimeout(timer);
  }, [idleMs, round, pathname]);

  useEffect(() => {
    if (warning) stay.current?.focus();
  }, [warning]);

  if (!warning) return null;
  const minutes = Math.round(IDLE_WARNING_MS / 60_000);
  return (
    <div
      role="alertdialog"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-body`}
      className="fixed bottom-4 right-4 z-[80] max-w-sm rounded-2xl bg-white p-4 shadow-pop ring-1 ring-slate-200"
    >
      <p id={`${id}-title`} className="font-bold text-slate-900">
        {t("session.idleTitle")}
      </p>
      <p id={`${id}-body`} className="mt-1 text-sm text-slate-700">
        {t("session.idleBody", { count: minutes })}
      </p>
      <Button
        ref={stay}
        size="sm"
        className="mt-3"
        onClick={async () => {
          await keepSessionAlive();
          setWarning(false);
          setRound((r) => r + 1);
          returnTo.current?.focus();
        }}
      >
        {t("session.stay")}
      </Button>
    </div>
  );
}
