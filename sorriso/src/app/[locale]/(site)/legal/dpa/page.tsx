import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocumentHeader, DpaDocument } from "@/components/privacy-admin/LegalDocuments";
import { PrintButton } from "@/components/privacy-admin/SettingsForms";
import { isLocale } from "@/i18n/config";
import { alternatesFor } from "@/i18n/seo";
import { getT } from "@/i18n/server";
import { SUBPROCESSOR_CHANGES } from "@/lib/privacy/gates";
import { legalDocumentData } from "@/lib/privacy/register";
import { LEGAL_VERSIONS } from "@/lib/privacy/versions";

type Params = Promise<{ locale: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getT(locale, "legalPractice");
  return { title: t("dpa.title"), description: t("dpa.description"), alternates: alternatesFor("/legal/dpa", locale) };
}

/** The Art. 28 data processing agreement, public so practices can read it before signing up. */
export default async function DpaPage({ params }: { params: Params }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getT(locale, "legalPractice");
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="mb-4 flex justify-end">
        <PrintButton label={t("common.print")} />
      </div>
      <DocumentHeader
        title={t("dpa.title")}
        version={t("common.version", { version: LEGAL_VERSIONS.dpa })}
        intro={t("dpa.intro")}
        italianNote={locale === "it" ? null : t("common.italianPrevails")}
      />
      <DpaDocument t={t} data={legalDocumentData(locale, SUBPROCESSOR_CHANGES)} version={LEGAL_VERSIONS.subprocessors} />
    </div>
  );
}
