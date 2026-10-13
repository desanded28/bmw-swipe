"use client";

import {
  BellRing,
  CalendarX,
  Check,
  CircleAlert,
  Clock,
  ExternalLink,
  LoaderCircle,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  RefreshCw,
  Stethoscope,
  UserX,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  appointmentMessages,
  approve,
  cancelByStaff,
  clearAttention,
  confirmByPhone,
  moveAppointment,
  recordOutcome,
  remindNow,
  saveInternalNote,
  type ActionResult,
} from "@/app/dashboard/actions";
import type { Message } from "@/db/schema";
import { fmtDay, zonedDate, zonedTime } from "@/lib/datefmt";
import { formatPhone } from "@/lib/phone";
import { Badge, Button, Field, Input, Select, Textarea, cx } from "../ui";
import { useNow } from "../useNow";
import { useToast } from "./Toast";
import type { ApptDTO, Resources } from "./types";

export const localDate = zonedDate;
export const localTime = zonedTime;
export function longDate(iso: string, tz: string) {
  return fmtDay(zonedDate(iso, tz), "medium");
}

export function StatusBadge({ a }: { a: Pick<ApptDTO, "status" | "confirmation" | "confirmedVia" | "needsAttention"> }) {
  if (a.status === "cancelled") return <Badge tone="red">Cancelled</Badge>;
  if (a.status === "requested") return <Badge tone="amber">Request</Badge>;
  if (a.status === "completed") return <Badge tone="slate">Completed</Badge>;
  if (a.status === "no_show") return <Badge tone="red">No-show</Badge>;
  if (a.needsAttention)
    return (
      <Badge tone="red">
        <CircleAlert size={12} /> Needs attention
      </Badge>
    );
  if (a.confirmation === "confirmed")
    return (
      <Badge tone="green">
        <Check size={12} /> Confirmed{a.confirmedVia && a.confirmedVia !== "booking" ? ` · ${a.confirmedVia}` : ""}
      </Badge>
    );
  return (
    <Badge tone="blue">
      <Clock size={12} /> Awaiting confirmation
    </Badge>
  );
}

/** Run a server action with toast feedback and refresh the page data. */
export function useRunAction() {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<ActionResult>, after?: (r: ActionResult) => void) =>
    start(async () => {
      const res = await fn();
      toast.show(res.ok ? { tone: "success", text: res.message ?? "Done." } : { tone: "error", text: res.error });
      if (res.ok) router.refresh();
      after?.(res);
    });
  return { run, pending };
}

export function AppointmentDrawer({ appt, resources, onClose }: { appt: ApptDTO; resources: Resources; onClose: () => void }) {
  const tz = appt.location.timezone;
  const { run, pending } = useRunAction();
  const toast = useToast();
  const [panel, setPanel] = useState<"move" | "cancel" | null>(null);
  const [note, setNote] = useState(appt.internalNote ?? "");
  const [thread, setThread] = useState<Message[] | null>(null);
  const [move, setMove] = useState({
    date: localDate(appt.start, tz),
    time: localTime(appt.start, tz),
    practitionerId: appt.practitioner.id,
    locationId: appt.location.id,
    roomId: appt.room?.id ?? "",
    duration: String(Math.round((Date.parse(appt.end) - Date.parse(appt.start)) / 60000)),
    notify: true,
  });
  const [conflict, setConflict] = useState<string | null>(null);
  const [cancel, setCancel] = useState({ reason: "", notify: true });

  useEffect(() => {
    let alive = true;
    appointmentMessages(appt.id).then((m) => alive && setThread(m));
    return () => {
      alive = false;
    };
  }, [appt.id, appt.confirmation, appt.status]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const now = useNow();
  const upcoming = now !== null && Date.parse(appt.start) > now;
  const started = now !== null && Date.parse(appt.start) <= now;
  const live = appt.status === "scheduled" || appt.status === "requested";

  function submitMove(force = false) {
    setConflict(null);
    startMove(force);
  }
  const startMove = (force: boolean) =>
    run(
      () =>
        moveAppointment({
          id: appt.id,
          date: move.date,
          time: move.time,
          practitionerId: move.practitionerId,
          locationId: move.locationId,
          roomId: move.roomId || null,
          durationMinutes: Number(move.duration) || undefined,
          notifyPatient: move.notify,
          force,
        }),
      (r) => {
        if (r.ok) setPanel(null);
        else if (r.code && r.code !== "not_found") setConflict(r.error);
      },
    );

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30" onClick={onClose}>
      <div
        className="animate-slide-in flex h-full w-full max-w-[460px] flex-col bg-white shadow-pop"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Appointment details"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-5">
          <div className="min-w-0">
            <Link href={`/dashboard/patients/${appt.patient.id}`} className="text-lg font-bold hover:underline">
              {appt.patient.name}
            </Link>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <StatusBadge a={appt} />
              {appt.isNewPatient ? <Badge tone="violet">New patient</Badge> : null}
              {appt.patient.noShowCount > 0 ? (
                <Badge tone="red">
                  <UserX size={12} /> {appt.patient.noShowCount} no-show{appt.patient.noShowCount > 1 ? "s" : ""}
                </Badge>
              ) : null}
              <Badge>{appt.source === "staff" ? "Front desk" : appt.source}</Badge>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-ink" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          <div className="flex flex-wrap gap-2">
            {appt.patient.phone ? (
              <>
                <a href={`tel:${appt.patient.phone}`} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-sm font-semibold hover:bg-slate-200">
                  <Phone size={14} /> {formatPhone(appt.patient.phone)}
                </a>
                <a
                  href={`https://wa.me/${appt.patient.phone.replace("+", "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
                >
                  <MessageCircle size={14} /> WhatsApp
                </a>
              </>
            ) : null}
            {appt.patient.email ? (
              <a href={`mailto:${appt.patient.email}`} className="inline-flex max-w-full items-center gap-1.5 truncate rounded-lg bg-slate-100 px-2.5 py-1.5 text-sm font-semibold hover:bg-slate-200">
                <Mail size={14} /> {appt.patient.email}
              </a>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-4 rounded-xl bg-slate-50 p-4 text-sm">
            <div>
              <p className="text-xs font-semibold text-slate-500">When</p>
              <p className="font-semibold">{longDate(appt.start, tz)}</p>
              <p>
                {localTime(appt.start, tz)} – {localTime(appt.end, tz)}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500">Treatment</p>
              <p className="flex items-center gap-1.5 font-semibold">
                <Stethoscope size={14} /> {appt.service.name}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500">With</p>
              <p className="flex items-center gap-1.5 font-semibold">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: appt.practitioner.color }} />
                {appt.practitioner.name}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500">Where</p>
              <p className="flex items-center gap-1.5 font-semibold">
                <MapPin size={14} /> {appt.location.name}
              </p>
              {appt.room ? <p className="text-slate-500">{appt.room.name}</p> : null}
            </div>
          </div>

          {appt.patientNote ? (
            <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
              <p className="text-xs font-bold uppercase tracking-wide text-amber-700">Patient&apos;s note</p>
              {appt.patientNote}
            </div>
          ) : null}
          {appt.cancelReason ? <p className="text-sm text-slate-500">Cancellation reason: {appt.cancelReason}</p> : null}

          {/* actions */}
          <div className="flex flex-wrap gap-2">
            {appt.status === "requested" ? (
              <Button size="sm" disabled={pending} onClick={() => run(() => approve(appt.id))}>
                <Check size={15} /> Approve request
              </Button>
            ) : null}
            {appt.status === "scheduled" && appt.confirmation === "pending" && upcoming ? (
              <Button size="sm" disabled={pending} onClick={() => run(() => confirmByPhone(appt.id))}>
                <Check size={15} /> Confirmed by phone
              </Button>
            ) : null}
            {appt.needsAttention ? (
              <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => clearAttention(appt.id))}>
                Mark handled
              </Button>
            ) : null}
            {appt.status === "scheduled" && upcoming ? (
              <ReminderMenu disabled={pending} onSend={(c) => run(() => remindNow(appt.id, c))} />
            ) : null}
            {live ? (
              <Button size="sm" variant={panel === "move" ? "subtle" : "secondary"} onClick={() => setPanel(panel === "move" ? null : "move")}>
                <RefreshCw size={15} /> Reschedule
              </Button>
            ) : null}
            {live ? (
              <Button size="sm" variant="danger" onClick={() => setPanel(panel === "cancel" ? null : "cancel")}>
                <CalendarX size={15} /> {appt.status === "requested" ? "Decline" : "Cancel"}
              </Button>
            ) : null}
            {appt.status === "scheduled" && started ? (
              <>
                <Button size="sm" disabled={pending} onClick={() => run(() => recordOutcome(appt.id, "completed"))}>
                  <Check size={15} /> Completed
                </Button>
                <Button size="sm" variant="danger" disabled={pending} onClick={() => run(() => recordOutcome(appt.id, "no_show"))}>
                  <UserX size={15} /> No-show
                </Button>
              </>
            ) : null}
            {appt.status === "completed" || appt.status === "no_show" ? (
              <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => recordOutcome(appt.id, appt.status === "completed" ? "no_show" : "completed"))}>
                Change to {appt.status === "completed" ? "no-show" : "completed"}
              </Button>
            ) : null}
          </div>

          {panel === "move" ? (
            <div className="animate-fade-up space-y-3 rounded-xl p-4 ring-1 ring-slate-200">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Date">
                  <Input type="date" value={move.date} onChange={(e) => setMove({ ...move, date: e.target.value })} />
                </Field>
                <Field label="Time">
                  <Input type="time" step={300} value={move.time} onChange={(e) => setMove({ ...move, time: e.target.value })} />
                </Field>
                <Field label="Practitioner">
                  <Select value={move.practitionerId} onChange={(e) => setMove({ ...move, practitionerId: e.target.value })}>
                    {resources.practitioners.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Office">
                  <Select value={move.locationId} onChange={(e) => setMove({ ...move, locationId: e.target.value, roomId: "" })}>
                    {resources.locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Chair">
                  <Select value={move.roomId} onChange={(e) => setMove({ ...move, roomId: e.target.value })}>
                    <option value="">Auto-assign</option>
                    {resources.rooms
                      .filter((r) => r.locationId === move.locationId)
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                  </Select>
                </Field>
                <Field label="Duration (min)">
                  <Input type="number" min={5} max={480} step={5} value={move.duration} onChange={(e) => setMove({ ...move, duration: e.target.value })} />
                </Field>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="h-4 w-4 accent-brand-700" checked={move.notify} onChange={(e) => setMove({ ...move, notify: e.target.checked })} />
                Notify the patient ({appt.patient.preferredChannel})
              </label>
              {conflict ? (
                <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                  {conflict}
                  <button type="button" className="ml-2 font-semibold underline" onClick={() => submitMove(true)}>
                    Book anyway
                  </button>
                </div>
              ) : null}
              <Button size="sm" disabled={pending} onClick={() => submitMove(false)}>
                {pending ? <LoaderCircle size={15} className="animate-spin" /> : null} Save new time
              </Button>
            </div>
          ) : null}

          {panel === "cancel" ? (
            <div className="animate-fade-up space-y-3 rounded-xl p-4 ring-1 ring-red-200">
              <Textarea placeholder="Reason (internal, optional)" rows={2} value={cancel.reason} onChange={(e) => setCancel({ ...cancel, reason: e.target.value })} />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="h-4 w-4 accent-brand-700" checked={cancel.notify} onChange={(e) => setCancel({ ...cancel, notify: e.target.checked })} />
                Tell the patient and offer a new booking link
              </label>
              <Button
                size="sm"
                variant="danger"
                disabled={pending}
                onClick={() =>
                  run(
                    () => cancelByStaff(appt.id, cancel.reason, cancel.notify),
                    (r) => r.ok && onClose(),
                  )
                }
              >
                Cancel appointment
              </Button>
            </div>
          ) : null}

          <div>
            <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">Internal note</p>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Only visible to the team" />
            {note !== (appt.internalNote ?? "") ? (
              <Button size="sm" variant="secondary" className="mt-2" disabled={pending} onClick={() => run(() => saveInternalNote(appt.id, note))}>
                Save note
              </Button>
            ) : null}
          </div>

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Messages</p>
            {thread === null ? (
              <LoaderCircle size={16} className="animate-spin text-slate-400" />
            ) : thread.length === 0 ? (
              <p className="text-sm text-slate-500">No messages yet.</p>
            ) : (
              <div className="space-y-2">
                {thread.map((m) => (
                  <div key={m.id} className={cx("flex", m.direction === "inbound" ? "justify-start" : "justify-end")}>
                    <div
                      className={cx(
                        "max-w-[88%] rounded-2xl px-3 py-2 text-[13px] [overflow-wrap:anywhere]",
                        m.direction === "inbound" ? "rounded-bl-sm bg-slate-100" : "rounded-br-sm bg-brand-50 text-brand-950 ring-1 ring-brand-100",
                      )}
                    >
                      <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        {m.channel} · {m.direction === "inbound" ? `reply${m.intent ? ` → ${m.intent}` : ""}` : m.status} ·{" "}
                        {fmtDay(zonedDate(new Date(m.createdAt), tz), "short")} {zonedTime(new Date(m.createdAt), tz)}
                      </p>
                      {m.subject ? <p className="font-semibold">{m.subject}</p> : <p className="whitespace-pre-line">{m.body}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <a href={`/a/${appt.manageToken}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-ink">
            <ExternalLink size={13} /> Patient&apos;s self-service page
          </a>
          <button
            type="button"
            className="ml-4 text-xs font-semibold text-slate-500 hover:text-ink"
            onClick={() => {
              navigator.clipboard?.writeText(`${window.location.origin}/a/${appt.manageToken}`);
              toast.show({ tone: "success", text: "Link copied." });
            }}
          >
            Copy link
          </button>
        </div>
      </div>
    </div>
  );
}

function ReminderMenu({ onSend, disabled }: { onSend: (c: "sms" | "whatsapp" | "email") => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <Button size="sm" variant="secondary" disabled={disabled} onClick={() => setOpen(!open)}>
        <BellRing size={15} /> Send reminder
      </Button>
      {open ? (
        <div className="absolute left-0 top-9 z-10 w-40 overflow-hidden rounded-xl bg-white py-1 shadow-pop ring-1 ring-slate-200">
          {(["sms", "whatsapp", "email"] as const).map((c) => (
            <button
              key={c}
              type="button"
              className="block w-full px-3 py-2 text-left text-sm font-medium hover:bg-slate-50"
              onClick={() => {
                setOpen(false);
                onSend(c);
              }}
            >
              {c === "sms" ? "SMS" : c === "whatsapp" ? "WhatsApp" : "Email"}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
