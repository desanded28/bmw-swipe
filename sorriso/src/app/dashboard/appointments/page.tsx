import type { Metadata } from "next";
import Link from "next/link";
import { AppointmentList } from "@/components/dashboard/AppointmentList";
import { PageHeader, cx } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { listAppointments, loadResources } from "@/lib/dashboard";
import { addDays, todayIn, zonedToUtc } from "@/lib/time";

export const metadata: Metadata = { title: "Confirmations" };

const TABS = [
  ["tomorrow", "Tomorrow"],
  ["week", "Next 7 days"],
  ["requests", "Online requests"],
  ["outcome", "Record outcome"],
  ["cancelled", "Recently cancelled"],
] as const;

export default async function ConfirmationsPage({ searchParams }: { searchParams: Promise<{ tab?: string; filter?: string }> }) {
  const s = await requireStaff();
  const sp = await searchParams;
  const tab = TABS.some(([k]) => k === sp.tab) ? sp.tab! : "tomorrow";
  const onlyPending = sp.filter === "pending";
  const tz = s.org.timezone;
  const today = todayIn(tz);
  const resources = await loadResources(s.org.id, tz);

  let list =
    tab === "tomorrow"
      ? await listAppointments(s.org.id, { from: zonedToUtc(addDays(today, 1), 0, tz), to: zonedToUtc(addDays(today, 2), 0, tz), statuses: ["scheduled", "requested"] })
      : tab === "week"
        ? await listAppointments(s.org.id, { from: new Date(), to: zonedToUtc(addDays(today, 8), 0, tz), statuses: ["scheduled", "requested"] })
        : tab === "requests"
          ? await listAppointments(s.org.id, { from: new Date(), statuses: ["requested"] })
          : tab === "outcome"
            ? await listAppointments(s.org.id, { from: zonedToUtc(addDays(today, -14), 0, tz), to: new Date(), statuses: ["scheduled"] })
            : await listAppointments(s.org.id, { from: new Date(), statuses: ["cancelled"] });
  const pendingCount = list.filter((a) => a.status === "scheduled" && a.confirmation === "pending").length;
  if (onlyPending) list = list.filter((a) => a.status === "scheduled" && a.confirmation === "pending");

  const descriptions: Record<string, string> = {
    tomorrow: "Who's coming tomorrow. Chase the ones still awaiting confirmation — patients with past no-shows are flagged.",
    week: "Everything booked for the coming week.",
    requests: "Online bookings waiting for your approval (when “require approval” is on).",
    outcome: "Past visits without an outcome. Mark them completed (triggers a review request) or no-show.",
    cancelled: "Upcoming slots freed by cancellations. Matching waitlist patients were offered them automatically.",
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Confirmations" description={descriptions[tab]} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {TABS.map(([key, label]) => (
          <Link
            key={key}
            href={`/dashboard/appointments?tab=${key}`}
            className={cx("rounded-full px-3.5 py-1.5 text-sm font-semibold ring-1", tab === key ? "bg-ink text-white ring-ink" : "bg-white text-slate-600 ring-slate-200 hover:ring-slate-300")}
          >
            {label}
          </Link>
        ))}
        {tab === "tomorrow" || tab === "week" ? (
          <Link
            href={`/dashboard/appointments?tab=${tab}${onlyPending ? "" : "&filter=pending"}`}
            className={cx("ml-auto rounded-full px-3.5 py-1.5 text-sm font-semibold ring-1", onlyPending ? "bg-amber-100 text-amber-900 ring-amber-300" : "bg-white text-slate-600 ring-slate-200")}
          >
            Only awaiting confirmation ({pendingCount})
          </Link>
        ) : null}
      </div>
      <AppointmentList appointments={list} resources={resources} empty="Nothing to show here." />
    </div>
  );
}
