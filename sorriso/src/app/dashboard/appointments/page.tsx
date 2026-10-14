import type { Metadata } from "next";
import Link from "next/link";
import { AppointmentList } from "@/components/dashboard/AppointmentList";
import { riskRank, type ApptListDTO } from "@/components/dashboard/types";
import { PageHeader, cx } from "@/components/ui";
import { zonedDate } from "@/i18n/datefmt";
import { getStaffLocale, getT } from "@/i18n/server";
import { auditListView, listAppointments, listViewer, loadResources } from "@/lib/dashboard";
import { can, requirePermission } from "@/lib/permissions";
import { addDays, todayIn, zonedToUtc } from "@/lib/time";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getStaffLocale(), "dashboard")("confirmations.title") };
}

const TABS = ["tomorrow", "week", "requests", "outcome", "cancelled"] as const;
type Tab = (typeof TABS)[number];

const unconfirmed = (a: ApptListDTO) => a.status === "scheduled" && a.confirmation === "pending";

/**
 * Who to call first: on each day, unconfirmed visits come first, highest no-show risk first
 * (WP8's risk level, when the practice uses risk-based reminders), then everything else by time.
 * Without any risk level the list keeps its plain time order.
 */
function byRisk(list: ApptListDTO[]): ApptListDTO[] {
  if (!list.some((a) => a.riskLevel)) return list;
  const day = (a: ApptListDTO) => zonedDate(a.start, a.location.timezone);
  return [...list].sort(
    (a, b) =>
      day(a).localeCompare(day(b)) ||
      Number(unconfirmed(b)) - Number(unconfirmed(a)) ||
      (unconfirmed(a) ? riskRank(a.riskLevel) - riskRank(b.riskLevel) : 0) ||
      a.start.localeCompare(b.start),
  );
}

export default async function ConfirmationsPage({ searchParams }: { searchParams: Promise<{ tab?: string; filter?: string }> }) {
  const s = await requirePermission("calendar.read");
  const sp = await searchParams;
  const locale = await getStaffLocale();
  const t = getT(locale, "dashboard");
  const tab: Tab = TABS.find((k) => k === sp.tab) ?? "tomorrow";
  const onlyPending = sp.filter === "pending";
  const tz = s.org.timezone;
  const today = todayIn(tz);
  const viewer = listViewer(s, locale);
  const now = new Date();
  const resources = await loadResources(s.org.id, tz);

  let list =
    tab === "tomorrow"
      ? await listAppointments(s.org.id, { from: zonedToUtc(addDays(today, 1), 0, tz), to: zonedToUtc(addDays(today, 2), 0, tz), statuses: ["scheduled", "requested"], viewer })
      : tab === "week"
        ? await listAppointments(s.org.id, { from: now, to: zonedToUtc(addDays(today, 8), 0, tz), statuses: ["scheduled", "requested"], viewer })
        : tab === "requests"
          ? await listAppointments(s.org.id, { from: now, statuses: ["requested"], viewer })
          : tab === "outcome"
            ? await listAppointments(s.org.id, { from: zonedToUtc(addDays(today, -14), 0, tz), to: now, statuses: ["scheduled"], viewer })
            : await listAppointments(s.org.id, { from: now, statuses: ["cancelled"], viewer });
  const pendingCount = list.filter(unconfirmed).length;
  if (onlyPending) list = list.filter(unconfirmed);
  const sorted = tab === "tomorrow" || tab === "week" ? byRisk(list) : list;
  const riskSorted = sorted !== list;
  await auditListView(s, `confirmations_${tab}`, sorted.length);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title={t("confirmations.title")} description={t(`confirmations.descriptions.${tab}`)} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <nav aria-label={t("confirmations.tabs.label")} className="flex flex-wrap gap-2">
          {TABS.map((key) => (
            <Link
              key={key}
              href={`/dashboard/appointments?tab=${key}`}
              aria-current={tab === key ? "page" : undefined}
              className={cx(
                "rounded-full px-3.5 py-1.5 text-sm font-semibold ring-1",
                tab === key ? "bg-ink text-white ring-ink" : "bg-white text-slate-700 ring-slate-300 hover:ring-slate-400",
              )}
            >
              {t(`confirmations.tabs.${key}`)}
            </Link>
          ))}
        </nav>
        {tab === "tomorrow" || tab === "week" ? (
          <Link
            href={`/dashboard/appointments?tab=${tab}${onlyPending ? "" : "&filter=pending"}`}
            className={cx(
              "ml-auto rounded-full px-3.5 py-1.5 text-sm font-semibold ring-1",
              onlyPending ? "bg-amber-100 text-amber-950 ring-amber-300" : "bg-white text-slate-700 ring-slate-300",
            )}
          >
            {t("confirmations.onlyPending", { count: pendingCount })}
          </Link>
        ) : null}
      </div>
      {riskSorted ? <p className="mb-3 text-xs text-slate-600">{t("confirmations.riskSorted")}</p> : null}
      <AppointmentList appointments={sorted} resources={resources} quickActions={can(s.role, "appointment.write")} empty={t("confirmations.empty")} />
    </div>
  );
}
