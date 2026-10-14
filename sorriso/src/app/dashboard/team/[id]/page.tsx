import { and, asc, eq, gt } from "drizzle-orm";
import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PractitionerForm } from "@/components/dashboard/PractitionerForm";
import { ScheduleEditor } from "@/components/dashboard/ScheduleEditor";
import { TimeOffForm, TimeOffList } from "@/components/dashboard/TimeOff";
import { IcsFeedCard } from "@/components/security/IcsFeedCard";
import { Avatar, Card } from "@/components/ui";
import { db } from "@/db";
import { locations, practitionerServices, practitioners, schedules, services, timeOff } from "@/db/schema";
import { fmtDay, zonedDate } from "@/i18n/datefmt";
import { lhref } from "@/i18n/href";
import { getStaffLocale, getT } from "@/i18n/server";
import { practitionerName } from "@/lib/format";
import { can, requirePermission } from "@/lib/permissions";
import { getPrivacy } from "@/lib/privacy/settings";
import { minutesToHHMM, todayIn } from "@/lib/time";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getStaffLocale(), "security")("practitioner.metaTitle") };
}

export default async function PractitionerAdminPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const s = await requirePermission("calendar.read");
  const { id } = await params;
  const { created } = await searchParams;
  const locale = await getStaffLocale();
  const t = getT(locale, "security");
  const [p] = await db.select().from(practitioners).where(and(eq(practitioners.id, id), eq(practitioners.orgId, s.org.id)));
  if (!p) notFound();
  const [svcs, links, locs, sched, off] = await Promise.all([
    db.select().from(services).where(eq(services.orgId, s.org.id)).orderBy(asc(services.sortOrder)),
    db.select().from(practitionerServices).where(eq(practitionerServices.practitionerId, id)),
    db.select().from(locations).where(and(eq(locations.orgId, s.org.id), eq(locations.active, true))).orderBy(asc(locations.name)),
    db.select().from(schedules).where(eq(schedules.practitionerId, id)),
    db
      .select()
      .from(timeOff)
      .where(and(eq(timeOff.orgId, s.org.id), eq(timeOff.practitionerId, id), gt(timeOff.endsAt, new Date())))
      .orderBy(asc(timeOff.startsAt)),
  ]);
  const canManage = can(s.role, "team.manage");
  const isSelf = p.userId !== null && p.userId === s.user.id;
  // The feed is the practitioner's own: only they or a manager see or change it.
  const feedVisible = canManage || isSelf;
  const privacy = getPrivacy(s.org);
  const feedOn = Boolean(p.icsEnabled && p.icsTokenHash && (!p.icsTokenExpiresAt || p.icsTokenExpiresAt > new Date()));

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/dashboard/team" className="text-sm font-semibold text-slate-500 hover:text-ink">
        ← {t("practitioner.back")}
      </Link>
      <div className="mb-6 mt-3 flex flex-wrap items-center gap-4">
        <Avatar name={p.name} color={p.color} size={56} />
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{practitionerName(p)}</h1>
          <p className="text-sm text-slate-500">{p.specialty.trim() || getT(locale, "marketplace")("profile.defaultSpecialty")}</p>
        </div>
        <Link
          href={lhref(locale, `/c/${s.org.slug}/${p.slug}`)}
          target="_blank"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline"
        >
          {t("practitioner.publicProfile")} <ExternalLink size={14} aria-hidden />
        </Link>
      </div>
      {created ? (
        <p role="status" className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
          {t("practitioner.created")}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="mb-1 text-lg font-bold">{t("practitioner.hoursTitle")}</h2>
            <p className="mb-4 text-sm text-slate-500">{t("practitioner.hoursDescription")}</p>
            {canManage ? (
              <ScheduleEditor
                practitionerId={p.id}
                locations={locs.map((l) => ({ id: l.id, name: l.name }))}
                initial={sched.map((r) => ({ weekday: r.weekday, locationId: r.locationId, start: minutesToHHMM(r.startMinute), end: minutesToHHMM(r.endMinute) }))}
              />
            ) : (
              <p className="text-sm text-slate-500">{t("practitioner.hoursManagersOnly")}</p>
            )}
          </Card>
          <Card className="p-6">
            <h2 className="mb-4 text-lg font-bold">{t("practitioner.timeOffTitle")}</h2>
            <TimeOffList items={off} tz={s.org.timezone} />
            <div className="mt-5 border-t border-slate-100 pt-5">
              <TimeOffForm scopes={[{ value: `practitioner:${p.id}`, label: practitionerName(p) }]} today={todayIn(s.org.timezone)} />
            </div>
          </Card>
        </div>
        <div className="space-y-6">
          {/* The practitioner themselves too: only they approve their public profile or leave the
              marketplace (PractitionerForm shows a non-manager the record read-only). */}
          {canManage || isSelf ? (
            <Card className="p-6">
              <h2 className="mb-4 text-lg font-bold">{t("practitioner.profileTitle")}</h2>
              <PractitionerForm practitioner={p} services={svcs} offered={links.map((l) => l.serviceId)} />
            </Card>
          ) : null}
          {feedVisible ? (
            <IcsFeedCard
              practitionerId={p.id}
              orgEnabled={privacy.icsFeedsEnabled}
              feedOn={feedOn}
              expires={feedOn && p.icsTokenExpiresAt ? fmtDay(zonedDate(p.icsTokenExpiresAt, s.org.timezone), "long", locale) : null}
              detail={privacy.icsDetail}
              canOpenPrivacySettings={can(s.role, "privacy.settings")}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
