import { and, asc, eq, gt, inArray, isNull, ne } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { PractitionerForm } from "@/components/dashboard/PractitionerForm";
import { TimeOffForm, TimeOffList } from "@/components/dashboard/TimeOff";
import { TeamMembers } from "@/components/security/TeamMembers";
import { Avatar, Badge, Card, PageHeader } from "@/components/ui";
import { db } from "@/db";
import {
  authTokens,
  locations,
  memberships,
  practitionerServices,
  practitioners,
  rooms,
  schedules,
  services,
  timeOff,
  users,
} from "@/db/schema";
import type { Locale } from "@/i18n/config";
import { fmtDay, zonedDate } from "@/i18n/datefmt";
import { getStaffLocale, getT } from "@/i18n/server";
import { practitionerName } from "@/lib/format";
import { can, requirePermission } from "@/lib/permissions";
import { LEGAL_VERSIONS } from "@/lib/privacy/versions";
import { minutesToHHMM, todayIn } from "@/lib/time";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getStaffLocale(), "security")("team.metaTitle") };
}

/** Short weekday name for 0 = Sunday … 6 = Saturday (2024-01-07 was a Sunday). */
function weekdayShort(wd: number, locale: Locale): string {
  return fmtDay(`2024-01-${String(7 + wd).padStart(2, "0")}`, "wd", locale);
}

export default async function TeamPage() {
  const s = await requirePermission("calendar.read");
  const locale = await getStaffLocale();
  const t = getT(locale, "security");
  const canManage = can(s.role, "team.manage");
  const [team, locs, svcs, members, invites] = await Promise.all([
    db.select().from(practitioners).where(eq(practitioners.orgId, s.org.id)).orderBy(asc(practitioners.name)),
    db.select().from(locations).where(eq(locations.orgId, s.org.id)).orderBy(asc(locations.name)),
    db.select().from(services).where(eq(services.orgId, s.org.id)).orderBy(asc(services.sortOrder)),
    db
      .select({
        userId: users.id,
        name: users.name,
        email: users.email,
        role: memberships.role,
        totp: users.totpEnabledAt,
        isPlatformAdmin: users.isPlatformAdmin,
        instructionsVersion: memberships.instructionsVersion,
      })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(eq(memberships.orgId, s.org.id))
      .orderBy(asc(users.name)),
    canManage
      ? db
          .select({ id: authTokens.id, email: authTokens.email, role: authTokens.role, expiresAt: authTokens.expiresAt })
          .from(authTokens)
          .where(and(eq(authTokens.kind, "invite"), eq(authTokens.orgId, s.org.id), isNull(authTokens.usedAt), gt(authTokens.expiresAt, new Date())))
      : [],
  ]);
  // Accounts shared with other practices: their two-step reset is Sorriso support's (actions/team.ts).
  const memberIds = members.map((m) => m.userId);
  const elsewhere =
    canManage && memberIds.length
      ? new Set(
          (
            await db
              .select({ userId: memberships.userId })
              .from(memberships)
              .where(and(inArray(memberships.userId, memberIds), ne(memberships.orgId, s.org.id)))
          ).map((r) => r.userId),
        )
      : new Set<string>();
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
  const roomName = new Map(roomRows.map((r) => [r.id, t("team.room", { office: locName.get(r.locationId) ?? "", room: r.name })]));
  const slotLabel = (r: { startMinute: number; endMinute: number; locationId: string }) => {
    const from = minutesToHHMM(r.startMinute);
    const to = minutesToHHMM(r.endMinute);
    return locs.length > 1 ? t("team.windowAt", { from, to, office: locName.get(r.locationId) ?? "" }) : t("team.window", { from, to });
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title={t("team.title")} description={t("team.description")} />
      <div className="grid gap-4 md:grid-cols-2">
        {team.map((p) => {
          const mine = sched.filter((x) => x.practitionerId === p.id);
          const byDay = [1, 2, 3, 4, 5, 6, 0]
            .map((wd) => ({ wd, rows: mine.filter((x) => x.weekday === wd).sort((a, b) => a.startMinute - b.startMinute) }))
            .filter((d) => d.rows.length);
          return (
            <Link key={p.id} href={`/dashboard/team/${p.id}`} className="rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500">
              <Card className="h-full p-5 transition hover:ring-brand-300">
                <div className="flex items-start gap-3">
                  <Avatar name={p.name} color={p.color} size={46} />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{practitionerName(p)}</p>
                    <p className="text-sm text-slate-500">{p.specialty}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Badge>{t("team.treatments", { count: links.filter((l) => l.practitionerId === p.id).length })}</Badge>
                      {!p.active ? <Badge tone="red">{t("team.inactive")}</Badge> : null}
                      {!p.acceptsNewPatients ? <Badge tone="amber">{t("team.noNewPatients")}</Badge> : null}
                    </div>
                  </div>
                </div>
                <div className="mt-4 space-y-1 text-[13px]">
                  {byDay.length === 0 ? <p className="text-amber-700">{t("team.noHours")}</p> : null}
                  {byDay.map(({ wd, rows }) => (
                    <p key={wd} className="flex gap-2">
                      <span className="w-9 font-semibold text-slate-500">{weekdayShort(wd, locale)}</span>
                      <span className="text-slate-700">{rows.map(slotLabel).join(", ")}</span>
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
          <h2 className="mb-4 text-lg font-bold">{t("team.timeOffTitle")}</h2>
          <TimeOffList
            items={closures}
            tz={s.org.timezone}
            label={(x) =>
              x.practitionerId
                ? (pName.get(x.practitionerId) ?? "")
                : x.roomId
                  ? (roomName.get(x.roomId) ?? "")
                  : x.locationId
                    ? t("team.wholeOffice", { office: locName.get(x.locationId) ?? "" })
                    : t("team.wholePractice")
            }
          />
          <div className="mt-5 border-t border-slate-100 pt-5">
            <TimeOffForm
              today={todayIn(s.org.timezone)}
              scopes={[
                ...team.map((p) => ({ value: `practitioner:${p.id}`, label: practitionerName(p) })),
                ...locs.map((l) => ({ value: `location:${l.id}`, label: t("team.scopeOffice", { office: l.name }) })),
                ...roomRows.map((r) => ({ value: `room:${r.id}`, label: t("team.scopeRoom", { room: roomName.get(r.id) ?? r.name }) })),
                { value: "org", label: t("team.scopeHoliday") },
              ]}
            />
          </div>
        </Card>
        {canManage ? (
          <Card className="p-6">
            <h2 className="mb-4 text-lg font-bold">{t("team.addPractitioner")}</h2>
            <PractitionerForm services={svcs} offered={[]} />
          </Card>
        ) : null}
        <Card className="p-6 lg:col-span-2">
          <h2 className="text-lg font-bold">{t("team.membersTitle")}</h2>
          <p className="mb-3 mt-1 text-sm text-slate-500">{t("team.membersDescription")}</p>
          <TeamMembers
            canManage={canManage}
            isOwner={s.role === "owner"}
            members={members.map((m) => ({
              userId: m.userId,
              name: m.name,
              // Colleagues' addresses only for managers; everyone sees who is on the team.
              email: canManage || m.userId === s.user.id ? m.email : "",
              role: m.role,
              mfa: Boolean(m.totp),
              instructionsAccepted: m.instructionsVersion === LEGAL_VERSIONS.staff_instructions,
              you: m.userId === s.user.id,
              sharedAccount: canManage ? m.isPlatformAdmin || elsewhere.has(m.userId) : undefined,
            }))}
            invites={invites
              .filter((i) => i.email && i.role)
              .map((i) => ({
                id: i.id,
                email: i.email!,
                role: i.role!,
                expires: fmtDay(zonedDate(i.expiresAt, s.org.timezone), "short", locale),
              }))}
          />
        </Card>
      </div>
    </div>
  );
}
