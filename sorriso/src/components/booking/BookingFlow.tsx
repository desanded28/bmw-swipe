"use client";

import { ArrowLeft, Check, Clock, MapPin, Stethoscope } from "lucide-react";
import { useEffect, useId, useMemo, useReducer } from "react";
import type { ProcessingContext } from "@/db/enums";
import { fmtWhen, zonedDate, zonedTime } from "@/i18n/datefmt";
import { formatMoney } from "@/i18n/number";
import { useLocale, useT } from "@/i18n/provider";
import type { Locale } from "@/i18n/config";
import type { PublicClinic } from "@/lib/directory";
import { practitionerName } from "@/lib/format";
import { ClinicHelp } from "../ClinicHelp";
import { LanguageSwitcher } from "../LanguageSwitcher";
import { Avatar, Field, Select, cx } from "../ui";
import { CONFIRM_WORD, DetailsStep, initialBookingForm, type BookingFormState, type DetailsForm } from "./DetailsStep";
import { DoneStep, type BookedAppointment } from "./DoneStep";
import { ServiceStep, type ServiceLabels } from "./ServiceStep";
import { SlotPicker, type PickedSlot } from "./SlotPicker";
import { WaitlistOffer, initialWaitlist, type WaitlistState } from "./WaitlistOffer";

export type Step = "service" | "time" | "details" | "done";

export type BookingInitial = {
  serviceId?: string;
  practitionerId?: string;
  locationId?: string;
  start?: string;
  waitlistEntryId?: string;
};

/**
 * Texts the server formats or looks up for the flow, so client components never format money or
 * units. `defaultSpecialty` (marketplace.profile.defaultSpecialty, "Dentist") stands in for a
 * practitioner whose practice left the specialty empty; without it the name is shown alone.
 */
export type BookingLabels = { services: ServiceLabels; defaultSpecialty?: string };

/**
 * Talking to the page that embeds the widget. Messages go only to `parentOrigin` (checked by the
 * embed page against the practice's allowed origins), never to "*", and carry only
 * { source, type, height }; the booked event is sent only if the host opted in (data-events), and
 * with the appointment id only if it asked for it (data-include-id).
 */
export type EmbedMessaging = { parentOrigin: string | null; events: boolean; includeId: boolean };

/**
 * In the widget's dialog focus is almost always inside this frame, and key events in a cross-origin
 * frame never reach the host page: Escape asks the host to close the dialog with { source, type }
 * only, posted to the validated parent only. widget.js checks the message's origin and source,
 * ignores it for an inline frame, and keeps the frame (what was typed) when it closes. An Escape a
 * control already handled (e.g. closing a picker) is left alone. Returns the cleanup.
 */
export function relayEscapeToHost(
  doc: Pick<Document, "addEventListener" | "removeEventListener">,
  host: Pick<Window, "postMessage">,
  parentOrigin: string,
): () => void {
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "Escape" || e.defaultPrevented || e.isComposing) return;
    host.postMessage({ source: "sorriso", type: "close" }, parentOrigin);
  };
  doc.addEventListener("keydown", onKey);
  return () => doc.removeEventListener("keydown", onKey);
}

/** Everything the flow holds, in memory only (never web storage): survives Back and a taken slot. */
export type FlowState = {
  step: Step;
  serviceId: string;
  practitionerId: string;
  locationId: string;
  slot: PickedSlot | null;
  form: BookingFormState;
  waitlist: WaitlistState;
  /** The chosen time was taken by someone else: the time step shows an alert. */
  slotTaken: boolean;
  booked: BookedAppointment | null;
  /** Bumped on every step change the visitor caused: the new step's heading takes focus. */
  focusRequest: number;
};

export type FlowAction =
  /**
   * keepPractitioner / keepLocation: the chosen practitioner offers the new service, the chosen
   * office has a practitioner who does (computed by the component, which knows the clinic). Anything
   * not kept is reset to "first available" / "any office".
   */
  | { type: "selectService"; serviceId: string; keepPractitioner: boolean; keepLocation?: boolean }
  | { type: "setPractitioner"; practitionerId: string }
  | { type: "setLocation"; locationId: string }
  | { type: "pickSlot"; slot: PickedSlot }
  | { type: "goto"; step: Exclude<Step, "done"> }
  | { type: "slotTaken" }
  | { type: "booked"; appointment: BookedAppointment }
  | { type: "form"; patch: Partial<BookingFormState> }
  | { type: "contact"; patch: Partial<DetailsForm> }
  | { type: "waitlist"; patch: Partial<WaitlistState> };

/**
 * The flow's transitions, pure (unit-tested). Moving between steps never touches `form` or
 * `waitlist`: what the visitor typed survives going back, changing the service or time, and a slot
 * taken by someone else (WCAG 3.3.7 Redundant Entry).
 */
export function flowReducer(state: FlowState, action: FlowAction): FlowState {
  const step = (s: Step, extra: Partial<FlowState> = {}): FlowState => ({
    ...state,
    ...extra,
    step: s,
    focusRequest: state.focusRequest + 1,
  });
  switch (action.type) {
    case "selectService":
      return step("time", {
        serviceId: action.serviceId,
        slot: null,
        slotTaken: false,
        practitionerId: action.keepPractitioner ? state.practitionerId : "",
        // An office kept from another service could have no one offering this one: no times, and
        // its select may be hidden (one eligible office), so nothing could reset it.
        locationId: action.keepLocation ? state.locationId : "",
      });
    case "setPractitioner":
      return { ...state, practitionerId: action.practitionerId, locationId: "", slot: null };
    case "setLocation":
      return { ...state, locationId: action.locationId, slot: null };
    case "pickSlot":
      return step("details", { slot: action.slot, slotTaken: false });
    case "goto":
      return step(action.step, { slotTaken: false });
    case "slotTaken":
      return step("time", { slot: null, slotTaken: true });
    case "booked":
      return step("done", { booked: action.appointment });
    case "form":
      return { ...state, form: { ...state.form, ...action.patch } };
    case "contact":
      return { ...state, form: { ...state.form, details: { ...state.form.details, ...action.patch } } };
    case "waitlist":
      return { ...state, waitlist: { ...state.waitlist, ...action.patch } };
  }
}

/** The selectService action for `id`, keeping the practitioner and office only where they offer it. */
export function selectServiceAction(
  clinic: Pick<PublicClinic, "practitioners">,
  state: Pick<FlowState, "practitionerId" | "locationId">,
  serviceId: string,
): Extract<FlowAction, { type: "selectService" }> {
  const offering = clinic.practitioners.filter((p) => p.serviceIds.includes(serviceId));
  const keepPractitioner = Boolean(state.practitionerId && offering.some((p) => p.id === state.practitionerId));
  const keepLocation = Boolean(
    state.locationId &&
      offering.some((p) => (!keepPractitioner || p.id === state.practitionerId) && p.locationIds.includes(state.locationId)),
  );
  return { type: "selectService", serviceId, keepPractitioner, keepLocation };
}

export function initialFlowState(
  clinic: PublicClinic,
  initial: BookingInitial,
  today: string,
  locale: Locale,
): FlowState {
  const tz = clinic.org.timezone;
  const practitioner = clinic.practitioners.find((p) => p.id === initial.practitionerId);
  const service = clinic.services.find((s) => s.id === initial.serviceId);
  const location = clinic.locations.find((l) => l.id === initial.locationId);
  const serviceId = service?.id ?? (practitioner?.serviceIds.length === 1 ? practitioner.serviceIds[0] : "");
  const slot: PickedSlot | null =
    initial.start && service && practitioner && location
      ? {
          start: initial.start,
          end: initial.start,
          time: zonedTime(initial.start, tz),
          date: zonedDate(initial.start, tz),
          practitionerId: practitioner.id,
          locationId: location.id,
        }
      : null;
  return {
    step: slot ? "details" : serviceId ? "time" : "service",
    serviceId,
    practitionerId: practitioner?.id ?? "",
    locationId: location?.id ?? "",
    slot,
    form: initialBookingForm(locale),
    waitlist: initialWaitlist(today),
    slotTaken: false,
    booked: null,
    focusRequest: 0,
  };
}

const STEPS = ["service", "time", "details"] as const;

export function BookingFlow({
  clinic,
  initial,
  today,
  embedded = false,
  context,
  practiceRef = null,
  labels,
  embed,
  search,
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
  /** Price and duration texts from the server; computed here (without Intl) when a page passes none. */
  labels?: BookingLabels;
  /** Embedded in the widget: where and what to post to the host page. */
  embed?: EmbedMessaging;
  /** The page's query as the server saw it (x-search): the language switcher keeps it without JavaScript. */
  search?: string;
}) {
  const t = useT("booking");
  const tc = useT("common");
  const ta = useT("a11y");
  const te = useT("errors");
  const locale = useLocale();
  const uid = useId();
  const headingId = `${uid}-step`;
  const tz = clinic.org.timezone;
  const [state, dispatch] = useReducer(flowReducer, undefined, () => initialFlowState(clinic, initial, today, locale));
  const { step, serviceId, practitionerId, slot, form } = state;

  const practitionerById = useMemo(() => new Map(clinic.practitioners.map((p) => [p.id, p])), [clinic]);
  const locationById = useMemo(() => new Map(clinic.locations.map((l) => [l.id, l])), [clinic]);
  const serviceById = useMemo(() => new Map(clinic.services.map((s) => [s.id, s])), [clinic]);
  const serviceLabels = useMemo<ServiceLabels>(() => {
    if (labels) return labels.services;
    const price = (c: number | null) => (c == null ? tc("price.onRequest") : c === 0 ? tc("price.free") : formatMoney(c, locale));
    return Object.fromEntries(
      clinic.services.map((s) => [s.id, { price: price(s.priceCents), duration: tc("units.minutesShort", { count: s.durationMinutes }) }]),
    );
  }, [labels, clinic, tc, locale]);

  const fixedPractitioner = initial.practitionerId ? (practitionerById.get(initial.practitionerId) ?? null) : null;
  const service = serviceId ? serviceById.get(serviceId) : undefined;
  const eligiblePractitioners = clinic.practitioners.filter(
    (p) => (!serviceId || p.serviceIds.includes(serviceId)) && p.locationIds.length > 0,
  );
  const eligibleLocations = clinic.locations.filter((l) =>
    (practitionerId ? eligiblePractitioners.filter((p) => p.id === practitionerId) : eligiblePractitioners).some((p) =>
      p.locationIds.includes(l.id),
    ),
  );
  // An office nobody eligible works at (e.g. from the link) is ignored rather than searched in vain.
  const locationId = eligibleLocations.some((l) => l.id === state.locationId) ? state.locationId : "";
  const visibleServices = fixedPractitioner
    ? clinic.services.filter((s) => fixedPractitioner.serviceIds.includes(s.id))
    : clinic.services.filter((s) => clinic.practitioners.some((p) => p.serviceIds.includes(s.id)));

  // A step change the visitor caused moves focus to the new step's heading (never on first load).
  useEffect(() => {
    if (state.focusRequest > 0) document.getElementById(headingId)?.focus();
  }, [state.focusRequest, headingId]);

  // Embedded in the widget: tell the host page our height, only if it was validated.
  const parentOrigin = embedded ? (embed?.parentOrigin ?? null) : null;
  useEffect(() => {
    if (!parentOrigin || typeof ResizeObserver === "undefined") return;
    const post = () =>
      window.parent?.postMessage({ source: "sorriso", type: "resize", height: document.body.scrollHeight }, parentOrigin);
    const ro = new ResizeObserver(post);
    ro.observe(document.body);
    return () => ro.disconnect();
  }, [parentOrigin]);
  useEffect(() => {
    if (!parentOrigin || !window.parent || window.parent === window) return;
    return relayEscapeToHost(document, window.parent, parentOrigin);
  }, [parentOrigin]);

  const chosenPractitioner = slot ? practitionerById.get(slot.practitionerId) : practitionerById.get(practitionerId);
  const chosenLocation = slot ? locationById.get(slot.locationId) : locationById.get(locationId);
  const helpPhone = chosenLocation?.phone ?? clinic.org.phone ?? clinic.locations.find((l) => l.phone)?.phone ?? null;
  const stepIndex = { service: 0, time: 1, details: 2, done: 3 }[step];
  const stepLabels = { service: t("steps.service"), time: t("steps.time"), details: t("steps.details") };

  return (
    <div className={cx("grid gap-6", step !== "done" && "lg:grid-cols-[1fr_300px]")}>
      <div className="min-w-0">
        {step !== "done" ? (
          <ol aria-label={t("steps.label")} className="mb-5 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
            {STEPS.map((s, i) => (
              <li key={s} aria-current={i === stepIndex ? "step" : undefined} className="flex items-center gap-2">
                <span
                  aria-hidden
                  className={cx(
                    "inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px]",
                    i < stepIndex
                      ? "bg-brand-700 text-white"
                      : i === stepIndex
                        ? "bg-brand-100 text-brand-800 ring-2 ring-brand-600"
                        : "bg-slate-100 text-slate-700",
                  )}
                >
                  {i < stepIndex ? <Check size={13} /> : i + 1}
                </span>
                <span className={cx(i === stepIndex && "text-slate-900")}>
                  {stepLabels[s]}
                  {i < stepIndex ? <span className="sr-only"> ({ta("completed")})</span> : null}
                </span>
                {i < STEPS.length - 1 ? <span aria-hidden className="mx-1 h-px w-6 bg-slate-300" /> : null}
              </li>
            ))}
          </ol>
        ) : null}

        {step === "service" ? (
          <ServiceStep
            services={visibleServices}
            selected={serviceId}
            labels={serviceLabels}
            headingId={headingId}
            onSelect={(id) => dispatch(selectServiceAction(clinic, state, id))}
          />
        ) : null}

        {step === "time" && service ? (
          <div className="animate-fade-up">
            {visibleServices.length > 1 ? (
              <button
                type="button"
                onClick={() => dispatch({ type: "goto", step: "service" })}
                className="mb-4 inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-slate-600 hover:text-slate-900"
              >
                <ArrowLeft size={15} aria-hidden /> {t("time.changeService")}
              </button>
            ) : null}
            <h2 id={headingId} tabIndex={-1} className="mb-4 text-lg font-bold">
              {t("time.heading")}
            </h2>
            {state.slotTaken ? (
              <div role="alert" className="mb-4 rounded-xl bg-amber-50 p-3 text-sm font-medium text-amber-900 ring-1 ring-amber-200">
                {te("slotTaken")}
              </div>
            ) : null}
            <div className="mb-5 grid gap-3 sm:grid-cols-2">
              {!fixedPractitioner ? (
                <Field label={t("time.practitioner")}>
                  <Select value={practitionerId} onChange={(e) => dispatch({ type: "setPractitioner", practitionerId: e.target.value })}>
                    <option value="">{t("time.firstAvailable")}</option>
                    {eligiblePractitioners.map((p) => {
                      // Left empty by the practice: the server's default ("Dentist"), else the name alone.
                      const specialty = p.specialty.trim() || labels?.defaultSpecialty;
                      return (
                        <option key={p.id} value={p.id}>
                          {specialty ? t("time.practitionerOption", { name: practitionerName(p), specialty }) : practitionerName(p)}
                        </option>
                      );
                    })}
                  </Select>
                </Field>
              ) : null}
              {eligibleLocations.length > 1 ? (
                <Field label={t("time.office")}>
                  <Select value={locationId} onChange={(e) => dispatch({ type: "setLocation", locationId: e.target.value })}>
                    <option value="">{t("time.anyOffice")}</option>
                    {eligibleLocations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {t("time.officeOption", { name: l.name, address: l.address })}
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
              onSelect={(s) => dispatch({ type: "pickSlot", slot: s })}
            />
            <WaitlistOffer
              clinic={clinic}
              serviceId={service.id}
              practitionerId={practitionerId}
              locationId={locationId}
              today={today}
              context={context}
              practiceRef={practiceRef}
              contact={form.details}
              onContactChange={(patch) => dispatch({ type: "contact", patch })}
              value={state.waitlist}
              onChange={(patch) => dispatch({ type: "waitlist", patch })}
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
            headingId={headingId}
            form={form}
            onFormChange={(patch) => dispatch({ type: "form", patch })}
            onDetailsChange={(patch) => dispatch({ type: "contact", patch })}
            onBack={() => dispatch({ type: "goto", step: "time" })}
            onBooked={(a) => {
              dispatch({ type: "booked", appointment: a });
              if (parentOrigin && embed?.events) {
                window.parent?.postMessage(
                  { source: "sorriso", type: "booked", ...(embed.includeId ? { appointmentId: a.id } : {}) },
                  parentOrigin,
                );
              }
            }}
            onSlotTaken={() => dispatch({ type: "slotTaken" })}
          />
        ) : null}

        {step === "done" && state.booked ? (
          <DoneStep
            appointment={state.booked}
            clinic={clinic}
            confirmWord={CONFIRM_WORD[form.details.locale]}
            headingId={headingId}
            embedded={embedded}
            forOtherAdult={form.relationAsked && form.relation.bookedFor === "other_adult" ? context : "no"}
          />
        ) : null}
      </div>

      {step !== "done" ? (
        <aside
          aria-labelledby={`${uid}-summary`}
          className="h-fit rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-200/70 lg:sticky lg:top-20"
        >
          <div className="mb-3 flex items-start justify-between gap-2">
            <h2 id={`${uid}-summary`} className="pt-2 text-xs font-bold uppercase tracking-wider text-slate-600">
              {t("summary.title")}
            </h2>
            <LanguageSwitcher mode={embedded ? "url" : "cookie"} search={search} />
          </div>
          <dl className="space-y-3 text-sm">
            <SummaryRow icon={<Stethoscope size={16} />} label={t("summary.service")}>
              {service ? (
                <>
                  {service.name}
                  <span className="block text-xs font-normal text-slate-600">
                    {t("summary.serviceMeta", {
                      duration: serviceLabels[service.id]?.duration ?? "",
                      price: serviceLabels[service.id]?.price ?? "",
                    })}
                  </span>
                </>
              ) : (
                <span className="font-normal text-slate-600">{t("summary.chooseService")}</span>
              )}
            </SummaryRow>
            <SummaryRow
              icon={<Avatar name={chosenPractitioner?.name ?? "?"} color={chosenPractitioner?.color} size={18} />}
              label={t("summary.with")}
            >
              {chosenPractitioner ? (
                practitionerName(chosenPractitioner)
              ) : (
                <span className="font-normal text-slate-600">{t("time.firstAvailable")}</span>
              )}
            </SummaryRow>
            <SummaryRow icon={<Clock size={16} />} label={t("summary.when")}>
              {slot ? fmtWhen(slot.start, tz, locale) : <span className="font-normal text-slate-600">{t("summary.pickTime")}</span>}
            </SummaryRow>
            <SummaryRow icon={<MapPin size={16} />} label={t("summary.where")}>
              {chosenLocation ? (
                <>
                  {chosenLocation.name}
                  <span className="block text-xs font-normal text-slate-600">
                    {t("summary.address", { address: chosenLocation.address, city: chosenLocation.city })}
                  </span>
                </>
              ) : clinic.locations.length === 1 ? (
                clinic.locations[0].name
              ) : (
                <span className="font-normal text-slate-600">{t("time.anyOffice")}</span>
              )}
            </SummaryRow>
          </dl>
          <ul className="mt-4 space-y-1.5 border-t border-slate-200 pt-4 text-xs text-slate-600">
            {[
              t("summary.noAccount"),
              clinic.privacy.whatsappEnabled ? t("summary.remindersWhatsapp") : t("summary.reminders"),
              t("summary.reschedule"),
            ].map((text) => (
              <li key={text} className="flex gap-2">
                <Check size={14} className="shrink-0 text-brand-700" aria-hidden /> {text}
              </li>
            ))}
          </ul>
          <ClinicHelp
            clinicName={clinic.org.name}
            phone={helpPhone}
            email={clinic.org.email}
            className="mt-4 border-t border-slate-200 pt-4"
          />
        </aside>
      ) : null}
    </div>
  );
}

function SummaryRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="relative min-w-0 pl-8">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
        <span className="absolute left-0 top-0.5 flex h-5 w-5 items-center justify-center text-slate-500" aria-hidden>
          {icon}
        </span>
        {label}
      </dt>
      <dd className="font-semibold text-slate-800">{children}</dd>
    </div>
  );
}
