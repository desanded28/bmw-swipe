import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocumentHeader, SubprocessorsDocument } from "@/components/privacy-admin/LegalDocuments";
import { isLocale } from "@/i18n/config";
import { alternatesFor } from "@/i18n/seo";
import { getT } from "@/i18n/server";
import { SUBPROCESSOR_CHANGES } from "@/lib/privacy/gates";
import { legalDocumentData } from "@/lib/privacy/register";
import { SUBPROCESSORS_VERSION } from "@/lib/privacy/subprocessors";

type Params = Promise<{ locale: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getT(locale, "legalPractice");
  return { title: t("subprocessors.title"), description: t("subprocessors.description"), alternates: alternatesFor("/legal/subprocessors", locale) };
}

/** Sorriso's sub-processors (Art. 28(2) and (4)): who, where, which transfer tool, and the change log. */
export default async function SubprocessorsPage({ params }: { params: Params }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getT(locale, "legalPractice");
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <DocumentHeader
        title={t("subprocessors.title")}
        version={t("common.version", { version: SUBPROCESSORS_VERSION })}
        italianNote={locale === "it" ? null : t("common.italianPrevails")}
      />
      <div className="mt-6">
        <SubprocessorsDocument t={t} data={legalDocumentData(locale, SUBPROCESSOR_CHANGES)} />
      </div>
    </div>
  );
}
