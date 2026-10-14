import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui";
import { isLocale } from "@/i18n/config";
import { alternatesFor } from "@/i18n/seo";
import { getT } from "@/i18n/server";
import { EXPORT_SCHEMA_VERSION, patientExportJsonSchema } from "@/lib/privacy/export";

type Params = Promise<{ locale: string }>;

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

type JsonSchema = {
  type?: string | string[];
  description?: string;
  format?: string;
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  anyOf?: JsonSchema[];
  enum?: unknown[];
  const?: unknown;
};

/** "string (date-time) | null", "object[]", "\"a\" | \"b\"". */
function typeOf(s: JsonSchema): string {
  if (s.anyOf) return s.anyOf.map(typeOf).join(" | ");
  if (s.const !== undefined) return JSON.stringify(s.const);
  if (s.enum) return s.enum.map((v) => JSON.stringify(v)).join(" | ");
  if (s.type === "array") return `${s.items ? typeOf(s.items) : "any"}[]`;
  const t = Array.isArray(s.type) ? s.type.join(" | ") : (s.type ?? "any");
  return s.format ? `${t} (${s.format})` : t;
}

/** Flatten the schema into dotted field paths, one row each (arrays as path[]). */
function fields(s: JsonSchema, prefix = ""): { path: string; type: string; description: string }[] {
  const out: { path: string; type: string; description: string }[] = [];
  for (const [name, child] of Object.entries(s.properties ?? {})) {
    const path = prefix ? `${prefix}.${name}` : name;
    const target = child.anyOf?.find((a) => a.type !== "null") ?? child;
    out.push({ path, type: typeOf(child), description: child.description ?? target.description ?? "" });
    if (target.properties) out.push(...fields(target, path));
    if (target.type === "array" && target.items?.properties) out.push(...fields(target.items, `${path}[]`));
  }
  return out;
}

/** Public documentation of the patient export format (patient.json), with its JSON Schema. */
export default async function ExportSchemaPage({ params }: { params: Params }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getT(locale, "privacyAdmin");
  const schema = patientExportJsonSchema() as JsonSchema;
  const rows = fields(schema);
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
