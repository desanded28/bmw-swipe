import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NoticeView } from "@/components/privacy/NoticeView";
import { LinkButton } from "@/components/ui";
import { isLocale } from "@/i18n/config";
import { lhref } from "@/i18n/href";
import { alternatesFor } from "@/i18n/seo";
import { getT } from "@/i18n/server";
import { loadNoticeOrg, noticePageChrome, noticePath, publishNotice } from "@/lib/privacy/notices";

export const dynamic = "force-dynamic";

type Params = Promise<{ locale: string; org: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, org: slug } = await params;
  if (!isLocale(locale)) return {};
  const org = await loadNoticeOrg(slug);
  if (!org) return {};
  const t = getT(locale, "legalPatient");
  return {
    title: t("meta.practiceTitle", { practice: org.name }),
    description: t("meta.practiceDescription", { practice: org.name }),
    alternates: alternatesFor(noticePath("practice_patient", org.slug), locale),
    robots: org.listed ? undefined : { index: false },
  };
}

/**
 * The practice's privacy notice to its patients (Art. 13-14): a short first layer, then every
 * section with anchors. Generated from the processing register and the practice's settings; each
 * rendered wording is recorded in notice_versions, and the page shows its version and the date
 * it has been in force from. Translations say the Italian version prevails.
 */
export default async function PracticeNoticePage({ params }: { params: Params }) {
  const { locale, org: slug } = await params;
  if (!isLocale(locale)) notFound();
  const org = await loadNoticeOrg(slug);
  if (!org) notFound();
  const t = getT(locale, "legalPatient");
  const path = noticePath("practice_patient", org.slug);
  const { notice, publishedAt } = await publishNotice("practice_patient", { org, locale });
  const chrome = noticePageChrome({ kind: "practice_patient", locale, publishedAt, path });

  return (
    <NoticeView
      title={t("meta.practiceTitle", { practice: org.name })}
      sections={notice.sections}
      {...chrome}
      related={[
        { href: lhref(locale, noticePath("minor", org.slug)), label: t("page.minorsLink") },
        { href: lhref(locale, noticePath("platform_patient")), label: t("page.platformLink") },
        { href: lhref(locale, noticePath("cookies")), label: t("page.cookiesLink") },
      ]}
    >
      <LinkButton href={lhref(locale, "/privacy")} variant="secondary" size="sm">
        <ShieldCheck size={15} aria-hidden /> {t("page.privacyCenterLink")}
      </LinkButton>
    </NoticeView>
  );
}
