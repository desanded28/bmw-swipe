import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocumentHeader, TermsDocument } from "@/components/privacy-admin/LegalDocuments";
import { PrintButton } from "@/components/privacy-admin/SettingsForms";
import { isLocale } from "@/i18n/config";
import { alternatesFor } from "@/i18n/seo";
import { getT } from "@/i18n/server";
import { legalDocumentData } from "@/lib/privacy/register";
import { LEGAL_VERSIONS } from "@/lib/privacy/versions";

type Params = Promise<{ locale: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getT(locale, "legalPractice");
  return { title: t("terms.title"), description: t("terms.description"), alternates: alternatesFor("/legal/terms", locale) };
}

/** The terms of service for practices (B2B; P2B Regulation and EU Data Act switching rules). */
export default async function TermsPage({ params }: { params: Params }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getT(locale, "legalPractice");
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="mb-4 flex justify-end">
        <PrintButton label={t("common.print")} />
      </div>
      <DocumentHeader
        title={t("terms.title")}
        version={t("common.version", { version: LEGAL_VERSIONS.terms })}
        intro={t("terms.intro", { platform: legalDocumentData(locale, []).platform })}
        italianNote={locale === "it" ? null : t("common.italianPrevails")}
      />
      <TermsDocument t={t} />
    </div>
  );
}
