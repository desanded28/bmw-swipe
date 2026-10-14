"use client";

import { ArrowLeft, BellRing, CalendarCheck, LoaderCircle, Mail, MessageCircle, RotateCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Channel, ProcessingContext } from "@/db/enums";
import { DIAL_CODE, ENDONYM, LOCALES, type Locale } from "@/i18n/config";
import { useLocale, useT } from "@/i18n/provider";
import type { Translator } from "@/i18n/types";
import type { PublicClinic } from "@/lib/directory";
import { formatPhone, normalizePhone } from "@/lib/phone";
import { noticeVersionFor } from "@/lib/privacy/booking-rules";
import { Button, Field, Input, Select, Textarea, cx } from "../ui";
import { BookingExtrasSection } from "./BookingExtrasSection";
import {
  INITIAL_EXTRAS,
  INITIAL_PRIVACY,
  INITIAL_RELATION,
  PRACTICE_DIAL_CODE,
  privacyPayload,
  relationPayload,
  type BookingPrivacyState,
  type ExtrasState,
  type RelationState,
} from "./contracts";
import type { BookedAppointment } from "./DoneStep";
import { PatientRelationSection } from "./PatientRelationSection";
import { PrivacySection } from "./PrivacySection";
import type { PickedSlot } from "./SlotPicker";

/**
 * The word that confirms an appointment by SMS or WhatsApp reply, per message language. The
 * messaging engine (WP3) accepts each of these; the form names the one of the language the
 * patient chose for their messages, not the page's.
 */
export const CONFIRM_WORD: Record<Locale, string> = {
  it: "SI",
  en: "YES",
  de: "JA",
  fr: "OUI",
  es: "SI",
  pt: "SIM",
  ro: "DA",
  pl: "TAK",
};

/**
 * Country codes offered next to the phone number: the practices' country first, then those of the
 * site's languages, then other communities common among patients in Italy.
 */
export const DIAL_CODES = [
  ...new Set([PRACTICE_DIAL_CODE, ...LOCALES.map((l) => DIAL_CODE[l]), "41", "43", "355", "380", "212", "86", "1"]),
];

/** A national number shape per country code, shown as the placeholder (digits only, nothing to translate). */
const PHONE_EXAMPLE: Record<string, string> = {
  "39": "333 123 4567",
  "44": "7700 900123",
  "49": "151 23456789",
  "33": "6 12 34 56 78",
  "34": "612 34 56 78",
  "351": "912 345 678",
  "40": "722 123 456",
  "48": "512 345 678",
};

/** The patient's own details. Lifted into BookingFlow, so they survive going back and a taken slot (WCAG 3.3.7). */
export type DetailsForm = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  /** Dial code for a number typed without "+" (posted as patient.phoneCountry). */
  phoneCountry: string;
  birthDate: string;
  note: string;
  isNewPatient: "yes" | "no";
  preferredChannel: Channel;
  /** The language of the patient's messages; starts as the page language. */
  locale: Locale;
  /** Honeypot: never shown to people. */
  website: string;
};

/** Everything the booking form holds; in memory only, never in web storage. */
export type BookingFormState = {
  details: DetailsForm;
  privacy: BookingPrivacyState;
  relation: RelationState;
  /** `relation` is posted only once PatientRelationSection reported a choice (PatientRelationSectionProps). */
  relationAsked: boolean;
  extras: ExtrasState;
};

export function initialBookingForm(locale: Locale): BookingFormState {
  return {
    details: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      phoneCountry: PRACTICE_DIAL_CODE,
      birthDate: "",
      note: "",
      isNewPatient: "yes",
      preferredChannel: "sms",
      locale,
      website: "",
    },
    privacy: INITIAL_PRIVACY,
    relation: INITIAL_RELATION,
    relationAsked: false,
    extras: INITIAL_EXTRAS,
  };
}

export const NOTE_MAX = 500;

/** API codes meaning the chosen time is gone: back to the times, details kept. */
export const SLOT_GONE_CODES = new Set(["practitioner_busy", "no_room", "too_soon", "time_off", "outside_hours", "in_past", "too_far"]);

export type ApiError = { code?: string; message?: string; field?: string; issues?: { path: string; message: string }[] };

/** The localised text for an API error code (errors.api.*), or the generic one. */
export function apiErrorText(te: Translator<"errors">, code: string | undefined): string {
  const key = `api.${code ?? ""}` as const;
  return te.has(key) ? te(key) : te("generic");
}

/**
 * API errors as form errors keyed by field ("firstName", "guardian.name"…), in the page language: a
 * rule's code gives its own text, a validation issue the text for that kind of field. The API's
 * English messages are never shown.
 */
export function apiFieldErrors(te: Translator<"errors">, error: ApiError | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  const byField = (path: string) => {
    const field = path.replace(/^(patient|privacy|relation)\./, "");
    if (field === "firstName" || field === "lastName") return te("fields.required");
    if (field === "email" || field.endsWith(".email")) return te("fields.invalidEmail");
    if (field === "phone" || field.endsWith(".phone")) return te("fields.invalidPhone");
    if (field === "phoneCountry") return te("fields.invalidCountryCode");
    if (field === "birthDate" || field === "earliestDate" || field === "latestDate") return te("fields.invalidDate");
    if (field === "note") return te("fields.tooLong");
    return te("fields.invalid");
  };
  for (const issue of error?.issues ?? []) out[issue.path.replace(/^(patient|privacy|relation)\./, "")] = byField(issue.path);
  if (error?.field && error.code) out[error.field.replace(/^(patient|relation)\./, "")] = apiErrorText(te, error.code);
  return out;
}

/**
 * Shown in the error summary after notice_outdated: the privacy notice changed since this page was
 * loaded, and only a reload shows (and posts) the current version. What was typed is lost, so the
 * patient chooses when to reload.
 */
export function NoticeOutdatedReload() {
  const te = useT("errors");
  return (
    <button
      type="button"
      onClick={() => window.location.reload()}
      className="mt-2 flex min-h-10 w-fit items-center gap-1.5 rounded-lg bg-white px-3 text-sm font-semibold text-red-800 ring-1 ring-red-300 hover:bg-red-100"
    >
      <RotateCw size={15} aria-hidden /> {te("reload")}
    </button>
  );
}

/** Move focus to the first field marked invalid in `root`, else to `fallback` (the error summary). */
export function focusFirstInvalid(root: HTMLElement | null, fallback: HTMLElement | null) {
  const invalid = root?.querySelector<HTMLElement>('[aria-invalid="true"]');
  (invalid ?? fallback)?.focus();
}

export function DetailsStep({
  clinic,
  service,
  slot,
  waitlistEntryId,
  source,
  context,
  practiceRef,
  headingId,
  form,
  onFormChange,
  onDetailsChange,
  onBack,
  onBooked,
  onSlotTaken,
}: {
  clinic: PublicClinic;
  service: PublicClinic["services"][number];
  slot: PickedSlot;
  waitlistEntryId?: string;
  source: "online" | "widget";
  /** Decided by the server page; only shapes the form (the API decides again from practiceRef). */
  context: ProcessingContext;
  /** The verified practice ref of the page, posted back so the API keeps the practice context. */
  practiceRef?: string | null;
  /** The id of this step's heading, which receives focus when the step opens. */
  headingId: string;
  form: BookingFormState;
  onFormChange: (patch: Partial<BookingFormState>) => void;
  /** Merges into the current details (not this render's copy): autofill changes several fields at once. */
  onDetailsChange: (patch: Partial<DetailsForm>) => void;
  onBack: () => void;
  onBooked: (a: BookedAppointment) => void;
  onSlotTaken: () => void;
}) {
  const t = useT("booking");
  const te = useT("errors");
  const tc = useT("common");
  const pageLocale = useLocale();
  const formRef = useRef<HTMLFormElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  /**
   * The error summary and how many times it was shown (a new key re-announces the same text);
   * `reload` when the privacy notice changed since the page was loaded.
   */
  const [alert, setAlert] = useState<{ text: string; n: number; reload?: boolean } | null>(null);
  /** Bumped after a failed submit: focus moves to the first invalid field once it is rendered. */
  const [focusRequest, setFocusRequest] = useState(0);
  const d = form.details;
  const set = <K extends keyof DetailsForm>(key: K, value: DetailsForm[K]) => onDetailsChange({ [key]: value });

  useEffect(() => {
    if (focusRequest) focusFirstInvalid(formRef.current, alertRef.current);
  }, [focusRequest]);

  const fail = (text: string, reload = false) => {
    setAlert((a) => ({ text, n: (a?.n ?? 0) + 1, reload }));
    setFocusRequest((n) => n + 1);
  };

  const channels = (
    [
      ["sms", <MessageCircle key="i" size={16} aria-hidden />],
      ["whatsapp", <MessageCircle key="i" size={16} aria-hidden />],
      ["email", <Mail key="i" size={16} aria-hidden />],
    ] as const
  ).filter(([value]) => value !== "whatsapp" || clinic.privacy.whatsappEnabled);
  // A WhatsApp choice can't outlive the practice turning WhatsApp off.
  const channel: Channel = d.preferredChannel === "whatsapp" && !clinic.privacy.whatsappEnabled ? "sms" : d.preferredChannel;

  const normalized = d.phone.trim() ? normalizePhone(d.phone, d.phoneCountry) : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    const errs: Record<string, string> = {};
    if (!d.firstName.trim()) errs.firstName = te("fields.required");
    if (!d.lastName.trim()) errs.lastName = te("fields.required");
    if (!d.email.trim() && !d.phone.trim()) errs.phone = te("fields.contactRequired");
    else if (channel !== "email" && !d.phone.trim()) errs.phone = te("fields.phoneForText");
    else if (d.phone.trim() && !normalized) errs.phone = te("fields.invalidPhone");
    if (channel === "email" && !d.email.trim()) errs.email = te("fields.emailForEmail");
    else if (d.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim())) errs.email = te("fields.invalidEmail");
    if (d.birthDate && !/^\d{4}-\d{2}-\d{2}$/.test(d.birthDate)) errs.birthDate = te("fields.invalidDate");
    if (context === "marketplace" && !form.privacy.platformConsent) errs.platformConsent = te("fields.consentRequired");
    if (channel === "whatsapp" && !form.privacy.whatsapp) errs.whatsapp = te("fields.whatsappRequired");
    setErrors(errs);
    const count = Object.keys(errs).length;
    if (count) return fail(te("checkFields", { count }));

    setAlert(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/clinics/${clinic.org.slug}/appointments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: service.id,
          practitionerId: slot.practitionerId,
          locationId: slot.locationId,
          start: slot.start,
          note: d.note.trim() || null,
          isNewPatient: d.isNewPatient === "yes",
          waitlistEntryId: waitlistEntryId ?? null,
          source,
          website: d.website,
          patient: {
            firstName: d.firstName,
            lastName: d.lastName,
            email: d.email.trim() || null,
            phone: d.phone.trim() || null,
            phoneCountry: d.phoneCountry,
            birthDate: d.birthDate || null,
            locale: d.locale,
            preferredChannel: channel,
          },
          privacy: privacyPayload(form.privacy, {
            clinic,
            context,
            preferredChannel: channel,
            noticeVersion: noticeVersionFor(context),
            locale: pageLocale,
          }),
          relation: form.relationAsked ? relationPayload(form.relation) : undefined,
          fundId: form.extras.fundId,
          practiceRef: practiceRef ?? null,
        }),
      });
      const json = (await res.json().catch(() => null)) as { error?: ApiError; appointment?: BookedAppointment } | null;
      if (!res.ok || !json?.appointment) {
        const code = json?.error?.code;
        if (code && SLOT_GONE_CODES.has(code)) return onSlotTaken();
        const fields = apiFieldErrors(te, json?.error);
        const n = Object.keys(fields).length;
        setErrors(fields);
        return fail(n ? te("checkFields", { count: n }) : apiErrorText(te, code), code === "notice_outdated");
      }
      onBooked(json.appointment);
    } catch {
      fail(te("network"));
    } finally {
      setSubmitting(false);
    }
  }

  const ids = { channel: `${headingId}-channel`, channelError: `${headingId}-channel-error` };

  return (
    <form ref={formRef} onSubmit={submit} className="animate-fade-up space-y-5" noValidate>
      <button
        type="button"
        onClick={onBack}
        className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft size={15} aria-hidden /> {t("details.changeTime")}
      </button>
      <h2 id={headingId} tabIndex={-1} className="text-lg font-bold">
        {t("details.heading")}
      </h2>

      <PatientRelationSection
        value={form.relation}
        onChange={(relation) => onFormChange({ relation, relationAsked: true })}
        birthDate={d.birthDate}
        errors={errors}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("details.firstName")} error={errors.firstName}>
          <Input value={d.firstName} onChange={(e) => set("firstName", e.target.value)} autoComplete="given-name" required />
        </Field>
        <Field label={t("details.lastName")} error={errors.lastName}>
          <Input value={d.lastName} onChange={(e) => set("lastName", e.target.value)} autoComplete="family-name" required />
        </Field>
        <Field
          label={t("details.mobile")}
          error={errors.phone ?? errors.phoneCountry}
          hint={
            <>
              {t("details.phoneHint", { word: CONFIRM_WORD[d.locale] })}
              {normalized ? <span className="block font-medium text-slate-700">{t("details.phonePreview", { number: formatPhone(normalized) })}</span> : null}
            </>
          }
        >
          {(control) => (
            <span className="flex gap-2">
              <Select
                aria-label={t("details.countryCode")}
                value={d.phoneCountry}
                onChange={(e) => set("phoneCountry", e.target.value)}
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
                value={d.phone}
                onChange={(e) => set("phone", e.target.value)}
                type="tel"
                inputMode="tel"
                placeholder={PHONE_EXAMPLE[d.phoneCountry]}
                autoComplete="tel-national"
              />
            </span>
          )}
        </Field>
        <Field label={t("details.email")} error={errors.email}>
          <Input value={d.email} onChange={(e) => set("email", e.target.value)} type="email" autoComplete="email" />
        </Field>
        <Field label={t("details.birthDate")} hint={tc("words.optional")} error={errors.birthDate}>
          <Input value={d.birthDate} onChange={(e) => set("birthDate", e.target.value)} type="date" autoComplete="bday" />
        </Field>
        <Field label={t("details.newPatient")}>
          <Select value={d.isNewPatient} onChange={(e) => set("isNewPatient", e.target.value as "yes" | "no")}>
            <option value="yes">{t("details.newPatientYes")}</option>
            <option value="no">{t("details.newPatientNo")}</option>
          </Select>
        </Field>
      </div>

      <fieldset aria-describedby={errors.preferredChannel ? ids.channelError : undefined}>
        <legend className="mb-2 text-[13px] font-semibold text-slate-700">{t("details.channel")}</legend>
        <div className={cx("grid gap-2", channels.length === 3 ? "grid-cols-3" : "grid-cols-2")}>
          {channels.map(([value, icon]) => (
            <label
              key={value}
              className={cx(
                "flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold ring-1 transition",
                "has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-brand-600",
                channel === value ? "bg-brand-50 text-brand-800 ring-2 ring-brand-600" : "bg-white text-slate-700 ring-line-strong hover:bg-slate-50",
              )}
            >
              <input
                type="radio"
                name={ids.channel}
                value={value}
                checked={channel === value}
                onChange={() => set("preferredChannel", value)}
                className="sr-only"
              />
              {icon}
              {tc(`channels.${value}`)}
            </label>
          ))}
        </div>
        {errors.preferredChannel ? (
          <p id={ids.channelError} className="mt-1 text-xs font-medium text-red-600">
            {errors.preferredChannel}
          </p>
        ) : null}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
        <Field label={t("details.note")} hint={t("details.noteHint")} error={errors.note}>
          <Textarea value={d.note} onChange={(e) => set("note", e.target.value)} rows={3} maxLength={NOTE_MAX} />
        </Field>
        <Field label={t("details.language")} hint={t("details.languageHint")}>
          <Select value={d.locale} onChange={(e) => set("locale", e.target.value as Locale)}>
            {LOCALES.map((l) => (
              <option key={l} value={l} lang={l}>
                {ENDONYM[l]}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <BookingExtrasSection clinic={clinic} serviceId={service.id} value={form.extras} onChange={(extras) => onFormChange({ extras })} />

      {/* Honeypot: hidden from people and assistive technology, filled in only by bots. */}
      <input
        type="text"
        tabIndex={-1}
        autoComplete="off"
        value={d.website}
        onChange={(e) => set("website", e.target.value)}
        className="hidden"
        aria-hidden
      />

      <PrivacySection
        clinic={clinic}
        context={context}
        variant="booking"
        preferredChannel={channel}
        relation={form.relation}
        value={form.privacy}
        onChange={(privacy) => onFormChange({ privacy })}
        errors={errors}
      />

      {alert ? (
        <div
          key={alert.n}
          ref={alertRef}
          role="alert"
          tabIndex={-1}
          className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700 ring-1 ring-red-200"
        >
          {alert.text}
          {alert.reload ? <NoticeOutdatedReload /> : null}
        </div>
      ) : null}

      {/* aria-disabled, not disabled: the focused button must keep focus while the request runs. */}
      <Button type="submit" size="lg" className="w-full aria-disabled:opacity-60 sm:w-auto" aria-disabled={submitting}>
        {submitting ? <LoaderCircle size={18} className="animate-spin" aria-hidden /> : <CalendarCheck size={18} aria-hidden />}
        {submitting ? t("details.sending") : clinic.booking.requireApproval ? t("details.request") : t("details.confirm")}
      </Button>
      {clinic.booking.requireApproval ? (
        <p className="flex gap-2 text-xs text-slate-600">
          <BellRing size={14} className="mt-0.5 shrink-0" aria-hidden /> {t("details.approvalNote")}
        </p>
      ) : null}
    </form>
  );
}
