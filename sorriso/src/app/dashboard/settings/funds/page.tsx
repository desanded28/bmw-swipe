import { asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { TAX_DEDUCTION_RATE, TAX_DEDUCTION_THRESHOLD_CENTS } from "@/components/marketplace/price";
import { FundsForm } from "@/components/marketplace/FundsForm";
import { Card, PageHeader } from "@/components/ui";
import { db } from "@/db";
import { funds, orgFunds, services } from "@/db/schema";
import { formatMoney, formatPercent } from "@/i18n/number";
import { getStaffLocale, getT } from "@/i18n/server";
import { requirePermission } from "@/lib/permissions";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getStaffLocale(), "catalog")("funds.metaTitle") };
}

/**
 * The health funds and insurers the practice works with (org_funds): shown on its marketplace
 * page as declared by the practice, used by the fund filter in search and offered in the booking
 * form. The fund list itself is maintained by Sorriso (seeded by the migration).
 */
export default async function HealthFundsPage() {
  const s = await requirePermission("catalog.manage");
  const locale = await getStaffLocale();
  const t = getT(locale, "catalog");
  const [all, mine, svcs] = await Promise.all([
    db.select({ id: funds.id, name: funds.name, kind: funds.kind }).from(funds).orderBy(asc(funds.name)),
    db.select().from(orgFunds).where(eq(orgFunds.orgId, s.org.id)),
    db.select().from(services).where(eq(services.orgId, s.org.id)).orderBy(asc(services.sortOrder)),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={t("funds.title")} description={t("funds.description")} />
      <Card className="p-6">
        <FundsForm
          funds={all}
          services={svcs.map((x) => ({ id: x.id, name: x.name }))}
          current={Object.fromEntries(mine.map((m) => [m.fundId, { mode: m.mode, serviceIds: m.serviceIds ?? null, note: m.note }]))}
        />
      </Card>
      <Card className="mt-6 p-6 text-sm text-slate-600">
        <h2 className="mb-1 font-bold text-slate-800">{t("tax.title")}</h2>
        <p>{t("tax.body", { rate: formatPercent(TAX_DEDUCTION_RATE, locale), threshold: formatMoney(TAX_DEDUCTION_THRESHOLD_CENTS, locale) })}</p>
      </Card>
    </div>
  );
}
