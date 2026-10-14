"use client";

import { CalendarX, LoaderCircle, PhoneCall, Send, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { cancelForClosureAction, loadClosureClashes, sendRebookOffersAction } from "@/app/dashboard/actions/timeoff";
import { capitalizeFirst, fmtDay, fmtTime, zonedDate } from "@/i18n/datefmt";
import { useLocale, useT } from "@/i18n/provider";
import { Badge, Button } from "../ui";
import { useRunAction } from "../dashboard/useRunAction";
import type { CareResult, ClashItem } from "./types";

/**
 * "Rebook N patients": the visits a closure covers, to offer new times (one message each, in the
 * patient's language, with a one-tap rebooking link) or to cancel with reason
 * practice_unavailable. A side drawer: Escape or the close button closes it, focus starts on its
 * title and returns where it was.
 */
export function RebookDrawer({ timeOffId, onClose }: { timeOffId: string; onClose(): void }) {
  const t = useT("care");
  const locale = useLocale();
  const titleId = useId();
  const descId = useId();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const { run, pending } = useRunAction();
  const [version, setVersion] = useState(0);
  const [loaded, setLoaded] = useState<{ v: number; res: CareResult<ClashItem[]> } | null>(null);
  /** Unticked visits (everything starts ticked). */
  const [unticked, setUnticked] = useState<Set<string>>(new Set());

  useEffect(() => {
    let alive = true;
    loadClosureClashes(timeOffId)
      .then((res) => alive && setLoaded({ v: version, res }))
      .catch(() => alive && setLoaded({ v: version, res: { ok: false, error: "" } }));
    return () => {
      alive = false;
    };
  }, [timeOffId, version]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    titleRef.current?.focus();
    return () => previous?.focus?.();
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const res = loaded?.v === version ? loaded.res : null;
  const items = res?.ok ? res.data : [];
  const selected = items.filter((i) => !unticked.has(i.id)).map((i) => i.id);
  const allTicked = items.length > 0 && selected.length === items.length;
  const toggle = (id: string) =>
    setUnticked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const after = () => {
    setUnticked(new Set());
    setVersion((v) => v + 1);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30" onClick={onClose}>
      <div
        className="animate-slide-in flex h-full w-full max-w-[480px] flex-col bg-white shadow-pop"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-5">
          <div className="min-w-0">
            <h2 id={titleId} ref={titleRef} tabIndex={-1} className="text-lg font-bold focus:outline-none">
              {t("drawer.title")}
            </h2>
            <p id={descId} className="mt-1 text-sm text-slate-600">
              {t("drawer.description")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-ink focus-visible:outline-2 focus-visible:outline-brand-600"
            aria-label={t("drawer.close")}
          >
            <X size={20} aria-hidden />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {res === null ? (
            <p className="flex items-center gap-2 text-sm text-slate-500" role="status">
              <LoaderCircle size={14} className="animate-spin" aria-hidden /> {t("drawer.loading")}
            </p>
          ) : !res.ok ? (
            <p className="text-sm text-red-700" role="alert">
              {res.error || t("actions.failed")}
            </p>
          ) : !items.length ? (
            <p className="text-sm text-slate-600">{t("drawer.empty")}</p>
          ) : (
            <fieldset>
              <legend className="sr-only">{t("drawer.title")}</legend>
              <label className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-brand-700"
                  checked={allTicked}
                  onChange={() => setUnticked(allTicked ? new Set(items.map((i) => i.id)) : new Set())}
                />
                {t("drawer.selectAll")}
              </label>
              <ul className="divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200">
                {items.map((i) => (
                  <li key={i.id} className="flex items-start gap-3 p-3">
                    <input
                      id={`${titleId}-${i.id}`}
                      type="checkbox"
                      className="mt-1 h-4 w-4 accent-brand-700"
                      checked={!unticked.has(i.id)}
                      onChange={() => toggle(i.id)}
                      aria-label={t("drawer.select", { name: i.patientName })}
                    />
                    <label htmlFor={`${titleId}-${i.id}`} className="min-w-0 flex-1 text-sm">
                      <span className="block font-semibold">{i.patientName}</span>
                      <span className="block text-slate-600">
                        {capitalizeFirst(
                          t("drawer.when", { date: fmtDay(zonedDate(i.start, i.timezone), "medium", locale), time: fmtTime(i.start, i.timezone) }),
                          locale,
                        )}
                      </span>
                      <span className="block text-xs text-slate-500">
                        {i.practitionerName} · {i.locationName}
                      </span>
                      <span className="mt-1 flex flex-wrap gap-1">
                        {i.callRequested ? (
                          <Badge tone="amber">
                            <PhoneCall size={12} aria-hidden /> {t("drawer.callRequested")}
                          </Badge>
                        ) : i.needsAttention ? (
                          <Badge tone="blue">{t("drawer.offerSent")}</Badge>
                        ) : null}
                        {!i.reachable ? <Badge tone="red">{t("drawer.unreachable")}</Badge> : null}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
          )}
        </div>

        <div className="flex flex-wrap gap-2 border-t border-slate-100 p-4">
          <Button
            type="button"
            disabled={pending || !selected.length}
            onClick={() => run(() => sendRebookOffersAction(selected), after)}
          >
            {pending ? <LoaderCircle size={16} className="animate-spin" aria-hidden /> : <Send size={16} aria-hidden />}
            {t("drawer.send", { count: selected.length })}
          </Button>
          <Button
            type="button"
            variant="danger"
            disabled={pending || !selected.length}
            onClick={() => {
              if (window.confirm(t("drawer.cancelConfirm"))) run(() => cancelForClosureAction(selected), after);
            }}
          >
            <CalendarX size={16} aria-hidden /> {t("drawer.cancel", { count: selected.length })}
          </Button>
        </div>
      </div>
    </div>
  );
}
