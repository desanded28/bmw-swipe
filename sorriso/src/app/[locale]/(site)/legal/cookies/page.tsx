import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NoticeView } from "@/components/privacy/NoticeView";
import { isLocale } from "@/i18n/config";
import { lhref } from "@/i18n/href";
import { alternatesFor } from "@/i18n/seo";
import { getT } from "@/i18n/server";
import { noticePageChrome, noticePath, publishNotice } from "@/lib/privacy/notices";

export const dynamic = "force-dynamic";

type Params = Promise<{ locale: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getT(locale, "legalPatient");
  return { title: t("meta.cookiesTitle"), description: t("meta.cookiesDescription"), alternates: alternatesFor(noticePath("cookies"), locale) };
}

/**
 * The cookie notice (Art. 122 Codice privacy; Garante guidelines of 10 June 2021): the staff
 * session, the language choice and the privacy-center session, the browser-storage keys (none
 * today), no third parties, and the click-to-load map. Only technical cookies, so no banner.
 */
export default async function CookieNoticePage({ params }: { params: Params }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getT(locale, "legalPatient");
  const { notice, publishedAt } = await publishNotice("cookies", { locale });
  const chrome = noticePageChrome({ kind: "cookies", locale, publishedAt, path: noticePath("cookies") });

  return (
    <NoticeView
      title={t("meta.cookiesTitle")}
      sections={notice.sections}
      {...chrome}
      related={[{ href: lhref(locale, noticePath("platform_patient")), label: t("page.platformLink") }]}
    />
  );
}
