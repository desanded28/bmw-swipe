import { and, count, eq, gt, inArray } from "drizzle-orm";
import type { Metadata } from "next";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { ToastProvider } from "@/components/dashboard/Toast";
import { db } from "@/db";
import { appointments, waitlist } from "@/db/schema";
import { CLIENT_NAMESPACES } from "@/i18n/namespaces";
import { ClientMessages } from "@/i18n/ClientMessages";
import { getStaffLocale } from "@/i18n/server";
import { requireStaff } from "@/lib/auth";
import { permissionsFor } from "@/lib/permissions";
import { enforceDashboardGates } from "@/lib/privacy/gates";
import { jakarta } from "../fonts";
import "../globals.css";

export const metadata: Metadata = {
  title: { default: "Dashboard", template: "%s · Dashboard" },
  robots: { index: false },
  icons: { icon: "/icon.svg" },
};

/** Root layout for the staff area (not localised by URL: the language is the staff member's own). */

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const s = await requireStaff();
  await enforceDashboardGates(s);
  const locale = await getStaffLocale();
  const now = new Date();
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
      .where(
        and(eq(appointments.orgId, s.org.id), eq(appointments.status, "requested"), gt(appointments.startsAt, now)),
      ),
    db
      .select({ n: count() })
      .from(waitlist)
      .where(and(eq(waitlist.orgId, s.org.id), eq(waitlist.status, "active"))),
  ]);

  return (
    <html lang={locale} className={jakarta.variable}>
      <body className="min-h-dvh">
        <ClientMessages locale={locale} ns={CLIENT_NAMESPACES}>
          <ToastProvider>
            <div className="flex min-h-dvh flex-col bg-[#f7f9fb] lg:flex-row">
              <Sidebar
                user={s.user}
                role={s.role}
                permissions={permissionsFor(s.role)}
                platformAdmin={s.user.isPlatformAdmin}
                org={{ id: s.org.id, name: s.org.name, slug: s.org.slug, brandColor: s.org.brandColor }}
                orgs={s.orgs.map((o) => ({ id: o.org.id, name: o.org.name }))}
                counts={{ attention: attention?.n ?? 0, requests: requests?.n ?? 0, waitlist: waiting?.n ?? 0 }}
              />
              <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
            </div>
          </ToastProvider>
        </ClientMessages>
      </body>
    </html>
  );
}
