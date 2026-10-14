"use client";

import { ArrowLeft, BellRing, CalendarCheck, LoaderCircle, MessageCircle } from "lucide-react";
import { useState } from "react";
import type { Channel, ProcessingContext } from "@/db/enums";
import { DIAL_CODE, ENDONYM, LOCALES, type Locale } from "@/i18n/config";
import { useLocale } from "@/i18n/provider";
import type { PublicClinic } from "@/lib/directory";
import { noticeVersionFor } from "@/lib/privacy/booking-rules";
import { Button, Field, Input, Select, Textarea, cx } from "../ui";
import { BookingExtrasSection } from "./BookingExtrasSection";
import {
  INITIAL_EXTRAS,
  INITIAL_PRIVACY,
  INITIAL_RELATION,
  PRACTICE_DIAL_CODE,
  fieldErrors,
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

const DIAL_CODES = [...new Set(LOCALES.map((l) => DIAL_CODE[l]))];

type FormState = {
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
  /** The language of the patient's messages. */
  locale: Locale;
  website: string;
};

export function DetailsStep({
  clinic,
  service,
  slot,
  waitlistEntryId,
  source,
  context,
  practiceRef,
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
  onBack: () => void;
  onBooked: (a: BookedAppointment) => void;
  onSlotTaken: () => void;
}) {
  const pageLocale = useLocale();
  const [form, setForm] = useState<FormState>(() => ({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    phoneCountry: PRACTICE_DIAL_CODE,
    birthDate: "",
    note: "",
    isNewPatient: "yes",
    preferredChannel: "sms",
    locale: pageLocale,
    website: "",
  }));
  const [privacy, setPrivacy] = useState<BookingPrivacyState>(INITIAL_PRIVACY);
  const [relation, setRelation] = useState<RelationState>(INITIAL_RELATION);
  /** Posted only once the relation section asked (PatientRelationSectionProps). */
  const [relationAsked, setRelationAsked] = useState(false);
  const [extras, setExtras] = useState<ExtrasState>(INITIAL_EXTRAS);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));
  const channels = (
    [
      ["sms", "SMS", <MessageCircle key="i" size={16} />],
      ["whatsapp", "WhatsApp", <MessageCircle key="i" size={16} />],
      ["email", "Email", <BellRing key="i" size={16} />],
    ] as const
  ).filter(([value]) => value !== "whatsapp" || clinic.privacy.whatsappEnabled);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const errs: Record<string, string> = {};
    if (!form.firstName.trim()) errs.firstName = "Required";
    if (!form.lastName.trim()) errs.lastName = "Required";
    if (!form.email.trim() && !form.phone.trim()) errs.phone = "Add a mobile number or an email";
    if (form.preferredChannel !== "email" && !form.phone.trim()) errs.phone = "Needed for SMS / WhatsApp reminders";
    if (form.preferredChannel === "email" && !form.email.trim()) errs.email = "Needed for email reminders";
    if (context === "marketplace" && !privacy.platformConsent) errs.platformConsent = "Please consent to continue";
    if (form.preferredChannel === "whatsapp" && !privacy.whatsapp) errs.whatsapp = "Please confirm to continue";
    setErrors(errs);
    if (Object.keys(errs).length) return;

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
          note: form.note || null,
          isNewPatient: form.isNewPatient === "yes",
          waitlistEntryId: waitlistEntryId ?? null,
          source,
          website: form.website,
          patient: {
            firstName: form.firstName,
            lastName: form.lastName,
            email: form.email || null,
            phone: form.phone || null,
            phoneCountry: form.phoneCountry,
            birthDate: form.birthDate || null,
            locale: form.locale,
            preferredChannel: form.preferredChannel,
          },
          privacy: privacyPayload(privacy, {
            clinic,
            context,
            preferredChannel: form.preferredChannel,
            noticeVersion: noticeVersionFor(context),
            locale: pageLocale,
          }),
          relation: relationAsked ? relationPayload(relation) : undefined,
          fundId: extras.fundId,
          practiceRef: practiceRef ?? null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        const code = json?.error?.code as string | undefined;
        const fields = fieldErrors(json?.error);
        if (code === "practitioner_busy" || code === "no_room" || code === "too_soon" || code === "time_off") {
          setError("Sorry, someone just booked that time. Please pick another slot.");
          setTimeout(onSlotTaken, 1800);
        } else if (Object.keys(fields).length) {
          setErrors(fields);
          setError(json?.error?.issues ? "Please check the highlighted fields." : (json?.error?.message ?? null));
        } else {
          setError(json?.error?.message ?? "Booking failed. Please try again.");
        }
        return;
      }
      onBooked(json.appointment);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="animate-fade-up space-y-5" noValidate>
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft size={15} /> Change time
      </button>
      <h2 className="text-lg font-bold">Your details</h2>

      <PatientRelationSection
        value={relation}
        onChange={(v) => {
          setRelation(v);
          setRelationAsked(true);
        }}
        birthDate={form.birthDate}
        errors={errors}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name" error={errors.firstName}>
          <Input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} autoComplete="given-name" />
        </Field>
        <Field label="Last name" error={errors.lastName}>
          <Input value={form.lastName} onChange={(e) => set("lastName", e.target.value)} autoComplete="family-name" />
        </Field>
        <Field label="Mobile number" error={errors.phone ?? errors.phoneCountry} hint="For your reminder. Reply SI/YES to confirm.">
          <span className="flex gap-2">
            <Select
              aria-label="Country code"
              value={form.phoneCountry}
              onChange={(e) => set("phoneCountry", e.target.value)}
              className="w-24 shrink-0"
            >
              {DIAL_CODES.map((code) => (
                <option key={code} value={code}>
                  +{code}
                </option>
              ))}
            </Select>
            <Input
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              type="tel"
              inputMode="tel"
              placeholder="333 123 4567"
              autoComplete="tel-national"
            />
          </span>
        </Field>
        <Field label="Email" error={errors.email}>
          <Input value={form.email} onChange={(e) => set("email", e.target.value)} type="email" autoComplete="email" />
        </Field>
        <Field label="Date of birth" hint="Optional" error={errors.birthDate}>
          <Input value={form.birthDate} onChange={(e) => set("birthDate", e.target.value)} type="date" />
        </Field>
        <Field label="First visit at this practice?">
          <Select value={form.isNewPatient} onChange={(e) => set("isNewPatient", e.target.value as "yes" | "no")}>
            <option value="yes">Yes, I&apos;m a new patient</option>
            <option value="no">No, I&apos;ve been here before</option>
          </Select>
        </Field>
      </div>

      <div>
        <p className="mb-2 text-[13px] font-semibold text-slate-700">Remind me by</p>
        <div className={cx("grid gap-2", channels.length === 3 ? "grid-cols-3" : "grid-cols-2")}>
          {channels.map(([value, label, icon]) => (
            <button
              key={value}
              type="button"
              onClick={() => set("preferredChannel", value)}
              className={cx(
                "flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold ring-1 transition",
                form.preferredChannel === value
                  ? "bg-brand-50 text-brand-800 ring-2 ring-brand-600"
                  : "bg-white text-slate-700 ring-slate-200 hover:ring-slate-300",
              )}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>
        {errors.preferredChannel ? <p className="mt-1 text-xs font-medium text-red-600">{errors.preferredChannel}</p> : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
        <Field label="Anything the practice should know?" hint="Optional — e.g. pain, anxiety, previous X-rays" error={errors.note}>
          <Textarea value={form.note} onChange={(e) => set("note", e.target.value)} rows={2} maxLength={500} />
        </Field>
        <Field label="Messages language">
          <Select value={form.locale} onChange={(e) => set("locale", e.target.value as Locale)}>
            {LOCALES.map((l) => (
              <option key={l} value={l} lang={l}>
                {ENDONYM[l]}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <BookingExtrasSection clinic={clinic} serviceId={service.id} value={extras} onChange={setExtras} />

      {/* Honeypot */}
      <input
        type="text"
        tabIndex={-1}
        autoComplete="off"
        value={form.website}
        onChange={(e) => set("website", e.target.value)}
        className="hidden"
        aria-hidden
      />

      <PrivacySection
        clinic={clinic}
        context={context}
        variant="booking"
        preferredChannel={form.preferredChannel}
        relation={relation}
        value={privacy}
        onChange={setPrivacy}
        errors={errors}
      />

      {error ? <p className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">{error}</p> : null}

      <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={submitting}>
        {submitting ? <LoaderCircle size={18} className="animate-spin" /> : <CalendarCheck size={18} />}
        {clinic.booking.requireApproval ? "Request appointment" : "Confirm booking"}
      </Button>
      {clinic.booking.requireApproval ? (
        <p className="text-xs text-slate-500">This practice confirms online requests personally, usually within a few hours.</p>
      ) : null}
    </form>
  );
}
