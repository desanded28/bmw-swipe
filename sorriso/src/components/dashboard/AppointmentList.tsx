"use client";

import { BellRing, Check, Phone, UserX } from "lucide-react";
import { useState } from "react";
import { approve, confirmByPhone, remindNow } from "@/app/dashboard/actions";
import { fmtDay } from "@/lib/datefmt";
import { formatPhone } from "@/lib/phone";
import { Badge, Button, EmptyState, cx } from "../ui";
import { useNow } from "../useNow";
import { AppointmentDrawer, StatusBadge, localDate, localTime, useRunAction } from "./AppointmentDrawer";
import type { ApptDTO, Resources } from "./types";

export function AppointmentList({
  appointments,
  resources,
  showDate = true,
  quickActions = true,
  empty = "Nothing here.",
  showLastMessage,
}: {
  appointments: ApptDTO[];
  resources: Resources;
  showDate?: boolean;
  quickActions?: boolean;
  empty?: string;
  showLastMessage?: Record<string, string>;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const { run, pending } = useRunAction();
  const now = useNow();
  const open = appointments.find((a) => a.id === openId);
  if (!appointments.length) return <EmptyState title={empty} />;

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-slate-200/70">
      {appointments.map((a, i) => {
        const tz = a.location.timezone;
        const date = localDate(a.start, tz);
        const prev = appointments[i - 1];
        const header = showDate && (!prev || localDate(prev.start, prev.location.timezone) !== date);
        const upcoming = now !== null && Date.parse(a.start) > now;
        return (
          <div key={a.id}>
            {header ? (
              <p className="border-y border-slate-100 bg-slate-50 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-slate-500 first:border-t-0">
                {fmtDay(date, "medium")}
              </p>
            ) : null}
            <div
              className={cx(
                "grid cursor-pointer items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 hover:bg-slate-50 sm:grid-cols-[64px_1.4fr_1.2fr_1fr_auto]",
                a.status === "cancelled" && "opacity-60",
              )}
              onClick={() => setOpenId(a.id)}
            >
              <div className="text-sm font-bold tabular-nums">{localTime(a.start, tz)}</div>
              <div className="min-w-0">
                <p className="flex items-center gap-2 truncate font-semibold">
                  {a.patient.name}
                  {a.patient.noShowCount ? (
                    <Badge tone="red" title="Previous no-shows">
                      <UserX size={11} /> {a.patient.noShowCount}
                    </Badge>
                  ) : null}
                  {a.isNewPatient ? <Badge tone="violet">New</Badge> : null}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {a.patient.phone ? formatPhone(a.patient.phone) : a.patient.email} · prefers {a.patient.preferredChannel}
                </p>
                {showLastMessage?.[a.id] ? (
                  <p className="mt-1 truncate rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-900">“{showLastMessage[a.id]}”</p>
                ) : null}
              </div>
              <div className="min-w-0 text-sm">
                <p className="truncate font-medium">{a.service.name}</p>
                <p className="flex items-center gap-1.5 truncate text-xs text-slate-500">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: a.practitioner.color }} />
                  {a.practitioner.name} · {a.location.name}
                </p>
              </div>
              <div>
                <StatusBadge a={a} />
              </div>
              <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                {quickActions && a.status === "requested" ? (
                  <Button size="sm" disabled={pending} onClick={() => run(() => approve(a.id))}>
                    <Check size={14} /> Approve
                  </Button>
                ) : null}
                {quickActions && a.status === "scheduled" && a.confirmation === "pending" && upcoming ? (
                  <>
                    {a.patient.phone ? (
                      <a href={`tel:${a.patient.phone}`} className="inline-flex h-8 w-8 items-center justify-center rounded-lg ring-1 ring-slate-200 hover:bg-white" title="Call patient">
                        <Phone size={14} />
                      </a>
                    ) : null}
                    <Button size="sm" variant="secondary" disabled={pending} title="Send a reminder now" onClick={() => run(() => remindNow(a.id, a.patient.preferredChannel))}>
                      <BellRing size={14} />
                    </Button>
                    <Button size="sm" variant="secondary" disabled={pending} title="Patient confirmed by phone" onClick={() => run(() => confirmByPhone(a.id))}>
                      <Check size={14} /> Confirm
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}
      {open ? <AppointmentDrawer key={open.id + open.status + open.confirmation + open.start} appt={open} resources={resources} onClose={() => setOpenId(null)} /> : null}
    </div>
  );
}
