"use client";

import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import type { ProcessingContext } from "@/db/enums";
import { DIAL_CODE, LOCALES } from "@/i18n/config";
import { useLocale } from "@/i18n/provider";
import type { PublicClinic } from "@/lib/directory";
import { noticeVersionFor } from "@/lib/privacy/booking-rules";
import { Button, Field, Input, Select } from "../ui";
import {
  INITIAL_PRIVACY,
  INITIAL_RELATION,
  PRACTICE_DIAL_CODE,
  fieldErrors,
  privacyPayload,
  relationPayload,
  type BookingPrivacyState,
  type RelationState,
} from "./contracts";
import { PatientRelationSection } from "./PatientRelationSection";
import { PrivacySection } from "./PrivacySection";

const DIAL_CODES = [...new Set(LOCALES.map((l) => DIAL_CODE[l]))];

export function WaitlistOffer({
  clinic,
  serviceId,
  practitionerId,
  locationId,
  today,
  context,
  practiceRef,
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
}) {
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    earliestDate: today,
    latestDate: "",
    partOfDay: "any",
    firstName: "",
    lastName: "",
    phone: "",
    phoneCountry: PRACTICE_DIAL_CODE,
    email: "",
  });
  const [privacy, setPrivacy] = useState<BookingPrivacyState>(INITIAL_PRIVACY);
  const [relation, setRelation] = useState<RelationState>(INITIAL_RELATION);
  /** Posted only once the relation section asked (PatientRelationSectionProps). */
  const [relationAsked, setRelationAsked] = useState(false);

  if (!open)
    return (
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-slate-300 p-4">
        <p className="text-sm text-slate-600">
          <span className="font-semibold text-slate-800">Nothing suitable?</span> Join the waitlist — we&apos;ll text you
          the moment an earlier slot frees up.
        </p>
        <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
          Join waitlist
        </Button>
      </div>
    );

  if (state === "done")
    return (
      <div className="mt-5 rounded-xl bg-brand-50 p-4 text-sm font-medium text-brand-800">
        You&apos;re on the waitlist. If a matching slot opens up we&apos;ll message you straight away — first to book gets it.
      </div>
    );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (context === "marketplace" && !privacy.platformConsent) {
      setErrors({ platformConsent: "Please consent to continue" });
      return;
    }
    setErrors({});
    setState("sending");
    const res = await fetch(`/api/v1/clinics/${clinic.org.slug}/waitlist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serviceId,
        practitionerId: practitionerId || null,
        locationId: locationId || null,
        earliestDate: form.earliestDate,
        latestDate: form.latestDate || form.earliestDate,
        partOfDay: form.partOfDay,
        patient: {
          firstName: form.firstName,
          lastName: form.lastName,
          phone: form.phone || null,
          phoneCountry: form.phoneCountry,
          email: form.email || null,
          locale,
        },
        privacy: privacyPayload(privacy, {
          clinic,
          context,
          preferredChannel: "sms",
          noticeVersion: noticeVersionFor(context),
          locale,
        }),
        relation: relationAsked ? relationPayload(relation) : undefined,
        practiceRef: practiceRef ?? null,
      }),
    }).catch(() => null);
    if (!res?.ok) {
      const json = await res?.json().catch(() => null);
      setErrors(fieldErrors(json?.error));
      setError(json?.error?.issues?.[0]?.message ?? json?.error?.message ?? "Could not join the waitlist.");
      setState("idle");
      return;
    }
    setState("done");
  }

  return (
    <form onSubmit={submit} className="mt-5 space-y-3 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
      <p className="text-sm font-semibold">Waitlist — tell us when you could come</p>
      {/* The waitlist form asks no birth date yet: WP4 adds it with the minor variant. */}
      <PatientRelationSection
        value={relation}
        onChange={(v) => {
          setRelation(v);
          setRelationAsked(true);
        }}
        birthDate=""
        errors={errors}
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="From">
          <Input type="date" min={today} value={form.earliestDate} onChange={(e) => setForm({ ...form, earliestDate: e.target.value })} required />
        </Field>
        <Field label="Until">
          <Input type="date" min={form.earliestDate} value={form.latestDate} onChange={(e) => setForm({ ...form, latestDate: e.target.value })} required />
        </Field>
        <Field label="Time of day">
          <Select value={form.partOfDay} onChange={(e) => setForm({ ...form, partOfDay: e.target.value })}>
            <option value="any">Any time</option>
            <option value="morning">Mornings</option>
            <option value="afternoon">Afternoons</option>
          </Select>
        </Field>
        <Field label="First name">
          <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
        </Field>
        <Field label="Last name">
          <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
        </Field>
        <Field label="Mobile">
          <span className="flex gap-2">
            <Select
              aria-label="Country code"
              value={form.phoneCountry}
              onChange={(e) => setForm({ ...form, phoneCountry: e.target.value })}
              className="w-24 shrink-0"
            >
              {DIAL_CODES.map((code) => (
                <option key={code} value={code}>
                  +{code}
                </option>
              ))}
            </Select>
            <Input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="333…" />
          </span>
        </Field>
      </div>
      <Field label="Email (optional)">
        <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      </Field>
      <PrivacySection
        clinic={clinic}
        context={context}
        variant="waitlist"
        preferredChannel="sms"
        relation={relation}
        value={privacy}
        onChange={setPrivacy}
        errors={errors}
      />
      {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={state === "sending"}>
          {state === "sending" ? <LoaderCircle size={15} className="animate-spin" /> : null} Notify me
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
