import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RequestActions } from "@/components/privacy-admin/RequestForms";
import { OneClickActions, RequestFactsCard } from "@/components/privacy-admin/RequestViews";
import { PageHeader } from "@/components/ui";
import { ENDONYM } from "@/i18n/config";
import { fmtDay, zonedDate } from "@/i18n/datefmt";
import { getStaffLocale, getT } from "@/i18n/server";
import { auditStaff } from "@/lib/audit";
import { can, requirePermission } from "@/lib/permissions";
import { dueBadge, effectiveDueAt, getPrivacyRequest, isOpenRequest, maxExtensionUntil, requesterLabel } from "@/lib/privacy/requests";
import { db } from "@/db";
import { patients } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { addDays, zonedParts } from "@/lib/time";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getStaffLocale(), "privacyAdmin")("requests.title") };
}

/**
 * One privacy request: its facts and decrypted details, the deadline countdown, and the steps to
 * handle it — start, extend (at most two months, decided within the first month, reasons sent to
 * the requester), answer with a decision (sent in the requester's language), and one-click links
 * to export, erase or restrict the linked patient. Opening it is audited (it shows personal data).
 */
export default async function PrivacyRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const s = await requirePermission("privacy.requests");
  const { id } = await params;
  const r = await getPrivacyRequest(s.org.id, id);
  if (!r) notFound();
  const locale = await getStaffLocale();
  const t = getT(locale, "privacyAdmin");
  const tz = s.org.timezone;
  const now = new Date();
  // Viewing the request reads personal data (the requester's own words): audited.
  await auditStaff(s, "patient.view", { type: "privacy_request", id: r.id }, { metadata: { patientId: r.patientId } });

  const [patient] = r.patientId
    ? await db
        .select({ id: patients.id, firstName: patients.firstName, lastName: patients.lastName, restrictedAt: patients.restrictedAt, erasedAt: patients.erasedAt })
        .from(patients)
        .where(and(eq(patients.orgId, s.org.id), eq(patients.id, r.patientId)))
    : [];
  const long = (d: Date) => fmtDay(zonedDate(d, tz), "long", locale);
  const open = isOpenRequest(r);
  const max = maxExtensionUntil(r.dueAt, tz);
  const canExtend = open && !r.extendedUntil && now.getTime() <= r.dueAt.getTime();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link href="/dashboard/privacy" className="text-sm font-semibold text-slate-500 hover:text-ink">
        ← {t("requests.detail.back")}
      </Link>
      <PageHeader title={t(`requests.types.${r.type}`)} description={t("requests.description")} />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-6">
          <RequestFactsCard
            t={t}
            f={{
              type: r.type,
              channel: r.channel,
              status: r.status,
              received: long(r.receivedAt),
              due: long(effectiveDueAt(r)),
              dueBadge: dueBadge(t, r, now),
              originalDue: r.extendedUntil ? long(r.dueAt) : null,
              extensionReason: r.extensionReason,
              language: ENDONYM[r.requesterLocale],
              requester: requesterLabel(t, patient ?? null, can(s.role, "patient.restricted.read")),
              details: r.details,
              decision: r.decision,
              decisionReason: r.decisionReason,
              closedAt: r.closedAt ? long(r.closedAt) : null,
            }}
          />
          <RequestActions
            id={r.id}
            scope="org"
            open={open}
            canStart={r.status === "open"}
            canExtend={canExtend}
            extendMin={addDays(zonedParts(r.dueAt, tz).date, 1)}
            extendMax={zonedParts(max, tz).date}
            maxLabel={long(max)}
            languageLabel={ENDONYM[r.requesterLocale]}
          />
        </div>
        <div className="space-y-6">
          {patient && open ? (
            <OneClickActions
              t={t}
              patientId={patient.id}
              type={r.type}
              allowed={{
                export: can(s.role, "patient.export"),
                erase: can(s.role, "patient.erase"),
                restrict: can(s.role, "patient.restrict"),
                write: can(s.role, "patient.write"),
              }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
