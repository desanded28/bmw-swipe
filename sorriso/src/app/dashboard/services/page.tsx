import { asc, eq } from "drizzle-orm";
import { ChevronDown } from "lucide-react";
import type { Metadata } from "next";
import { ServiceForm } from "@/components/dashboard/ServiceForm";
import { Badge, Card, PageHeader } from "@/components/ui";
import { db } from "@/db";
import { practitionerServices, practitioners, services } from "@/db/schema";
import { MANAGERS, requireStaff } from "@/lib/auth";
import { CATEGORY_LABELS, formatPrice } from "@/lib/format";

export const metadata: Metadata = { title: "Treatments" };

export default async function ServicesPage() {
  const s = await requireStaff();
  const canManage = MANAGERS.includes(s.role);
  const [svcs, links] = await Promise.all([
    db.select().from(services).where(eq(services.orgId, s.org.id)).orderBy(asc(services.sortOrder)),
    db
      .select({ serviceId: practitionerServices.serviceId, name: practitioners.name })
      .from(practitionerServices)
      .innerJoin(practitioners, eq(practitioners.id, practitionerServices.practitionerId))
      .where(eq(practitioners.orgId, s.org.id)),
  ]);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Treatments & prices" description="Durations drive availability: a 45-minute cleaning with a 10-minute buffer blocks the chair for 55 minutes." />
      <Card className="divide-y divide-slate-100">
        {svcs.map((svc) => {
          const who = links.filter((l) => l.serviceId === svc.id).map((l) => l.name.split(" ").slice(-1)[0]);
          return (
            <details key={svc.id} className="group">
              <summary className="flex cursor-pointer list-none items-center gap-4 px-5 py-4 hover:bg-slate-50">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {svc.name} {!svc.active ? <Badge tone="red">Inactive</Badge> : null} {!svc.onlineBookable ? <Badge tone="amber">Front desk only</Badge> : null}
                  </p>
                  <p className="text-xs text-slate-500">
                    {CATEGORY_LABELS[svc.category]} · {who.length ? who.join(", ") : "nobody offers it yet"}
                  </p>
                </div>
                <div className="text-right text-sm">
                  <p className="font-bold">{formatPrice(svc.priceCents)}</p>
                  <p className="text-xs text-slate-500">
                    {svc.durationMinutes} min{svc.bufferMinutes ? ` + ${svc.bufferMinutes}` : ""}
                  </p>
                </div>
                <ChevronDown size={18} className="text-slate-400 transition group-open:rotate-180" />
              </summary>
              {canManage ? (
                <div className="border-t border-slate-100 bg-slate-50/60 p-5">
                  <ServiceForm service={svc} />
                </div>
              ) : null}
            </details>
          );
        })}
      </Card>
      {canManage ? (
        <Card className="mt-6 p-6">
          <h2 className="mb-4 text-lg font-bold">Add a treatment</h2>
          <ServiceForm />
        </Card>
      ) : null}
    </div>
  );
}
