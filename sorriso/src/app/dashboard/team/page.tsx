import { and, asc, eq, gt, inArray } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { PractitionerForm } from "@/components/dashboard/PractitionerForm";
import { TimeOffForm, TimeOffList } from "@/components/dashboard/TimeOff";
import { Avatar, Badge, Card, PageHeader } from "@/components/ui";
import { db } from "@/db";
import { locations, memberships, practitionerServices, practitioners, rooms, schedules, services, timeOff, users } from "@/db/schema";
import { MANAGERS, requireStaff } from "@/lib/auth";
import { practitionerName } from "@/lib/format";
import { minutesToHHMM, todayIn } from "@/lib/time";

export const metadata: Metadata = { title: "Team & hours" };

const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function TeamPage() {
  const s = await requireStaff();
  const canManage = MANAGERS.includes(s.role);
  const [team, locs, svcs, members] = await Promise.all([
    db.select().from(practitioners).where(eq(practitioners.orgId, s.org.id)).orderBy(asc(practitioners.name)),
    db.select().from(locations).where(eq(locations.orgId, s.org.id)).orderBy(asc(locations.name)),
    db.select().from(services).where(eq(services.orgId, s.org.id)).orderBy(asc(services.sortOrder)),
    // Dashboard accounts (moved here from the settings page).
    db
      .select({ name: users.name, email: users.email, role: memberships.role })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(eq(memberships.orgId, s.org.id)),
  ]);
  const ids = team.map((p) => p.id);
  const locIds = locs.map((l) => l.id);
  const [sched, links, roomRows, closures] = await Promise.all([
    ids.length ? db.select().from(schedules).where(inArray(schedules.practitionerId, ids)) : [],
    ids.length ? db.select().from(practitionerServices).where(inArray(practitionerServices.practitionerId, ids)) : [],
    locIds.length ? db.select().from(rooms).where(inArray(rooms.locationId, locIds)) : [],
    db
      .select()
      .from(timeOff)
      .where(and(eq(timeOff.orgId, s.org.id), gt(timeOff.endsAt, new Date())))
      .orderBy(asc(timeOff.startsAt)),
  ]);
  const locName = new Map(locs.map((l) => [l.id, l.name]));
  const pName = new Map(team.map((p) => [p.id, practitionerName(p)]));
  const roomName = new Map(roomRows.map((r) => [r.id, `${locName.get(r.locationId)} · ${r.name}`]));

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Team & working hours" description="Who works where, and when. Availability for online booking is calculated from these hours." />
      <div className="grid gap-4 md:grid-cols-2">
        {team.map((p) => {
          const mine = sched.filter((x) => x.practitionerId === p.id);
          const byDay = [1, 2, 3, 4, 5, 6, 0]
            .map((wd) => ({ wd, rows: mine.filter((x) => x.weekday === wd).sort((a, b) => a.startMinute - b.startMinute) }))
            .filter((d) => d.rows.length);
          return (
            <Link key={p.id} href={`/dashboard/team/${p.id}`}>
              <Card className="h-full p-5 transition hover:ring-brand-300">
                <div className="flex items-start gap-3">
                  <Avatar name={p.name} color={p.color} size={46} />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{practitionerName(p)}</p>
                    <p className="text-sm text-slate-500">{p.specialty}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Badge>{links.filter((l) => l.practitionerId === p.id).length} treatments</Badge>
                      {!p.active ? <Badge tone="red">Inactive</Badge> : null}
                      {!p.acceptsNewPatients ? <Badge tone="amber">No new patients</Badge> : null}
                    </div>
                  </div>
                </div>
                <div className="mt-4 space-y-1 text-[13px]">
                  {byDay.length === 0 ? <p className="text-amber-700">No working hours yet — not bookable.</p> : null}
                  {byDay.map(({ wd, rows }) => (
                    <p key={wd} className="flex gap-2">
                      <span className="w-9 font-semibold text-slate-500">{WD[wd]}</span>
                      <span className="text-slate-700">
                        {rows.map((r) => `${minutesToHHMM(r.startMinute)}–${minutesToHHMM(r.endMinute)} ${locs.length > 1 ? `(${locName.get(r.locationId)})` : ""}`).join(", ")}
                      </span>
                    </p>
                  ))}
                </div>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-bold">Time off & closures</h2>
          <TimeOffList
            items={closures}
            tz={s.org.timezone}
            label={(t) =>
              t.practitionerId ? pName.get(t.practitionerId)! : t.roomId ? roomName.get(t.roomId)! : t.locationId ? `${locName.get(t.locationId)} (whole office)` : "Whole practice"
            }
          />
          <div className="mt-5 border-t border-slate-100 pt-5">
            <TimeOffForm
              today={todayIn(s.org.timezone)}
              scopes={[
                ...team.map((p) => ({ value: `practitioner:${p.id}`, label: practitionerName(p) })),
                ...locs.map((l) => ({ value: `location:${l.id}`, label: `${l.name} — whole office closed` })),
                ...roomRows.map((r) => ({ value: `room:${r.id}`, label: `${roomName.get(r.id)} — out of service` })),
                { value: "org", label: "Whole practice (holiday)" },
              ]}
            />
          </div>
        </Card>
        {canManage ? (
          <Card className="p-6">
            <h2 className="mb-4 text-lg font-bold">Add a practitioner</h2>
            <PractitionerForm services={svcs} offered={[]} />
          </Card>
        ) : null}
        <Card className="p-6">
          <h2 className="mb-3 text-lg font-bold">Team members</h2>
          <ul className="divide-y divide-slate-100">
            {members.map((m) => (
              <li key={m.email} className="flex items-center justify-between py-2.5 text-sm">
                <span>
                  <span className="font-semibold">{m.name}</span>
                  <span className="block text-xs text-slate-500">{m.email}</span>
                </span>
                <Badge tone={m.role === "owner" ? "brand" : "slate"}>{m.role}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
