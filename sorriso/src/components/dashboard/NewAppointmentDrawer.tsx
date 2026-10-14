"use client";

import { Lock, LoaderCircle, Search, UserPlus, UserX, X } from "lucide-react";
import { useEffect, useId, useState, type ReactNode } from "react";
import { createStaffAppointment } from "@/app/dashboard/actions/appointments";
import { searchPatients } from "@/app/dashboard/actions/patients";
import { useT } from "@/i18n/provider";
import { fullName } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { Badge, Button, Field, Input, Select, Textarea, cx } from "../ui";
import { SLOT_CONFLICTS } from "./AppointmentDrawer";
import { DRAWER_DIALOG, useModalDialog } from "./modal";
import { Pii } from "./PrivacyScreen";
import type { Resources } from "./types";
import { useRunAction } from "./useRunAction";

type PatientHit = Awaited<ReturnType<typeof searchPatients>>[number];

export type NewAppointmentDefaults = {
  date: string;
  time: string;
  practitionerId?: string;
  locationId?: string;
  roomId?: string;
};

/**
 * A restricted (Art. 18) record in the search results. WP5's search lists these only for a role
 * with patient.restricted.read, and booking one needs a reason the server records.
 */
const isRestrictedHit = (h: PatientHit) => h.restricted;

/**
 * A patient's name and contacts in the search results and the chosen-patient card. Under the
 * front-desk privacy screen both are blurred until the row or card (`group/pii`) is hovered or
 * holds keyboard focus.
 */
export function PatientSummary({
  hit,
  nameClassName,
  badge,
}: {
  hit: Pick<PatientHit, "firstName" | "lastName" | "phone" | "email">;
  nameClassName?: string;
  /** Shown after the name (not blurred). */
  badge?: ReactNode;
}) {
  const contacts = [formatPhone(hit.phone), hit.email].filter(Boolean).join(" · ");
  return (
    <>
      <span className={cx("flex min-w-0 items-center gap-2", nameClassName)}>
        <Pii className="truncate">{fullName(hit)}</Pii>
        {badge}
      </span>
      {contacts ? <Pii className="block truncate text-xs text-slate-600">{contacts}</Pii> : null}
    </>
  );
}

/**
 * Book from the dashboard: a native modal <dialog> docked on the right. Every control has a
 * visible label; the search announces its result count; a slot conflict offers "book anyway",
 * and booking a restricted patient asks for the reason the server records (Art. 18).
 */
export function NewAppointmentDrawer({
  resources,
  defaults,
  onClose,
}: {
  resources: Resources;
  defaults: NewAppointmentDefaults;
  onClose: () => void;
}) {
  const t = useT("calendar");
  const titleId = useId();
  const { ref, props: dialogProps } = useModalDialog(onClose);
  const { run, pending } = useRunAction();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ q: string; hits: PatientHit[] }>({ q: "", hits: [] });
  const term = query.trim();
  const hits = term.length >= 2 ? results.hits : [];
  const searching = term.length >= 2 && results.q !== term;
  const [patient, setPatient] = useState<PatientHit | null>(null);
  const [newPatient, setNewPatient] = useState(false);
  const [np, setNp] = useState({ firstName: "", lastName: "", phone: "", email: "" });
  const firstPractitioner = defaults.practitionerId ?? resources.practitioners[0]?.id ?? "";
  const [form, setForm] = useState(() => {
    const p = resources.practitioners.find((x) => x.id === firstPractitioner);
    const serviceId = p?.serviceIds[0] ?? resources.services[0]?.id ?? "";
    return {
      serviceId,
      practitionerId: firstPractitioner,
      locationId: defaults.locationId ?? resources.locations[0]?.id ?? "",
      roomId: defaults.roomId ?? "",
      date: defaults.date,
      time: defaults.time,
      duration: String(resources.services.find((s) => s.id === serviceId)?.durationMinutes ?? 30),
      note: "",
      notify: true,
    };
  });
  const [conflict, setConflict] = useState<string | null>(null);
  const [needsReason, setNeedsReason] = useState(false);
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (term.length < 2) return;
    let alive = true;
    const timer = setTimeout(() => {
      searchPatients(term).then((found) => alive && setResults({ q: term, hits: found }));
    }, 200);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [term]);

  const practitioner = resources.practitioners.find((p) => p.id === form.practitionerId);
  const offered = new Set(practitioner?.serviceIds ?? []);
  const sortedServices = [...resources.services].sort((a, b) => Number(offered.has(b.id)) - Number(offered.has(a.id)));

  function submit(force = false) {
    setConflict(null);
    run(
      () =>
        createStaffAppointment({
          patientId: patient?.id,
          ...(patient ? {} : np),
          serviceId: form.serviceId,
          practitionerId: form.practitionerId,
          locationId: form.locationId,
          roomId: form.roomId || undefined,
          date: form.date,
          time: form.time,
          durationMinutes: Number(form.duration) || undefined,
          internalNote: form.note,
          notifyPatient: form.notify,
          force,
          restrictedAccessReason: needsReason ? reason : undefined,
        }),
      (r) => {
        if (r.ok) onClose();
        else if (r.code === "restricted") setNeedsReason(true);
        else if (r.code && SLOT_CONFLICTS.has(r.code)) setConflict(r.error);
      },
    );
  }

  return (
    <dialog ref={ref} aria-labelledby={titleId} className={DRAWER_DIALOG} {...dialogProps}>
      <form
        className="flex h-full flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          submit(false);
        }}
      >
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <h2 id={titleId} className="text-lg font-bold">
            {t("newAppointment.title")}
          </h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-ink" aria-label={t("drawer.close")}>
            <X size={20} aria-hidden />
          </button>
        </div>
        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          <fieldset>
            <legend className="mb-1.5 text-[13px] font-semibold text-slate-700">{t("newAppointment.patient")}</legend>
            {patient ? (
              <div className="group/pii flex items-center justify-between gap-3 rounded-xl bg-brand-50 p-3 ring-1 ring-brand-200">
                <div className="min-w-0">
                  <PatientSummary
                    hit={patient}
                    nameClassName="font-semibold"
                    badge={
                      isRestrictedHit(patient) ? (
                        <Badge tone="amber">
                          <Lock size={11} aria-hidden /> {t("newAppointment.restrictedHit")}
                        </Badge>
                      ) : null
                    }
                  />
                </div>
                <button
                  type="button"
                  className="shrink-0 text-sm font-semibold text-brand-700 hover:underline"
                  onClick={() => {
                    setPatient(null);
                    setNeedsReason(false);
                  }}
                >
                  {t("newAppointment.change")}
                </button>
              </div>
            ) : newPatient ? (
              <div className="grid grid-cols-2 gap-3 rounded-xl p-3 ring-1 ring-slate-200">
                <Field label={t("newAppointment.firstName")}>
                  <Input autoComplete="off" required value={np.firstName} onChange={(e) => setNp({ ...np, firstName: e.target.value })} />
                </Field>
                <Field label={t("newAppointment.lastName")}>
                  <Input autoComplete="off" required value={np.lastName} onChange={(e) => setNp({ ...np, lastName: e.target.value })} />
                </Field>
                <Field label={t("newAppointment.mobile")}>
                  <Input type="tel" autoComplete="off" value={np.phone} onChange={(e) => setNp({ ...np, phone: e.target.value })} />
                </Field>
                <Field label={t("newAppointment.email")}>
                  <Input type="email" autoComplete="off" value={np.email} onChange={(e) => setNp({ ...np, email: e.target.value })} />
                </Field>
                <button type="button" className="col-span-2 text-left text-sm font-semibold text-slate-600 hover:text-ink" onClick={() => setNewPatient(false)}>
                  {t("newAppointment.backToSearch")}
                </button>
              </div>
            ) : (
              <div>
                <div className="relative">
                  <Search size={16} className="pointer-events-none absolute left-3 top-3 text-slate-500" aria-hidden />
                  <Input
                    data-autofocus
                    type="search"
                    autoComplete="off"
                    className="pl-9"
                    aria-label={t("newAppointment.search")}
                    placeholder={t("newAppointment.searchPlaceholder")}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  {searching ? <LoaderCircle size={16} className="absolute right-3 top-3 animate-spin text-slate-500" aria-hidden /> : null}
                </div>
                <p className="sr-only" role="status">
                  {term.length >= 2 && !searching ? (hits.length ? t("newAppointment.results", { count: hits.length }) : t("newAppointment.noResults")) : ""}
                </p>
                {hits.length ? (
                  <ul className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-xl ring-1 ring-slate-200">
                    {hits.map((h) => (
                      <li key={h.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setPatient(h);
                            // Ask for the reason up front instead of after a refused first attempt.
                            setNeedsReason(isRestrictedHit(h));
                          }}
                          className="group/pii flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-slate-50"
                        >
                          <span className="min-w-0">
                            <PatientSummary hit={h} nameClassName="text-sm font-semibold" />
                          </span>
                          {isRestrictedHit(h) ? (
                            <Badge tone="amber">
                              <Lock size={11} aria-hidden /> {t("newAppointment.restrictedHit")}
                            </Badge>
                          ) : h.noShowCount ? (
                            <Badge tone="red">
                              <UserX size={11} aria-hidden /> {t("newAppointment.noShows", { count: h.noShowCount })}
                            </Badge>
                          ) : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : term.length >= 2 && !searching ? (
                  <p className="mt-2 text-sm text-slate-600">{t("newAppointment.noResults")}</p>
                ) : null}
                <button type="button" className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline" onClick={() => setNewPatient(true)}>
                  <UserPlus size={15} aria-hidden /> {t("newAppointment.newPatient")}
                </button>
              </div>
            )}
          </fieldset>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t("newAppointment.practitioner")} className="col-span-2">
              <Select value={form.practitionerId} onChange={(e) => setForm({ ...form, practitionerId: e.target.value })}>
                {resources.practitioners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("newAppointment.treatment")} className="col-span-2">
              <Select
                value={form.serviceId}
                onChange={(e) =>
                  setForm({
                    ...form,
                    serviceId: e.target.value,
                    duration: String(resources.services.find((s) => s.id === e.target.value)?.durationMinutes ?? form.duration),
                  })
                }
              >
                {sortedServices.map((s) => {
                  const vars = { name: s.name, duration: t("newAppointment.minutes", { count: s.durationMinutes }) };
                  return (
                    <option key={s.id} value={s.id}>
                      {offered.has(s.id) ? t("newAppointment.treatmentOption", vars) : t("newAppointment.treatmentNotOffered", vars)}
                    </option>
                  );
                })}
              </Select>
            </Field>
            <Field label={t("newAppointment.date")}>
              <Input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </Field>
            <Field label={t("newAppointment.time")}>
              <Input type="time" step={300} required value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
            </Field>
            <Field label={t("newAppointment.office")}>
              <Select value={form.locationId} onChange={(e) => setForm({ ...form, locationId: e.target.value, roomId: "" })}>
                {resources.locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("newAppointment.chair")}>
              <Select value={form.roomId} onChange={(e) => setForm({ ...form, roomId: e.target.value })}>
                <option value="">{t("newAppointment.autoChair")}</option>
                {resources.rooms
                  .filter((r) => r.locationId === form.locationId)
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
              </Select>
            </Field>
            <Field label={t("newAppointment.duration")}>
              <Input type="number" min={5} max={480} step={5} value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} />
            </Field>
          </div>
          <Field label={t("newAppointment.internalNote")} hint={t("newAppointment.internalNoteHint")}>
            <Textarea rows={2} maxLength={2000} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </Field>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand-700" checked={form.notify} onChange={(e) => setForm({ ...form, notify: e.target.checked })} />
            {t("newAppointment.notify")}
          </label>
          {needsReason ? (
            <div className="space-y-2 rounded-lg bg-amber-50 p-3 ring-1 ring-amber-200" role="alert">
              <Field label={t("newAppointment.restrictedReason")} hint={t("newAppointment.restrictedReasonHint")}>
                <Textarea rows={2} required minLength={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
              </Field>
            </div>
          ) : null}
          {conflict ? (
            <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950" role="alert">
              {conflict}{" "}
              <button type="button" className="font-semibold underline" onClick={() => submit(true)}>
                {t("newAppointment.bookAnyway")}
              </button>
            </div>
          ) : null}
        </div>
        <div className="border-t border-slate-100 p-5">
          <Button type="submit" className="w-full" disabled={pending || (!patient && !newPatient)}>
            {pending ? <LoaderCircle size={16} className="animate-spin" aria-hidden /> : null}
            {needsReason ? t("newAppointment.bookWithReason") : t("newAppointment.book")}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
