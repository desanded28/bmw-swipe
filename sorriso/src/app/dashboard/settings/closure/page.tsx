import type { Metadata } from "next";
import { CancelClosureButton, ExportAllButton, RequestClosureForm } from "@/components/privacy-admin/ClosureForms";
import { Card, PageHeader } from "@/components/ui";
import { fmtDay, zonedDate } from "@/i18n/datefmt";
import { getStaffLocale, getT } from "@/i18n/server";
import { can, requirePermission } from "@/lib/permissions";
import { CLOSURE_RETRIEVAL_DAYS, CLOSURE_TRANSITION_DAYS } from "@/lib/privacy/org-closure";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getStaffLocale(), "privacyAdmin")("closure.title") };
}

/**
 * Closing the practice's account (owner only: org.close, with step-up when confirming). It
 * explains what happens, offers the full export first, and once requested shows the purge date
 * with the option to cancel. The gate never redirects away from this page.
 */
export default async function ClosurePage() {
  const s = await requirePermission("org.export");
  const locale = await getStaffLocale();
  const t = getT(locale, "privacyAdmin");
  const org = s.org;
  const owner = can(s.role, "org.close");
  const day = (d: Date) => fmtDay(zonedDate(d, org.timezone), "long", locale);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={t("closure.title")} description={t("closure.description")} />
      {org.closureRequestedAt && org.purgeAfter ? (
        <Card className="space-y-4 p-6">
          <p role="status" className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-800 ring-1 ring-red-200">
            {t("closure.scheduled", { date: day(org.purgeAfter) })}
          </p>
          <div className="flex flex-wrap gap-3">
            <ExportAllButton label={t("closure.exportButton")} />
            {owner ? <CancelClosureButton /> : null}
          </div>
        </Card>
      ) : (
        <Card className="space-y-5 p-6">
          <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-slate-700">
            <li>{t("closure.steps.export")}</li>
            <li>{t("closure.steps.stop")}</li>
            <li>{t("closure.steps.retrieve", { days: CLOSURE_TRANSITION_DAYS + CLOSURE_RETRIEVAL_DAYS })}</li>
            <li>{t("closure.steps.purge")}</li>
          </ol>
          <ExportAllButton label={t("closure.exportButton")} />
          <div className="border-t border-slate-100 pt-5">{owner ? <RequestClosureForm orgName={org.name} /> : <p className="text-sm text-slate-500">{t("closure.ownerOnly")}</p>}</div>
        </Card>
      )}
    </div>
  );
}
