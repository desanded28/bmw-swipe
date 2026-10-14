import { and, count, desc, eq, gte, inArray, lt, ne } from "drizzle-orm";
import { ArrowRight, CalendarCheck, CircleCheck, Globe, RefreshCw, ShieldAlert, TrendingDown, UserX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AppointmentList } from "@/components/dashboard/AppointmentList";
import { Card, LinkButton, PageHeader } from "@/components/ui";
import { db } from "@/db";
import { appointments, messages, practitioners, waitlist } from "@/db/schema";
import { capitalizeFirst, fmtDay } from "@/i18n/datefmt";
import { formatPercent } from "@/i18n/number";
import { getStaffLocale, getT } from "@/i18n/server";
import { auditStaff } from "@/lib/audit";
import { auditListView, listAppointments, listViewer, loadResources } from "@/lib/dashboard";
import { providerStatus } from "@/lib/messaging";
import { requireStaff } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { addDays, todayIn, zonedParts, zonedToUtc } from "@/lib/time";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getStaffLocale(), "dashboard")("overview.title") };
}

/** Longest reply text shown on the overview (the drawer shows the whole thread). */
const REPLY_PREVIEW = 160;

function Stat({ icon: Icon, label, value, hint, tone = "brand" }: { icon: typeof CalendarCheck; label: string; value: string; hint?: string; tone?: "brand" | "red" | "amber" }) {
  const tones = { brand: "bg-brand-50 text-brand-700", red: "bg-red-50 text-red-700", amber: "bg-amber-50 text-amber-800" };
  return (
    <Card className="p-5">
      <div className="flex items-center gap-3">
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${tones[tone]}`} aria-hidden>
          <Icon size={18} />
        </span>
        <p className="text-sm font-semibold text-slate-600">{label}</p>
      </div>
      <p className="mt-3 text-3xl font-extrabold tracking-tight">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-600">{hint}</p> : null}
    </Card>
  );
}

/**
 * The overview. It is where requirePermission() sends a role that lacks a page's permission
 * (?denied=1), so it never requires one itself: the appointment lists need calendar.read and are
 * left out without it.
 */
export default async function Overview({ searchParams }: { searchParams: Promise<{ welcome?: string; denied?: string }> }) {
  const s = await requireStaff();
  const { welcome, denied } = await searchParams;
  const locale = await getStaffLocale();
  const t = getT(locale, "dashboard");
  const deniedBanner = denied ? (
    <p role="alert" className="mb-4 flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-950 ring-1 ring-amber-200">
      <ShieldAlert size={16} aria-hidden /> {t("denied")}
    </p>
  ) : null;
  const firstName = s.user.name.split(" ")[0] ?? s.user.name;
  const hour = Math.floor(zonedParts(new Date(), s.org.timezone).minutes / 60);
  const greeting = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  if (!can(s.role, "calendar.read")) {
    return (
      <div className="mx-auto max-w-6xl">
        {deniedBanner}
        <PageHeader title={t(`overview.greeting.${greeting}`, { name: firstName })} description={s.org.name} />
      </div>
    );
  }
  const viewer = listViewer(s, locale);
  const tz = s.org.timezone;
  const today = todayIn(tz);
  const startToday = zonedToUtc(today, 0, tz);
  const startTomorrow = zonedToUtc(addDays(today, 1), 0, tz);
  const startAfter = zonedToUtc(addDays(today, 2), 0, tz);
  const now = new Date();
  const monthAgo = new Date(now.getTime() - 30 * 86_400_000);
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
  const orgId = s.org.id;

  const [resources, todayList, tomorrowList, attention, requests, outcomes, online, refilled, waiting, team] = await Promise.all([
    loadResources(orgId, tz),
    listAppointments(orgId, { from: startToday, to: startTomorrow, viewer }),
    listAppointments(orgId, { from: startTomorrow, to: startAfter, statuses: ["scheduled"], viewer }),
    listAppointments(orgId, { from: now, needsAttention: true, statuses: ["scheduled", "requested"], viewer }),
    listAppointments(orgId, { from: now, statuses: ["requested"], viewer }),
    db
      .select({ status: appointments.status, n: count() })
      .from(appointments)
      .where(and(eq(appointments.orgId, orgId), gte(appointments.startsAt, monthAgo), lt(appointments.startsAt, now), inArray(appointments.status, ["completed", "no_show"])))
      .groupBy(appointments.status),
    db
      .select({ n: count() })
      .from(appointments)
      .where(and(eq(appointments.orgId, orgId), gte(appointments.createdAt, weekAgo), ne(appointments.source, "staff"))),
    db
      .select({ n: count() })
      .from(appointments)
      .where(and(eq(appointments.orgId, orgId), gte(appointments.createdAt, monthAgo), eq(appointments.source, "waitlist"))),
    db.select({ n: count() }).from(waitlist).where(and(eq(waitlist.orgId, orgId), eq(waitlist.status, "active"))),
    db.select({ n: count() }).from(practitioners).where(eq(practitioners.orgId, orgId)),
  ]);

  // The patient's last unparsed reply, for the "needs attention" rows: message text, so only
  // with messages.read, never for a masked (restricted) patient, and each one audited.
  const replyIds = can(s.role, "messages.read") ? attention.filter((a) => !a.patient.masked).map((a) => a.id) : [];
  const lastInbound = replyIds.length
    ? await db
        .select({ appointmentId: messages.appointmentId, body: messages.body })
        .from(messages)
        .where(and(eq(messages.orgId, orgId), eq(messages.direction, "inbound"), inArray(messages.appointmentId, replyIds)))
        .orderBy(desc(messages.createdAt))
    : [];
  const lastMessage: Record<string, string> = {};
  for (const m of lastInbound) {
    if (m.appointmentId && !lastMessage[m.appointmentId]) {
      lastMessage[m.appointmentId] = m.body.length > REPLY_PREVIEW ? `${m.body.slice(0, REPLY_PREVIEW)}…` : m.body;
    }
  }
  await Promise.all(
    Object.keys(lastMessage).map((id) => auditStaff(s, "appointment.view", { type: "appointment", id }, { metadata: { view: "last_reply" } })),
  );

  const attentionList = [...requests, ...attention.filter((a) => a.status !== "requested")];
  await auditListView(s, "overview", new Set([...todayList, ...tomorrowList, ...attentionList].map((a) => a.id)).size);

  const completed = outcomes.find((o) => o.status === "completed")?.n ?? 0;
  const noShows = outcomes.find((o) => o.status === "no_show")?.n ?? 0;
  const visits = completed + noShows;
  const todayLive = todayList.filter((a) => a.status !== "cancelled");
  const tomorrowConfirmed = tomorrowList.filter((a) => a.confirmation === "confirmed").length;
  const providers = providerStatus();
  const captured = { email: providers.email === "captured", text: providers.sms === "captured" };
  const canWrite = can(s.role, "appointment.write");

  return (
    <div className="mx-auto max-w-6xl">
      {deniedBanner}
      <PageHeader
        title={t(`overview.greeting.${greeting}`, { name: firstName })}
        description={t("overview.subtitle", { date: capitalizeFirst(fmtDay(today, "medium", locale), locale), practice: s.org.name })}
        actions={
          <LinkButton href="/dashboard/calendar">
            {t("overview.openCalendar")} <ArrowRight size={16} aria-hidden />
          </LinkButton>
        }
      />

      {welcome || team[0]?.n === 0 ? (
        <Card className="mb-6 p-6">
          <h2 className="text-lg font-bold">{t("overview.welcome.title")}</h2>
          <ol className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            {(
              [
                ["/dashboard/team", t("overview.welcome.team")],
                ["/dashboard/services", t("overview.welcome.services")],
                ["/dashboard/reminders", t("overview.welcome.reminders")],
                ["/dashboard/settings", t("overview.welcome.widget")],
              ] as const
            ).map(([href, text], i) => (
              <li key={href}>
                <Link href={href} className="flex items-center gap-3 rounded-xl p-3 ring-1 ring-slate-200 hover:ring-brand-400">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-700 text-xs font-bold text-white" aria-hidden>
                    {i + 1}
                  </span>
                  {text}
                </Link>
              </li>
            ))}
          </ol>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          icon={CalendarCheck}
          label={t("overview.stats.today")}
          value={String(todayLive.length)}
          hint={t("overview.stats.todayHint", { count: todayLive.filter((a) => a.confirmation === "confirmed" || a.status === "completed").length })}
        />
        <Stat
          icon={CircleCheck}
          label={t("overview.stats.tomorrow")}
          value={tomorrowList.length ? formatPercent(tomorrowConfirmed / tomorrowList.length, locale) : t("overview.stats.none")}
          hint={t("overview.stats.tomorrowHint", { confirmed: tomorrowConfirmed, total: tomorrowList.length, open: tomorrowList.length - tomorrowConfirmed })}
          tone={tomorrowList.length - tomorrowConfirmed > 3 ? "amber" : "brand"}
        />
        <Stat
          icon={visits && noShows / visits > 0.08 ? UserX : TrendingDown}
          label={t("overview.stats.noShow")}
          value={visits ? formatPercent(noShows / visits, locale, 1) : t("overview.stats.none")}
          hint={t("overview.stats.noShowHint", { noShows, visits })}
          tone={visits && noShows / visits > 0.08 ? "red" : "brand"}
        />
        <Stat
          icon={Globe}
          label={t("overview.stats.online")}
          value={String(online[0]?.n ?? 0)}
          hint={t("overview.stats.onlineHint", { refilled: refilled[0]?.n ?? 0, waiting: waiting[0]?.n ?? 0 })}
        />
      </div>

      {captured.email || captured.text ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-950 ring-1 ring-amber-200">
          <p>{captured.email && captured.text ? t("overview.demo.all") : captured.email ? t("overview.demo.email") : t("overview.demo.text")}</p>
          <Link href="/dashboard/reminders" className="font-semibold underline">
            {t("overview.demo.connect")}
          </Link>
        </div>
      ) : null}

      {attentionList.length ? (
        <section className="mt-8" aria-labelledby="attention-heading">
          <h2 id="attention-heading" className="mb-3 flex items-center gap-2 text-lg font-bold">
            {t("overview.attention")}
            <span className="rounded-full bg-red-600 px-2 text-xs font-bold text-white">
              <span aria-hidden>{attentionList.length}</span>
              <span className="sr-only">{t("overview.attentionCount", { count: attentionList.length })}</span>
            </span>
          </h2>
          <AppointmentList appointments={attentionList} resources={resources} showLastMessage={lastMessage} quickActions={canWrite} />
        </section>
      ) : null}

      <section className="mt-8" aria-labelledby="agenda-heading">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="agenda-heading" className="text-lg font-bold">
            {t("overview.agenda")}
          </h2>
          <Link href="/dashboard/appointments" className="flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
            <RefreshCw size={14} aria-hidden /> {t("overview.tomorrowLink")}
          </Link>
        </div>
        <AppointmentList appointments={todayList} resources={resources} showDate={false} quickActions={canWrite} empty={t("overview.noneToday")} />
      </section>
    </div>
  );
}
