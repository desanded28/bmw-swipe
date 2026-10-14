import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RequestActions } from "@/components/privacy-admin/RequestForms";
import { RequestFactsCard } from "@/components/privacy-admin/RequestViews";
import { PageHeader } from "@/components/ui";
import { db } from "@/db";
import { patients } from "@/db/schema";
import { ENDONYM } from "@/i18n/config";
import { fmtDay, zonedDate } from "@/i18n/datefmt";
import { getStaffLocale, getT } from "@/i18n/server";
import { audit } from "@/lib/audit";
import { requirePlatformAdmin } from "@/lib/auth";
import { dueBadge, effectiveDueAt, getPrivacyRequest, isOpenRequest, maxExtensionUntil, requesterLabel } from "@/lib/privacy/requests";
import { addDays, zonedParts } from "@/lib/time";

const TZ = "Europe/Rome";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getStaffLocale(), "privacyAdmin")("requests.platformTitle") };
}

/** One request to Sorriso as controller: same steps as the practice inbox, in the platform audit chain. */
export default async function PlatformPrivacyRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const s = await requirePlatformAdmin();
  const { id } = await params;
  const r = await getPrivacyRequest(null, id);
  if (!r) notFound();
  const locale = await getStaffLocale();
  const t = getT(locale, "privacyAdmin");
  const now = new Date();
  await audit({ orgId: null, actor: { type: "platform_admin", id: s.user.id }, action: "patient.view", entity: { type: "privacy_request", id: r.id } });
  const [patient] = r.patientId
    ? await db
        .select({ id: patients.id, firstName: patients.firstName, lastName: patients.lastName, restrictedAt: patients.restrictedAt, erasedAt: patients.erasedAt })
        .from(patients)
        .where(eq(patients.id, r.patientId))
    : [];
  const long = (d: Date) => fmtDay(zonedDate(d, TZ), "long", locale);
  const open = isOpenRequest(r);
  const max = maxExtensionUntil(r.dueAt, TZ);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href="/dashboard/platform/privacy" className="text-sm font-semibold text-slate-500 hover:text-ink">
        ← {t("requests.platformTitle")}
      </Link>
      <PageHeader title={t(`requests.types.${r.type}`)} description={t("requests.platformDescription")} />
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
          requester: requesterLabel(t, patient ?? null, true),
          details: r.details,
          decision: r.decision,
          decisionReason: r.decisionReason,
          closedAt: r.closedAt ? long(r.closedAt) : null,
        }}
      />
      <RequestActions
        id={r.id}
        scope="platform"
        open={open}
        canStart={r.status === "open"}
        canExtend={open && !r.extendedUntil && now.getTime() <= r.dueAt.getTime()}
        extendMin={addDays(zonedParts(r.dueAt, TZ).date, 1)}
        extendMax={zonedParts(max, TZ).date}
        maxLabel={long(max)}
        languageLabel={ENDONYM[r.requesterLocale]}
      />
    </div>
  );
}
