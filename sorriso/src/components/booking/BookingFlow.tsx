"use client";

import {
  ArrowLeft,
  BellRing,
  CalendarCheck,
  CalendarPlus,
  Check,
  Clock,
  Hourglass,
  LoaderCircle,
  MapPin,
  MessageCircle,
  Stethoscope,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { PublicClinic } from "@/lib/directory";
import { CATEGORY_LABELS, formatPrice, practitionerName } from "@/lib/format";
import { googleCalendarUrl } from "@/lib/calendar-links";
import { fmtWhen, zonedDate, zonedTime } from "@/lib/datefmt";
import { Avatar, Button, Field, Input, Select, Textarea, buttonClass, cx } from "../ui";
import { SlotPicker, type PickedSlot } from "./SlotPicker";

type Step = "service" | "time" | "details" | "done";

type BookedAppointment = {
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

export type BookingInitial = {
  serviceId?: string;
  practitionerId?: string;
  locationId?: string;
  start?: string;
  waitlistEntryId?: string;
};

export function BookingFlow({
  clinic,
  initial,
  today,
  embedded = false,
}: {
  clinic: PublicClinic;
  initial: BookingInitial;
  today: string;
  embedded?: boolean;
}) {
  const tz = clinic.org.timezone;
  const practitionerById = useMemo(() => new Map(clinic.practitioners.map((p) => [p.id, p])), [clinic]);
  const locationById = useMemo(() => new Map(clinic.locations.map((l) => [l.id, l])), [clinic]);
  const serviceById = useMemo(() => new Map(clinic.services.map((s) => [s.id, s])), [clinic]);

  const validInitialService = initial.serviceId && serviceById.has(initial.serviceId) ? initial.serviceId : "";
  const validInitialPractitioner =
    initial.practitionerId && practitionerById.has(initial.practitionerId) ? initial.practitionerId : "";
  const fixedPractitioner = validInitialPractitioner ? practitionerById.get(validInitialPractitioner)! : null;

  const [serviceId, setServiceId] = useState(
    validInitialService ||
      (fixedPractitioner?.serviceIds.length === 1 ? fixedPractitioner.serviceIds[0] : ""),
  );
  const [practitionerId, setPractitionerId] = useState(validInitialPractitioner);
  const [locationId, setLocationId] = useState(
    initial.locationId && locationById.has(initial.locationId) ? initial.locationId : "",
  );
  const initialSlot: PickedSlot | null =
    initial.start && validInitialService && validInitialPractitioner && initial.locationId
      ? {
          start: initial.start,
          end: initial.start,
          time: zonedTime(initial.start, tz),
          date: zonedDate(initial.start, tz),
          practitionerId: validInitialPractitioner,
          locationId: initial.locationId,
        }
      : null;
  const [slot, setSlot] = useState<PickedSlot | null>(initialSlot);
  const [step, setStep] = useState<Step>(initialSlot ? "details" : serviceId ? "time" : "service");
  const [booked, setBooked] = useState<BookedAppointment | null>(null);

  const service = serviceId ? serviceById.get(serviceId) : undefined;
  const eligiblePractitioners = clinic.practitioners.filter(
    (p) => (!serviceId || p.serviceIds.includes(serviceId)) && p.locationIds.length > 0,
  );
  const eligibleLocations = clinic.locations.filter((l) =>
    (practitionerId ? eligiblePractitioners.filter((p) => p.id === practitionerId) : eligiblePractitioners).some((p) =>
      p.locationIds.includes(l.id),
    ),
  );
  const visibleServices = fixedPractitioner
    ? clinic.services.filter((s) => fixedPractitioner.serviceIds.includes(s.id))
    : clinic.services.filter((s) => clinic.practitioners.some((p) => p.serviceIds.includes(s.id)));

  // Embedded in a widget iframe: tell the parent page our height.
  useEffect(() => {
    if (!embedded || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() =>
      window.parent?.postMessage({ source: "sorriso", type: "resize", height: document.body.scrollHeight }, "*"),
    );
    ro.observe(document.body);
    return () => ro.disconnect();
  }, [embedded]);

  const chosenPractitioner = slot ? practitionerById.get(slot.practitionerId) : practitionerById.get(practitionerId);
  const chosenLocation = slot ? locationById.get(slot.locationId) : locationById.get(locationId);

  const stepIndex = { service: 0, time: 1, details: 2, done: 3 }[step];

  return (
    <div className={cx("grid gap-6", step !== "done" && "lg:grid-cols-[1fr_300px]")}>
      <div className="min-w-0">
        {step !== "done" ? (
          <ol className="mb-5 flex items-center gap-2 text-xs font-semibold text-slate-400">
            {["Service", "Date & time", "Your details"].map((label, i) => (
              <li key={label} className="flex items-center gap-2">
                <span
                  className={cx(
                    "inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px]",
                    i < stepIndex ? "bg-brand-700 text-white" : i === stepIndex ? "bg-brand-100 text-brand-800 ring-2 ring-brand-600" : "bg-slate-100",
                  )}
                >
                  {i < stepIndex ? <Check size={13} /> : i + 1}
                </span>
                <span className={cx(i === stepIndex && "text-slate-800")}>{label}</span>
                {i < 2 ? <span className="mx-1 h-px w-6 bg-slate-200" /> : null}
              </li>
            ))}
          </ol>
        ) : null}

        {step === "service" ? (
          <ServiceStep
            services={visibleServices}
            selected={serviceId}
            onSelect={(id) => {
              setServiceId(id);
              setSlot(null);
              if (practitionerId && !practitionerById.get(practitionerId)?.serviceIds.includes(id)) setPractitionerId("");
              setStep("time");
            }}
          />
        ) : null}

        {step === "time" && service ? (
          <div className="animate-fade-up">
            <button
              type="button"
              onClick={() => setStep("service")}
              className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-800"
            >
              <ArrowLeft size={15} /> Change service
            </button>
            <div className="mb-5 grid gap-3 sm:grid-cols-2">
              {!fixedPractitioner ? (
                <Field label="Practitioner">
                  <Select
                    value={practitionerId}
                    onChange={(e) => {
                      setPractitionerId(e.target.value);
                      setSlot(null);
                      setLocationId("");
                    }}
                  >
                    <option value="">First available</option>
                    {eligiblePractitioners.map((p) => (
                      <option key={p.id} value={p.id}>
                        {practitionerName(p)} — {p.specialty}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : null}
              {eligibleLocations.length > 1 ? (
                <Field label="Office">
                  <Select
                    value={locationId}
                    onChange={(e) => {
                      setLocationId(e.target.value);
                      setSlot(null);
                    }}
                  >
                    <option value="">Any office</option>
                    {eligibleLocations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} — {l.address}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : null}
            </div>
            <SlotPicker
              clinicSlug={clinic.org.slug}
              serviceId={service.id}
              practitionerId={practitionerId || undefined}
              locationId={locationId || undefined}
              timezone={tz}
              today={today}
              maxAdvanceDays={clinic.booking.maxAdvanceDays}
              practitionerNames={Object.fromEntries(eligiblePractitioners.map((p) => [p.id, practitionerName(p)]))}
              locationNames={Object.fromEntries(eligibleLocations.map((l) => [l.id, l.name]))}
              selectedStart={slot?.start}
              onSelect={(s) => {
                setSlot(s);
                setStep("details");
              }}
            />
            <WaitlistOffer clinic={clinic} serviceId={service.id} practitionerId={practitionerId} locationId={locationId} today={today} />
          </div>
        ) : null}

        {step === "details" && service && slot ? (
          <DetailsStep
            clinic={clinic}
            service={service}
            slot={slot}
            waitlistEntryId={initial.waitlistEntryId}
            source={embedded ? "widget" : "online"}
            onBack={() => setStep("time")}
            onBooked={(a) => {
              setBooked(a);
              setStep("done");
              window.parent?.postMessage({ source: "sorriso", type: "booked", appointmentId: a.id }, "*");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            onSlotTaken={() => {
              setSlot(null);
              setStep("time");
            }}
          />
        ) : null}

        {step === "done" && booked ? <DoneStep appointment={booked} clinic={clinic} /> : null}
      </div>

      {step !== "done" ? (
        <aside className="h-fit rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-200/70 lg:sticky lg:top-6">
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Your appointment</p>
          <div className="space-y-3 text-sm">
            <SummaryRow icon={<Stethoscope size={16} />} label="Service">
              {service ? (
                <>
                  {service.name}
                  <span className="block text-xs font-normal text-slate-500">
                    {service.durationMinutes} min · {formatPrice(service.priceCents)}
                  </span>
                </>
              ) : (
                <span className="text-slate-400">Choose a service</span>
              )}
            </SummaryRow>
            <SummaryRow icon={<Avatar name={chosenPractitioner?.name ?? "?"} color={chosenPractitioner?.color} size={18} />} label="With">
              {chosenPractitioner ? practitionerName(chosenPractitioner) : <span className="text-slate-500">First available</span>}
            </SummaryRow>
            <SummaryRow icon={<Clock size={16} />} label="When">
              {slot ? (
                fmtWhen(slot.start, tz)
              ) : (
                <span className="text-slate-400">Pick a time</span>
              )}
            </SummaryRow>
            <SummaryRow icon={<MapPin size={16} />} label="Where">
              {chosenLocation ? (
                <>
                  {chosenLocation.name}
                  <span className="block text-xs font-normal text-slate-500">
                    {chosenLocation.address}, {chosenLocation.city}
                  </span>
                </>
              ) : clinic.locations.length === 1 ? (
                `${clinic.locations[0].name}`
              ) : (
                <span className="text-slate-500">Any office</span>
              )}
            </SummaryRow>
          </div>
          <div className="mt-4 space-y-1.5 border-t border-slate-200 pt-4 text-xs text-slate-500">
            <p className="flex gap-2">
              <Check size={14} className="shrink-0 text-brand-600" /> No account needed, no booking fee
            </p>
            <p className="flex gap-2">
              <Check size={14} className="shrink-0 text-brand-600" /> Reminder by SMS, WhatsApp or email
            </p>
            <p className="flex gap-2">
              <Check size={14} className="shrink-0 text-brand-600" /> Reschedule or cancel online anytime
            </p>
          </div>
        </aside>
      ) : null}
    </div>
  );
}

function SummaryRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center text-slate-400">{icon}</span>
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
        <div className="font-semibold text-slate-800">{children}</div>
      </div>
    </div>
  );
}

function ServiceStep({
  services,
  selected,
  onSelect,
}: {
  services: PublicClinic["services"];
  selected: string;
  onSelect: (id: string) => void;
}) {
  const groups = new Map<string, PublicClinic["services"]>();
  for (const s of services) groups.set(s.category, [...(groups.get(s.category) ?? []), s]);
  return (
    <div className="animate-fade-up space-y-5">
      <h2 className="text-lg font-bold">What do you need?</h2>
      {[...groups.entries()].map(([category, list]) => (
        <div key={category}>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">{CATEGORY_LABELS[category] ?? category}</p>
          <div className="grid gap-2">
            {list.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => onSelect(s.id)}
                className={cx(
                  "flex items-start justify-between gap-4 rounded-xl bg-white p-4 text-left ring-1 transition hover:ring-brand-400",
                  selected === s.id ? "ring-2 ring-brand-600" : "ring-slate-200",
                )}
              >
                <div>
                  <div className="font-semibold text-slate-900">{s.name}</div>
                  {s.description ? <div className="mt-0.5 text-sm text-slate-500">{s.description}</div> : null}
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-bold text-slate-900">{formatPrice(s.priceCents)}</div>
                  <div className="text-xs text-slate-500">{s.durationMinutes} min</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

type FormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  birthDate: string;
  note: string;
  isNewPatient: "yes" | "no";
  preferredChannel: "sms" | "whatsapp" | "email";
  locale: "it" | "en";
  consent: boolean;
  website: string;
};

function DetailsStep({
  clinic,
  service,
  slot,
  waitlistEntryId,
  source,
  onBack,
  onBooked,
  onSlotTaken,
}: {
  clinic: PublicClinic;
  service: PublicClinic["services"][number];
  slot: PickedSlot;
  waitlistEntryId?: string;
  source: "online" | "widget";
  onBack: () => void;
  onBooked: (a: BookedAppointment) => void;
  onSlotTaken: () => void;
}) {
  const [form, setForm] = useState<FormState>(() => ({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    birthDate: "",
    note: "",
    isNewPatient: "yes",
    preferredChannel: "sms",
    locale: typeof navigator !== "undefined" && !navigator.language.startsWith("it") ? "en" : "it",
    consent: false,
    website: "",
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const errs: Record<string, string> = {};
    if (!form.firstName.trim()) errs.firstName = "Required";
    if (!form.lastName.trim()) errs.lastName = "Required";
    if (!form.email.trim() && !form.phone.trim()) errs.phone = "Add a mobile number or an email";
    if (form.preferredChannel !== "email" && !form.phone.trim()) errs.phone = "Needed for SMS / WhatsApp reminders";
    if (form.preferredChannel === "email" && !form.email.trim()) errs.email = "Needed for email reminders";
    if (!form.consent) errs.consent = "Please accept to continue";
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
            birthDate: form.birthDate || null,
            locale: form.locale,
            preferredChannel: form.preferredChannel,
            smsOptIn: true,
            emailOptIn: true,
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        const code = json?.error?.code as string | undefined;
        if (code === "practitioner_busy" || code === "no_room" || code === "too_soon" || code === "time_off") {
          setError("Sorry, someone just booked that time. Please pick another slot.");
          setTimeout(onSlotTaken, 1800);
        } else if (json?.error?.issues) {
          const fieldErrors: Record<string, string> = {};
          for (const issue of json.error.issues as { path: string; message: string }[])
            fieldErrors[issue.path.replace("patient.", "")] = issue.message;
          setErrors(fieldErrors);
          setError("Please check the highlighted fields.");
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

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name" error={errors.firstName}>
          <Input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} autoComplete="given-name" />
        </Field>
        <Field label="Last name" error={errors.lastName}>
          <Input value={form.lastName} onChange={(e) => set("lastName", e.target.value)} autoComplete="family-name" />
        </Field>
        <Field label="Mobile number" error={errors.phone} hint="For your reminder. Reply SI/YES to confirm.">
          <Input
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
            type="tel"
            inputMode="tel"
            placeholder="+39 333 123 4567"
            autoComplete="tel"
          />
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
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ["sms", "SMS", <MessageCircle key="i" size={16} />],
              ["whatsapp", "WhatsApp", <MessageCircle key="i" size={16} />],
              ["email", "Email", <BellRing key="i" size={16} />],
            ] as const
          ).map(([value, label, icon]) => (
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
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
        <Field label="Anything the practice should know?" hint="Optional — e.g. pain, anxiety, previous X-rays">
          <Textarea value={form.note} onChange={(e) => set("note", e.target.value)} rows={2} maxLength={1000} />
        </Field>
        <Field label="Messages language">
          <Select value={form.locale} onChange={(e) => set("locale", e.target.value as "it" | "en")}>
            <option value="it">Italiano</option>
            <option value="en">English</option>
          </Select>
        </Field>
      </div>

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

      <label className="flex items-start gap-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={form.consent}
          onChange={(e) => set("consent", e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded accent-brand-700"
        />
        <span>
          I agree that {clinic.org.name} processes my data to manage this appointment and sends me reminders.
          {errors.consent ? <span className="block text-xs font-medium text-red-600">{errors.consent}</span> : null}
        </span>
      </label>

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

function DoneStep({ appointment, clinic }: { appointment: BookedAppointment; clinic: PublicClinic }) {
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

function WaitlistOffer({
  clinic,
  serviceId,
  practitionerId,
  locationId,
  today,
}: {
  clinic: PublicClinic;
  serviceId: string;
  practitionerId: string;
  locationId: string;
  today: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    earliestDate: today,
    latestDate: "",
    partOfDay: "any",
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
  });

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
          email: form.email || null,
          locale: navigator.language.startsWith("it") ? "it" : "en",
        },
      }),
    }).catch(() => null);
    if (!res?.ok) {
      const json = await res?.json().catch(() => null);
      setError(json?.error?.issues?.[0]?.message ?? json?.error?.message ?? "Could not join the waitlist.");
      setState("idle");
      return;
    }
    setState("done");
  }

  return (
    <form onSubmit={submit} className="mt-5 space-y-3 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
      <p className="text-sm font-semibold">Waitlist — tell us when you could come</p>
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
          <Input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+39…" />
        </Field>
      </div>
      <Field label="Email (optional)">
        <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      </Field>
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
