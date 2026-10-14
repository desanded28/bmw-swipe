"use client";

import { CalendarPlus, Check, Hourglass } from "lucide-react";
import { lhref } from "@/i18n/href";
import { fmtWhen } from "@/i18n/datefmt";
import { useLocale, useT } from "@/i18n/provider";
import { googleCalendarUrl } from "@/lib/calendar-links";
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

/** The manage page in the page's language: the API returns the short /a/<token> link used in messages. */
function localManageHref(manageUrl: string, locale: ReturnType<typeof useLocale>): string {
  try {
    const url = new URL(manageUrl, "http://x");
    return url.pathname.startsWith("/a/") ? lhref(locale, url.pathname) : manageUrl;
  } catch {
    return manageUrl;
  }
}

export function DoneStep({
  appointment,
  clinic,
  confirmWord,
  headingId,
  embedded = false,
  forOtherAdult = "no",
}: {
  appointment: BookedAppointment;
  clinic: PublicClinic;
  /** The confirm reply word in the patient's message language (CONFIRM_WORD). */
  confirmWord: string;
  /** The id of the heading, which receives focus when the step opens. */
  headingId: string;
  /** In the widget's iframe, pages of the site open in a new tab. */
  embedded?: boolean;
  /**
   * Booked for another adult (the posted relation): their messages go to their own contacts, not
   * to the booker. "marketplace": on Sorriso such a booking comes back `requested` because it is
   * held for that adult's own confirmation (48 hours, adult-confirmation.ts), not because the
   * practice approves requests.
   */
  forOtherAdult?: "no" | "practice" | "marketplace";
}) {
  const t = useT("booking");
  const ta = useT("a11y");
  const locale = useLocale();
  const tz = clinic.org.timezone;
  const when = fmtWhen(appointment.start, tz, locale);
  const requested = appointment.status === "requested";
  const held = requested && forOtherAdult === "marketplace";
  const forOther = forOtherAdult !== "no";
  const newTab = embedded ? ({ target: "_blank", rel: "noopener" } as const) : {};
  return (
    <div className="animate-fade-up mx-auto max-w-lg py-4 text-center">
      <div
        className={cx(
          "mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full",
          requested ? "bg-amber-100 text-amber-700" : "bg-brand-100 text-brand-700",
        )}
        aria-hidden
      >
        {requested ? <Hourglass size={30} /> : <Check size={34} strokeWidth={3} />}
      </div>
      <h2 id={headingId} tabIndex={-1} className="text-2xl font-bold">
        {held ? t("done.heldTitle") : requested ? t("done.requestedTitle") : t("done.bookedTitle")}
      </h2>
      <p className="mt-2 text-slate-600">
        {held
          ? t("done.heldBody")
          : requested
            ? forOther
              ? t("done.otherAdultRequestedBody", { clinic: clinic.org.name })
              : t("done.requestedBody", { clinic: clinic.org.name })
            : forOther
              ? t("done.otherAdultBody")
              : appointment.confirmation === "confirmed"
                ? t("done.confirmedBody")
                : t("done.pendingBody", { word: confirmWord })}
      </p>
      <div className="mt-6 rounded-2xl bg-slate-50 p-5 text-left ring-1 ring-slate-200/70">
        <p className="font-bold">{appointment.service.name}</p>
        <p className="mt-1 text-sm text-slate-600">{when}</p>
        <p className="mt-1 text-sm text-slate-600">
          {t("done.withAt", {
            practitioner: appointment.practitioner.name,
            office: appointment.location.name,
            address: appointment.location.address,
            city: appointment.location.city,
          })}
        </p>
      </div>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <a className={buttonClass("secondary")} href={appointment.icsUrl}>
          <CalendarPlus size={16} aria-hidden /> {t("done.appleOutlook")}
        </a>
        <a
          className={buttonClass("secondary")}
          target="_blank"
          rel="noopener noreferrer"
          href={googleCalendarUrl({
            // Discreet: the practice, not the treatment (calendars sync and show on lock screens).
            title: t("done.eventTitle", { clinic: clinic.org.name }),
            start: new Date(appointment.start),
            end: new Date(appointment.end),
            location: `${appointment.location.address}, ${appointment.location.city}`,
          })}
        >
          <CalendarPlus size={16} aria-hidden /> {t("done.google")}
          <span className="sr-only"> {ta("opensInNewTab")}</span>
        </a>
        <a className={buttonClass("primary")} href={localManageHref(appointment.manageUrl, locale)} {...newTab}>
          {t("done.manage")}
          {embedded ? <span className="sr-only"> {ta("opensInNewTab")}</span> : null}
        </a>
      </div>
    </div>
  );
}
