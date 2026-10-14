import { ArrowLeft, Copy, ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { dismissDuplicateAction, mergePatientsAction } from "@/app/dashboard/actions/care";
import { ActionButton } from "@/components/dashboard/ActionButton";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { fmtDay, zonedDate } from "@/i18n/datefmt";
import { getStaffLocale } from "@/i18n/server";
import { getT } from "@/i18n/t";
import { auditStaff } from "@/lib/audit";
import { listDuplicatePairs, type DuplicateSide } from "@/lib/booking";
import { can, requirePermission } from "@/lib/permissions";
import { formatPhone } from "@/lib/phone";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getStaffLocale(), "care")("duplicates.metaTitle") };
}

/**
 * Possible duplicate patients (WP8): records flagged when a booking shared a first name and a
 * contact with an existing record but not every detail. Staff merge them (keeping one record;
 * audited as patient.merge) or mark them as different people. Never merged automatically.
 */
export default async function DuplicatesPage() {
  const s = await requirePermission("patient.read");
  const locale = await getStaffLocale();
  const t = getT(locale, "care");
  const contacts = can(s.role, "patient.contact.read");
  const canWrite = can(s.role, "patient.write");
  // Restricted records (Art. 18) are masked unless the viewer may read them, as on the calendar.
  const pairs = await listDuplicatePairs(s.org.id, { contacts, restricted: can(s.role, "patient.restricted.read") });
  await auditStaff(s, "patient.search", undefined, { metadata: { view: "duplicates", pairs: pairs.length } });

  /** A day inside a sentence ("Born 3 March 1990"): never capitalised. */
  const day = (date: string) => fmtDay(date, "medium", locale);
  const anchored = new Set<string>();

  const side = (p: DuplicateSide, other: DuplicateSide, restricted: boolean) => {
    const anchor = anchored.has(p.id) ? undefined : `p-${p.id}`;
    anchored.add(p.id);
    return (
      <div id={anchor} className="min-w-0 flex-1 basis-64 space-y-2 rounded-xl bg-slate-50 p-4 scroll-mt-20">
        <Link href={`/dashboard/patients/${p.id}`} className="text-base font-bold hover:underline">
          {p.masked ? t("duplicates.maskedName") : `${p.firstName} ${p.lastName}`.trim()}
        </Link>
        {p.masked ? (
          <p className="text-sm text-slate-600">{t("duplicates.maskedHint")}</p>
        ) : (
          <div className="space-y-0.5 text-sm text-slate-700">
            <p className={p.birthDate !== other.birthDate && !other.masked ? "font-semibold text-amber-800" : undefined}>
              {p.birthDate ? t("duplicates.born", { date: day(p.birthDate) }) : t("duplicates.noBirthDate")}
            </p>
            {p.phone || p.email ? <p>{[formatPhone(p.phone), p.email].filter(Boolean).join(" · ")}</p> : null}
            <p className="text-xs text-slate-500">{t("duplicates.record", { date: day(zonedDate(p.createdAt, s.org.timezone)) })}</p>
            <p className="text-xs text-slate-500">
              {t("duplicates.visits", { count: p.appointments })} ·{" "}
              {p.lastVisit ? t("duplicates.lastVisit", { date: day(zonedDate(p.lastVisit, s.org.timezone)) }) : t("duplicates.noVisit")}
            </p>
          </div>
        )}
        {p.restricted ? (
          <Badge tone="red">
            <ShieldAlert size={12} aria-hidden /> {t("duplicates.restricted")}
          </Badge>
        ) : null}
        {canWrite && !restricted ? (
          <ActionButton action={mergePatientsAction.bind(null, p.id, other.id)} variant="primary" confirm={t("duplicates.mergeConfirm")}>
            {t("duplicates.keepThis")}
          </ActionButton>
        ) : null}
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/dashboard/patients" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-slate-600 hover:text-ink">
        <ArrowLeft size={14} aria-hidden /> {t("duplicates.back")}
      </Link>
      <PageHeader title={t("duplicates.title")} description={t("duplicates.description")} />
      {pairs.length === 0 ? (
        <EmptyState icon={<Copy size={28} />} title={t("duplicates.empty")} />
      ) : (
        <ul className="space-y-4">
          {pairs.map(({ patient, other }) => {
            const restricted = patient.restricted || other.restricted;
            // Deciding about a record the viewer can't see would be guesswork.
            const masked = patient.masked || other.masked;
            return (
              <li key={`${patient.id}:${other.id}`}>
                <Card className="p-4">
                  <div className="flex flex-wrap gap-3">
                    {side(other, patient, restricted)}
                    {side(patient, other, restricted)}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    {restricted ? <p className="text-xs text-red-700">{t("duplicates.restrictedHint")}</p> : <span />}
                    {canWrite && !masked ? (
                      <ActionButton action={dismissDuplicateAction.bind(null, patient.id)} variant="ghost" confirm={t("duplicates.notSameConfirm")}>
                        {t("duplicates.notSame")}
                      </ActionButton>
                    ) : null}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
