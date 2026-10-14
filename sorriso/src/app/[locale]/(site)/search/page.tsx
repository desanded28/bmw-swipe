import { SearchX } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { PractitionerCard } from "@/components/PractitionerCard";
import { SearchForm, type SearchDefaults } from "@/components/SearchForm";
import { EmptyState } from "@/components/ui";
import { PRICE_TYPES, SERVICE_CATEGORIES, SPOKEN_LANGUAGES, type PriceType, type ServiceCategory, type SpokenLanguage } from "@/db/enums";
import { toLocale } from "@/i18n/config";
import { ClientMessages } from "@/i18n/ClientMessages";
import { lhref } from "@/i18n/href";
import { alternatesFor } from "@/i18n/seo";
import { getT } from "@/i18n/server";
import { ACCESS_FEATURES, listCities, listFunds, recordProfileStats, searchPractitioners, type AccessFeature, type SearchParams } from "@/lib/directory";

export const dynamic = "force-dynamic";

type Params = Promise<{ locale: string }>;
type SP = Promise<Record<string, string | string[] | undefined>>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
const flag = (v: string | string[] | undefined) => ["1", "on", "true", "yes"].includes(one(v) ?? "");

/** The query string as search filters; anything unknown or malformed is ignored. */
function parseSearch(sp: Record<string, string | string[] | undefined>): { filters: SearchParams; defaults: SearchDefaults } {
  const category = one(sp.category);
  const lang = one(sp.lang);
  const fund = one(sp.fund);
  const priceType = one(sp.priceType);
  const max = Number(one(sp.maxPrice)?.replace(",", "."));
  const access = [sp.access ?? []]
    .flat()
    .flatMap((a) => a.split(","))
    .map((a) => a.trim())
    .filter((a): a is AccessFeature => (ACCESS_FEATURES as readonly string[]).includes(a));
  const filters: SearchParams = {
    city: one(sp.city)?.slice(0, 80),
    category: (SERVICE_CATEGORIES as readonly string[]).includes(category ?? "") ? (category as ServiceCategory) : undefined,
    q: one(sp.q)?.slice(0, 100),
    lang: (SPOKEN_LANGUAGES as readonly string[]).includes(lang ?? "") ? (lang as SpokenLanguage) : undefined,
    fund: fund && /^[a-z0-9-]{1,60}$/.test(fund) ? fund : undefined,
    maxPriceCents: Number.isFinite(max) && max >= 0 ? Math.round(max * 100) : undefined,
    priceType: (PRICE_TYPES as readonly string[]).includes(priceType ?? "") ? (priceType as PriceType) : undefined,
    access: [...new Set(access)],
    children: flag(sp.children),
    anxiety: flag(sp.anxiety),
    sedation: flag(sp.sedation),
    urgent: flag(sp.urgent),
  };
  const defaults: SearchDefaults = {
    city: filters.city,
    category: filters.category,
    q: filters.q,
    lang: filters.lang,
    fund: filters.fund,
    maxPrice: filters.maxPriceCents != null ? filters.maxPriceCents / 100 : undefined,
    priceType: filters.priceType,
    access: filters.access,
    children: filters.children,
    anxiety: filters.anxiety,
    sedation: filters.sedation,
    urgent: filters.urgent,
  };
  return { filters, defaults };
}

/** Filters beyond city and treatment: such pages are not worth indexing. */
const isFiltered = (f: SearchParams) =>
  Boolean(f.q || f.lang || f.fund || f.maxPriceCents != null || f.priceType || f.access?.length || f.children || f.anxiety || f.sedation || f.urgent);

export async function generateMetadata({ params, searchParams }: { params: Params; searchParams: SP }): Promise<Metadata> {
  const locale = toLocale((await params).locale);
  const { filters } = parseSearch(await searchParams);
  const t = getT(locale, "marketplace");
  const tc = getT(locale, "common");
  const category = filters.category ? tc(`categories.${filters.category}`) : null;
  const title =
    category && filters.city
      ? t("search.metaTitleCategoryCity", { category, city: filters.city })
      : category
        ? t("search.headingCategory", { category })
        : filters.city
          ? t("search.metaTitleCity", { city: filters.city })
          : t("search.metaTitle");
  return {
    title,
    description: t("search.metaDescription"),
    alternates: alternatesFor("/search", locale),
    robots: { index: !isFiltered(filters), follow: true },
  };
}

/** Marketplace search: filters, transparent ranking, and the reasons each result ranks where it does. */
export default async function SearchPage({ params, searchParams }: { params: Params; searchParams: SP }) {
  const locale = toLocale((await params).locale);
  const t = getT(locale, "marketplace");
  const tc = getT(locale, "common");
  const { filters, defaults } = parseSearch(await searchParams);
  const [cities, funds, results] = await Promise.all([listCities(), listFunds(), searchPractitioners({ ...filters, locale })]);
  // Daily counters only (no cookie, no identifier); bots and prefetches are skipped.
  await recordProfileStats(
    "searchImpressions",
    results.map((r) => r.practitioner.id),
    await headers(),
  );
  const withSlots = results.filter((r) => r.slots.length).length;
  const category = filters.category ? tc(`categories.${filters.category}`) : null;
  const heading =
    category && filters.city
      ? t("search.headingCategoryCity", { category, city: filters.city })
      : category
        ? t("search.headingCategory", { category })
        : filters.city
          ? t("search.headingCity", { city: filters.city })
          : t("search.heading");

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <ClientMessages locale={locale} ns={["marketplace"]}>
        <SearchForm cities={cities} funds={funds} defaults={defaults} compact />
        <div className="mb-5 mt-8">
          <h1 className="text-2xl font-bold tracking-tight">{heading}</h1>
          <p className="text-sm text-slate-600">
            {t("search.count", { count: results.length })} · {t("search.withSlots", { count: withSlots })}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            {filters.urgent ? t("search.sortedUrgent") : t("search.sortedRelevance")}{" "}
            <Link href={lhref(locale, "/legal/ranking")} className="font-semibold text-brand-700 hover:underline">
              {t("search.howRanking")}
            </Link>
          </p>
        </div>
        {results.length ? (
          <ol className="grid gap-4" aria-label={t("search.resultsLabel")}>
            {results.map((r) => (
              <li key={r.practitioner.id}>
                <PractitionerCard result={r} />
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState icon={<SearchX size={32} />} title={t("search.noResults")}>
            <p>{t("search.noResultsBody")}</p>
            <Link href={lhref(locale, "/search")} className="mt-2 inline-block font-semibold text-brand-700 hover:underline">
              {t("search.clearFilters")}
            </Link>
          </EmptyState>
        )}
      </ClientMessages>
    </div>
  );
}
