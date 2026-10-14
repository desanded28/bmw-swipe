import { and, asc, desc, eq, gt, inArray, type SQL } from "drizzle-orm";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ReplySimulator } from "@/components/dashboard/ReplySimulator";
import { Badge, Card, EmptyState, PageHeader, cx } from "@/components/ui";
import { db } from "@/db";
import { appointments, messages, patients, type Locale } from "@/db/schema";
import { fmtDay, fmtWhen, zonedDate, zonedTime } from "@/i18n/datefmt";
import { getStaffLocale, getT } from "@/i18n/server";
import { auditStaff } from "@/lib/audit";
import { redactPatientLinks } from "@/lib/dashboard";
import { isDemoMode } from "@/lib/demo";
import { fullName } from "@/lib/format";
import { SAMPLE_REPLIES } from "@/lib/inbound";
import { can, requirePermission } from "@/lib/permissions";
import { formatPhone } from "@/lib/phone";
import { hasRestrictedAccess } from "@/lib/privacy/erasure";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getStaffLocale(), "reminders")("messages.title") };
}

const FILTERS = ["all", "inbound", "attention", "sms", "whatsapp", "email"] as const;
type Filter = (typeof FILTERS)[number];

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ f?: string; open?: string }> }) {
  const s = await requirePermission("messages.read");
  const locale = await getStaffLocale();
  const t = getT(locale, "reminders");
  const tc = getT(locale, "common");
  const sp = await searchParams;
  const f: Filter = FILTERS.find((k) => k === sp.f) ?? "all";
  const tz = s.org.timezone;
  const conditions: SQL[] = [eq(messages.orgId, s.org.id)];
  if (f === "inbound") conditions.push(eq(messages.direction, "inbound"));
  if (f === "attention") conditions.push(eq(messages.direction, "inbound"), eq(messages.intent, "unknown"));
  if (f === "sms" || f === "whatsapp" || f === "email") conditions.push(eq(messages.channel, f));
  const simulator = isDemoMode() && can(s.role, "messages.simulate");

  const [rows, upcoming] = await Promise.all([
    db
      .select({ m: messages, patient: patients })
      .from(messages)
      .leftJoin(patients, and(eq(patients.id, messages.patientId), eq(patients.orgId, s.org.id)))
      .where(and(...conditions))
      .orderBy(desc(messages.createdAt))
      .limit(150),
    simulator
      ? db
          .selectDistinct({
            phone: patients.phone,
            firstName: patients.firstName,
            lastName: patients.lastName,
            locale: patients.locale,
            start: appointments.startsAt,
          })
          .from(appointments)
          .innerJoin(patients, eq(patients.id, appointments.patientId))
          .where(
            and(eq(appointments.orgId, s.org.id), gt(appointments.startsAt, new Date()), inArray(appointments.status, ["scheduled", "requested"])),
          )
          .orderBy(asc(appointments.startsAt))
          .limit(40)
      : Promise.resolve([]),
  ]);
  // A restricted (Art. 18) or erased patient's messages are shown, as in the calendar drawer, only
  // to staff with patient.restricted.read who gave a reason for that record (hasRestrictedAccess);
  // everyone else sees a placeholder instead of the name and the text.
  const unlocked = new Set<string>();
  if (can(s.role, "patient.restricted.read")) {
    const restricted = new Set(rows.flatMap(({ patient }) => (patient && (patient.restrictedAt || patient.erasedAt) ? [patient.id] : [])));
    for (const id of restricted) if (await hasRestrictedAccess(s, id)) unlocked.add(id);
  }
  const hidden = (p: (typeof rows)[number]["patient"]) => Boolean(p && (p.restrictedAt || p.erasedAt) && !unlocked.has(p.id));
  // Sent texts carry the patient's personal links (manage page, calendar file): staff get those only
  // through issuePatientLink(), which is audited, never off the log.
  const linkLabel = t("messages.linkRedacted");
  const clean = (text: string) => redactPatientLinks(text, linkLabel);

  // Reading the log shows patients' messages: one audit row per page view (ids and counts only),
  // and one per email opened in full, carrying its patient for their access log.
  await auditStaff(s, "message.view", undefined, { metadata: { view: "messages", filter: f, count: rows.length } });
  const found = sp.open ? rows.find(({ m }) => m.id === sp.open) : undefined;
  const opened = found && !hidden(found.patient) ? found : undefined;
  if (opened) {
    await auditStaff(
      s,
      "message.view",
      { type: "message", id: opened.m.id },
      { metadata: { view: "message", patientId: opened.m.patientId, appointmentId: opened.m.appointmentId } },
    );
  }

  const simPatients = upcoming
    .flatMap((p) => (p.phone ? [{ ...p, phone: p.phone }] : []))
    .filter((p, i, arr) => arr.findIndex((x) => x.phone === p.phone) === i)
    .map((p) => ({
      phone: p.phone,
      locale: p.locale as Locale,
      label: t("simulator.patientOption", { name: `${p.firstName} ${p.lastName}`, when: fmtWhen(p.start, tz, locale, "weekday") }),
    }));
  const filterLabel = (k: Filter) =>
    k === "sms" || k === "whatsapp" || k === "email" ? tc(`channels.${k}`) : t(`messages.${k}`);
  const href = (q: Record<string, string>) => `/dashboard/messages?${new URLSearchParams(q).toString()}`;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title={t("messages.title")} description={t("messages.description")} />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0">
          <nav aria-label={t("messages.filters")} className="mb-3 flex flex-wrap gap-2">
            {FILTERS.map((k) => (
              <Link
                key={k}
                href={href({ f: k })}
                aria-current={f === k ? "page" : undefined}
                className={cx(
                  "rounded-full px-3 py-1.5 text-sm font-semibold ring-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
                  f === k ? "bg-ink text-white ring-ink" : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50",
                )}
              >
                {filterLabel(k)}
              </Link>
            ))}
          </nav>
          {rows.length === 0 ? (
            <EmptyState title={t("messages.empty")} />
          ) : (
            <Card>
              <ul className="divide-y divide-slate-100">
                {rows.map(({ m, patient }) => {
                  const inbound = m.direction === "inbound";
                  const masked = hidden(patient);
                  const expanded = opened?.m.id === m.id;
                  const who = masked
                    ? t("messages.restrictedPatient")
                    : patient
                      ? fullName(patient)
                      : formatPhone(inbound ? m.from : m.to) || t("messages.unknownSender");
                  return (
                    <li key={m.id} className={cx("p-4", inbound && m.intent === "unknown" && "bg-amber-50/60")}>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {inbound ? (
                          <ArrowDownLeft size={15} className="text-brand-700" aria-label={t("messages.received")} role="img" />
                        ) : (
                          <ArrowUpRight size={15} className="text-slate-500" aria-label={t("messages.sentLabel")} role="img" />
                        )}
                        <span className="font-semibold text-slate-800">{who}</span>
                        <Badge tone={m.channel === "email" ? "blue" : m.channel === "whatsapp" ? "green" : "slate"}>{tc(`channels.${m.channel}`)}</Badge>
                        {inbound ? (
                          <Badge tone={m.intent === "unknown" ? "amber" : m.intent === "cancel" ? "red" : "brand"}>
                            {t("messages.reply", { intent: t(`messages.intent.${m.intent ?? "unknown"}`) })}
                          </Badge>
                        ) : (
                          <Badge tone={m.status === "failed" ? "red" : m.status === "captured" ? "amber" : "slate"}>{t(`messages.status.${m.status}`)}</Badge>
                        )}
                        <time className="ml-auto text-slate-500" dateTime={m.createdAt.toISOString()}>
                          {fmtDay(zonedDate(m.createdAt, tz), "weekday", locale)} {zonedTime(m.createdAt, tz)}
                        </time>
                      </div>
                      {m.redactedAt ? (
                        <p className="mt-1.5 text-sm italic text-slate-500">{t("messages.redacted")}</p>
                      ) : masked ? (
                        <p className="mt-1.5 text-sm italic text-slate-500">{t("messages.restrictedBody")}</p>
                      ) : m.subject ? (
                        <div className="mt-1.5">
                          <p className="text-sm font-semibold [overflow-wrap:anywhere]">{clean(m.subject)}</p>
                          {m.html ? (
                            <Link
                              href={href(expanded ? { f } : { f, open: m.id })}
                              aria-expanded={expanded}
                              className="mt-1 inline-block text-xs font-semibold text-brand-700 hover:underline focus-visible:outline-2 focus-visible:outline-brand-600"
                              scroll={false}
                            >
                              {expanded ? t("messages.hideEmail") : t("messages.showEmail")}
                            </Link>
                          ) : null}
                          {expanded && m.html ? (
                            <iframe
                              title={t("messages.emailFrame", { subject: clean(m.subject) })}
                              srcDoc={clean(m.html)}
                              sandbox=""
                              className="mt-2 h-[460px] w-full rounded-lg border border-slate-200"
                            />
                          ) : null}
                        </div>
                      ) : (
                        <p className={cx("mt-1.5 text-sm [overflow-wrap:anywhere]", inbound ? "font-medium text-slate-900" : "text-slate-600")}>{clean(m.body)}</p>
                      )}
                      {m.error ? <p className="mt-1 text-xs text-red-700">{m.error}</p> : null}
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </div>
        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="font-bold">{t("simulator.title")}</h2>
            <p className="mb-4 mt-1 text-sm text-slate-500">{t("simulator.description")}</p>
            {!simulator ? (
              <p className="text-sm text-slate-500">{t("simulator.demoOnly")}</p>
            ) : simPatients.length ? (
              <ReplySimulator patients={simPatients} samples={SAMPLE_REPLIES} />
            ) : (
              <p className="text-sm text-slate-500">{t("simulator.noPatients")}</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
