import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NoticeView } from "@/components/privacy/NoticeView";
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
    title: t("meta.minorTitle", { practice: org.name }),
    description: t("meta.minorDescription", { practice: org.name }),
    alternates: alternatesFor(noticePath("minor", org.slug), locale),
    robots: org.listed ? undefined : { index: false },
  };
}

/**
 * The practice's notice for children and teenagers, in simple words (Recital 58: information
 * addressed to a child must be in language the child can easily understand). Young people from 14
 * booking for themselves are pointed here; it links to the full notice.
 */
export default async function MinorNoticePage({ params }: { params: Params }) {
  const { locale, org: slug } = await params;
  if (!isLocale(locale)) notFound();
  const org = await loadNoticeOrg(slug);
  if (!org) notFound();
  const t = getT(locale, "legalPatient");
  const path = noticePath("minor", org.slug);
  const { notice, publishedAt } = await publishNotice("minor", { org, locale });
  const chrome = noticePageChrome({ kind: "minor", locale, publishedAt, path });

  return (
    <NoticeView
      title={t("meta.minorTitle", { practice: org.name })}
      sections={notice.sections}
      {...chrome}
      related={[
        { href: lhref(locale, noticePath("practice_patient", org.slug)), label: t("page.practiceLink") },
        { href: lhref(locale, "/privacy"), label: t("page.privacyCenterLink") },
      ]}
    />
  );
}
