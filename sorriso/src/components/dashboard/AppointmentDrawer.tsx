"use client";

import {
  Ban,
  BellRing,
  CalendarX,
  Check,
  CircleAlert,
  Clock,
  Copy,
  ExternalLink,
  Hourglass,
  LoaderCircle,
  Lock,
  Mail,
  MapPin,
  MessageCircle,
  MoveRight,
  Phone,
  Stethoscope,
  UserRound,
  UserX,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import {
  approve,
  cancelByStaff,
  clearAttention,
  confirmByPhone,
  getAppointmentDetail,
  moveAppointment,
  openRestrictedAppointment,
  recordOutcome,
  remindNow,
  saveInternalNote,
} from "@/app/dashboard/actions/appointments";
import { issuePatientLink } from "@/app/dashboard/actions/links";
import { CHANNELS, type Channel } from "@/db/enums";
import { fmtDay, fmtWhen, zonedDate, zonedTime } from "@/i18n/datefmt";
import { useLocale, useT } from "@/i18n/provider";
import { formatPhone } from "@/lib/phone";
import { Badge, Button, Field, Input, Select, Textarea, cx } from "../ui";
import { useNow } from "../useNow";
import { DRAWER_DIALOG, useModalDialog } from "./modal";
import { Pii } from "./PrivacyScreen";
import { AppointmentCarePanel } from "./slots/AppointmentCarePanel";
import { useToast } from "./Toast";
import { toCareAppointment, type ApptDetailDTO, type ApptListDTO, type RestrictedAccess, type Resources, type ThreadMessage } from "./types";
import { useRunAction } from "./useRunAction";

export const localDate = zonedDate;
export const localTime = zonedTime;

// ---------------------------------------------------------------- status

type StatusFields = Pick<ApptListDTO, "status" | "confirmation" | "confirmedVia" | "needsAttention">;
type StatusKind = "cancelled" | "requested" | "completed" | "no_show" | "attention" | "confirmed" | "declined" | "pending";

function statusKind(a: StatusFields): StatusKind {
  if (a.status === "cancelled" || a.status === "requested" || a.status === "completed" || a.status === "no_show") return a.status;
  if (a.needsAttention) return "attention";
  if (a.confirmation === "confirmed") return "confirmed";
  if (a.confirmation === "declined") return "declined";
  return "pending";
}

/** The localised status of an appointment ("Confirmed (SMS)", "Awaiting confirmation"...). */
export function useStatusLabel() {
  const t = useT("calendar");
  const tc = useT("common");
  return (a: StatusFields): string => {
    const kind = statusKind(a);
    switch (kind) {
      case "cancelled":
      case "requested":
      case "completed":
      case "no_show":
        return tc(`appointmentStatus.${kind}`);
      case "attention":
        return t("status.needsAttention");
      case "declined":
      case "pending":
        return tc(`confirmationStatus.${kind}`);
      case "confirmed": {
        const status = tc("confirmationStatus.confirmed");
        const via = a.confirmedVia;
        if (!via || via === "booking") return status;
        const channel = (CHANNELS as readonly string[]).includes(via) ? tc(`channels.${via as Channel}`) : null;
        const label = channel ?? (via === "web" || via === "staff" ? t(`via.${via}`) : null);
        return label ? t("status.confirmedVia", { status, via: label }) : status;
      }
    }
  };
}

/** One word for the status, shown on events too short for the full label ("Confirmed", "Request"...). */
export function useShortStatusLabel() {
  const t = useT("calendar");
  return (a: StatusFields): string => t(`event.statusShort.${statusKind(a)}`);
}

/** The status icon (shape differs per status, so it never relies on colour alone). */
export function StatusIcon({ a, size = 12, className }: { a: StatusFields; size?: number; className?: string }) {
  const kind = statusKind(a);
  const cls = (tone: string) => cx("shrink-0", tone, className);
  if (kind === "attention") return <CircleAlert size={size} className={cls("text-red-600")} aria-hidden />;
  if (kind === "requested") return <Hourglass size={size} className={cls("text-amber-700")} aria-hidden />;
  if (kind === "no_show") return <UserX size={size} className={cls("text-red-600")} aria-hidden />;
  if (kind === "cancelled" || kind === "declined") return <Ban size={size} className={cls("text-slate-500")} aria-hidden />;
  if (kind === "confirmed" || kind === "completed") return <Check size={size} className={cls("text-emerald-700")} aria-hidden />;
  return <Clock size={size} className={cls("text-slate-500")} aria-hidden />;
}

const TONES: Record<StatusKind, "red" | "amber" | "slate" | "green" | "blue"> = {
  cancelled: "red",
  requested: "amber",
  completed: "slate",
  no_show: "red",
  attention: "red",
  confirmed: "green",
  declined: "slate",
  pending: "blue",
};

export function StatusBadge({ a }: { a: StatusFields }) {
  const label = useStatusLabel();
  return (
    <Badge tone={TONES[statusKind(a)]}>
      <StatusIcon a={a} />
      {label(a)}
    </Badge>
  );
}

// ---------------------------------------------------------------- the drawer

type Panel = "move" | "cancel" | null;

/**
 * The appointment drawer. It opens with what the list already has (time, treatment, status) and
 * loads the rest with getAppointmentDetail(): contacts, notes and messages, each only when the
 * viewer's role allows it, and audited on the server. A restricted patient's record asks for a
 * reason first.
 */
export function AppointmentDrawer({
  appt,
  resources,
  onClose,
  initialPanel = null,
}: {
  appt: ApptListDTO;
  resources: Resources;
  onClose: () => void;
  /** "move" opens the drawer on the reschedule form (Shift+Enter on a calendar event). */
  initialPanel?: Panel;
}) {
  const t = useT("calendar");
  const tc = useT("common");
  const locale = useLocale();
  const statusLabel = useStatusLabel();
  const titleId = useId();
  const { ref, props: dialogProps } = useModalDialog(onClose, { fallbackSelector: `[data-appt-id="${appt.id}"]` });
  const tz = appt.location.timezone;
  const { run, pending } = useRunAction();
  const toast = useToast();
  const [detail, setDetail] = useState<ApptDetailDTO | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>(initialPanel);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  // One request (and so one audit row) per opening or explicit reload: React's development
  // double-run of effects must not read the record twice. Late answers for an older key are dropped.
  const requested = useRef<string | null>(null);
  useEffect(() => {
    const key = `${appt.id}:${reload}`;
    if (requested.current === key) return;
    requested.current = key;
    getAppointmentDetail(appt.id).then(
      (res) => {
        if (requested.current !== key) return;
        if (res.ok) {
          setDetail(res.data);
          setSavedNote(res.data.internalNote ?? "");
          setLoadError(null);
        } else setLoadError(res.error);
      },
      () => requested.current === key && setLoadError(t("errors.loadFailed")),
    );
  }, [appt.id, reload, t]);

  const now = useNow();
  const upcoming = now !== null && Date.parse(appt.start) > now;
  const started = now !== null && Date.parse(appt.start) <= now;
  const live = appt.status === "scheduled" || appt.status === "requested";
  const canWrite = detail?.access.write ?? true;
  // Until the server answers, a restricted record is "loading" (the list row can't tell whether a
  // reason was given recently) and an unrestricted one "open"; only the detail unlocks patient data.
  const restricted: RestrictedAccess | "loading" =
    detail?.access.restricted ?? (appt.restricted ? (appt.patient.masked ? "placeholder" : "loading") : "open");
  /** The server said the record is open: the care panel, reminders and patient links may load. */
  const unlocked = detail?.access.restricted === "open";
  const noteValue = note ?? savedNote ?? "";
  const channelName = tc(`channels.${appt.patient.preferredChannel}`);
  const care = toCareAppointment(appt);
  const sourceKey = `source.${appt.source}` as const;

  async function submitReason(e: FormEvent) {
    e.preventDefault();
    setReasonError(null);
    const res = await openRestrictedAppointment(appt.id, reason);
    if (res.ok) {
      setDetail(res.data);
      setSavedNote(res.data.internalNote ?? "");
    } else setReasonError(res.error);
  }

  async function patientLink(mode: "open" | "copy") {
    const res = await issuePatientLink(appt.id);
    if (!res.ok) return toast.show({ tone: "error", text: res.error });
    const url = (res.data as { url: string }).url;
    if (mode === "open") window.open(url, "_blank", "noopener,noreferrer");
    else {
      try {
        await navigator.clipboard.writeText(url);
        toast.show({ tone: "success", text: t("drawer.linkCopied") });
      } catch {
        toast.show({ tone: "error", text: t("drawer.linkNotCopied") });
      }
    }
  }

  return (
    <dialog ref={ref} aria-labelledby={titleId} className={DRAWER_DIALOG} {...dialogProps}>
      <div className="flex h-full flex-col">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-5">
          <div className="group/pii min-w-0">
            <h2 id={titleId} className="truncate text-lg font-bold">
              <Pii>{appt.patient.name}</Pii>
            </h2>
            <p className="text-sm text-slate-600">
              {t("drawer.timeRange", { start: localTime(appt.start, tz), end: localTime(appt.end, tz) })}
              {" · "}
              {appt.service.name}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {live && canWrite ? (
              <Button size="sm" variant={panel === "move" ? "subtle" : "secondary"} aria-expanded={panel === "move"} onClick={() => setPanel(panel === "move" ? null : "move")}>
                <MoveRight size={15} aria-hidden /> {t("drawer.move")}
              </Button>
            ) : null}
            <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-ink" aria-label={t("drawer.close")}>
              <X size={20} aria-hidden />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          <div className="flex flex-wrap gap-1.5">
            <StatusBadge a={appt} />
            {appt.isNewPatient ? <Badge tone="violet">{t("drawer.newPatient")}</Badge> : null}
            {appt.patient.noShowCount > 0 ? (
              <Badge tone="red">
                <UserX size={12} aria-hidden /> {t("drawer.noShows", { count: appt.patient.noShowCount })}
              </Badge>
            ) : null}
            <Badge>{t.has(sourceKey) ? t(sourceKey) : appt.source}</Badge>
            {appt.processingContext === "marketplace" ? <Badge tone="brand">{t("drawer.marketplace")}</Badge> : null}
          </div>

          {restricted === "placeholder" || restricted === "needs_reason" ? (
            <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-950 ring-1 ring-amber-200">
              <p className="flex items-center gap-2 font-semibold">
                <Lock size={15} aria-hidden /> {t("drawer.restricted.title")}
              </p>
              <p className="mt-1">{t("drawer.restricted.body")}</p>
              {restricted === "needs_reason" ? (
                <form onSubmit={submitReason} className="mt-3 space-y-2">
                  <Field label={t("drawer.restricted.reasonTitle")} hint={t("drawer.restricted.reasonHint")} error={reasonError}>
                    <Textarea rows={2} required minLength={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
                  </Field>
                  <Button size="sm" type="submit">
                    {t("drawer.restricted.open")}
                  </Button>
                </form>
              ) : null}
            </div>
          ) : null}

          {restricted === "open" || restricted === "loading" ? (
            <section aria-label={t("drawer.contacts")} className="space-y-2">
              {!detail && !loadError ? (
                <p className="flex items-center gap-2 text-sm text-slate-500" role="status">
                  <LoaderCircle size={15} className="animate-spin" aria-hidden /> {t("drawer.loading")}
                </p>
              ) : null}
              {loadError ? (
                <p className="flex flex-wrap items-center gap-2 text-sm text-red-700" role="alert">
                  {loadError}
                  <button type="button" className="font-semibold underline" onClick={() => setReload((n) => n + 1)}>
                    {t("drawer.retry")}
                  </button>
                </p>
              ) : null}
              {detail?.contacts ? <Contacts c={detail.contacts} /> : null}
              {detail && !detail.access.contacts ? <p className="text-sm text-slate-500">{t("drawer.contactsHidden")}</p> : null}
              {detail ? (
                <Link
                  href={`/dashboard/patients/${appt.patient.id}`}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline"
                >
                  <UserRound size={14} aria-hidden /> {t("drawer.patientRecord")}
                </Link>
              ) : null}
            </section>
          ) : null}

          <dl className="grid grid-cols-2 gap-4 rounded-xl bg-slate-50 p-4 text-sm">
            <div>
              <dt className="text-xs font-semibold text-slate-600">{t("drawer.when")}</dt>
              <dd className="font-semibold">{fmtDay(zonedDate(appt.start, tz), "medium", locale)}</dd>
              <dd>{t("drawer.timeRange", { start: localTime(appt.start, tz), end: localTime(appt.end, tz) })}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-slate-600">{t("drawer.treatment")}</dt>
              <dd className="flex items-center gap-1.5 font-semibold">
                <Stethoscope size={14} aria-hidden /> {appt.service.name}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-slate-600">{t("drawer.with")}</dt>
              <dd className="flex items-center gap-1.5 font-semibold">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: appt.practitioner.color }} aria-hidden />
                {appt.practitioner.name}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-slate-600">{t("drawer.where")}</dt>
              <dd className="flex items-center gap-1.5 font-semibold">
                <MapPin size={14} aria-hidden /> {appt.location.name}
              </dd>
              {appt.room ? <dd className="text-slate-600">{appt.room.name}</dd> : null}
            </div>
          </dl>

          {detail?.patientNote ? (
            <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950 ring-1 ring-amber-200">
              <p className="text-xs font-bold uppercase tracking-wide text-amber-800">{t("drawer.patientNote")}</p>
              <p className="whitespace-pre-line [overflow-wrap:anywhere]">{detail.patientNote}</p>
            </div>
          ) : null}
          {detail?.cancelReason ? (
            <p className="text-sm text-slate-600">
              <span className="font-semibold">{t("drawer.cancelReason")}</span> {detail.cancelReason}
            </p>
          ) : null}

          {unlocked ? <AppointmentCarePanel appt={care} canManage={detail.access.manageCare} /> : null}

          {canWrite ? (
            <section aria-label={t("drawer.actions")} className="flex flex-wrap gap-2">
              {appt.status === "requested" ? (
                <Button size="sm" disabled={pending} onClick={() => run(() => approve(appt.id))}>
                  <Check size={15} aria-hidden /> {t("drawer.approve")}
                </Button>
              ) : null}
              {appt.status === "scheduled" && appt.confirmation === "pending" && upcoming ? (
                <Button size="sm" disabled={pending} onClick={() => run(() => confirmByPhone(appt.id))}>
                  <Check size={15} aria-hidden /> {t("drawer.confirmByPhone")}
                </Button>
              ) : null}
              {appt.needsAttention ? (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={pending}
                  onClick={() => {
                    // Clearing the flag also withdraws an open rebooking offer: the patient's link stops offering times.
                    if (detail?.rebookOfferSent && !window.confirm(t("drawer.markHandledRebookConfirm"))) return;
                    run(() => clearAttention(appt.id));
                  }}
                >
                  {t("drawer.markHandled")}
                </Button>
              ) : null}
              {live ? (
                <Button size="sm" variant="danger" aria-expanded={panel === "cancel"} onClick={() => setPanel(panel === "cancel" ? null : "cancel")}>
                  <CalendarX size={15} aria-hidden /> {appt.status === "requested" ? t("drawer.decline") : t("drawer.cancel")}
                </Button>
              ) : null}
              {appt.status === "scheduled" && started ? (
                <>
                  <Button size="sm" disabled={pending} onClick={() => run(() => recordOutcome(appt.id, "completed"))}>
                    <Check size={15} aria-hidden /> {t("drawer.completed")}
                  </Button>
                  <Button size="sm" variant="danger" disabled={pending} onClick={() => run(() => recordOutcome(appt.id, "no_show"))}>
                    <UserX size={15} aria-hidden /> {t("drawer.noShow")}
                  </Button>
                </>
              ) : null}
              {appt.status === "completed" || appt.status === "no_show" ? (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={pending}
                  onClick={() => run(() => recordOutcome(appt.id, appt.status === "completed" ? "no_show" : "completed"))}
                >
                  {appt.status === "completed" ? t("drawer.changeToNoShow") : t("drawer.changeToCompleted")}
                </Button>
              ) : null}
              {/* No messages go to a restricted or erased patient at all (the reminder engine skips them). */}
              {appt.status === "scheduled" && upcoming && unlocked && !appt.restricted ? (
                <div role="group" aria-label={t("drawer.sendReminder")} className="flex flex-wrap items-center gap-1.5">
                  <span className="flex items-center gap-1 text-xs font-semibold text-slate-600">
                    <BellRing size={14} aria-hidden /> {t("drawer.sendReminder")}
                  </span>
                  {CHANNELS.map((c) => (
                    <Button
                      key={c}
                      size="sm"
                      variant="secondary"
                      disabled={pending}
                      aria-label={t("drawer.reminderVia", { channel: tc(`channels.${c}`) })}
                      onClick={() => run(() => remindNow(appt.id, c), (r) => r.ok && setReload((n) => n + 1))}
                    >
                      {tc(`channels.${c}`)}
                    </Button>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}

          {panel === "move" && live && canWrite ? (
            <MovePanel appt={appt} resources={resources} channelName={channelName} onDone={() => setPanel(null)} />
          ) : null}

          {panel === "cancel" && live && canWrite ? (
            <CancelPanel appt={appt} onDone={onClose} />
          ) : null}

          {detail?.access.notes ? (
            <div>
              <Field label={t("drawer.internalNote")} hint={t("drawer.internalNoteHint")}>
                <Textarea rows={2} value={noteValue} readOnly={!detail.access.writeNotes} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
              </Field>
              {detail.access.writeNotes && noteValue !== (savedNote ?? "") ? (
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-2"
                  disabled={pending}
                  onClick={() =>
                    run(
                      () => saveInternalNote(appt.id, noteValue),
                      (r) => {
                        if (r.ok) {
                          setSavedNote(noteValue.trim());
                          setNote(noteValue.trim());
                        }
                      },
                    )
                  }
                >
                  {t("drawer.saveNote")}
                </Button>
              ) : null}
            </div>
          ) : detail && restricted === "open" ? (
            <p className="text-sm text-slate-500">{t("drawer.notesHidden")}</p>
          ) : null}

          {detail?.messages ? (
            <MessageThread messages={detail.messages} tz={tz} headingId={`${titleId}-messages`} />
          ) : detail && restricted === "open" ? (
            <p className="text-sm text-slate-500">{t("drawer.messagesHidden")}</p>
          ) : null}

          {canWrite && unlocked && appt.status !== "cancelled" ? (
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              <button type="button" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-ink" onClick={() => patientLink("open")}>
                <ExternalLink size={13} aria-hidden /> {t("drawer.patientPage")}
              </button>
              <button type="button" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-ink" onClick={() => patientLink("copy")}>
                <Copy size={13} aria-hidden /> {t("drawer.copyLink")}
              </button>
            </div>
          ) : null}
          <p className="sr-only" aria-live="polite">
            {statusLabel(appt)}
          </p>
        </div>
      </div>
    </dialog>
  );
}

function Contacts({ c }: { c: NonNullable<ApptDetailDTO["contacts"]> }) {
  const t = useT("calendar");
  const relationKey = `drawer.guardianRelation.${c.guardian?.relation ?? ""}` as const;
  const chip = "inline-flex max-w-full items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-sm font-semibold hover:bg-slate-200";
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {c.phone ? (
          <a href={`tel:${c.phone}`} className={chip} aria-label={t("drawer.call", { phone: formatPhone(c.phone) })}>
            <Phone size={14} aria-hidden /> {formatPhone(c.phone)}
          </a>
        ) : null}
        {c.whatsappUrl ? (
          <a
            href={c.whatsappUrl}
            target="_blank"
            rel="noreferrer noopener"
            title={t("drawer.whatsappHint")}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-sm font-semibold text-emerald-900 hover:bg-emerald-100"
          >
            <MessageCircle size={14} aria-hidden /> {t("drawer.whatsapp")}
          </a>
        ) : null}
        {c.email ? (
          <a href={`mailto:${c.email}`} className={cx(chip, "truncate")} aria-label={t("drawer.emailTo", { email: c.email })}>
            <Mail size={14} aria-hidden /> {c.email}
          </a>
        ) : null}
      </div>
      {c.guardian ? (
        <div className="rounded-lg bg-slate-50 p-3 text-sm ring-1 ring-slate-200">
          <p className="text-xs font-semibold text-slate-600">
            {t.has(relationKey) ? t(relationKey) : t("drawer.guardian")}
          </p>
          {c.guardian.name ? <p className="font-semibold">{c.guardian.name}</p> : null}
          <p className="flex flex-wrap gap-x-3">
            {c.guardian.phone ? <a href={`tel:${c.guardian.phone}`} className="font-semibold text-brand-700 hover:underline">{formatPhone(c.guardian.phone)}</a> : null}
            {c.guardian.email ? <a href={`mailto:${c.guardian.email}`} className="font-semibold text-brand-700 hover:underline">{c.guardian.email}</a> : null}
          </p>
        </div>
      ) : null}
    </div>
  );
}

/**
 * The appointment's messages, oldest first. Personal patient links in the texts arrive already
 * replaced by a placeholder (loadAppointmentDetail); times use the staff locale's date pattern.
 */
export function MessageThread({ messages, tz, headingId }: { messages: ThreadMessage[]; tz: string; headingId: string }) {
  const t = useT("calendar");
  const tc = useT("common");
  const locale = useLocale();
  return (
    <section aria-labelledby={headingId}>
      <h3 id={headingId} className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-600">
        {t("drawer.messages")}
      </h3>
      {messages.length === 0 ? (
        <p className="text-sm text-slate-500">{t("drawer.noMessages")}</p>
      ) : (
        <ol className="space-y-2">
          {messages.map((m) => {
            const when = fmtWhen(m.createdAt, tz, locale, "short");
            const channel = tc(`channels.${m.channel}`);
            const statusKey = `drawer.messageStatus.${m.status}` as const;
            const meta =
              m.direction === "inbound"
                ? m.intent
                  ? t("drawer.replyIntentMeta", { channel, intent: t(`drawer.intents.${m.intent}`), when })
                  : t("drawer.replyMeta", { channel, when })
                : t("drawer.messageMeta", {
                    channel,
                    status: t.has(statusKey) ? t(statusKey) : m.status,
                    when,
                  });
            return (
              <li key={m.id} className={cx("flex", m.direction === "inbound" ? "justify-start" : "justify-end")}>
                <div
                  className={cx(
                    "max-w-[88%] rounded-2xl px-3 py-2 text-[13px] [overflow-wrap:anywhere]",
                    m.direction === "inbound" ? "rounded-bl-sm bg-slate-100" : "rounded-br-sm bg-brand-50 text-brand-950 ring-1 ring-brand-100",
                  )}
                >
                  <p className="mb-0.5 text-[11px] font-semibold text-slate-600">{meta}</p>
                  {m.subject ? <p className="font-semibold">{m.subject}</p> : <p className="whitespace-pre-line">{m.body}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function MovePanel({ appt, resources, channelName, onDone }: { appt: ApptListDTO; resources: Resources; channelName: string; onDone: () => void }) {
  const t = useT("calendar");
  const tz = appt.location.timezone;
  const { run, pending } = useRunAction();
  const first = useRef<HTMLInputElement>(null);
  const [conflict, setConflict] = useState<string | null>(null);
  const [move, setMove] = useState(() => ({
    date: localDate(appt.start, tz),
    time: localTime(appt.start, tz),
    practitionerId: appt.practitioner.id,
    locationId: appt.location.id,
    roomId: appt.room?.id ?? "",
    duration: String(Math.round((Date.parse(appt.end) - Date.parse(appt.start)) / 60000)),
    notify: true,
  }));

  useEffect(() => {
    first.current?.focus();
  }, []);

  function submit(force: boolean) {
    setConflict(null);
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
        if (r.ok) onDone();
        else if (r.code && SLOT_CONFLICTS.has(r.code)) setConflict(r.error);
      },
    );
  }

  return (
    <form
      className="animate-fade-up space-y-3 rounded-xl p-4 ring-1 ring-slate-200"
      aria-label={t("drawer.movePanel.title")}
      onSubmit={(e) => {
        e.preventDefault();
        submit(false);
      }}
    >
      <p className="text-sm font-bold">{t("drawer.movePanel.title")}</p>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("drawer.movePanel.date")}>
          <Input ref={first} data-autofocus type="date" required value={move.date} onChange={(e) => setMove({ ...move, date: e.target.value })} />
        </Field>
        <Field label={t("drawer.movePanel.time")}>
          <Input type="time" step={300} required value={move.time} onChange={(e) => setMove({ ...move, time: e.target.value })} />
        </Field>
        <Field label={t("drawer.movePanel.practitioner")}>
          <Select value={move.practitionerId} onChange={(e) => setMove({ ...move, practitionerId: e.target.value })}>
            {resources.practitioners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("drawer.movePanel.office")}>
          <Select value={move.locationId} onChange={(e) => setMove({ ...move, locationId: e.target.value, roomId: "" })}>
            {resources.locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("drawer.movePanel.chair")}>
          <Select value={move.roomId} onChange={(e) => setMove({ ...move, roomId: e.target.value })}>
            <option value="">{t("drawer.movePanel.autoChair")}</option>
            {resources.rooms
              .filter((r) => r.locationId === move.locationId)
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
          </Select>
        </Field>
        <Field label={t("drawer.movePanel.duration")}>
          <Input type="number" min={5} max={480} step={5} value={move.duration} onChange={(e) => setMove({ ...move, duration: e.target.value })} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="h-4 w-4 accent-brand-700" checked={move.notify} onChange={(e) => setMove({ ...move, notify: e.target.checked })} />
        {t("drawer.movePanel.notify", { channel: channelName })}
      </label>
      {conflict ? (
        <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950" role="alert">
          {conflict}{" "}
          <button type="button" className="font-semibold underline" onClick={() => submit(true)}>
            {t("drawer.movePanel.moveAnyway")}
          </button>
        </div>
      ) : null}
      <Button size="sm" type="submit" disabled={pending}>
        {pending ? <LoaderCircle size={15} className="animate-spin" aria-hidden /> : null} {t("drawer.movePanel.save")}
      </Button>
    </form>
  );
}

/** Slot rejections staff may override ("book anyway"): the server allows them with force. */
export const SLOT_CONFLICTS = new Set(["practitioner_busy", "time_off", "no_room", "not_offered", "outside_hours"]);

function CancelPanel({ appt, onDone }: { appt: ApptListDTO; onDone: () => void }) {
  const t = useT("calendar");
  const { run, pending } = useRunAction();
  const [cancel, setCancel] = useState({ reason: "", notify: true });
  const request = appt.status === "requested";
  return (
    <form
      className="animate-fade-up space-y-3 rounded-xl p-4 ring-1 ring-red-200"
      aria-label={request ? t("drawer.cancelPanel.declineTitle") : t("drawer.cancelPanel.title")}
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () => cancelByStaff(appt.id, cancel.reason, cancel.notify),
          (r) => r.ok && onDone(),
        );
      }}
    >
      <Field label={t("drawer.cancelPanel.reason")} hint={t("drawer.cancelPanel.reasonHint")}>
        <Textarea rows={2} maxLength={500} value={cancel.reason} onChange={(e) => setCancel({ ...cancel, reason: e.target.value })} />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="h-4 w-4 accent-brand-700" checked={cancel.notify} onChange={(e) => setCancel({ ...cancel, notify: e.target.checked })} />
        {t("drawer.cancelPanel.notify")}
      </label>
      <Button size="sm" variant="danger" type="submit" disabled={pending}>
        {request ? t("drawer.cancelPanel.confirmDecline") : t("drawer.cancelPanel.confirm")}
      </Button>
    </form>
  );
}
