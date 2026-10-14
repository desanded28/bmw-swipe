import {
  CalendarDays,
  Download,
  FileText,
  History,
  Inbox,
  ListChecks,
  LogOut,
  MessageSquare,
  Send,
  ShieldAlert,
  Star,
  UserRound,
  Users,
} from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { ActionForm } from "@/components/privacy/ActionForm";
import { ContactChangeForm, PreferencesForm } from "@/components/privacy/RecordForms";
import { Badge, buttonClass, Card, EmptyState, Field, Input, Select, Textarea } from "@/components/ui";
import type { Locale } from "@/db/enums";
import { ENDONYM, isLocale } from "@/i18n/config";
import { ClientMessages } from "@/i18n/ClientMessages";
import { fmtDay, fmtTime, fmtWhen, zonedDate } from "@/i18n/datefmt";
import { lhref } from "@/i18n/href";
import { getT } from "@/i18n/server";
import type { Translator } from "@/i18n/types";
import { DEFAULT_TIMEZONE } from "@/lib/config";
import { isContactVerified } from "@/lib/contact";
import { formatPhone } from "@/lib/phone";
import { getPatientSession } from "@/lib/privacy/patient-session";
import {
  auditView,
  CENTER_REQUEST_TYPES,
  channelOptions,
  consentOptions,
  findRecords,
  loadRecordDetails,
  maskContact,
  MAX_REQUEST_DETAILS,
  type CenterRecord,
  type ConsentOption,
  type RecordDetails,
} from "@/lib/privacy/privacy-center";
import {
  challengeAction,
  consentAction,
  contactConfirmAction,
  contactRequestAction,
  preferencesAction,
  requestAction,
  signOutAction,
  withdrawReviewAction,
} from "../actions";

export const dynamic = "force-dynamic";

type Params = Promise<{ locale: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: getT(locale, "privacy")("me.meta.title"), robots: { index: false, follow: false }, referrer: "no-referrer" };
}

type T = Translator<"privacy">;
type TC = Translator<"consents">;
type TCommon = Translator<"common">;
type Ctx = { locale: Locale; t: T; tc: TC; tcommon: TCommon };

const day = (d: Date, tz: string, locale: Locale) => fmtDay(zonedDate(d, tz), "medium", locale);
const when = (d: Date, tz: string, locale: Locale) => fmtWhen(d, tz, locale, "short");

/**
 * The patient's data, after the one-time code: every practice holding a record for the verified
 * contact (and their children's, until 18), with the appointments, messages, waiting list,
 * choices, reviews, access log and requests of each, and what they can do about it. Records the
 * contact alone doesn't prove show only "a record exists" until the surname and birth date match.
 * Each record shown in full is audited (privacy_center.view, actor patient_session).
 */
export default async function PrivacyDataPage({ params }: { params: Params }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await getPatientSession();
  if (!session) redirect(lhref(locale, "/privacy?expired=1"));

  const records = await findRecords(session.contact);
  const details = new Map<string, RecordDetails>();
  for (const r of records) if (r.disclosure === "details") details.set(r.patient.id, await loadRecordDetails(r));
  await auditView(session, records, await headers());

  const ctx: Ctx = { locale, t: getT(locale, "privacy"), tc: getT(locale, "consents"), tcommon: getT(locale, "common") };
  const { t } = ctx;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-ink">{t("me.title")}</h1>
          <p className="mt-1 text-sm text-slate-600">{t("me.signedInAs", { contact: maskContact(session.contact) })}</p>
          <p className="text-xs text-slate-500">{t("me.until", { time: fmtTime(session.expiresAt, DEFAULT_TIMEZONE) })}</p>
        </div>
        <form action={signOutAction}>
          <input type="hidden" name="locale" value={locale} />
          <button type="submit" className={buttonClass("secondary", "sm")}>
            <LogOut size={14} aria-hidden /> {t("me.signOut")}
          </button>
        </form>
      </header>

      {records.length === 0 ? (
        <div className="mt-8">
          <EmptyState icon={<Inbox size={28} />} title={t("me.empty.title")}>
            {t("me.empty.body")}
          </EmptyState>
        </div>
      ) : (
        <>
          {records.length > 1 ? (
            <nav aria-label={t("me.contents")} className="mt-6">
              <ul className="flex flex-wrap gap-2">
                {records.map((r) => (
                  <li key={r.patient.id}>
                    <a href={`#rec-${r.patient.id}`} className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-white px-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">
                      {r.via === "guardian" ? <Users size={14} aria-hidden /> : <UserRound size={14} aria-hidden />}
                      {r.org.name}
                      {r.via === "guardian" ? <span className="font-normal text-slate-500">· {r.patient.firstName}</span> : null}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
          <ClientMessages locale={locale} ns={["privacy", "consents"]}>
            <div className="mt-6 space-y-8">
              {records.map((r) =>
                r.disclosure === "challenge" ? (
                  <ChallengeCard key={r.patient.id} rec={r} ctx={ctx} />
                ) : (
                  <RecordCard key={r.patient.id} rec={r} d={details.get(r.patient.id)!} others={records} ctx={ctx} />
                ),
              )}
            </div>
          </ClientMessages>
        </>
      )}
    </div>
  );
}

function contactOf(org: CenterRecord["org"]): string | null {
  return org.privacyEmail ?? org.email ?? org.phone ?? null;
}

function ChallengeCard({ rec, ctx }: { rec: CenterRecord; ctx: Ctx }) {
  const { t, locale } = ctx;
  const contact = contactOf(rec.org);
  return (
    <Card id={`rec-${rec.patient.id}`} className="scroll-mt-24 p-6">
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <ShieldAlert size={18} className="text-amber-600" aria-hidden /> {t("me.challenge.title", { practice: rec.org.name })}
      </h2>
      <p className="mt-1 text-sm text-slate-600">{t("me.challenge.body")}</p>
      <ActionForm
        action={challengeAction}
        hidden={{ locale, patientId: rec.patient.id }}
        submit={{ label: t("me.challenge.submit"), pending: t("verify.checking"), size: "sm" }}
        className="mt-4"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("me.challenge.lastName")}>
            <Input name="lastName" required autoComplete="family-name" />
          </Field>
          <Field label={t("me.challenge.birthDate")}>
            <Input name="birthDate" type="date" required autoComplete="bday" />
          </Field>
        </div>
      </ActionForm>
      {contact ? <p className="mt-3 text-xs text-slate-500">{t("me.challenge.help", { contact })}</p> : null}
    </Card>
  );
}

function Section({ id, icon, title, count, open, children }: { id: string; icon: ReactNode; title: string; count?: string; open?: boolean; children: ReactNode }) {
  return (
    <details id={id} open={open} className="group border-t border-slate-200 py-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg font-semibold text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2">
          <span className="text-brand-700" aria-hidden>
            {icon}
          </span>
          {title}
        </span>
        <span className="flex items-center gap-2 text-sm font-normal text-slate-500">
          {count}
          <span className="transition group-open:rotate-90" aria-hidden>
            ›
          </span>
        </span>
      </summary>
      <div className="mt-3 space-y-3 text-sm text-slate-700">{children}</div>
    </details>
  );
}

function RecordCard({ rec, d, others, ctx }: { rec: CenterRecord; d: RecordDetails; others: CenterRecord[]; ctx: Ctx }) {
  const { t, tcommon, locale } = ctx;
  const p = rec.patient;
  const tz = rec.org.timezone || DEFAULT_TIMEZONE;
  const sid = (s: string) => `rec-${p.id}-${s}`;
  const options = consentOptions(rec, d.consents);
  const sameKind = others.filter((o) => o.patient.id !== p.id && o.disclosure === "details" && o.via === rec.via);
  const contact = contactOf(rec.org);

  return (
    <Card id={`rec-${p.id}`} className="scroll-mt-24 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">{rec.org.name}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {rec.via === "guardian" ? (
              <Badge tone="violet">
                <Users size={12} aria-hidden /> {t("me.familyBadge", { name: p.firstName })}
              </Badge>
            ) : (
              <Badge tone="brand">
                <UserRound size={12} aria-hidden /> {t("me.yours")}
              </Badge>
            )}
            {contact ? <span className="text-xs text-slate-500">{contact}</span> : null}
          </div>
        </div>
        <Link href={lhref(locale, `/c/${rec.org.slug}/privacy`)} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 underline-offset-2 hover:underline">
          <FileText size={14} aria-hidden /> {t("linkPage.notice", { practice: rec.org.name })}
        </Link>
      </div>
      {rec.via === "guardian" ? <p className="mt-3 text-xs text-slate-500">{t("me.familyNote", { name: p.firstName })}</p> : null}
      {p.restrictedAt ? (
        <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">{t("me.restricted", { date: day(p.restrictedAt, tz, locale) })}</p>
      ) : null}

      <div className="mt-4">
        <Section id={sid("details")} icon={<UserRound size={16} />} title={t("me.sections.details")} open>
          <DetailsList rec={rec} ctx={ctx} />
          <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200/70">
            <h3 className="mb-3 text-sm font-semibold">{t("me.sections.preferences")}</h3>
            <PreferencesForm
              action={preferencesAction}
              hidden={{ patientId: p.id }}
              current={{ locale: p.locale, channel: p.preferredChannel }}
              channels={channelOptions(rec)}
              whatsappConsented={d.consents.whatsapp_channel?.granted === true}
            />
          </div>
          <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200/70">
            <h3 className="mb-2 text-sm font-semibold">{t("me.sections.contact")}</h3>
            <ContactChangeForm
              requestAction={contactRequestAction}
              confirmAction={contactConfirmAction}
              patientId={p.id}
              others={sameKind.map((o) => ({ id: o.patient.id, practice: o.org.name }))}
            />
          </div>
        </Section>

        <Section id={sid("choices")} icon={<ListChecks size={16} />} title={t("me.sections.choices")} open>
          <p className="text-slate-600">{t("me.choices.intro")}</p>
          <ul className="divide-y divide-slate-100">
            {options.map((o) => (
              <ChoiceRow key={o.purpose} o={o} rec={rec} ctx={ctx} />
            ))}
          </ul>
        </Section>

        <Section
          id={sid("appointments")}
          icon={<CalendarDays size={16} />}
          title={t("me.sections.appointments")}
          count={t("me.counts.appointments", { count: d.appointments.length })}
        >
          {d.appointments.length ? (
            <ul className="divide-y divide-slate-100">
              {d.appointments.map((a) => (
                <li key={a.id} className="flex flex-wrap items-start justify-between gap-2 py-2">
                  <div>
                    <p className="font-semibold">{when(a.startsAt, a.timezone, locale)}</p>
                    <p className="text-slate-600">
                      {a.service} · {a.practitioner} · {a.location}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {a.processingContext === "marketplace" ? <Badge tone="blue">{t("me.appointments.viaSorriso")}</Badge> : null}
                      {a.bookedFor === "other_adult" ? <Badge tone="slate">{t("me.appointments.bookedByOther")}</Badge> : null}
                    </div>
                  </div>
                  <Badge tone={a.status === "cancelled" || a.status === "no_show" ? "red" : a.status === "completed" ? "slate" : "green"}>
                    {tcommon(`appointmentStatus.${a.status}`)}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-slate-500">{t("me.appointments.empty")}</p>
          )}
        </Section>

        <Section id={sid("messages")} icon={<MessageSquare size={16} />} title={t("me.sections.messages")} count={t("me.counts.messages", { count: d.messages.length })}>
          <p className="text-xs text-slate-500">{t("me.messages.intro")}</p>
          {d.messages.length ? (
            <ul className="space-y-2">
              {d.messages.map((m) => (
                <li key={m.id} className={m.direction === "inbound" ? "ml-6 rounded-xl bg-brand-50 p-3" : "mr-6 rounded-xl bg-slate-50 p-3"}>
                  <p className="text-xs text-slate-500">
                    {when(m.createdAt, tz, locale)} · {tcommon(`channels.${m.channel}`)} · {m.direction === "inbound" ? t("me.messages.inbound") : t("me.messages.outbound")}
                  </p>
                  {m.redacted ? (
                    <p className="mt-1 italic text-slate-500">{t("me.messages.redacted")}</p>
                  ) : (
                    <>
                      {m.subject ? <p className="mt-1 font-semibold">{m.subject}</p> : null}
                      <p className="mt-1 whitespace-pre-line break-words">{m.body}</p>
                    </>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-slate-500">{t("me.messages.empty")}</p>
          )}
        </Section>

        {d.waitlist.length ? (
          <Section id={sid("waitlist")} icon={<History size={16} />} title={t("me.sections.waitlist")} count={t("me.counts.entries", { count: d.waitlist.length })}>
            <ul className="divide-y divide-slate-100">
              {d.waitlist.map((w) => (
                <li key={w.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>
                    <span className="font-semibold">{w.service}</span>{" "}
                    <span className="text-slate-600">
                      {t("me.waitlist.range", { from: fmtDay(w.earliestDate, "medium", locale), to: fmtDay(w.latestDate, "medium", locale) })}
                    </span>
                  </span>
                  <Badge>{t(`me.waitlist.statuses.${w.status}`)}</Badge>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        {d.reviews.length ? (
          <Section id={sid("reviews")} icon={<Star size={16} />} title={t("me.sections.reviews")} count={String(d.reviews.length)}>
            <ul className="divide-y divide-slate-100">
              {d.reviews.map((r) => (
                <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      {t("me.reviews.rating", { rating: r.rating })} · <span className="font-normal text-slate-500">{day(r.createdAt, tz, locale)}</span>
                    </p>
                    {r.comment ? <p className="mt-1 whitespace-pre-line text-slate-600">{r.comment}</p> : null}
                    <Badge className="mt-1">{t(`me.reviews.statuses.${r.status}`)}</Badge>
                  </div>
                  {r.status !== "withdrawn" && r.status !== "removed" ? (
                    <ActionForm
                      action={withdrawReviewAction}
                      hidden={{ locale, reviewId: r.id }}
                      submit={{ label: t("me.reviews.withdraw"), pending: tcommon("actions.saving"), variant: "danger", size: "sm" }}
                      confirmText={t("me.reviews.confirm")}
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        <Section id={sid("access")} icon={<History size={16} />} title={t("me.sections.accessLog")} count={t("me.counts.entries", { count: d.accessLog.length })}>
          <p className="text-slate-600">{t("me.accessLog.intro")}</p>
          {d.accessLog.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">{t("me.sections.accessLog")}</caption>
                <thead className="text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th scope="col" className="py-2 pr-4 font-semibold">{t("me.accessLog.when")}</th>
                    <th scope="col" className="py-2 pr-4 font-semibold">{t("me.accessLog.who")}</th>
                    <th scope="col" className="py-2 font-semibold">{t("me.accessLog.what")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {d.accessLog.map((e, i) => (
                    <tr key={i}>
                      <td className="whitespace-nowrap py-2 pr-4 text-slate-600">{when(e.at, tz, locale)}</td>
                      <td className="py-2 pr-4">{actorLabel(e, ctx)}</td>
                      <td className="py-2">{actionLabel(e.action, t)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-slate-500">{t("me.accessLog.empty")}</p>
          )}
        </Section>

        <Section id={sid("requests")} icon={<Send size={16} />} title={t("me.sections.requests")} open>
          <RequestsBlock rec={rec} d={d} ctx={ctx} />
        </Section>

        <Section id={sid("download")} icon={<Download size={16} />} title={t("me.sections.download")} open>
          <p className="text-slate-600">{t("me.download.body")}</p>
          <a href={`/api/privacy/export?p=${encodeURIComponent(p.id)}&locale=${locale}`} download className={buttonClass("secondary", "sm")}>
            <Download size={14} aria-hidden /> {t("me.download.button")}
          </a>
        </Section>
      </div>
    </Card>
  );
}

function DetailsList({ rec, ctx }: { rec: CenterRecord; ctx: Ctx }) {
  const { t, tcommon, locale } = ctx;
  const p = rec.patient;
  const row = (label: string, value: ReactNode) => (
    <div className="grid gap-1 py-2 sm:grid-cols-[12rem_1fr]">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-900">{value}</dd>
    </div>
  );
  const verified = (kind: "phone" | "email", value: string | null) =>
    value && isContactVerified(p, kind, value) ? (
      <Badge tone="green" className="ml-2">
        {t("me.details.verified")}
      </Badge>
    ) : null;
  const none = <span className="font-normal text-slate-500">{t("me.details.none")}</span>;
  return (
    <dl className="divide-y divide-slate-100">
      {row(t("me.details.name"), `${p.firstName} ${p.lastName}`)}
      {row(t("me.details.birthDate"), p.birthDate ? fmtDay(p.birthDate, "long", locale) : none)}
      {row(t("me.details.phone"), p.phone ? <>{formatPhone(p.phone)}{verified("phone", p.phone)}</> : none)}
      {row(t("me.details.email"), p.email ? <>{p.email}{verified("email", p.email)}</> : none)}
      {row(t("me.details.language"), ENDONYM[p.locale])}
      {row(t("me.details.channel"), tcommon(`channels.${p.preferredChannel}`))}
      {p.guardianName || p.guardianPhone || p.guardianEmail
        ? row(
            t("me.details.guardian"),
            <span className="block">
              {p.guardianName ?? none}
              {p.guardianRelation ? <span className="font-normal text-slate-500"> · {t(`relation.minor.relations.${p.guardianRelation}`)}</span> : null}
              {p.guardianPhone ? <span className="block font-normal">{formatPhone(p.guardianPhone)}</span> : null}
              {p.guardianEmail ? <span className="block font-normal">{p.guardianEmail}</span> : null}
            </span>,
          )
        : null}
    </dl>
  );
}

function ChoiceRow({ o, rec, ctx }: { o: ConsentOption; rec: CenterRecord; ctx: Ctx }) {
  const { t, tc, tcommon, locale } = ctx;
  const tz = rec.org.timezone || DEFAULT_TIMEZONE;
  const state = o.kind === "objection" && !o.on ? t("me.choices.objected") : o.on ? t("me.choices.on") : t("me.choices.off");
  const button =
    o.kind === "objection"
      ? o.on
        ? t("me.choices.object")
        : t("me.choices.undoObjection")
      : o.kind === "consent" && o.on
        ? t("me.choices.withdraw")
        : o.on
          ? t("me.choices.turnOff")
          : t("me.choices.turnOn");
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 font-semibold text-slate-900">
          {tc(`${o.purpose}.title`)}
          <Badge tone={o.on ? "green" : "slate"}>{state}</Badge>
        </p>
        <p className="mt-0.5 text-xs text-slate-500">
          {t(`me.choices.kinds.${o.kind}`)} · {o.at ? t("me.choices.since", { date: day(o.at, tz, locale) }) : t("me.choices.default")}
        </p>
        <details className="mt-1 text-xs text-slate-600">
          <summary className="cursor-pointer font-semibold text-brand-700">{t("booking.whatThisMeans")}</summary>
          <p className="mt-1 leading-relaxed">{tc(`${o.purpose}.description`)}</p>
        </details>
        {o.purpose === "whatsapp_channel" && !o.on ? <p className="mt-1 text-xs text-slate-500">{t("me.choices.whatsappHint")}</p> : null}
      </div>
      {o.canTurnOn || o.canTurnOff ? (
        <ActionForm
          action={consentAction}
          hidden={{ locale, patientId: rec.patient.id, purpose: o.purpose, on: o.on ? "0" : "1" }}
          submit={{ label: button, pending: tcommon("actions.saving"), variant: o.on ? "secondary" : "subtle", size: "sm" }}
        />
      ) : null}
    </li>
  );
}

function RequestsBlock({ rec, d, ctx }: { rec: CenterRecord; d: RecordDetails; ctx: Ctx }) {
  const { t, locale } = ctx;
  const tz = rec.org.timezone || DEFAULT_TIMEZONE;
  return (
    <>
      <p className="text-slate-600">{t("me.requests.intro")}</p>
      <ActionForm
        action={requestAction}
        hidden={{ locale, patientId: rec.patient.id }}
        submit={{ label: <><Send size={14} aria-hidden /> {t("me.requests.submit")}</>, pending: t("center.signIn.sending"), size: "sm" }}
      >
        <fieldset className="space-y-2">
          <legend className="mb-1 text-[13px] font-semibold text-slate-700">{t("me.requests.type")}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {CENTER_REQUEST_TYPES.map((type, i) => (
              <label
                key={type}
                className="flex cursor-pointer gap-3 rounded-xl bg-white p-3 ring-1 ring-slate-200 has-[input:checked]:ring-2 has-[input:checked]:ring-brand-600 has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-brand-600"
              >
                <input type="radio" name="type" value={type} defaultChecked={i === 0} required className="mt-1 h-4 w-4 shrink-0 accent-brand-700" />
                <span>
                  <span className="block font-semibold text-slate-900">{t(`me.requests.types.${type}.title`)}</span>
                  <span className="block text-xs text-slate-600">{t(`me.requests.types.${type}.body`)}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        {d.hasPlatformData ? (
          <Field label={t("me.requests.to")}>
            <Select name="to" defaultValue="practice" className="max-w-md">
              <option value="practice">{t("me.requests.toPractice", { practice: rec.org.name })}</option>
              <option value="sorriso">{t("me.requests.toSorriso")}</option>
            </Select>
          </Field>
        ) : null}
        <Field label={t("me.requests.details")} hint={t("me.requests.detailsHint")}>
          <Textarea name="details" rows={3} maxLength={MAX_REQUEST_DETAILS} />
        </Field>
      </ActionForm>
      <h3 className="pt-2 text-sm font-semibold">{t("me.requests.listHeading")}</h3>
      {d.requests.length ? (
        <ul className="divide-y divide-slate-100">
          {d.requests.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                <span className="font-semibold">{t(`me.requests.typeLabels.${r.type}`)}</span>{" "}
                <span className="text-slate-600">
                  · {t("me.requests.received", { date: day(r.receivedAt, tz, locale) })} ·{" "}
                  {r.closedAt ? t("me.requests.closed", { date: day(r.closedAt, tz, locale) }) : t("me.requests.due", { date: day(r.dueAt, tz, locale) })}
                </span>
              </span>
              <span className="flex gap-1.5">
                {r.toSorriso ? <Badge tone="blue">{t("me.requests.sorriso")}</Badge> : null}
                <Badge tone={r.status === "completed" ? "green" : r.status === "rejected" ? "red" : "amber"}>{t(`me.requests.statuses.${r.status}`)}</Badge>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-slate-500">{t("me.requests.empty")}</p>
      )}
    </>
  );
}

function actorLabel(e: RecordDetails["accessLog"][number], { t, tcommon }: Ctx): string {
  if (e.actorType === "user") return e.role ? tcommon(`roles.${e.role}`) : t("me.accessLog.formerStaff");
  return t(`me.accessLog.actors.${e.actorType}`);
}

function actionLabel(action: string, t: T): string {
  const key = `me.accessLog.actions.${action.replace(/\./g, "_")}` as const;
  return t.has(key) ? t(key) : t("me.accessLog.actions.other");
}
