"use client";

import {
  BellRing,
  Building2,
  CalendarDays,
  ChevronDown,
  Hourglass,
  LayoutDashboard,
  ListChecks,
  LogOut,
  MessageCircle,
  Settings,
  Star,
  Stethoscope,
  Users,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition } from "react";
import { logout } from "@/app/auth-actions";
import { switchOrg } from "@/app/dashboard/actions";
import { Avatar, Logo, cx } from "../ui";

type Counts = { attention: number; requests: number; waitlist: number };

const NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/dashboard/appointments", label: "Confirmations", icon: ListChecks, count: "requests" as const },
  { href: "/dashboard/messages", label: "Messages", icon: MessageCircle, count: "attention" as const },
  { href: "/dashboard/patients", label: "Patients", icon: UserRound },
  { href: "/dashboard/waitlist", label: "Waitlist", icon: Hourglass, count: "waitlist" as const, muted: true },
  { href: "/dashboard/reviews", label: "Reviews", icon: Star },
];
const SETUP = [
  { href: "/dashboard/team", label: "Team & hours", icon: Users },
  { href: "/dashboard/services", label: "Treatments", icon: Stethoscope },
  { href: "/dashboard/locations", label: "Offices & chairs", icon: Building2 },
  { href: "/dashboard/reminders", label: "Reminders", icon: BellRing },
  { href: "/dashboard/settings", label: "Settings & API", icon: Settings },
];

export function Sidebar({
  user,
  org,
  orgs,
  role,
  counts,
}: {
  user: { name: string; email: string };
  org: { id: string; name: string; slug: string; brandColor: string };
  orgs: { id: string; name: string }[];
  role: string;
  counts: Counts;
}) {
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const active = (href: string, exact?: boolean) => (exact ? pathname === href : pathname.startsWith(href));

  const link = (item: (typeof NAV)[number] | (typeof SETUP)[number]) => {
    const Icon = item.icon;
    const count = "count" in item && item.count ? counts[item.count] : 0;
    return (
      <Link
        key={item.href}
        href={item.href}
        className={cx(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
          active(item.href, "exact" in item ? item.exact : false)
            ? "bg-white text-ink shadow-sm ring-1 ring-slate-200"
            : "text-slate-600 hover:bg-white/70 hover:text-ink",
        )}
      >
        <Icon size={17} className="shrink-0" />
        <span className="flex-1 whitespace-nowrap">{item.label}</span>
        {count ? (
          <span
            className={cx(
              "rounded-full px-1.5 text-[11px] font-bold",
              "muted" in item && item.muted ? "bg-slate-200 text-slate-600" : "bg-red-500 text-white",
            )}
          >
            {count}
          </span>
        ) : null}
      </Link>
    );
  };

  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-slate-200 bg-slate-50 lg:sticky lg:top-0 lg:h-dvh lg:w-64 lg:border-b-0 lg:border-r">
      <div className="flex items-center justify-between px-4 py-4">
        <Link href="/dashboard">
          <Logo />
        </Link>
        <Link href={`/c/${org.slug}`} target="_blank" className="text-xs font-semibold text-slate-500 hover:text-ink">
          Public page ↗
        </Link>
      </div>

      <div className="px-3">
        <label className="relative flex items-center gap-2 rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200">
          <Avatar name={org.name} color={org.brandColor} size={26} />
          <span className="min-w-0 flex-1 truncate text-sm font-bold">{org.name}</span>
          {orgs.length > 1 ? <ChevronDown size={15} className="text-slate-400" /> : null}
          {orgs.length > 1 ? (
            <select
              aria-label="Switch practice"
              className="absolute inset-0 cursor-pointer opacity-0"
              value={org.id}
              disabled={pending}
              onChange={(e) => start(() => switchOrg(e.target.value))}
            >
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          ) : null}
        </label>
      </div>

      <nav className="scrollbar-thin flex gap-1 overflow-x-auto px-3 py-3 lg:flex-1 lg:flex-col lg:overflow-y-auto">
        {NAV.map(link)}
        <p className="hidden px-3 pb-1 pt-4 text-[11px] font-bold uppercase tracking-wider text-slate-400 lg:block">Setup</p>
        {SETUP.map(link)}
      </nav>

      <div className="hidden items-center gap-3 border-t border-slate-200 px-4 py-3 lg:flex">
        <Avatar name={user.name} color="#475569" size={32} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{user.name}</p>
          <p className="truncate text-xs capitalize text-slate-500">{role}</p>
        </div>
        <form action={logout}>
          <button className="rounded-lg p-2 text-slate-500 hover:bg-white hover:text-ink" aria-label="Log out" title="Log out">
            <LogOut size={17} />
          </button>
        </form>
      </div>
    </aside>
  );
}
