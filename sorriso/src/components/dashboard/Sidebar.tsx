"use client";

import {
  BellRing,
  Building2,
  CalendarClock,
  CalendarDays,
  ChartColumn,
  ChevronDown,
  ExternalLink,
  Fingerprint,
  GitMerge,
  Globe,
  HeartHandshake,
  Hourglass,
  Inbox,
  KeyRound,
  Languages,
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
import { switchOrg, updateMyLocale } from "@/app/dashboard/actions/session";
import { ENDONYM, LOCALES, isLocale, type Locale } from "@/i18n/config";
import { lhref } from "@/i18n/href";
import { useLocale, useT } from "@/i18n/provider";
import type { Permission } from "@/lib/permissions";
import { Avatar, Logo, cx } from "../ui";
import { useRunAction } from "./useRunAction";

type Counts = { attention: number; requests: number; waitlist: number };

type NavKey =
  | "overview"
  | "calendar"
  | "confirmations"
  | "messages"
  | "patients"
  | "duplicates"
  | "waitlist"
  | "recalls"
  | "reviews"
  | "analytics"
  | "team"
  | "services"
  | "locations"
  | "reminders"
  | "settings"
  | "funds"
  | "api"
  | "privacyRequests"
  | "privacySettings"
  | "audit"
  | "security"
  | "platform"
  | "platformPrivacy";

type NavItem = {
  href: string;
  key: NavKey;
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
  { href: "/dashboard", key: "overview", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/calendar", key: "calendar", icon: CalendarDays, perm: "calendar.read" },
  { href: "/dashboard/appointments", key: "confirmations", icon: ListChecks, count: "requests", perm: "calendar.read" },
  { href: "/dashboard/messages", key: "messages", icon: MessageCircle, count: "attention", perm: "messages.read" },
  { href: "/dashboard/patients", key: "patients", icon: UserRound, perm: "patient.read" },
  { href: "/dashboard/patients/duplicates", key: "duplicates", icon: GitMerge, perm: "patient.read" },
  { href: "/dashboard/waitlist", key: "waitlist", icon: Hourglass, count: "waitlist", muted: true, perm: "calendar.read" },
  { href: "/dashboard/recalls", key: "recalls", icon: CalendarClock, perm: "recalls.manage" },
  { href: "/dashboard/reviews", key: "reviews", icon: Star },
  { href: "/dashboard/analytics", key: "analytics", icon: ChartColumn, perm: "analytics.read" },
];
const SETUP: NavItem[] = [
  { href: "/dashboard/team", key: "team", icon: Users },
  { href: "/dashboard/services", key: "services", icon: Stethoscope },
  { href: "/dashboard/locations", key: "locations", icon: Building2 },
  { href: "/dashboard/reminders", key: "reminders", icon: BellRing },
  { href: "/dashboard/settings", key: "settings", icon: Settings },
  { href: "/dashboard/settings/funds", key: "funds", icon: HeartHandshake, perm: "catalog.manage" },
  { href: "/dashboard/settings/api", key: "api", icon: KeyRound, perm: "apikeys.manage" },
];
const PRIVACY: NavItem[] = [
  { href: "/dashboard/privacy", key: "privacyRequests", icon: ShieldCheck, perm: "privacy.requests" },
  { href: "/dashboard/settings/privacy", key: "privacySettings", icon: LockKeyhole, perm: "privacy.settings" },
  { href: "/dashboard/audit", key: "audit", icon: ScrollText, perm: "audit.read" },
];
const ACCOUNT: NavItem[] = [
  { href: "/dashboard/account/security", key: "security", icon: Fingerprint },
  { href: "/dashboard/platform", key: "platform", icon: Globe, platformOnly: true },
  // Sorriso's own privacy inbox (WP5): requests where Sorriso is the controller.
  { href: "/dashboard/platform/privacy", key: "platformPrivacy", icon: Inbox, platformOnly: true },
];

const AUTO = "auto";

export function Sidebar({
  user,
  org,
  orgs,
  role,
  permissions,
  platformAdmin,
  counts,
}: {
  /** `locale` is the user's own choice (users.locale); null = automatic. */
  user: { name: string; email: string; locale?: string | null };
  org: { id: string; name: string; slug: string; brandColor: string };
  orgs: { id: string; name: string }[];
  role: string;
  /** The signed-in role's permissions (permissionsFor(role)): entries needing another one are hidden. */
  permissions: readonly Permission[];
  /** users.isPlatformAdmin: shows the Platform entry. */
  platformAdmin: boolean;
  counts: Counts;
}) {
  const t = useT("dashboard");
  const tc = useT("common");
  const locale = useLocale();
  const pathname = usePathname();
  const [switching, start] = useTransition();
  const { run, pending: savingLocale } = useRunAction();
  const choice: Locale | typeof AUTO = isLocale(user.locale) ? user.locale : AUTO;
  const visible = (items: NavItem[]) =>
    items.filter((i) => (!i.perm || permissions.includes(i.perm)) && (!i.platformOnly || platformAdmin));
  const groups = { nav: visible(NAV), setup: visible(SETUP), privacy: visible(PRIVACY), account: visible(ACCOUNT) };
  // The deepest matching entry is the active one (Settings stays inactive on Settings → API).
  const current = Object.values(groups)
    .flat()
    .filter((i) => (i.exact ? pathname === i.href : pathname === i.href || pathname.startsWith(`${i.href}/`)))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  const roleKey = `roles.${role}` as const;

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
          item.href === current ? "bg-white text-ink shadow-sm ring-1 ring-slate-200" : "text-slate-700 hover:bg-white/70 hover:text-ink",
        )}
      >
        <Icon size={17} className="shrink-0" aria-hidden />
        <span className="flex-1 whitespace-nowrap">{t(`nav.${item.key}`)}</span>
        {count ? (
          <span className={cx("rounded-full px-1.5 text-[11px] font-bold", item.muted ? "bg-slate-200 text-slate-700" : "bg-red-600 text-white")}>
            <span aria-hidden>{count}</span>
            <span className="sr-only">{t("nav.count", { count })}</span>
          </span>
        ) : null}
      </Link>
    );
  };
  const heading = (key: "setup" | "privacy" | "account") => (
    <p className="hidden px-3 pb-1 pt-4 text-[11px] font-bold uppercase tracking-wider text-slate-500 lg:block">{t(`nav.groups.${key}`)}</p>
  );

  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-slate-200 bg-slate-50 lg:sticky lg:top-0 lg:h-dvh lg:w-64 lg:border-b-0 lg:border-r">
      <div className="flex items-center justify-between px-4 py-4">
        <Link href="/dashboard" aria-label={t("sidebar.home")}>
          <Logo />
        </Link>
        <a
          href={lhref(locale, `/c/${org.slug}`)}
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-ink"
          aria-label={t("sidebar.publicPageNewTab")}
        >
          {t("sidebar.publicPage")} <ExternalLink size={12} aria-hidden />
        </a>
      </div>

      <div className="px-3">
        <label className="relative flex items-center gap-2 rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200 focus-within:ring-2 focus-within:ring-brand-600">
          <Avatar name={org.name} color={org.brandColor} size={26} />
          <span className="min-w-0 flex-1 truncate text-sm font-bold">{org.name}</span>
          {orgs.length > 1 ? <ChevronDown size={15} className="text-slate-500" aria-hidden /> : null}
          {orgs.length > 1 ? (
            <select
              aria-label={t("sidebar.switchPractice")}
              className="absolute inset-0 cursor-pointer opacity-0"
              value={org.id}
              disabled={switching}
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

      <nav aria-label={t("nav.label")} className="scrollbar-thin relative flex gap-1 overflow-x-auto px-3 py-3 lg:flex-1 lg:flex-col lg:overflow-y-auto">
        {groups.nav.map(link)}
        {groups.setup.length ? heading("setup") : null}
        {groups.setup.map(link)}
        {groups.privacy.length ? heading("privacy") : null}
        {groups.privacy.map(link)}
        {heading("account")}
        {groups.account.map(link)}
      </nav>

      <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 px-4 py-3">
        <Avatar name={user.name} color="#475569" size={32} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{user.name}</p>
          <p className="truncate text-xs text-slate-600">{tc.has(roleKey) ? tc(roleKey) : role}</p>
        </div>
        <form action={logout}>
          <button className="rounded-lg p-2 text-slate-600 hover:bg-white hover:text-ink" aria-label={t("sidebar.logout")} title={t("sidebar.logout")}>
            <LogOut size={17} aria-hidden />
          </button>
        </form>
        <label className="flex w-full items-center gap-2 text-xs font-semibold text-slate-700">
          <Languages size={15} className="shrink-0 text-slate-500" aria-hidden />
          <span className="sr-only">{t("sidebar.language")}</span>
          <select
            className="h-8 min-w-0 flex-1 rounded-lg bg-white px-2 text-[13px] font-medium ring-1 ring-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-600"
            value={choice}
            disabled={savingLocale}
            onChange={(e) => {
              const next = e.target.value === AUTO ? null : (e.target.value as Locale);
              run(() => updateMyLocale(next));
            }}
          >
            <option value={AUTO}>{t("sidebar.languageAuto", { language: ENDONYM[locale] })}</option>
            {LOCALES.map((l) => (
              <option key={l} value={l} lang={l}>
                {ENDONYM[l]}
              </option>
            ))}
          </select>
        </label>
      </div>
    </aside>
  );
}
