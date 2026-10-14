"use client";

import { CalendarClock, CalendarOff } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { deleteTimeOff, loadClosureClashCounts } from "@/app/dashboard/actions/timeoff";
import { fmtDay, zonedDate, zonedTime } from "@/i18n/datefmt";
import { useLocale, useT } from "@/i18n/provider";
import { Badge, Button } from "../ui";
import { ActionButton } from "../dashboard/ActionButton";
import { RebookDrawer } from "./RebookDrawer";

export type TimeOffItem = {
  id: string;
  /** ISO instants. */
  startsAt: string;
  endsAt: string;
  /** Who or what is unavailable (computed by the page), if shown. */
  label: string | null;
  reason: string | null;
};

/**
 * The list of time off and closures, each with how many booked visits it covers and a
 * "Rebook N patients" button. Counts are loaded after render (they change as patients rebook).
 */
export function TimeOffItems({ items, tz }: { items: TimeOffItem[]; tz: string }) {
  const t = useT("care");
  const locale = useLocale();
  const [counts, setCounts] = useState<{ key: string; data: Record<string, number> } | null>(null);
  const [drawer, setDrawer] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const closeDrawer = useCallback(() => {
    setDrawer(null);
    setVersion((v) => v + 1);
  }, []);
  const idList = items.map((i) => i.id).join(",");
  const key = `${idList}:${version}`;

  useEffect(() => {
    if (!idList) return;
    let alive = true;
    loadClosureClashCounts(idList.split(","))
      .then((r) => alive && r.ok && setCounts({ key, data: r.data }))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [idList, key]);

  if (!items.length) return <p className="text-sm text-slate-500">{t("timeOff.nothing")}</p>;
  const clashes = counts?.key === key ? counts.data : {};
  const day = (iso: string) => fmtDay(zonedDate(iso, tz), "weekday", locale);

  return (
    <>
      <ul className="divide-y divide-slate-100">
        {items.map((item) => {
          const start = new Date(item.startsAt);
          const end = new Date(item.endsAt);
          const endInclusive = new Date(end.getTime() - 1).toISOString();
          const allDay = zonedTime(start, tz) === "00:00" && zonedTime(end, tz) === "00:00";
          const sameDay = zonedDate(start, tz) === zonedDate(allDay ? endInclusive : end, tz);
          const when = allDay
            ? sameDay
              ? t("timeOff.allDayOne", { day: day(item.startsAt) })
              : t("timeOff.allDayRange", { from: day(item.startsAt), to: day(endInclusive) })
            : sameDay
              ? t("timeOff.timedSameDay", { day: day(item.startsAt), start: zonedTime(start, tz), end: zonedTime(end, tz) })
              : t("timeOff.timedRange", {
                  fromDay: day(item.startsAt),
                  start: zonedTime(start, tz),
                  toDay: day(item.endsAt),
                  end: zonedTime(end, tz),
                });
          const n = clashes[item.id] ?? 0;
          return (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
              <div className="flex min-w-0 items-start gap-2.5">
                <CalendarOff size={16} className="mt-0.5 shrink-0 text-slate-500" aria-hidden />
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{when}</p>
                  <p className="text-xs text-slate-500">{[item.label, item.reason].filter(Boolean).join(" · ") || t("timeOff.unavailable")}</p>
                  {n > 0 ? (
                    <Badge tone="amber" className="mt-1">
                      {t("timeOff.affected", { count: n })}
                    </Badge>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {n > 0 ? (
                  <Button type="button" size="sm" variant="secondary" onClick={() => setDrawer(item.id)}>
                    <CalendarClock size={14} aria-hidden /> {t("timeOff.rebook", { count: n })}
                  </Button>
                ) : null}
                <ActionButton action={deleteTimeOff.bind(null, item.id)} variant="ghost" confirm={t("timeOff.removeConfirm")}>
                  {t("timeOff.remove")}
                </ActionButton>
              </div>
            </li>
          );
        })}
      </ul>
      {drawer ? <RebookDrawer timeOffId={drawer} onClose={closeDrawer} /> : null}
    </>
  );
}
