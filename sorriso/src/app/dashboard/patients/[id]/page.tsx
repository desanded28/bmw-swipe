import { and, desc, eq, inArray, or } from "drizzle-orm";
import { Lock, ShieldCheck, UserX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppointmentList } from "@/components/dashboard/AppointmentList";
import { PatientCarePanel } from "@/components/dashboard/slots/PatientCarePanel";
import { PatientDetailsForm, PatientNotesForm, RestrictedReasonForm } from "@/components/privacy-admin/PatientForms";
import { PatientPrivacyActions, type PrivacyActionKind } from "@/components/privacy-admin/PatientPrivacyActions";
import { AccessLog, ConsentTimeline, PanelCard, RequestList } from "@/components/privacy-admin/PrivacyPanel";
import { Avatar, Badge, Card } from "@/components/ui";
import { db } from "@/db";
import { CONSENT_PURPOSES } from "@/db/enums";
import { auditLog, consents, messages, patients, users } from "@/db/schema";
import { ENDONYM } from "@/i18n/config";
import { fmtDay, fmtWhen, zonedDate } from "@/i18n/datefmt";
import { getStaffLocale, getT } from "@/i18n/server";
import { auditStaff } from "@/lib/audit";
import { listAppointments, loadResources } from "@/lib/dashboard";
import { fullName } from "@/lib/format";
import { can, permissionsFor, requirePermission } from "@/lib/permissions";
import { currentConsents, isObjectable } from "@/lib/privacy/consent";
import { hasRestrictedAccess, restrictedView } from "@/lib/privacy/erasure";
import { dueBadge, listPrivacyRequests } from "@/lib/privacy/requests";
import { isPlatformConsentPurpose } from "@/lib/privacy/roles";
import { getPrivacy } from "@/lib/privacy/settings";
import { todayIn } from "@/lib/time";

export async function generateMetadata(): Promise<Metadata> {
  // The patient's name stays out of the tab title (shared screens, browser history).
  return { title: getT(await getStaffLocale(), "privacyAdmin")("patients.title") };
}

const ACCESS_LIMIT = 50;
const ACTIONS: readonly PrivacyActionKind[] = ["export", "restrict", "erase", "consents"];

/**
 * A patient's record: appointments, messages, details and notes, and the privacy panel (consent
 * ledger, who accessed the record, privacy requests, and the export / restriction / erasure /
 * consent actions). Every view is audited as patient.view. Restricted records are a placeholder
 * for staff without patient.restricted.read, and need an audited reason for those with it.
 */
export default async function PatientPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ action?: string }>;
}) {
  const s = await requirePermission("patient.read");
  const { id } = await params;
  const action = (await searchParams).action;
  const locale = await getStaffLocale();
  const t = getT(locale, "privacyAdmin");
  const tc = getT(locale, "common");
  const tConsents = getT(locale, "consents");
  const tz = s.org.timezone;

  const [p] = await db
    .select()
    .from(patients)
    .where(and(eq(patients.id, id), eq(patients.orgId, s.org.id)));
  if (!p) notFound();

  const back = (
    <Link href="/dashboard/patients" className="text-sm font-semibold text-slate-500 hover:text-ink">
      ← {t("patient.back")}
    </Link>
  );
  const view = restrictedView(p, can(s.role, "patient.restricted.read"));
  if (view === "placeholder") {
    return (
      <div className="mx-auto max-w-6xl">
        {back}
        <Card className="mx-auto mt-6 max-w-lg p-6 text-center">
          <Lock className="mx-auto mb-2 text-amber-700" size={22} aria-hidden />
          <h1 className="text-lg font-bold">{t("patient.placeholder.title")}</h1>
          <p className="mt-1 text-sm text-slate-600">{t("patient.placeholder.body")}</p>
        </Card>
      </div>
    );
  }
  if (view === "needs_reason" && !(await hasRestrictedAccess(s, id))) {
    return (
      <div className="mx-auto max-w-6xl">
        {back}
        <div className="mt-6">
          <RestrictedReasonForm patientId={id} />
        </div>
      </div>
    );
  }

  await auditStaff(s, "patient.view", { type: "patient", id });

  const perms = permissionsFor(s.role);
  const allow = (x: Parameters<typeof can>[1]) => can(s.role, x);
  const readOnly = Boolean(p.restrictedAt || p.erasedAt);
  const history = await listAppointments(s.org.id, { patientId: id, includeCancelled: true, order: "desc" });
  const apptIds = history.map((a) => a.id);
  const aboutPatient = or(
    and(eq(auditLog.entityType, "patient"), eq(auditLog.entityId, id)),
    apptIds.length ? and(eq(auditLog.entityType, "appointment"), inArray(auditLog.entityId, apptIds)) : undefined,
  );
  const [resources, log, ledger, access, requests, current] = await Promise.all([
    loadResources(s.org.id, tz),
    allow("messages.read")
      ? db
          .select()
          .from(messages)
          .where(and(eq(messages.patientId, id), eq(messages.orgId, s.org.id)))
          .orderBy(desc(messages.createdAt))
          .limit(30)
      : Promise.resolve([]),
    db
      .select()
      .from(consents)
      .where(and(eq(consents.orgId, s.org.id), eq(consents.patientId, id)))
      .orderBy(desc(consents.createdAt)),
    db
      .select({ row: auditLog, name: users.name })
      .from(auditLog)
      .leftJoin(users, and(eq(users.id, auditLog.actorId), eq(auditLog.actorType, "user")))
      .where(and(eq(auditLog.orgId, s.org.id), aboutPatient))
      .orderBy(desc(auditLog.seq))
      .limit(ACCESS_LIMIT),
    allow("privacy.requests") ? listPrivacyRequests(s.org.id, { status: "all", patientId: id }) : Promise.resolve([]),
    currentConsents(id),
  ]);

  const now = new Date();
  const upcoming = history.filter((a) => Date.parse(a.start) > now.getTime() && a.status !== "cancelled").reverse();
  const past = history.filter((a) => !upcoming.includes(a));
  const completed = history.filter((a) => a.status === "completed").length;
  const when = (d: Date) => fmtWhen(d, tz, locale, "short");
  const name = fullName(p);
  const privacy = getPrivacy(s.org);

  const actorName = (r: (typeof access)[number]) => {
    if (r.row.actorType === "user") return r.name ?? t("privacy.actors.formerStaff");
    const key = `privacy.actors.${r.row.actorType}` as const;
    return t.has(key) ? t(key) : r.row.actorType;
  };
  const purposes = CONSENT_PURPOSES.filter((c) => !isPlatformConsentPurpose(c)).map((c) => ({ id: c, title: tConsents(`${c}.title`) }));

  return (
    <div className="mx-auto max-w-6xl">
      {back}
      <div className="mb-6 mt-3 flex flex-wrap items-center gap-4">
        <Avatar name={name} color={readOnly ? "#94a3b8" : "#475569"} size={56} />
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">{name}</h1>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Badge>{t("patient.completedVisits", { count: completed })}</Badge>
            {p.noShowCount ? (
              <Badge tone="red">
                <UserX size={12} aria-hidden /> {t("patient.noShows", { count: p.noShowCount })}
              </Badge>
            ) : null}
            {p.restrictedAt ? (
              <Badge tone="amber">
                <Lock size={12} aria-hidden /> {t("patients.restricted")}
              </Badge>
            ) : null}
            {p.erasedAt ? <Badge>{t("patients.erased")}</Badge> : null}
            {!p.erasedAt ? <Badge tone="blue">{t("patient.prefers", { channel: tc(`channels.${p.preferredChannel}`) })}</Badge> : null}
            <Badge>{ENDONYM[p.locale]}</Badge>
            {!p.erasedAt && !p.smsOptIn ? <Badge tone="amber">{t("patient.smsOptOut")}</Badge> : null}
            {!p.erasedAt && !p.emailOptIn ? <Badge tone="amber">{t("patient.emailOptOut")}</Badge> : null}
          </div>
        </div>
      </div>

      {p.erasedAt ? (
        <div role="status" className="mb-6 rounded-xl bg-slate-100 p-4 text-sm text-slate-700 ring-1 ring-slate-200">
          <p className="font-semibold">{t("patient.erasedBanner.title")}</p>
          <p>{t("patient.erasedBanner.body", { date: fmtDay(zonedDate(p.erasedAt, tz), "long", locale) })}</p>
        </div>
      ) : p.restrictedAt ? (
        <div role="status" className="mb-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">
          <p className="font-semibold">{t("patient.restrictedBanner.title")}</p>
          <p>{t("patient.restrictedBanner.body", { date: fmtDay(zonedDate(p.restrictedAt, tz), "long", locale) })}</p>
          {p.restrictionReason ? <p className="mt-1">{t("patient.restrictedBanner.reason", { reason: p.restrictionReason })}</p> : null}
          {p.retainUntil ? <p className="mt-1">{t("patient.restrictedBanner.retainUntil", { date: fmtDay(p.retainUntil, "long", locale) })}</p> : null}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-6">
          <section aria-labelledby="upcoming">
            <h2 id="upcoming" className="mb-2 font-bold">
              {t("patient.upcoming")}
            </h2>
            <AppointmentList appointments={upcoming} resources={resources} quickActions={!readOnly} empty={t("patient.noUpcoming")} />
          </section>
          <section aria-labelledby="history">
            <h2 id="history" className="mb-2 font-bold">
              {t("patient.history")}
            </h2>
            <AppointmentList appointments={past} resources={resources} quickActions={false} empty={t("patient.noPast")} />
          </section>
          {allow("messages.read") ? (
            <section aria-labelledby="messages">
              <h2 id="messages" className="mb-2 font-bold">
                {t("patient.messages")}
              </h2>
              <Card className="divide-y divide-slate-100">
                {log.length === 0 ? <p className="p-4 text-sm text-slate-500">{t("patient.noMessages")}</p> : null}
                {log.map((m) => (
                  <div key={m.id} className="p-3 text-sm">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                      {m.direction === "inbound" ? t("patient.inbound") : t("patient.outbound")} · {tc(`channels.${m.channel}`)} · {when(m.createdAt)}
                    </p>
                    {m.redactedAt ? (
                      <p className="mt-0.5 italic text-slate-400">{t("patient.redacted")}</p>
                    ) : (
                      <p className="mt-0.5 line-clamp-2 text-slate-700">{m.subject || m.body}</p>
                    )}
                    {m.intent ? <p className="mt-0.5 text-xs text-slate-500">{t("patient.understoodAs", { intent: m.intent })}</p> : null}
                  </div>
                ))}
              </Card>
            </section>
          ) : null}
        </div>

        <div className="space-y-6">
          <PanelCard title={t("patient.details")}>
            {readOnly || !allow("patient.write") ? (
              <dl className="space-y-2 text-sm">
                {readOnly ? <p className="mb-2 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">{t("patient.readOnly")}</p> : null}
                {(
                  [
                    [t("patient.mobile"), allow("patient.contact.read") ? p.phone : null],
                    [t("patient.email"), allow("patient.contact.read") ? p.email : null],
                    [t("patient.birthDate"), p.birthDate ? fmtDay(p.birthDate, "long", locale) : null],
                    [t("patient.language"), ENDONYM[p.locale]],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-3">
                    <dt className="text-slate-500">{label}</dt>
                    <dd className="text-right font-medium">{value ?? "—"}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <PatientDetailsForm
                whatsappEnabled={privacy.whatsappEnabled}
                patient={{
                  id: p.id,
                  firstName: p.firstName,
                  lastName: p.lastName,
                  phone: p.phone,
                  email: p.email,
                  birthDate: p.birthDate,
                  locale: p.locale,
                  preferredChannel: p.preferredChannel,
                  smsOptIn: p.smsOptIn,
                  emailOptIn: p.emailOptIn,
                  optedOut: {
                    sms: !p.smsOptIn || current.sms_channel?.granted === false,
                    email: !p.emailOptIn || current.email_channel?.granted === false,
                    whatsapp: current.whatsapp_channel?.granted === false,
                  },
                }}
              />
            )}
          </PanelCard>

          {allow("patient.notes.read") && !p.erasedAt ? (
            <Card className="p-5">
              {readOnly ? (
                <div className="text-sm">
                  <p className="mb-1 font-semibold">{t("patient.notes")}</p>
                  <p className="whitespace-pre-line text-slate-700">{p.notes ?? "—"}</p>
                </div>
              ) : (
                <PatientNotesForm patientId={p.id} notes={p.notes} />
              )}
            </Card>
          ) : null}

          <PanelCard title={t("privacy.actions")}>
            <div className="flex items-start gap-2">
              <ShieldCheck size={18} className="mt-1 shrink-0 text-brand-700" aria-hidden />
              <div className="min-w-0 flex-1">
                <PatientPrivacyActions
                  patientId={p.id}
                  fullName={name}
                  restricted={Boolean(p.restrictedAt)}
                  erased={Boolean(p.erasedAt)}
                  allowed={{
                    export: allow("patient.export"),
                    erase: allow("patient.erase"),
                    restrict: allow("patient.restrict"),
                    consents: allow("patient.write"),
                  }}
                  purposes={purposes}
                  initial={ACTIONS.find((a) => a === action) ?? null}
                  today={todayIn(tz)}
                />
              </div>
            </div>
          </PanelCard>

          <PatientCarePanel orgId={s.org.id} patientId={p.id} permissions={perms} />
        </div>
      </div>

      <section aria-labelledby="privacy-panel" className="mt-8">
        <h2 id="privacy-panel" className="mb-3 text-lg font-bold">
          {t("privacy.title")}
        </h2>
        <div className="grid gap-6 lg:grid-cols-3">
          <PanelCard title={t("privacy.consents")}>
            <ConsentTimeline
              t={t}
              entries={ledger.map((c) => ({
                id: c.id,
                title: tConsents(`${c.purpose}.title`),
                granted: c.granted,
                objectable: isObjectable(c.purpose),
                at: when(c.createdAt),
                source: c.source,
                method: c.method,
                actorRelation: c.actorRelation,
              }))}
            />
          </PanelCard>
          <PanelCard title={t("privacy.access")} intro={t("privacy.accessIntro")}>
            <AccessLog t={t} limit={ACCESS_LIMIT} entries={access.map((r) => ({ id: r.row.id, at: when(r.row.at), who: actorName(r), action: r.row.action }))} />
          </PanelCard>
          {allow("privacy.requests") ? (
            <PanelCard title={t("privacy.requests")}>
              <RequestList
                t={t}
                entries={requests.map(({ request: r }) => ({
                  id: r.id,
                  type: r.type,
                  status: r.status,
                  received: fmtDay(zonedDate(r.receivedAt, tz), "short", locale),
                  due: dueBadge(t, r, now),
                }))}
              />
            </PanelCard>
          ) : null}
        </div>
      </section>
    </div>
  );
}
