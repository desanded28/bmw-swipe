"use client";

import { CalendarPlus, CalendarX, Check, LoaderCircle, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AppointmentStatus } from "@/db/enums";
import { useLocale } from "@/i18n/provider";
import { googleCalendarUrl } from "@/lib/calendar-links";
import { fmtWhen } from "@/lib/datefmt";
import { Button, Textarea, buttonClass, cx } from "../ui";
import type { ManageSlotProps } from "./contracts";
import { ManageFormsCard } from "./ManageFormsCard";
import { ManagePrivacyCard } from "./ManagePrivacyCard";
import { SlotPicker, type PickedSlot } from "./SlotPicker";

export type ManageData = {
  token: string;
  appointmentId: string;
  status: AppointmentStatus;
  confirmation: string;
  start: string;
  end: string;
  timezone: string;
  today: string;
  clinicSlug: string;
  clinicName: string;
  clinicPhone: string | null;
  serviceId: string;
  serviceName: string;
  practitionerId: string;
  practitionerName: string;
  locationLabel: string;
  canCancel: boolean;
  canReschedule: boolean;
  lateCancellation: boolean;
  cancelUntilHours: number;
  maxAdvanceDays: number;
  icsUrl: string;
};

type Panel = "confirm" | "cancel" | "reschedule" | null;

export function ManageAppointment({ data, initialPanel }: { data: ManageData; initialPanel: Panel }) {
  const router = useRouter();
  const locale = useLocale();
  // Links in reminders carry ?do=…; only honour actions that are actually allowed.
  const allowed =
    (initialPanel === "confirm" && data.status === "scheduled" && data.confirmation !== "confirmed") ||
    (initialPanel === "cancel" && data.canCancel) ||
    (initialPanel === "reschedule" && data.canReschedule);
  const [panel, setPanel] = useState<Panel>(allowed ? initialPanel : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [slot, setSlot] = useState<PickedSlot | null>(null);

  const upcoming = data.status === "scheduled" || data.status === "requested";
  const confirmed = data.confirmation === "confirmed";

  async function act(action: "confirm" | "cancel" | "reschedule", body: object = {}, success: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/appointments/${data.token}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? "Something went wrong.");
        return;
      }
      setNotice(success);
      setPanel(null);
      setSlot(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  // Cards other packages fill in (privacy: WP4, forms: WP8); shown for past visits too.
  const slotProps: ManageSlotProps = {
    token: data.token,
    locale,
    orgSlug: data.clinicSlug,
    appointmentId: data.appointmentId,
    status: data.status,
  };
  const cards = (
    <>
      <ManagePrivacyCard {...slotProps} />
      <ManageFormsCard {...slotProps} />
    </>
  );

  if (!upcoming) return cards;

  return (
    <div className="space-y-4">
      {notice ? (
        <p className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">
          <Check size={16} /> {notice}
        </p>
      ) : null}
      {error ? <p className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">{error}</p> : null}

      {data.status === "scheduled" && !confirmed ? (
        <div className={cx("rounded-2xl p-5 ring-1", panel === "confirm" ? "bg-brand-50 ring-brand-300" : "bg-white ring-slate-200")}>
          <p className="font-bold">Will you be there?</p>
          <p className="mt-1 text-sm text-slate-600">Confirming helps {data.clinicName} plan the day — and keeps your slot.</p>
          <Button className="mt-3" size="lg" disabled={busy} autoFocus={panel === "confirm"} onClick={() => act("confirm", {}, "Thanks! Your attendance is confirmed.")}>
            {busy ? <LoaderCircle size={18} className="animate-spin" /> : <Check size={18} />} Yes, I&apos;ll be there
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {data.canReschedule ? (
          <Button variant={panel === "reschedule" ? "subtle" : "secondary"} onClick={() => setPanel(panel === "reschedule" ? null : "reschedule")}>
            <RefreshCw size={16} /> Reschedule
          </Button>
        ) : null}
        {data.canCancel ? (
          <Button variant="danger" onClick={() => setPanel(panel === "cancel" ? null : "cancel")}>
            <CalendarX size={16} /> Cancel appointment
          </Button>
        ) : null}
        <a className={buttonClass("secondary")} href={data.icsUrl}>
          <CalendarPlus size={16} /> Apple / Outlook
        </a>
        <a
          className={buttonClass("secondary")}
          target="_blank"
          rel="noreferrer"
          href={googleCalendarUrl({
            title: `${data.serviceName} — ${data.clinicName}`,
            start: new Date(data.start),
            end: new Date(data.end),
            location: data.locationLabel,
          })}
        >
          <CalendarPlus size={16} /> Google
        </a>
      </div>

      {!data.canReschedule ? (
        <p className="text-sm text-slate-500">
          Online rescheduling closes {data.cancelUntilHours}h before the visit.{" "}
          {data.clinicPhone ? (
            <>
              To move it, call <a className="font-semibold text-brand-700" href={`tel:${data.clinicPhone.replace(/\s/g, "")}`}>{data.clinicPhone}</a>.
            </>
          ) : null}
        </p>
      ) : null}

      {panel === "cancel" ? (
        <div className="animate-fade-up rounded-2xl bg-white p-5 ring-1 ring-red-200">
          <p className="font-bold">Cancel this appointment?</p>
          {data.lateCancellation ? (
            <p className="mt-1 text-sm text-amber-700">
              It&apos;s less than {data.cancelUntilHours}h to your visit. Cancelling still frees the slot for someone on the waitlist — thank you for letting us know.
            </p>
          ) : (
            <p className="mt-1 text-sm text-slate-600">Your slot will be offered to patients on the waitlist.</p>
          )}
          <Textarea className="mt-3" placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={300} />
          <div className="mt-3 flex gap-2">
            <Button variant="danger" disabled={busy} onClick={() => act("cancel", { reason }, "Your appointment has been cancelled.")}>
              {busy ? <LoaderCircle size={16} className="animate-spin" /> : null} Yes, cancel it
            </Button>
            <Button variant="ghost" onClick={() => setPanel(null)}>
              Keep it
            </Button>
          </div>
        </div>
      ) : null}

      {panel === "reschedule" ? (
        <div className="animate-fade-up rounded-2xl bg-white p-5 ring-1 ring-slate-200">
          <p className="mb-3 font-bold">Pick a new time with {data.practitionerName}</p>
          <SlotPicker
            clinicSlug={data.clinicSlug}
            serviceId={data.serviceId}
            practitionerId={data.practitionerId}
            timezone={data.timezone}
            today={data.today}
            maxAdvanceDays={data.maxAdvanceDays}
            selectedStart={slot?.start}
            onSelect={setSlot}
          />
          {slot ? (
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-brand-50 p-3">
              <p className="text-sm font-semibold text-brand-900">
                Move to{" "}
                {fmtWhen(slot.start, data.timezone)}?
              </p>
              <Button
                size="sm"
                disabled={busy}
                onClick={() =>
                  act("reschedule", { start: slot.start, practitionerId: slot.practitionerId, locationId: slot.locationId }, "Done — your appointment has been moved.")
                }
              >
                {busy ? <LoaderCircle size={15} className="animate-spin" /> : null} Confirm new time
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {cards}
    </div>
  );
}
