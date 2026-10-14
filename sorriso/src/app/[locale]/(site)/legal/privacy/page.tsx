import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NoticeView } from "@/components/privacy/NoticeView";
import { LinkButton } from "@/components/ui";
import type { NoticeKind } from "@/db/enums";
import { isLocale } from "@/i18n/config";
import { lhref } from "@/i18n/href";
import { alternatesFor } from "@/i18n/seo";
import { getT } from "@/i18n/server";
import { noticePageChrome, noticePath, publishNotice } from "@/lib/privacy/notices";

export const dynamic = "force-dynamic";

type Params = Promise<{ locale: string }>;
type SP = Promise<{ for?: string }>;

/** ?for=staff and ?for=practitioners show Sorriso's notices to practice staff and listed practitioners. */
function kindFor(audience: string | undefined): Extract<NoticeKind, "platform_patient" | "staff" | "practitioner"> {
  return audience === "staff" ? "staff" : audience === "practitioners" ? "practitioner" : "platform_patient";
}

const META = {
  platform_patient: { title: "meta.platformTitle", description: "meta.platformDescription" },
  staff: { title: "meta.staffTitle", description: "meta.staffDescription" },
  practitioner: { title: "meta.practitionerTitle", description: "meta.practitionerDescription" },
} as const;

export async function generateMetadata({ params, searchParams }: { params: Params; searchParams: SP }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const kind = kindFor((await searchParams).for);
  const t = getT(locale, "legalPatient");
  return {
    title: t(META[kind].title),
    description: t(META[kind].description),
    alternates: alternatesFor(noticePath(kind), locale),
  };
}

/**
 * Sorriso's own privacy notice: its role as independent controller for the marketplace (bookings
 * started on its search pages, reviews, ranking, the privacy center) and as processor for the
 * practices, its DPO, recipients, transfers and retention. The same page carries the notices to
 * practice staff and to listed practitioners (?for=staff, ?for=practitioners).
 */
export default async function SorrisoNoticePage({ params, searchParams }: { params: Params; searchParams: SP }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const kind = kindFor((await searchParams).for);
  const t = getT(locale, "legalPatient");
  const { notice, publishedAt } = await publishNotice(kind, { locale });
  const chrome = noticePageChrome({ kind, locale, publishedAt, path: noticePath(kind) });
  const others = (["platform_patient", "staff", "practitioner"] as const).filter((k) => k !== kind);
  const label = { platform_patient: t("page.patientLink"), staff: t("page.staffLink"), practitioner: t("page.practitionerLink") };

  return (
    <NoticeView
      title={t(META[kind].title)}
      sections={notice.sections}
      {...chrome}
      related={[
        ...others.map((k) => ({ href: lhref(locale, noticePath(k)), label: label[k] })),
        { href: lhref(locale, noticePath("cookies")), label: t("page.cookiesLink") },
      ]}
    >
      {kind === "platform_patient" ? (
        <LinkButton href={lhref(locale, "/privacy")} variant="secondary" size="sm">
          <ShieldCheck size={15} aria-hidden /> {t("page.privacyCenterLink")}
        </LinkButton>
      ) : null}
    </NoticeView>
  );
}
