"use client";

import { LoaderCircle, Search, UserPlus, UserX, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createStaffAppointment, searchPatients } from "@/app/dashboard/actions";
import { formatPhone } from "@/lib/phone";
import { Badge, Button, Field, Input, Select, Textarea, cx } from "../ui";
import { useRunAction } from "./AppointmentDrawer";
import type { Resources } from "./types";

type PatientHit = Awaited<ReturnType<typeof searchPatients>>[number];

export type NewAppointmentDefaults = {
  date: string;
  time: string;
  practitionerId?: string;
  locationId?: string;
  roomId?: string;
};

export function NewAppointmentDrawer({
  resources,
  defaults,
  onClose,
}: {
  resources: Resources;
  defaults: NewAppointmentDefaults;
  onClose: () => void;
}) {
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

  useEffect(() => {
    if (term.length < 2) return;
    let alive = true;
    const t = setTimeout(() => {
      searchPatients(term).then((found) => alive && setResults({ q: term, hits: found }));
    }, 200);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [term]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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
        }),
      (r) => {
        if (r.ok) onClose();
        else if (r.code && !["not_found", "invalid"].includes(r.code)) setConflict(r.error);
      },
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30" onClick={onClose}>
      <div className="animate-slide-in flex h-full w-full max-w-[460px] flex-col bg-white shadow-pop" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="New appointment">
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <h2 className="text-lg font-bold">New appointment</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-ink" aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          <div>
            <p className="mb-1.5 text-[13px] font-semibold text-slate-700">Patient</p>
            {patient ? (
              <div className="flex items-center justify-between rounded-xl bg-brand-50 p-3 ring-1 ring-brand-200">
                <div>
                  <p className="font-semibold">
                    {patient.firstName} {patient.lastName}
                  </p>
                  <p className="text-xs text-slate-600">{[formatPhone(patient.phone), patient.email].filter(Boolean).join(" · ")}</p>
                </div>
                <button type="button" className="text-sm font-semibold text-brand-700" onClick={() => setPatient(null)}>
                  Change
                </button>
              </div>
            ) : newPatient ? (
              <div className="grid grid-cols-2 gap-3 rounded-xl p-3 ring-1 ring-slate-200">
                <Input placeholder="First name" value={np.firstName} onChange={(e) => setNp({ ...np, firstName: e.target.value })} />
                <Input placeholder="Last name" value={np.lastName} onChange={(e) => setNp({ ...np, lastName: e.target.value })} />
                <Input placeholder="Mobile" type="tel" value={np.phone} onChange={(e) => setNp({ ...np, phone: e.target.value })} />
                <Input placeholder="Email" type="email" value={np.email} onChange={(e) => setNp({ ...np, email: e.target.value })} />
                <button type="button" className="col-span-2 text-left text-sm font-semibold text-slate-500 hover:text-ink" onClick={() => setNewPatient(false)}>
                  ← Search existing patients
                </button>
              </div>
            ) : (
              <div>
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-3 text-slate-400" />
                  <Input autoFocus className="pl-9" placeholder="Search by name, phone or email" value={query} onChange={(e) => setQuery(e.target.value)} />
                  {searching ? <LoaderCircle size={16} className="absolute right-3 top-3 animate-spin text-slate-400" /> : null}
                </div>
                {hits.length ? (
                  <div className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-xl ring-1 ring-slate-200">
                    {hits.map((h) => (
                      <button key={h.id} type="button" onClick={() => setPatient(h)} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-slate-50">
                        <span>
                          <span className="block text-sm font-semibold">
                            {h.firstName} {h.lastName}
                          </span>
                          <span className="text-xs text-slate-500">{[formatPhone(h.phone), h.email].filter(Boolean).join(" · ")}</span>
                        </span>
                        {h.noShowCount ? (
                          <Badge tone="red">
                            <UserX size={11} /> {h.noShowCount}
                          </Badge>
                        ) : null}
                      </button>
                    ))}
                  </div>
                ) : null}
                <button type="button" className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700" onClick={() => setNewPatient(true)}>
                  <UserPlus size={15} /> New patient
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Practitioner" className="col-span-2">
              <Select value={form.practitionerId} onChange={(e) => setForm({ ...form, practitionerId: e.target.value })}>
                {resources.practitioners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Treatment" className="col-span-2">
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
                {sortedServices.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.durationMinutes} min){offered.has(s.id) ? "" : " — not usually offered"}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Date">
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </Field>
            <Field label="Time">
              <Input type="time" step={300} value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
            </Field>
            <Field label="Office">
              <Select value={form.locationId} onChange={(e) => setForm({ ...form, locationId: e.target.value, roomId: "" })}>
                {resources.locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Chair">
              <Select value={form.roomId} onChange={(e) => setForm({ ...form, roomId: e.target.value })}>
                <option value="">Auto-assign</option>
                {resources.rooms
                  .filter((r) => r.locationId === form.locationId)
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
              </Select>
            </Field>
            <Field label="Duration (min)">
              <Input type="number" min={5} max={480} step={5} value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} />
            </Field>
          </div>
          <Field label="Internal note">
            <Textarea rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-brand-700" checked={form.notify} onChange={(e) => setForm({ ...form, notify: e.target.checked })} />
            Send the patient a confirmation (reminders are always scheduled)
          </label>
          {conflict ? (
            <div className={cx("rounded-lg bg-amber-50 p-3 text-sm text-amber-900")}>
              {conflict}
              <button type="button" className="ml-2 font-semibold underline" onClick={() => submit(true)}>
                Book anyway
              </button>
            </div>
          ) : null}
        </div>
        <div className="border-t border-slate-100 p-5">
          <Button className="w-full" disabled={pending || (!patient && !newPatient)} onClick={() => submit(false)}>
            {pending ? <LoaderCircle size={16} className="animate-spin" /> : null} Book appointment
          </Button>
        </div>
      </div>
    </div>
  );
}
