import { CalendarClock, Phone, PhoneCall, Repeat, ShieldCheck, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { confirmRecallAction, dismissRecallAction, markRecallCalledAction } from "@/app/dashboard/actions/care";
import { ActionButton } from "@/components/dashboard/ActionButton";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { capitalizeFirst, fmtDay, fmtTime, zonedDate } from "@/i18n/datefmt";
import { formatPercent } from "@/i18n/number";
import { getStaffLocale } from "@/i18n/server";
import { getT } from "@/i18n/t";
import { auditStaff } from "@/lib/audit";
import { can, requirePermission } from "@/lib/permissions";
import { formatPhone } from "@/lib/phone";
import { getCare } from "@/lib/privacy/settings";
import { frontDeskCallList, type CallRow } from "@/lib/rebooking";
import { recallDashboard, type RecallRow } from "@/lib/recalls";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getStaffLocale(), "care")("recalls.metaTitle") };
}

/**
 * Recalls and the front desk's call list (WP8): recalls to phone, overdue and due soon, intervals
 * waiting for a clinician, and conversion over the last 12 months. Listing patients here is
 * audited as patient.search.
 */
export default async function RecallsPage() {
  const s = await requirePermission("recalls.manage");
  const locale = await getStaffLocale();
  const t = getT(locale, "care");
  const now = new Date();
  const contacts = can(s.role, "patient.contact.read");
  const clinician = can(s.role, "patient.clinical.read");
  const care = getCare(s.org);
  const [board, calls] = await Promise.all([
    recallDashboard(s.org.id, s.org.timezone, now, { contacts }),
    frontDeskCallList(s.org.id, now, { contacts }),
  ]);
  await auditStaff(s, "patient.search", undefined, {
    metadata: {
      view: "recalls",
      rows: board.dueSoon.length + board.overdue.length + board.toCall.length + board.awaitingClinician.length + calls.length,
    },
  });

  /** A day inside a sentence ("Due Tuesday 3 March"): never capitalised. */
  const day = (date: string) => fmtDay(date, "medium", locale);
  const conversion = board.stats.due ? formatPercent(board.stats.booked / board.stats.due, locale) : "—";

  const phoneLink = (phone: string | null) =>
    phone ? (
      <a href={`tel:${phone}`} className="inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline">
        <Phone size={13} aria-hidden /> {formatPhone(phone)}
      </a>
    ) : contacts ? (
      <span className="text-slate-500">{t("recalls.row.noPhone")}</span>
    ) : null;

  const recallRow = (r: RecallRow, actions: ("called" | "dismiss" | "confirm")[]) => (
    <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
      <div className="min-w-0 flex-1 basis-56">
        <Link href={`/dashboard/patients/${r.patientId}`} className="font-semibold hover:underline">
          {r.patientName}
        </Link>
        <p className="text-xs text-slate-500">
          {r.serviceName}
          {r.practitionerName ? ` · ${r.practitionerName}` : ""}
        </p>
        <p className="mt-0.5 text-xs">{phoneLink(r.phone)}</p>
      </div>
      <div className="min-w-0 basis-44 text-sm">
        <p className="font-medium">{t("recalls.row.due", { date: day(r.dueDate) })}</p>
        <p className="text-xs text-slate-500">{t("recalls.row.every", { count: r.intervalMonths })}</p>
      </div>
      <div className="min-w-0 basis-44 text-xs text-slate-600">
        {r.attempts ? <p>{t("recalls.row.messages", { count: r.attempts })}</p> : null}
        {r.lastSentAt ? <p>{t("recalls.row.lastSent", { date: day(zonedDate(r.lastSentAt, s.org.timezone)) })}</p> : null}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {actions.includes("confirm") && clinician ? (
          <ActionButton action={confirmRecallAction.bind(null, r.id)} variant="primary">
            {t("recalls.actions.confirm")}
          </ActionButton>
        ) : null}
        {actions.includes("called") ? (
          <ActionButton action={markRecallCalledAction.bind(null, r.id)}>
            <PhoneCall size={14} aria-hidden /> {t("recalls.actions.called")}
          </ActionButton>
        ) : null}
        {actions.includes("dismiss") ? (
          <ActionButton action={dismissRecallAction.bind(null, r.id)} variant="ghost" confirm={t("recalls.actions.dismissConfirm")}>
            {t("recalls.actions.dismiss")}
          </ActionButton>
        ) : null}
      </div>
    </li>
  );

  const callRow = (c: CallRow) => (
    <li key={c.appointmentId} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
      <div className="min-w-0 flex-1 basis-56">
        <Link href={`/dashboard/patients/${c.patientId}`} className="font-semibold hover:underline">
          {c.patientName}
        </Link>
        <p className="mt-0.5 text-xs">{phoneLink(c.phone)}</p>
      </div>
      <div className="min-w-0 basis-56 text-sm">
        <p className="font-medium">
          {capitalizeFirst(t("recalls.row.visit", { date: day(zonedDate(c.start, c.timezone)), time: fmtTime(c.start, c.timezone) }), locale)}
        </p>
        <p className="text-xs text-slate-500">
          {c.serviceName} · {c.practitionerName}
        </p>
      </div>
      <div className="min-w-0 flex-1 basis-56">
        <Badge tone={c.reason === "risk" ? "red" : "amber"}>
          {c.reason === "risk" ? <TriangleAlert size={12} aria-hidden /> : <CalendarClock size={12} aria-hidden />}
          {t(`recalls.callReasons.${c.reason}`)}
        </Badge>
        {c.riskReasons.length ? (
          <ul className="mt-1 text-xs text-slate-600">
            {c.riskReasons.map((r) => {
              const k = `risk.reasons.${r}` as const;
              return t.has(k) ? <li key={r}>{t(k)}</li> : null;
            })}
          </ul>
        ) : null}
      </div>
    </li>
  );

  const section = (id: string, title: string, hint: string | null, rows: React.ReactNode[], empty: string) => (
    <section aria-labelledby={id} className="mt-8">
      <h2 id={id} className="font-bold">
        {title}
        {rows.length ? <span className="ml-2 text-sm font-semibold text-slate-500">({rows.length})</span> : null}
      </h2>
      {hint ? <p className="mt-0.5 text-sm text-slate-500">{hint}</p> : null}
      {rows.length ? (
        <Card className="mt-3">
          <ul className="divide-y divide-slate-100">{rows}</ul>
        </Card>
      ) : (
        <p className="mt-2 text-sm text-slate-500">{empty}</p>
      )}
    </section>
  );

  const nothing =
    !calls.length && !board.toCall.length && !board.overdue.length && !board.dueSoon.length && !board.awaitingClinician.length;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={t("recalls.title")} description={t("recalls.description")} />
      {!care.recallsEnabled ? (
        <p className="mb-6 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
          <ShieldCheck size={16} className="mt-0.5 shrink-0" aria-hidden /> {t("recalls.disabled")}
        </p>
      ) : null}

      <section aria-labelledby="recall-stats">
        <h2 id="recall-stats" className="mb-2 text-sm font-semibold text-slate-500">
          {t("recalls.stats.title")}
        </h2>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            [t("recalls.stats.due"), String(board.stats.due)],
            [t("recalls.stats.contacted"), String(board.stats.contacted)],
            [t("recalls.stats.booked"), String(board.stats.booked)],
            [t("recalls.stats.conversion"), conversion],
            [t("recalls.stats.messages"), String(board.stats.messages)],
          ].map(([label, value]) => (
            <Card key={label} className="p-4">
              <dt className="text-xs font-semibold text-slate-500">{label}</dt>
              <dd className="mt-1 text-2xl font-bold tabular-nums">{value}</dd>
            </Card>
          ))}
        </dl>
      </section>

      {nothing ? (
        <div className="mt-8">
          <EmptyState icon={<Repeat size={28} />} title={t("recalls.empty.dueSoon")} />
        </div>
      ) : null}

      {section("call-list", t("recalls.sections.callList"), t("recalls.sections.callListHint"), calls.map(callRow), t("recalls.empty.callList"))}
      {section(
        "to-call",
        t("recalls.sections.toCall"),
        t("recalls.sections.toCallHint"),
        board.toCall.map((r) => recallRow(r, ["called", "dismiss"])),
        t("recalls.empty.toCall"),
      )}
      {section("overdue", t("recalls.sections.overdue"), null, board.overdue.map((r) => recallRow(r, ["dismiss"])), t("recalls.empty.overdue"))}
      {section("due-soon", t("recalls.sections.dueSoon"), null, board.dueSoon.map((r) => recallRow(r, ["dismiss"])), t("recalls.empty.dueSoon"))}
      {section(
        "awaiting",
        t("recalls.sections.awaiting"),
        t("recalls.sections.awaitingHint"),
        board.awaitingClinician.map((r) => recallRow(r, ["confirm", "dismiss"])),
        t("recalls.empty.awaiting"),
      )}
    </div>
  );
}
