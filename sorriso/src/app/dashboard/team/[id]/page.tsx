import { and, asc, eq, gt } from "drizzle-orm";
import { CalendarSync, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { rotateIcsToken } from "@/app/dashboard/actions";
import { ActionButton } from "@/components/dashboard/ActionButton";
import { PractitionerForm } from "@/components/dashboard/PractitionerForm";
import { ScheduleEditor } from "@/components/dashboard/ScheduleEditor";
import { TimeOffForm, TimeOffList } from "@/components/dashboard/TimeOff";
import { Avatar, Card } from "@/components/ui";
import { db } from "@/db";
import { locations, practitionerServices, practitioners, schedules, services, timeOff } from "@/db/schema";
import { MANAGERS, requireStaff } from "@/lib/auth";
import { absoluteUrl } from "@/lib/config";
import { practitionerName } from "@/lib/format";
import { minutesToHHMM, todayIn } from "@/lib/time";

export const metadata: Metadata = { title: "Practitioner" };

export default async function PractitionerAdminPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const s = await requireStaff();
  const { id } = await params;
  const { created } = await searchParams;
  const [p] = await db.select().from(practitioners).where(and(eq(practitioners.id, id), eq(practitioners.orgId, s.org.id)));
  if (!p) notFound();
  const [svcs, links, locs, sched, off] = await Promise.all([
    db.select().from(services).where(eq(services.orgId, s.org.id)).orderBy(asc(services.sortOrder)),
    db.select().from(practitionerServices).where(eq(practitionerServices.practitionerId, id)),
    db.select().from(locations).where(and(eq(locations.orgId, s.org.id), eq(locations.active, true))).orderBy(asc(locations.name)),
    db.select().from(schedules).where(eq(schedules.practitionerId, id)),
    db.select().from(timeOff).where(and(eq(timeOff.practitionerId, id), gt(timeOff.endsAt, new Date()))).orderBy(asc(timeOff.startsAt)),
  ]);
  const canManage = MANAGERS.includes(s.role);
  const feed = absoluteUrl(`/api/ics/practitioner/${p.icsToken}.ics`);

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/dashboard/team" className="text-sm font-semibold text-slate-500 hover:text-ink">
        ← Team
      </Link>
      <div className="mb-6 mt-3 flex flex-wrap items-center gap-4">
        <Avatar name={p.name} color={p.color} size={56} />
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{practitionerName(p)}</h1>
          <p className="text-sm text-slate-500">{p.specialty}</p>
        </div>
        <Link href={`/c/${s.org.slug}/${p.slug}`} target="_blank" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline">
          Public profile <ExternalLink size={14} />
        </Link>
      </div>
      {created ? <p className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-800">Practitioner added. Now set their working hours below.</p> : null}

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="mb-1 text-lg font-bold">Working hours</h2>
            <p className="mb-4 text-sm text-slate-500">Add several windows per day (e.g. a lunch break) and pick the office for each — the same person can work in Milano in the morning and Monza in the afternoon.</p>
            {canManage ? (
              <ScheduleEditor
                practitionerId={p.id}
                locations={locs.map((l) => ({ id: l.id, name: l.name }))}
                initial={sched.map((r) => ({ weekday: r.weekday, locationId: r.locationId, start: minutesToHHMM(r.startMinute), end: minutesToHHMM(r.endMinute) }))}
              />
            ) : (
              <p className="text-sm text-slate-500">Only owners and admins can change working hours.</p>
            )}
          </Card>
          <Card className="p-6">
            <h2 className="mb-4 text-lg font-bold">Time off</h2>
            <TimeOffList items={off} tz={s.org.timezone} />
            <div className="mt-5 border-t border-slate-100 pt-5">
              <TimeOffForm scopes={[{ value: `practitioner:${p.id}`, label: practitionerName(p) }]} today={todayIn(s.org.timezone)} />
            </div>
          </Card>
        </div>
        <div className="space-y-6">
          {canManage ? (
            <Card className="p-6">
              <h2 className="mb-4 text-lg font-bold">Profile</h2>
              <PractitionerForm practitioner={p} services={svcs} offered={links.map((l) => l.serviceId)} />
            </Card>
          ) : null}
          <Card className="p-6">
            <h2 className="mb-1 flex items-center gap-2 text-lg font-bold">
              <CalendarSync size={18} /> Personal calendar feed
            </h2>
            <p className="mb-3 text-sm text-slate-500">
              Subscribe in Google Calendar (“From URL”), Apple Calendar or Outlook to see this agenda on your phone. Patient names are shortened.
            </p>
            <code className="block break-all rounded-lg bg-slate-100 p-3 text-xs">{feed}</code>
            {canManage ? (
              <div className="mt-3">
                <ActionButton action={rotateIcsToken.bind(null, p.id)} confirm="Generate a new link? The current one will stop working.">
                  Generate new link
                </ActionButton>
              </div>
            ) : null}
          </Card>
        </div>
      </div>
    </div>
  );
}
