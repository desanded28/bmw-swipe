"use client";

import { BellRing, Check, Lock, NotebookPen, Phone, UserX } from "lucide-react";
import { useState } from "react";
import { approve, confirmByPhone, getAppointmentPhone, remindNow } from "@/app/dashboard/actions/appointments";
import { capitalizeFirst, fmtDay } from "@/i18n/datefmt";
import { useLocale, useT } from "@/i18n/provider";
import { Badge, Button, EmptyState, cx } from "../ui";
import { useNow } from "../useNow";
import { AppointmentDrawer, StatusBadge, localDate, localTime } from "./AppointmentDrawer";
import { Pii } from "./PrivacyScreen";
import { CalendarEventBadges } from "./slots/CalendarEventBadges";
import { useToast } from "./Toast";
import { toCareAppointment, type ApptListDTO, type Resources } from "./types";
import { useRunAction } from "./useRunAction";

/**
 * A list of appointments (overview, confirmations, the calendar's list view, a patient's record).
 * Rows carry no contact details: "Call" fetches only the number (getAppointmentPhone, which checks
 * patient.contact.read and is audited). A restricted patient's row offers no call, reminder or
 * confirmation: the drawer asks for a reason first. Each row opens the appointment drawer.
 */
export function AppointmentList({
  appointments,
  resources,
  showDate = true,
  quickActions = true,
  empty,
  showLastMessage,
}: {
  appointments: ApptListDTO[];
  resources: Resources;
  showDate?: boolean;
  /** Approve / remind / confirm buttons on the rows (the server checks appointment.write anyway). */
  quickActions?: boolean;
  empty?: string;
  /** The patient's last unparsed reply per appointment id (needs messages.read; the page audits it). */
  showLastMessage?: Record<string, string>;
}) {
  const t = useT("calendar");
  const tc = useT("common");
  const locale = useLocale();
  const toast = useToast();
  const [openId, setOpenId] = useState<string | null>(null);
  const { run, pending } = useRunAction();
  const now = useNow();
  const open = appointments.find((a) => a.id === openId);
  if (!appointments.length) return <EmptyState title={empty ?? t("list.empty")} />;

  async function call(id: string) {
    const res = await getAppointmentPhone(id);
    if (!res.ok) return toast.show({ tone: "error", text: res.error });
    if (!res.phone) return toast.show({ tone: "error", text: t("list.noPhone") });
    window.location.href = `tel:${res.phone}`;
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-slate-200/70">
      <ul>
        {appointments.map((a, i) => {
          const tz = a.location.timezone;
          const date = localDate(a.start, tz);
          const prev = appointments[i - 1];
          const header = showDate && (!prev || localDate(prev.start, prev.location.timezone) !== date);
          const upcoming = now !== null && Date.parse(a.start) > now;
          const time = localTime(a.start, tz);
          return (
            <li key={a.id}>
              {header ? (
                <p className="border-y border-slate-100 bg-slate-50 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-slate-600 first:border-t-0">
                  {capitalizeFirst(fmtDay(date, "medium", locale), locale)}
                </p>
              ) : null}
              <div
                className={cx(
                  "group/pii grid cursor-pointer items-center gap-3 border-b border-slate-100 px-4 py-3 hover:bg-slate-50 sm:grid-cols-[64px_1.4fr_1.2fr_1fr_auto]",
                  a.status === "cancelled" && "opacity-70",
                )}
                onClick={() => setOpenId(a.id)}
              >
                <div className="text-sm font-bold tabular-nums">{time}</div>
                <div className="min-w-0">
                  <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 font-semibold">
                    <button
                      type="button"
                      data-appt-id={a.id}
                      className="min-w-0 truncate text-left hover:underline"
                      aria-label={t("list.open", { time, patient: a.patient.name })}
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenId(a.id);
                      }}
                    >
                      <Pii>{a.patient.name}</Pii>
                    </button>
                    {a.patient.noShowCount ? (
                      <Badge tone="red" title={t("drawer.noShows", { count: a.patient.noShowCount })}>
                        <UserX size={11} aria-hidden /> {a.patient.noShowCount}
                        <span className="sr-only">{t("drawer.noShows", { count: a.patient.noShowCount })}</span>
                      </Badge>
                    ) : null}
                    {a.isNewPatient ? <Badge tone="violet">{t("drawer.newPatient")}</Badge> : null}
                    {a.hasNotes ? (
                      <span title={t("list.hasNotes")} className="text-slate-500">
                        <NotebookPen size={13} aria-hidden />
                        <span className="sr-only">{t("list.hasNotes")}</span>
                      </span>
                    ) : null}
                    {/* A masked row's placeholder name already says it is restricted. */}
                    {a.restricted && !a.patient.masked ? (
                      <Badge tone="amber" title={t("list.restrictedHint")}>
                        <Lock size={11} aria-hidden /> {t("list.restricted")}
                      </Badge>
                    ) : null}
                    <CalendarEventBadges appt={toCareAppointment(a)} />
                  </p>
                  <p className="truncate text-xs text-slate-600">{t("list.prefers", { channel: tc(`channels.${a.patient.preferredChannel}`) })}</p>
                  {a.restricted && showLastMessage ? (
                    <p className="mt-1 text-xs text-slate-600">{t("list.restrictedHint")}</p>
                  ) : showLastMessage?.[a.id] ? (
                    <p className="mt-1 truncate rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-950">
                      {t("list.lastReply", { text: showLastMessage[a.id] })}
                    </p>
                  ) : null}
                </div>
                <div className="min-w-0 text-sm">
                  <p className="truncate font-medium">{a.service.name}</p>
                  <p className="flex items-center gap-1.5 truncate text-xs text-slate-600">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: a.practitioner.color }} aria-hidden />
                    {a.practitioner.name}
                    {" · "}
                    {a.location.name}
                  </p>
                </div>
                <div>
                  <StatusBadge a={a} />
                </div>
                <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                  {quickActions && a.status === "requested" && !a.awaitingAdultConfirmation ? (
                    <Button size="sm" disabled={pending} onClick={() => run(() => approve(a.id))}>
                      <Check size={14} aria-hidden /> {t("list.approve")}
                    </Button>
                  ) : null}
                  {quickActions && a.awaitingAdultConfirmation ? (
                    <span className="text-xs text-slate-600">{t("drawer.awaitingAdult")}</span>
                  ) : null}
                  {quickActions && a.status === "scheduled" && a.confirmation === "pending" && upcoming && !a.restricted ? (
                    <>
                      <Button size="sm" variant="secondary" aria-label={t("list.call")} title={t("list.call")} onClick={() => call(a.id)}>
                        <Phone size={14} aria-hidden />
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={pending}
                        aria-label={t("list.remind")}
                        title={t("list.remind")}
                        onClick={() => run(() => remindNow(a.id, a.patient.preferredChannel))}
                      >
                        <BellRing size={14} aria-hidden />
                      </Button>
                      <Button size="sm" variant="secondary" disabled={pending} title={t("list.confirmTitle")} onClick={() => run(() => confirmByPhone(a.id))}>
                        <Check size={14} aria-hidden /> {t("list.confirm")}
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {open ? <AppointmentDrawer key={open.id} appt={open} resources={resources} onClose={() => setOpenId(null)} /> : null}
    </div>
  );
}
