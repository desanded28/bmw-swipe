import { asc, eq } from "drizzle-orm";
import { ChevronDown } from "lucide-react";
import type { Metadata } from "next";
import { ServiceForm } from "@/components/dashboard/ServiceForm";
import { priceLabel } from "@/components/marketplace/price";
import { Badge, Card, PageHeader } from "@/components/ui";
import { db } from "@/db";
import { practitionerServices, practitioners, services } from "@/db/schema";
import { getStaffLocale, getT } from "@/i18n/server";
import { can, requirePermission } from "@/lib/permissions";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getStaffLocale(), "catalog")("services.metaTitle") };
}

/** The treatment catalogue: durations, prices as patients see them, who offers what. */
export default async function ServicesPage() {
  const s = await requirePermission("calendar.read");
  const locale = await getStaffLocale();
  const t = getT(locale, "catalog");
  const tc = getT(locale, "common");
  const canManage = can(s.role, "catalog.manage");
  const [svcs, links] = await Promise.all([
    db.select().from(services).where(eq(services.orgId, s.org.id)).orderBy(asc(services.sortOrder)),
    db
      .select({ serviceId: practitionerServices.serviceId, name: practitioners.name })
      .from(practitionerServices)
      .innerJoin(practitioners, eq(practitioners.id, practitionerServices.practitionerId))
      .where(eq(practitioners.orgId, s.org.id)),
  ]);
  const price = (svc: (typeof svcs)[number]) =>
    priceLabel(svc, locale, {
      onRequest: tc("price.onRequest"),
      free: tc("price.free"),
      from: (p) => tc("price.from", { price: p }),
      range: (min, max) => t("price.range", { min, max }),
      quote: t("price.quote"),
    });

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={t("services.title")} description={t("services.description")} />
      <Card>
        <ul className="divide-y divide-slate-100">
          {svcs.map((svc) => {
            const who = links.filter((l) => l.serviceId === svc.id).map((l) => l.name.split(" ").slice(-1)[0]);
            return (
              <li key={svc.id}>
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center gap-4 px-5 py-4 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-brand-600">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-1.5 font-semibold">
                        {svc.name}
                        {!svc.active ? <Badge tone="red">{t("services.inactive")}</Badge> : null}
                        {!svc.onlineBookable ? <Badge tone="amber">{t("services.frontDeskOnly")}</Badge> : null}
                        {svc.sensitive ? <Badge tone="violet">{t("services.sensitive")}</Badge> : null}
                      </p>
                      <p className="text-xs text-slate-600">
                        {tc(`categories.${svc.category}`)} · {who.length ? t("services.offeredBy", { names: who.join(", ") }) : t("services.nobody")}
                      </p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="font-bold">{price(svc)}</p>
                      <p className="text-xs text-slate-600">
                        {svc.bufferMinutes
                          ? t("services.durationWithBuffer", { minutes: svc.durationMinutes, buffer: svc.bufferMinutes })
                          : t("services.duration", { minutes: svc.durationMinutes })}
                      </p>
                    </div>
                    <ChevronDown size={18} className="text-slate-500 transition group-open:rotate-180" aria-hidden />
                  </summary>
                  {canManage ? (
                    <div className="border-t border-slate-100 bg-slate-50/60 p-5">
                      <ServiceForm service={svc} />
                    </div>
                  ) : null}
                </details>
              </li>
            );
          })}
        </ul>
      </Card>
      {canManage ? (
        <Card className="mt-6 p-6">
          <h2 className="mb-4 text-lg font-bold">{t("services.add")}</h2>
          <ServiceForm />
        </Card>
      ) : null}
    </div>
  );
}
