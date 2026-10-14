"use client";

import { CalendarPlus, CalendarX, Check, LoaderCircle, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import type { AppointmentStatus } from "@/db/enums";
import { fmtWhen } from "@/i18n/datefmt";
import { rich } from "@/i18n/rich";
import { useLocale, useT } from "@/i18n/provider";
import type { Translator } from "@/i18n/types";
import { googleCalendarUrl } from "@/lib/calendar-links";
import { Button, Field, Textarea, buttonClass, cx } from "../ui";
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

/** The errors.api.* text for an API error code, or the generic text. */
function apiErrorText(te: Translator<"errors">, code: string | undefined): string {
  const key = `api.${code ?? ""}` as const;
  return te.has(key) ? te(key) : te("generic");
}

/**
 * What the patient can do with an upcoming appointment: confirm, reschedule, cancel, add it to a
 * calendar. Results are announced (role=status / role=alert) and focus follows: into a panel when it
 * opens, onto the result message when an action succeeds (the button that was pressed is gone).
 */
export function ManageAppointment({ data, initialPanel }: { data: ManageData; initialPanel: Panel }) {
  const t = useT("manage");
  const tb = useT("booking");
  const te = useT("errors");
  const ta = useT("a11y");
  const router = useRouter();
  const locale = useLocale();
  const uid = useId();
  // Links in reminders carry ?do=…; only honour actions that are actually allowed.
  const allowed =
    (initialPanel === "confirm" && data.status === "scheduled" && data.confirmation !== "confirmed") ||
    (initialPanel === "cancel" && data.canCancel) ||
    (initialPanel === "reschedule" && data.canReschedule);
  const [panel, setPanel] = useState<Panel>(allowed ? initialPanel : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; n: number } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [slot, setSlot] = useState<PickedSlot | null>(null);
  /** What to focus after the next render. */
  const [focus, setFocus] = useState<{ id: string; n: number } | null>(null);
  const ids = { cancel: `${uid}-cancel`, reschedule: `${uid}-reschedule`, notice: `${uid}-notice` };

  useEffect(() => {
    if (focus) document.getElementById(focus.id)?.focus();
  }, [focus]);
  const focusOn = (id: string) => setFocus((f) => ({ id, n: (f?.n ?? 0) + 1 }));

  const upcoming = data.status === "scheduled" || data.status === "requested";
  const confirmed = data.confirmation === "confirmed";

  async function act(action: "confirm" | "cancel" | "reschedule", body: object, success: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/appointments/${data.token}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => null)) as { error?: { code?: string } } | null;
      if (!res.ok) {
        setError((e) => ({ text: apiErrorText(te, json?.error?.code), n: (e?.n ?? 0) + 1 }));
        return;
      }
      setNotice(success);
      setPanel(null);
      setSlot(null);
      focusOn(ids.notice);
      router.refresh();
    } catch {
      setError((e) => ({ text: te("network"), n: (e?.n ?? 0) + 1 }));
    } finally {
      setBusy(false);
    }
  }

  const toggle = (p: Exclude<Panel, null | "confirm">) => {
    const next = panel === p ? null : p;
    setPanel(next);
    if (next) focusOn(`${ids[p]}-title`);
  };

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

  const messages = (
    <>
      {notice ? (
        <p
          id={ids.notice}
          role="status"
          tabIndex={-1}
          className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800 outline-none"
        >
          <Check size={16} aria-hidden /> {notice}
        </p>
      ) : null}
      {error ? (
        <p key={error.n} role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700 ring-1 ring-red-200">
          {error.text}
        </p>
      ) : null}
    </>
  );

  if (!upcoming)
    return (
      <div className="space-y-4">
        {messages}
        {cards}
      </div>
    );

  const tel = (c: React.ReactNode) =>
    data.clinicPhone ? (
      <a className="font-semibold text-brand-700 underline underline-offset-2" href={`tel:${data.clinicPhone.replace(/[^\d+]/g, "")}`}>
        {c}
      </a>
    ) : (
      c
    );

  return (
    <div className="space-y-4">
      {messages}

      {data.status === "scheduled" && !confirmed ? (
        <section
          aria-labelledby={`${uid}-confirm-title`}
          className={cx("rounded-2xl p-5 ring-1", panel === "confirm" ? "bg-brand-50 ring-brand-300" : "bg-white ring-slate-200")}
        >
          <h2 id={`${uid}-confirm-title`} className="font-bold">
            {t("confirm.title")}
          </h2>
          <p className="mt-1 text-sm text-slate-600">{t("confirm.body", { clinic: data.clinicName })}</p>
          <Button
            className="mt-3 aria-disabled:opacity-60"
            size="lg"
            aria-disabled={busy}
            onClick={() => act("confirm", {}, t("confirm.done"))}
          >
            {busy ? <LoaderCircle size={18} className="animate-spin" aria-hidden /> : <Check size={18} aria-hidden />} {t("confirm.button")}
          </Button>
        </section>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {data.canReschedule ? (
          <Button
            variant={panel === "reschedule" ? "subtle" : "secondary"}
            aria-expanded={panel === "reschedule"}
            aria-controls={ids.reschedule}
            onClick={() => toggle("reschedule")}
          >
            <RefreshCw size={16} aria-hidden /> {t("reschedule.button")}
          </Button>
        ) : null}
        {data.canCancel ? (
          <Button
            id={`${uid}-cancel-toggle`}
            variant="danger"
            aria-expanded={panel === "cancel"}
            aria-controls={ids.cancel}
            onClick={() => toggle("cancel")}
          >
            <CalendarX size={16} aria-hidden /> {t("cancel.button")}
          </Button>
        ) : null}
        <a className={buttonClass("secondary")} href={data.icsUrl}>
          <CalendarPlus size={16} aria-hidden /> {t("calendar.appleOutlook")}
        </a>
        <a
          className={buttonClass("secondary")}
          target="_blank"
          rel="noopener noreferrer"
          href={googleCalendarUrl({
            // Discreet: the practice, not the treatment; never the manage link.
            title: tb("done.eventTitle", { clinic: data.clinicName }),
            start: new Date(data.start),
            end: new Date(data.end),
            location: data.locationLabel,
          })}
        >
          <CalendarPlus size={16} aria-hidden /> {t("calendar.google")}
          <span className="sr-only"> {ta("opensInNewTab")}</span>
        </a>
      </div>

      {!data.canReschedule ? (
        <p className="text-sm text-slate-600">
          {t("reschedule.closed", { count: data.cancelUntilHours })}{" "}
          {data.clinicPhone ? rich(t, "reschedule.call", { tel }, { phone: data.clinicPhone }) : null}
        </p>
      ) : null}

      {panel === "cancel" ? (
        <section id={ids.cancel} aria-labelledby={`${ids.cancel}-title`} className="animate-fade-up rounded-2xl bg-white p-5 ring-1 ring-red-200">
          <h2 id={`${ids.cancel}-title`} tabIndex={-1} className="font-bold">
            {t("cancel.title")}
          </h2>
          {data.lateCancellation ? (
            <p className="mt-1 text-sm text-amber-800">{t("cancel.late", { count: data.cancelUntilHours })}</p>
          ) : (
            <p className="mt-1 text-sm text-slate-600">{t("cancel.body")}</p>
          )}
          <Field label={t("cancel.reason")} hint={t("cancel.reasonHint")} className="mt-3">
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={300} />
          </Field>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="danger"
              aria-disabled={busy}
              className="aria-disabled:opacity-60"
              onClick={() => act("cancel", { reason: reason.trim() || undefined }, t("cancel.done"))}
            >
              {busy ? <LoaderCircle size={16} className="animate-spin" aria-hidden /> : null} {t("cancel.confirm")}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setPanel(null);
                focusOn(`${uid}-cancel-toggle`);
              }}
            >
              {t("cancel.keep")}
            </Button>
          </div>
        </section>
      ) : null}

      {panel === "reschedule" ? (
        <section
          id={ids.reschedule}
          aria-labelledby={`${ids.reschedule}-title`}
          className="animate-fade-up rounded-2xl bg-white p-5 ring-1 ring-slate-200"
        >
          <h2 id={`${ids.reschedule}-title`} tabIndex={-1} className="mb-3 font-bold">
            {t("reschedule.title", { practitioner: data.practitionerName })}
          </h2>
          <SlotPicker
            clinicSlug={data.clinicSlug}
            serviceId={data.serviceId}
            practitionerId={data.practitionerId}
            timezone={data.timezone}
            today={data.today}
            maxAdvanceDays={data.maxAdvanceDays}
            practitionerNames={{ [data.practitionerId]: data.practitionerName }}
            selectedStart={slot?.start}
            onSelect={(s) => {
              setSlot(s);
              focusOn(`${ids.reschedule}-move`);
            }}
          />
          {slot ? (
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-brand-50 p-3">
              <p id={`${ids.reschedule}-move`} tabIndex={-1} className="text-sm font-semibold text-brand-900 outline-none">
                {t("reschedule.moveTo", { when: fmtWhen(slot.start, data.timezone, locale) })}
              </p>
              <Button
                size="sm"
                aria-disabled={busy}
                className="aria-disabled:opacity-60"
                onClick={() =>
                  act(
                    "reschedule",
                    { start: slot.start, practitionerId: slot.practitionerId, locationId: slot.locationId },
                    t("reschedule.done"),
                  )
                }
              >
                {busy ? <LoaderCircle size={15} className="animate-spin" aria-hidden /> : null} {t("reschedule.confirm")}
              </Button>
            </div>
          ) : null}
        </section>
      ) : null}

      {cards}
    </div>
  );
}
