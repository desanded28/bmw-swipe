import { and, count, eq, isNull } from "drizzle-orm";
import { Download } from "lucide-react";
import type { Metadata } from "next";
import { PrintButton, RegisterEntryForm, RemoveRegisterEntry } from "@/components/privacy-admin/SettingsForms";
import { Badge, Button, Card, PageHeader, Select } from "@/components/ui";
import { db } from "@/db";
import { apiKeys, organizations } from "@/db/schema";
import { ENDONYM, isLocale, LOCALES } from "@/i18n/config";
import { fmtDay, zonedDate } from "@/i18n/datefmt";
import { getStaffLocale, getT } from "@/i18n/server";
import { requirePermission } from "@/lib/permissions";
import { buildRegister, customRegisterEntries, REGISTER_COLUMNS } from "@/lib/privacy/register";
import { resolveSettings } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getStaffLocale(), "privacyAdmin")("register.title") };
}

const PRINT_CSS = `@media print { aside, nav, header, .print\\:hidden { display: none !important; } main { padding: 0 !important; } table { font-size: 9pt; } }`;

/**
 * The practice's Art. 30 register: one row per active processing purpose, generated from the
 * settings and the sub-processors, plus the practice's own rows. CSV download and print view.
 * The register's language is chosen here (Italian is what the Garante expects).
 */
export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const s = await requirePermission("privacy.settings");
  const staffLocale = await getStaffLocale();
  const t = getT(staffLocale, "privacyAdmin");
  const requested = (await searchParams).lang;
  const locale = isLocale(requested) ? requested : "it";
  const lt = getT(locale, "legalPractice");
  const [[org], [{ keys }]] = await Promise.all([
    db.select().from(organizations).where(eq(organizations.id, s.org.id)),
    db.select({ keys: count() }).from(apiKeys).where(and(eq(apiKeys.orgId, s.org.id), isNull(apiKeys.revokedAt))),
  ]);
  const register = buildRegister(org, resolveSettings(org.settings), { locale, hasApiKeys: keys > 0, custom: customRegisterEntries(org) });
  const c = register.controller;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <style>{PRINT_CSS}</style>
      <PageHeader
        title={t("register.title")}
        description={t("register.description")}
        actions={
          <>
            <form method="get" className="flex items-center gap-2 print:hidden">
              <label className="sr-only" htmlFor="register-lang">
                {t("register.language")}
              </label>
              <Select id="register-lang" name="lang" defaultValue={locale} className="w-40">
                {LOCALES.map((l) => (
                  <option key={l} value={l} lang={l}>
                    {ENDONYM[l]}
                  </option>
                ))}
              </Select>
              <Button type="submit" variant="secondary">
                {t("register.show")}
              </Button>
            </form>
            <a href={`/dashboard/settings/privacy/register/csv?lang=${locale}`} className="inline-flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold ring-1 ring-inset ring-slate-200 hover:bg-slate-50 print:hidden">
              <Download size={16} aria-hidden /> {t("register.download")}
            </a>
            <PrintButton label={t("register.print")} />
          </>
        }
      />

      <Card className="p-5" lang={locale}>
        <h2 className="text-lg font-bold">{lt("register.title")}</h2>
        <p className="mt-1 text-sm text-slate-600">{lt("register.intro")}</p>
        <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[200px_1fr]">
          <dt className="text-slate-500">{lt("register.controller")}</dt>
          <dd className="font-medium">{c.name}</dd>
          <dt className="text-slate-500">{lt("register.vat")}</dt>
          <dd>{c.vatNumber ?? lt("register.none")}</dd>
          <dt className="text-slate-500">{lt("register.address")}</dt>
          <dd>{c.address ?? lt("register.none")}</dd>
          <dt className="text-slate-500">{lt("register.contact")}</dt>
          <dd>{c.contact ?? lt("register.none")}</dd>
          <dt className="text-slate-500">{lt("register.dpo")}</dt>
          <dd>{c.dpo ?? lt("register.none")}</dd>
        </dl>
        <p className="mt-2 text-xs text-slate-500">{lt("register.generated", { date: fmtDay(zonedDate(register.generatedAt, s.org.timezone), "long", locale) })}</p>
      </Card>

      <Card className="overflow-x-auto" lang={locale}>
        <table className="w-full min-w-[1100px] text-left text-xs">
          <thead className="bg-slate-50 font-bold uppercase tracking-wide text-slate-500">
            <tr>
              {REGISTER_COLUMNS.map((col) => (
                <th key={col} scope="col" className="px-3 py-2">
                  {lt(`register.columns.${col}`)}
                </th>
              ))}
              <th scope="col" className="px-3 py-2 print:hidden">
                <span className="sr-only">{t("register.add.remove")}</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 align-top">
            {register.rows.map((r) => (
              <tr key={r.id}>
                {REGISTER_COLUMNS.map((col) => (
                  <td key={col} className="px-3 py-2 leading-relaxed text-slate-700">
                    {col === "activity" ? (
                      <>
                        <span className="font-semibold text-ink">{r.activity}</span>
                        {r.custom ? (
                          <Badge tone="violet" className="ml-1 print:hidden">
                            {t("register.custom")}
                          </Badge>
                        ) : null}
                      </>
                    ) : (
                      r[col]
                    )}
                  </td>
                ))}
                <td className="px-3 py-2 print:hidden">{r.custom ? <RemoveRegisterEntry id={r.id} label={r.activity} /> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <RegisterEntryForm columns={REGISTER_COLUMNS.map((col) => ({ key: col, label: lt(`register.columns.${col}`) }))} />
    </div>
  );
}
