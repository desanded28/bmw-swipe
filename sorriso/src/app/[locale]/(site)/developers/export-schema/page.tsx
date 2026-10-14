import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui";
import { isLocale } from "@/i18n/config";
import { alternatesFor } from "@/i18n/seo";
import type privacyAdmin from "@/i18n/messages/en/privacyAdmin";
import { getT } from "@/i18n/server";
import { EXPORT_SCHEMA_VERSION, exportSchemaFields, patientExportJsonSchema } from "@/lib/privacy/export";

type Params = Promise<{ locale: string }>;
type DescriptionKey = keyof typeof privacyAdmin.exportSchema.descriptions;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getT(locale, "privacyAdmin");
  return {
    title: t("exportSchema.title"),
    description: t("exportSchema.description", { version: EXPORT_SCHEMA_VERSION }),
    alternates: alternatesFor("/developers/export-schema", locale),
  };
}

/** Public documentation of the patient export format (patient.json), with its JSON Schema. */
export default async function ExportSchemaPage({ params }: { params: Params }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getT(locale, "privacyAdmin");
  const schema = patientExportJsonSchema();
  // Descriptions in the page's language; the JSON Schema below keeps the English ones.
  const describe = (key: string | null, fallback: string) => {
    const k = `exportSchema.descriptions.${key as DescriptionKey}` as const;
    return key && t.has(k) ? t(k) : fallback;
  };
  const rows = exportSchemaFields().map((f) => ({ ...f, description: describe(f.descriptionKey, f.description) }));
  const files = ["patient.json", "csv/*.csv", "summary.html", "fhir.json"];

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-extrabold tracking-tight text-ink">{t("exportSchema.title")}</h1>
      <p className="mt-1 text-sm text-slate-500">{t("exportSchema.description", { version: EXPORT_SCHEMA_VERSION })}</p>
      <p className="mt-4 max-w-3xl leading-relaxed text-slate-700">{t("exportSchema.intro")}</p>

      <h2 className="mb-2 mt-8 text-lg font-bold">{t("exportSchema.files")}</h2>
      <ul className="flex flex-wrap gap-2">
        {files.map((f) => (
          <li key={f}>
            <code className="rounded-lg bg-slate-100 px-2 py-1 text-sm">{f}</code>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm text-slate-600">{t("exportSchema.fhirNote")}</p>
      <p className="mt-1 text-sm text-slate-600">{t("exportSchema.versioning")}</p>

      <h2 className="mb-2 mt-8 text-lg font-bold">{t("exportSchema.fields")}</h2>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
            <tr>
              <th scope="col" className="px-3 py-2">
                {t("exportSchema.field")}
              </th>
              <th scope="col" className="px-3 py-2">
                {t("exportSchema.type")}
              </th>
              <th scope="col" className="px-3 py-2">
                {t("exportSchema.descriptionCol")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 align-top">
            {rows.map((r) => (
              <tr key={r.path}>
                <td className="px-3 py-1.5 font-mono text-xs">{r.path}</td>
                <td className="px-3 py-1.5 font-mono text-xs text-slate-600">{r.type}</td>
                <td className="px-3 py-1.5 text-slate-700">{r.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <h2 className="mb-1 mt-8 text-lg font-bold">{t("exportSchema.jsonSchema")}</h2>
      <p className="mb-2 text-sm text-slate-600">{t("exportSchema.jsonSchemaHint")}</p>
      <pre tabIndex={0} role="group" aria-label={t("exportSchema.jsonSchema")} className="max-h-[480px] overflow-auto rounded-xl bg-ink p-4 text-[12px] leading-relaxed text-slate-100">
        <code>{JSON.stringify(schema, null, 2)}</code>
      </pre>
    </div>
  );
}
