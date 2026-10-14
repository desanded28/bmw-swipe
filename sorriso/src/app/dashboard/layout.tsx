import { and, count, eq, gt, inArray } from "drizzle-orm";
import type { Metadata } from "next";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { ToastProvider } from "@/components/dashboard/Toast";
import { db } from "@/db";
import { appointments, waitlist } from "@/db/schema";
import { DIR } from "@/i18n/config";
import { ClientMessages } from "@/i18n/ClientMessages";
import { CLIENT_NAMESPACES } from "@/i18n/namespaces";
import { getStaffLocale, getT } from "@/i18n/server";
import { requireStaff } from "@/lib/auth";
import { APP_NAME } from "@/lib/config";
import { permissionsFor } from "@/lib/permissions";
import { enforceDashboardGates } from "@/lib/privacy/gates";
import { jakarta } from "../fonts";
import "../globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = getT(await getStaffLocale(), "dashboard");
  return {
    title: { default: t("meta.title"), template: t("meta.template", { page: "%s", app: APP_NAME }) },
    robots: { index: false, follow: false },
    icons: { icon: "/icon.svg" },
  };
}

/**
 * Root layout of the staff area. Not localised by URL: the language is the staff member's own
 * (getStaffLocale: users.locale, chosen in the sidebar, then the browser and the practice
 * default), so <html lang> and every text follow the person, not the link.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const s = await requireStaff();
  await enforceDashboardGates(s);
  const locale = await getStaffLocale();
  const t = getT(locale, "dashboard");
  const now = new Date();
  // Counters only (no patient data): the sidebar's badges.
  const [[attention], [requests], [waiting]] = await Promise.all([
    db
      .select({ n: count() })
      .from(appointments)
      .where(
        and(
          eq(appointments.orgId, s.org.id),
          eq(appointments.needsAttention, true),
          gt(appointments.startsAt, now),
          inArray(appointments.status, ["scheduled", "requested"]),
        ),
      ),
    db
      .select({ n: count() })
      .from(appointments)
      .where(and(eq(appointments.orgId, s.org.id), eq(appointments.status, "requested"), gt(appointments.startsAt, now))),
    db
      .select({ n: count() })
      .from(waitlist)
      .where(and(eq(waitlist.orgId, s.org.id), eq(waitlist.status, "active"))),
  ]);

  return (
    <html lang={locale} dir={DIR[locale]} className={jakarta.variable}>
      <body className="min-h-dvh">
        <ClientMessages locale={locale} ns={CLIENT_NAMESPACES}>
          <a
            href="#main"
            className="sr-only z-[70] rounded-lg bg-white px-4 py-2 font-semibold text-ink shadow-pop focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
          >
            {t("skipToContent")}
          </a>
          <ToastProvider>
            <div className="flex min-h-dvh flex-col bg-[#f7f9fb] lg:flex-row">
              <Sidebar
                user={{ name: s.user.name, email: s.user.email, locale: s.user.locale }}
                role={s.role}
                permissions={permissionsFor(s.role)}
                platformAdmin={s.user.isPlatformAdmin}
                org={{ id: s.org.id, name: s.org.name, slug: s.org.slug, brandColor: s.org.brandColor }}
                orgs={s.orgs.map((o) => ({ id: o.org.id, name: o.org.name }))}
                counts={{ attention: attention?.n ?? 0, requests: requests?.n ?? 0, waitlist: waiting?.n ?? 0 }}
              />
              <main id="main" tabIndex={-1} className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
                {children}
              </main>
            </div>
          </ToastProvider>
        </ClientMessages>
      </body>
    </html>
  );
}
