import { and, count, eq, gt, inArray } from "drizzle-orm";
import type { Metadata } from "next";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { ToastProvider } from "@/components/dashboard/Toast";
import { db } from "@/db";
import { appointments, waitlist } from "@/db/schema";
import { requireStaff } from "@/lib/auth";

export const metadata: Metadata = { title: { default: "Dashboard", template: "%s · Dashboard" }, robots: { index: false } };

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const s = await requireStaff();
  const now = new Date();
  const [[attention], [requests], [waiting]] = await Promise.all([
    db
      .select({ n: count() })
      .from(appointments)
      .where(and(eq(appointments.orgId, s.org.id), eq(appointments.needsAttention, true), gt(appointments.startsAt, now), inArray(appointments.status, ["scheduled", "requested"]))),
    db
      .select({ n: count() })
      .from(appointments)
      .where(and(eq(appointments.orgId, s.org.id), eq(appointments.status, "requested"), gt(appointments.startsAt, now))),
    db.select({ n: count() }).from(waitlist).where(and(eq(waitlist.orgId, s.org.id), eq(waitlist.status, "active"))),
  ]);

  return (
    <ToastProvider>
      <div className="flex min-h-dvh flex-col bg-[#f7f9fb] lg:flex-row">
        <Sidebar
          user={s.user}
          role={s.role}
          org={{ id: s.org.id, name: s.org.name, slug: s.org.slug, brandColor: s.org.brandColor }}
          orgs={s.orgs.map((o) => ({ id: o.org.id, name: o.org.name }))}
          counts={{ attention: attention?.n ?? 0, requests: requests?.n ?? 0, waitlist: waiting?.n ?? 0 }}
        />
        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </ToastProvider>
  );
}
