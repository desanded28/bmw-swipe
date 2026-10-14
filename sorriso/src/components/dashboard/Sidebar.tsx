"use client";

import {
  BellRing,
  Building2,
  CalendarClock,
  CalendarDays,
  ChartColumn,
  ChevronDown,
  Fingerprint,
  Globe,
  HeartHandshake,
  Hourglass,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  LockKeyhole,
  LogOut,
  MessageCircle,
  ScrollText,
  Settings,
  ShieldCheck,
  Star,
  Stethoscope,
  Users,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition } from "react";
import { logout } from "@/app/auth-actions";
import { switchOrg } from "@/app/dashboard/actions/session";
import type { Permission } from "@/lib/permissions";
import { Avatar, Logo, cx } from "../ui";

type Counts = { attention: number; requests: number; waitlist: number };

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  count?: keyof Counts;
  muted?: boolean;
  /** Hidden unless the signed-in role has it. */
  perm?: Permission;
  /** Hidden unless the user is a Sorriso platform admin. */
  platformOnly?: boolean;
};

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/dashboard/appointments", label: "Confirmations", icon: ListChecks, count: "requests" },
  { href: "/dashboard/messages", label: "Messages", icon: MessageCircle, count: "attention" },
  { href: "/dashboard/patients", label: "Patients", icon: UserRound },
  { href: "/dashboard/waitlist", label: "Waitlist", icon: Hourglass, count: "waitlist", muted: true },
  { href: "/dashboard/recalls", label: "Recalls", icon: CalendarClock, perm: "recalls.manage" },
  { href: "/dashboard/reviews", label: "Reviews", icon: Star },
  { href: "/dashboard/analytics", label: "Analytics", icon: ChartColumn, perm: "analytics.read" },
];
const SETUP: NavItem[] = [
  { href: "/dashboard/team", label: "Team & hours", icon: Users },
  { href: "/dashboard/services", label: "Treatments", icon: Stethoscope },
  { href: "/dashboard/locations", label: "Offices & chairs", icon: Building2 },
  { href: "/dashboard/reminders", label: "Reminders", icon: BellRing },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
  { href: "/dashboard/settings/funds", label: "Health funds", icon: HeartHandshake, perm: "catalog.manage" },
  { href: "/dashboard/settings/api", label: "API", icon: KeyRound, perm: "apikeys.manage" },
];
const PRIVACY: NavItem[] = [
  { href: "/dashboard/privacy", label: "Privacy requests", icon: ShieldCheck, perm: "privacy.requests" },
  { href: "/dashboard/settings/privacy", label: "Privacy settings", icon: LockKeyhole, perm: "privacy.settings" },
  { href: "/dashboard/audit", label: "Audit log", icon: ScrollText, perm: "audit.read" },
];
const ACCOUNT: NavItem[] = [
  { href: "/dashboard/account/security", label: "My security", icon: Fingerprint },
  { href: "/dashboard/platform", label: "Platform", icon: Globe, platformOnly: true },
];

export function Sidebar({
  user,
  org,
  orgs,
  role,
  permissions,
  platformAdmin,
  counts,
}: {
  user: { name: string; email: string };
  org: { id: string; name: string; slug: string; brandColor: string };
  orgs: { id: string; name: string }[];
  role: string;
  /** The signed-in role's permissions (permissionsFor(role)): entries needing another one are hidden. */
  permissions: readonly Permission[];
  /** users.isPlatformAdmin: shows the Platform entry. */
  platformAdmin: boolean;
  counts: Counts;
}) {
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const visible = (items: NavItem[]) =>
    items.filter((i) => (!i.perm || permissions.includes(i.perm)) && (!i.platformOnly || platformAdmin));
  const groups = { nav: visible(NAV), setup: visible(SETUP), privacy: visible(PRIVACY), account: visible(ACCOUNT) };
  // The deepest matching entry is the active one (Settings stays inactive on Settings → API).
  const current = Object.values(groups)
    .flat()
    .filter((i) => (i.exact ? pathname === i.href : pathname === i.href || pathname.startsWith(`${i.href}/`)))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  const link = (item: NavItem) => {
    const Icon = item.icon;
    const count = item.count ? counts[item.count] : 0;
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={item.href === current ? "page" : undefined}
        className={cx(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
          item.href === current
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
              item.muted ? "bg-slate-200 text-slate-600" : "bg-red-500 text-white",
            )}
          >
            {count}
          </span>
        ) : null}
      </Link>
    );
  };
  const heading = (label: string) => (
    <p className="hidden px-3 pb-1 pt-4 text-[11px] font-bold uppercase tracking-wider text-slate-400 lg:block">{label}</p>
  );

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
        {groups.nav.map(link)}
        {heading("Setup")}
        {groups.setup.map(link)}
        {groups.privacy.length ? heading("Privacy") : null}
        {groups.privacy.map(link)}
        {heading("Account")}
        {groups.account.map(link)}
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
