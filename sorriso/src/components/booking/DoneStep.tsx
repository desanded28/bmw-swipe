"use client";

import { CalendarPlus, Check, Hourglass } from "lucide-react";
import { googleCalendarUrl } from "@/lib/calendar-links";
import { fmtWhen } from "@/lib/datefmt";
import type { PublicClinic } from "@/lib/directory";
import { buttonClass, cx } from "../ui";

/** The booking API's answer (publicAppointment), as far as the flow uses it. */
export type BookedAppointment = {
  id: string;
  status: "requested" | "scheduled";
  confirmation: "pending" | "confirmed";
  start: string;
  end: string;
  manageUrl: string;
  icsUrl: string;
  practitioner: { name: string };
  location: { name: string; address: string; city: string };
  service: { name: string };
};

export function DoneStep({ appointment, clinic }: { appointment: BookedAppointment; clinic: PublicClinic }) {
  const tz = clinic.org.timezone;
  const when = fmtWhen(appointment.start, tz);
  const requested = appointment.status === "requested";
  return (
    <div className="animate-fade-up mx-auto max-w-lg py-4 text-center">
      <div
        className={cx(
          "mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full",
          requested ? "bg-amber-100 text-amber-700" : "bg-brand-100 text-brand-700",
        )}
      >
        {requested ? <Hourglass size={30} /> : <Check size={34} strokeWidth={3} />}
      </div>
      <h2 className="text-2xl font-bold">{requested ? "Request sent!" : "You're booked!"}</h2>
      <p className="mt-2 text-slate-600">
        {requested
          ? `${clinic.org.name} will confirm your request shortly. You'll get an email as soon as they do.`
          : appointment.confirmation === "confirmed"
            ? "We've sent you a confirmation and will remind you shortly before the visit."
            : "We've sent you a confirmation. We'll remind you before the visit — just reply SI or YES to confirm."}
      </p>
      <div className="mt-6 rounded-2xl bg-slate-50 p-5 text-left ring-1 ring-slate-200/70">
        <p className="font-bold">{appointment.service.name}</p>
        <p className="mt-1 text-sm text-slate-600">{when}</p>
        <p className="mt-1 text-sm text-slate-600">
          {appointment.practitioner.name} · {appointment.location.name}, {appointment.location.address},{" "}
          {appointment.location.city}
        </p>
      </div>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <a className={buttonClass("secondary")} href={appointment.icsUrl}>
          <CalendarPlus size={16} /> Apple / Outlook
        </a>
        <a
          className={buttonClass("secondary")}
          target="_blank"
          rel="noreferrer"
          href={googleCalendarUrl({
            title: `${appointment.service.name} — ${clinic.org.name}`,
            start: new Date(appointment.start),
            end: new Date(appointment.end),
            details: appointment.manageUrl,
            location: `${appointment.location.address}, ${appointment.location.city}`,
          })}
        >
          <CalendarPlus size={16} /> Google Calendar
        </a>
        <a className={buttonClass("primary")} href={appointment.manageUrl}>
          Manage appointment
        </a>
      </div>
    </div>
  );
}
