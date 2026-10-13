import { and, count, desc, eq, gte, inArray, lt, ne } from "drizzle-orm";
import { ArrowRight, CalendarCheck, CircleCheck, Globe, RefreshCw, TrendingDown, UserX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AppointmentList } from "@/components/dashboard/AppointmentList";
import { Card, LinkButton, PageHeader } from "@/components/ui";
import { db } from "@/db";
import { appointments, messages, practitioners, waitlist } from "@/db/schema";
import { requireStaff } from "@/lib/auth";
import { listAppointments, loadResources } from "@/lib/dashboard";
import { fmtDay } from "@/lib/datefmt";
import { providerStatus } from "@/lib/messaging";
import { addDays, todayIn, zonedToUtc } from "@/lib/time";

export const metadata: Metadata = { title: "Overview" };

function Stat({ icon: Icon, label, value, hint, tone = "brand" }: { icon: typeof CalendarCheck; label: string; value: string; hint?: string; tone?: "brand" | "red" | "amber" }) {
  const tones = { brand: "bg-brand-50 text-brand-700", red: "bg-red-50 text-red-600", amber: "bg-amber-50 text-amber-700" };
  return (
    <Card className="p-5">
      <div className="flex items-center gap-3">
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${tones[tone]}`}>
          <Icon size={18} />
        </span>
        <p className="text-sm font-semibold text-slate-500">{label}</p>
      </div>
      <p className="mt-3 text-3xl font-extrabold tracking-tight tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </Card>
  );
}

export default async function Overview({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const s = await requireStaff();
  const { welcome } = await searchParams;
  const tz = s.org.timezone;
  const today = todayIn(tz);
  const startToday = zonedToUtc(today, 0, tz);
  const startTomorrow = zonedToUtc(addDays(today, 1), 0, tz);
  const startAfter = zonedToUtc(addDays(today, 2), 0, tz);
  const monthAgo = new Date(Date.now() - 30 * 86_400_000);
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  const orgId = s.org.id;

  const [resources, todayList, tomorrowList, attention, outcomes, online, refilled, waiting, team] = await Promise.all([
    loadResources(orgId, tz),
    listAppointments(orgId, { from: startToday, to: startTomorrow }),
    listAppointments(orgId, { from: startTomorrow, to: startAfter, statuses: ["scheduled"] }),
    listAppointments(orgId, { from: new Date(), needsAttention: true, statuses: ["scheduled", "requested"] }),
    db
      .select({ status: appointments.status, n: count() })
      .from(appointments)
      .where(and(eq(appointments.orgId, orgId), gte(appointments.startsAt, monthAgo), lt(appointments.startsAt, new Date()), inArray(appointments.status, ["completed", "no_show"])))
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
  const requests = await listAppointments(orgId, { from: new Date(), statuses: ["requested"] });

  const lastInbound = attention.length
    ? await db
        .select({ appointmentId: messages.appointmentId, body: messages.body })
        .from(messages)
        .where(and(eq(messages.orgId, orgId), eq(messages.direction, "inbound"), inArray(messages.appointmentId, attention.map((a) => a.id))))
        .orderBy(desc(messages.createdAt))
    : [];
  const lastMessage: Record<string, string> = {};
  for (const m of lastInbound) if (m.appointmentId && !lastMessage[m.appointmentId]) lastMessage[m.appointmentId] = m.body;

  const completed = outcomes.find((o) => o.status === "completed")?.n ?? 0;
  const noShows = outcomes.find((o) => o.status === "no_show")?.n ?? 0;
  const noShowRate = completed + noShows ? Math.round((noShows / (completed + noShows)) * 1000) / 10 : 0;
  const todayLive = todayList.filter((a) => a.status !== "cancelled");
  const tomorrowConfirmed = tomorrowList.filter((a) => a.confirmation === "confirmed").length;
  const providers = providerStatus();

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={`Buongiorno, ${s.user.name.split(" ")[0]}`}
        description={`${fmtDay(today, "medium")} · ${s.org.name}`}
        actions={
          <LinkButton href="/dashboard/calendar">
            Open calendar <ArrowRight size={16} />
          </LinkButton>
        }
      />

      {welcome || team[0]?.n === 0 ? (
        <Card className="mb-6 p-6">
          <p className="text-lg font-bold">Welcome! Four steps to go live</p>
          <ol className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            {[
              ["/dashboard/team", "Add your dentists and hygienists, with their hours at each office"],
              ["/dashboard/services", "Set treatments, durations and prices"],
              ["/dashboard/reminders", "Choose when reminders go out (SMS, WhatsApp, email)"],
              ["/dashboard/settings", "Embed the booking widget on your website"],
            ].map(([href, text], i) => (
              <li key={href}>
                <Link href={href} className="flex items-center gap-3 rounded-xl p-3 ring-1 ring-slate-200 hover:ring-brand-400">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-700 text-xs font-bold text-white">{i + 1}</span>
                  {text}
                </Link>
              </li>
            ))}
          </ol>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={CalendarCheck} label="Today" value={String(todayLive.length)} hint={`${todayLive.filter((a) => a.confirmation === "confirmed" || a.status === "completed").length} confirmed or done`} />
        <Stat
          icon={CircleCheck}
          label="Tomorrow confirmed"
          value={tomorrowList.length ? `${Math.round((tomorrowConfirmed / tomorrowList.length) * 100)}%` : "—"}
          hint={`${tomorrowConfirmed} of ${tomorrowList.length} · ${tomorrowList.length - tomorrowConfirmed} to chase`}
          tone={tomorrowList.length - tomorrowConfirmed > 3 ? "amber" : "brand"}
        />
        <Stat icon={noShowRate > 8 ? UserX : TrendingDown} label="No-show rate (30d)" value={`${noShowRate}%`} hint={`${noShows} no-shows / ${completed + noShows} visits`} tone={noShowRate > 8 ? "red" : "brand"} />
        <Stat icon={Globe} label="Online bookings (7d)" value={String(online[0]?.n ?? 0)} hint={`${refilled[0]?.n ?? 0} slots refilled from the waitlist (30d) · ${waiting[0]?.n ?? 0} waiting`} />
      </div>

      {providers.sms === "captured" || providers.email === "captured" ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
          <p>
            <span className="font-semibold">Demo mode:</span> {providers.email === "captured" ? "email" : ""}
            {providers.email === "captured" && providers.sms === "captured" ? " and " : ""}
            {providers.sms === "captured" ? "SMS/WhatsApp" : ""} messages are captured in the Messages page instead of being delivered.
          </p>
          <Link href="/dashboard/reminders" className="font-semibold underline">
            Connect providers
          </Link>
        </div>
      ) : null}

      {requests.length || attention.length ? (
        <section className="mt-8">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
            Needs your attention <span className="rounded-full bg-red-500 px-2 text-xs font-bold text-white">{requests.length + attention.length}</span>
          </h2>
          <AppointmentList appointments={[...requests, ...attention.filter((a) => a.status !== "requested")]} resources={resources} showLastMessage={lastMessage} />
        </section>
      ) : null}

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Today&apos;s agenda</h2>
          <Link href="/dashboard/appointments" className="flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
            <RefreshCw size={14} /> Tomorrow&apos;s confirmations
          </Link>
        </div>
        <AppointmentList appointments={todayList} resources={resources} showDate={false} empty="No appointments today." />
      </section>
    </div>
  );
}
