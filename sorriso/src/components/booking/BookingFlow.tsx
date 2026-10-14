"use client";

import { ArrowLeft, Check, Clock, MapPin, Stethoscope } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ProcessingContext } from "@/db/enums";
import type { PublicClinic } from "@/lib/directory";
import { formatPrice, practitionerName } from "@/lib/format";
import { fmtWhen, zonedDate, zonedTime } from "@/lib/datefmt";
import { Avatar, Field, Select, cx } from "../ui";
import { DetailsStep } from "./DetailsStep";
import { DoneStep, type BookedAppointment } from "./DoneStep";
import { ServiceStep } from "./ServiceStep";
import { SlotPicker, type PickedSlot } from "./SlotPicker";
import { WaitlistOffer } from "./WaitlistOffer";

type Step = "service" | "time" | "details" | "done";

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
  context,
  practiceRef = null,
}: {
  clinic: PublicClinic;
  initial: BookingInitial;
  today: string;
  embedded?: boolean;
  /**
   * Who is controller for this booking, decided by the server page (processingContextFor): the
   * embed and links carrying a valid practice ref are 'practice', other Sorriso pages 'marketplace'.
   */
  context: ProcessingContext;
  /** The page's verified practice ref (signPracticeRef), posted with the booking; null on the marketplace. */
  practiceRef?: string | null;
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
            <WaitlistOffer
              clinic={clinic}
              serviceId={service.id}
              practitionerId={practitionerId}
              locationId={locationId}
              today={today}
              context={context}
              practiceRef={practiceRef}
            />
          </div>
        ) : null}

        {step === "details" && service && slot ? (
          <DetailsStep
            clinic={clinic}
            service={service}
            slot={slot}
            waitlistEntryId={initial.waitlistEntryId}
            source={embedded ? "widget" : "online"}
            context={context}
            practiceRef={practiceRef}
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
