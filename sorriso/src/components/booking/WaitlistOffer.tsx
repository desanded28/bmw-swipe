"use client";

import { BellPlus, CheckCircle2, LoaderCircle } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { ProcessingContext } from "@/db/enums";
import type { Locale } from "@/i18n/config";
import { fmtDay } from "@/i18n/datefmt";
import { rich } from "@/i18n/rich";
import { useLocale, useT } from "@/i18n/provider";
import type { PublicClinic } from "@/lib/directory";
import { normalizePhone } from "@/lib/phone";
import { noticeVersionFor } from "@/lib/privacy/booking-rules";
import { addDays, isDateString } from "@/lib/time";
import { Button, Field, Input, Select } from "../ui";
import {
  INITIAL_PRIVACY,
  INITIAL_RELATION,
  privacyPayload,
  relationPayload,
  type BookingPrivacyState,
  type RelationState,
} from "./contracts";
import {
  DIAL_CODES,
  NoticeOutdatedReload,
  apiErrorText,
  apiFieldErrors,
  focusFirstInvalid,
  type ApiError,
  type DetailsForm,
} from "./DetailsStep";
import { PatientRelationSection } from "./PatientRelationSection";
import { PrivacySection } from "./PrivacySection";

/** The waitlist form, lifted into BookingFlow with the booking form so nothing typed is lost. */
export type WaitlistState = {
  open: boolean;
  done: boolean;
  earliestDate: string;
  /** "" = open-ended: as far ahead as the practice books online (waitlistRange). */
  latestDate: string;
  partOfDay: "any" | "morning" | "afternoon";
  /** Its own choices: a consent ticked for the booking is not reused for the waitlist. */
  privacy: BookingPrivacyState;
  relation: RelationState;
  relationAsked: boolean;
};

export function initialWaitlist(today: string): WaitlistState {
  return {
    open: false,
    done: false,
    earliestDate: today,
    latestDate: "",
    partOfDay: "any",
    privacy: INITIAL_PRIVACY,
    relation: INITIAL_RELATION,
    relationAsked: false,
  };
}

/**
 * The dates the waitlist entry covers. The API needs an end date and matches a freed time only
 * inside the range, so an empty "Until" is sent as the practice's online booking horizon counted
 * from "From" (never as "From" itself, which would wait for that single day only). The form shows
 * this end date to the patient before and after sending.
 */
export function waitlistRange(
  value: Pick<WaitlistState, "earliestDate" | "latestDate">,
  maxAdvanceDays: number,
): { earliestDate: string; latestDate: string } {
  const latest = value.latestDate || (isDateString(value.earliestDate) ? addDays(value.earliestDate, Math.max(1, maxAdvanceDays)) : "");
  return { earliestDate: value.earliestDate, latestDate: latest };
}

/** The body of POST /api/v1/clinics/:slug/waitlist (pure, unit-tested). */
export function waitlistBody(i: {
  clinic: PublicClinic;
  serviceId: string;
  practitionerId: string;
  locationId: string;
  context: ProcessingContext;
  practiceRef?: string | null;
  contact: DetailsForm;
  value: WaitlistState;
  /** The page language: the language of the privacy notice the patient read. */
  locale: Locale;
}) {
  const { contact, value } = i;
  return {
    serviceId: i.serviceId,
    practitionerId: i.practitionerId || null,
    locationId: i.locationId || null,
    ...waitlistRange(value, i.clinic.booking.maxAdvanceDays),
    partOfDay: value.partOfDay,
    patient: {
      firstName: contact.firstName,
      lastName: contact.lastName,
      phone: contact.phone.trim() || null,
      phoneCountry: contact.phoneCountry,
      email: contact.email.trim() || null,
      // The same field as the booking form's: required for a minor, optional otherwise.
      birthDate: contact.birthDate || null,
      locale: contact.locale,
    },
    privacy: privacyPayload(value.privacy, {
      clinic: i.clinic,
      context: i.context,
      preferredChannel: "sms",
      noticeVersion: noticeVersionFor(i.context),
      locale: i.locale,
    }),
    relation: value.relationAsked ? relationPayload(value.relation) : undefined,
    practiceRef: i.practiceRef ?? null,
    website: contact.website,
  };
}

/**
 * "Nothing suitable? Join the waitlist." Name and contacts are the booking form's own (typed once,
 * used by whichever form is sent), the dates and privacy choices the waitlist's.
 */
export function WaitlistOffer({
  clinic,
  serviceId,
  practitionerId,
  locationId,
  today,
  context,
  practiceRef,
  contact,
  onContactChange,
  value,
  onChange,
}: {
  clinic: PublicClinic;
  serviceId: string;
  practitionerId: string;
  locationId: string;
  today: string;
  /** Decided by the server page; only shapes the form (the API decides again from practiceRef). */
  context: ProcessingContext;
  /** The verified practice ref of the page, posted back so the API keeps the practice context. */
  practiceRef?: string | null;
  contact: DetailsForm;
  onContactChange: (patch: Partial<DetailsForm>) => void;
  value: WaitlistState;
  onChange: (patch: Partial<WaitlistState>) => void;
}) {
  const t = useT("booking");
  const te = useT("errors");
  const tc = useT("common");
  const locale = useLocale();
  const uid = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const [sending, setSending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  /** The error summary; `reload` when the privacy notice changed since the page was loaded. */
  const [alert, setAlert] = useState<{ text: string; n: number; reload?: boolean } | null>(null);
  /** What to focus after the next render: the form heading on open, the opener on close, an invalid field. */
  const [focus, setFocus] = useState<{ what: "heading" | "opener" | "invalid"; n: number } | null>(null);
  const ids = { heading: `${uid}-heading`, opener: `${uid}-opener` };

  useEffect(() => {
    if (!focus) return;
    if (focus.what === "invalid") focusFirstInvalid(formRef.current, alertRef.current);
    else document.getElementById(focus.what === "heading" ? ids.heading : ids.opener)?.focus();
  }, [focus, ids.heading, ids.opener]);

  const request = (what: "heading" | "opener" | "invalid") => setFocus((f) => ({ what, n: (f?.n ?? 0) + 1 }));
  const fail = (text: string, reload = false) => {
    setAlert((a) => ({ text, n: (a?.n ?? 0) + 1, reload }));
    request("invalid");
  };
  const range = waitlistRange(value, clinic.booking.maxAdvanceDays);
  const day = (d: string) => fmtDay(d, "medium", locale);
  const minor = value.relation.bookedFor === "minor";

  if (value.done)
    return (
      <div role="status" className="mt-5 flex gap-2 rounded-xl bg-brand-50 p-4 text-sm font-medium text-brand-800 ring-1 ring-brand-200">
        <CheckCircle2 size={18} className="shrink-0" aria-hidden />
        <p>
          {t("waitlist.done")}
          {range.latestDate ? (
            <span className="mt-1 block font-normal">{t("waitlist.doneRange", { from: day(range.earliestDate), to: day(range.latestDate) })}</span>
          ) : null}
        </p>
      </div>
    );

  if (!value.open)
    return (
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-slate-400 p-4">
        <p className="text-sm text-slate-600">
          {rich(t("waitlist.prompt"), { b: (c) => <strong className="font-semibold text-slate-800">{c}</strong> })}
        </p>
        <Button
          id={ids.opener}
          type="button"
          variant="secondary"
          size="sm"
          aria-expanded={false}
          onClick={() => {
            onChange({ open: true });
            request("heading");
          }}
        >
          <BellPlus size={15} aria-hidden /> {t("waitlist.join")}
        </Button>
      </div>
    );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (sending) return;
    const errs: Record<string, string> = {};
    if (!contact.firstName.trim()) errs.firstName = te("fields.required");
    if (!contact.lastName.trim()) errs.lastName = te("fields.required");
    if (!contact.phone.trim() && !contact.email.trim()) errs.phone = te("fields.contactRequired");
    else if (contact.phone.trim() && !normalizePhone(contact.phone, contact.phoneCountry)) errs.phone = te("fields.invalidPhone");
    if (contact.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email.trim())) errs.email = te("fields.invalidEmail");
    if (contact.birthDate && !isDateString(contact.birthDate)) errs.birthDate = te("fields.invalidDate");
    else if (minor && !contact.birthDate) errs.birthDate = te("api.birthdate_required");
    if (!isDateString(value.earliestDate)) errs.earliestDate = te("fields.invalidDate");
    if (value.latestDate && !isDateString(value.latestDate)) errs.latestDate = te("fields.invalidDate");
    else if (value.latestDate && value.latestDate < value.earliestDate) errs.latestDate = te("fields.dateOrder");
    if (context === "marketplace" && !value.privacy.platformConsent) errs.platformConsent = te("fields.consentRequired");
    setErrors(errs);
    const count = Object.keys(errs).length;
    if (count) return fail(te("checkFields", { count }));

    setAlert(null);
    setSending(true);
    try {
      const res = await fetch(`/api/v1/clinics/${clinic.org.slug}/waitlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          waitlistBody({ clinic, serviceId, practitionerId, locationId, context, practiceRef, contact, value, locale }),
        ),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { error?: ApiError } | null;
        const fields = apiFieldErrors(te, json?.error);
        const n = Object.keys(fields).length;
        setErrors(fields);
        const code = json?.error?.code;
        return fail(n ? te("checkFields", { count: n }) : apiErrorText(te, code), code === "notice_outdated");
      }
      onChange({ done: true });
    } catch {
      fail(te("network"));
    } finally {
      setSending(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="mt-5 space-y-3 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
      <h3 id={ids.heading} tabIndex={-1} className="text-sm font-semibold">
        {t("waitlist.heading")}
      </h3>
      <PatientRelationSection
        value={value.relation}
        onChange={(relation) => onChange({ relation, relationAsked: true })}
        birthDate={contact.birthDate}
        errors={errors}
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={t("waitlist.from")} error={errors.earliestDate}>
          <Input type="date" min={today} value={value.earliestDate} onChange={(e) => onChange({ earliestDate: e.target.value })} required />
        </Field>
        <Field
          label={t("waitlist.until")}
          hint={!value.latestDate && range.latestDate ? t("waitlist.untilDefault", { date: day(range.latestDate) }) : tc("words.optional")}
          error={errors.latestDate}
        >
          <Input
            type="date"
            min={value.earliestDate || today}
            value={value.latestDate}
            onChange={(e) => onChange({ latestDate: e.target.value })}
          />
        </Field>
        <Field label={t("waitlist.partOfDay")}>
          <Select value={value.partOfDay} onChange={(e) => onChange({ partOfDay: e.target.value as WaitlistState["partOfDay"] })}>
            <option value="any">{t("waitlist.any")}</option>
            <option value="morning">{t("waitlist.mornings")}</option>
            <option value="afternoon">{t("waitlist.afternoons")}</option>
          </Select>
        </Field>
        <Field label={t("details.firstName")} error={errors.firstName}>
          <Input value={contact.firstName} onChange={(e) => onContactChange({ firstName: e.target.value })} autoComplete="given-name" required />
        </Field>
        <Field label={t("details.lastName")} error={errors.lastName}>
          <Input value={contact.lastName} onChange={(e) => onContactChange({ lastName: e.target.value })} autoComplete="family-name" required />
        </Field>
        <Field label={t("details.mobile")} error={errors.phone ?? errors.phoneCountry}>
          {(control) => (
            <span className="flex gap-2">
              <Select
                aria-label={t("details.countryCode")}
                value={contact.phoneCountry}
                onChange={(e) => onContactChange({ phoneCountry: e.target.value })}
                className="w-24 shrink-0"
              >
                {DIAL_CODES.map((code) => (
                  <option key={code} value={code}>
                    {t("details.dialOption", { code })}
                  </option>
                ))}
              </Select>
              <Input
                {...control}
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                value={contact.phone}
                onChange={(e) => onContactChange({ phone: e.target.value })}
              />
            </span>
          )}
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("details.email")} hint={tc("words.optional")} error={errors.email}>
          <Input type="email" autoComplete="email" value={contact.email} onChange={(e) => onContactChange({ email: e.target.value })} />
        </Field>
        {/* Shared with the booking form; a minor's birth date is required (the API answers birthdate_required). */}
        <Field label={t("details.birthDate")} hint={minor ? undefined : tc("words.optional")} error={errors.birthDate}>
          <Input
            type="date"
            autoComplete="bday"
            max={today}
            value={contact.birthDate}
            onChange={(e) => onContactChange({ birthDate: e.target.value })}
            aria-required={minor || undefined}
          />
        </Field>
      </div>
      <PrivacySection
        clinic={clinic}
        context={context}
        variant="waitlist"
        preferredChannel="sms"
        relation={value.relation}
        value={value.privacy}
        onChange={(privacy) => onChange({ privacy })}
        errors={errors}
      />
      {alert ? (
        <div key={alert.n} ref={alertRef} role="alert" tabIndex={-1} className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700">
          {alert.text}
          {alert.reload ? <NoticeOutdatedReload /> : null}
        </div>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" size="sm" aria-disabled={sending} className="aria-disabled:opacity-60">
          {sending ? <LoaderCircle size={15} className="animate-spin" aria-hidden /> : null} {t("waitlist.submit")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            onChange({ open: false });
            request("opener");
          }}
        >
          {tc("actions.cancel")}
        </Button>
      </div>
    </form>
  );
}
