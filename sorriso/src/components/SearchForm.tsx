"use client";

import { MapPin, Search, SlidersHorizontal, Stethoscope } from "lucide-react";
import Link from "next/link";
import { useId } from "react";
import { PRICE_TYPES, SERVICE_CATEGORIES, SPOKEN_LANGUAGES } from "@/db/enums";
import { lhref } from "@/i18n/href";
import { useLocale, useT } from "@/i18n/provider";
import { ACCESS_ICONS } from "./marketplace/AccessibilityList";
import { cx, Input, Select } from "./ui";

export type SearchDefaults = {
  city?: string;
  category?: string;
  q?: string;
  lang?: string;
  fund?: string;
  /** Euros. */
  maxPrice?: number;
  priceType?: string;
  access?: readonly string[];
  children?: boolean;
  anxiety?: boolean;
  sedation?: boolean;
  urgent?: boolean;
};

const ACCESS_KEYS = Object.keys(ACCESS_ICONS) as (keyof typeof ACCESS_ICONS)[];

/** How many of the advanced filters are on (the summary shows it, and the panel opens). */
export function activeFilterCount(d: SearchDefaults): number {
  return [d.lang, d.fund, d.maxPrice, d.priceType, d.children, d.anxiety, d.sedation, d.urgent].filter(Boolean).length + (d.access?.length ?? 0);
}

/**
 * The marketplace search form: a plain GET form to /{locale}/search (works without script).
 * `compact` is the results-page version, with the text query and the filters: spoken language,
 * health fund, price, accessibility, care options and urgency.
 */
export function SearchForm({
  cities,
  defaults = {},
  compact = false,
  funds = [],
}: {
  cities: { city: string }[];
  defaults?: SearchDefaults;
  compact?: boolean;
  /** Health funds and insurers for the fund filter (none: the filter is hidden). */
  funds?: { slug: string; name: string }[];
}) {
  const t = useT("marketplace");
  const tc = useT("common");
  const locale = useLocale();
  const id = useId();
  const active = activeFilterCount(defaults);
  const field = "flex items-center gap-2 rounded-xl px-3 py-2 hover:bg-slate-50 focus-within:ring-2 focus-within:ring-brand-600";
  const control = "w-full bg-transparent py-1 text-sm font-semibold text-ink outline-none";
  const label = "mb-1 block text-[13px] font-semibold text-slate-700";
  const check = "flex items-center gap-2 text-sm text-slate-700";

  return (
    <form action={lhref(locale, "/search")} method="get" role="search" aria-label={t("form.label")}>
      <div
        className={cx(
          "grid gap-2 rounded-2xl bg-white p-2 shadow-pop ring-1 ring-slate-200/70",
          compact ? "sm:grid-cols-[1fr_1fr_1fr_auto]" : "sm:grid-cols-[1.2fr_1fr_auto]",
        )}
      >
        <label className={field}>
          <Stethoscope size={18} className="shrink-0 text-brand-700" aria-hidden />
          <span className="sr-only">{t("form.treatment")}</span>
          <select name="category" defaultValue={defaults.category ?? ""} className={control}>
            <option value="">{t("form.anyTreatment")}</option>
            {SERVICE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {tc(`categories.${c}`)}
              </option>
            ))}
          </select>
        </label>
        {compact ? (
          <label className={field}>
            <Search size={18} className="shrink-0 text-brand-700" aria-hidden />
            <span className="sr-only">{t("form.query")}</span>
            <input
              name="q"
              type="search"
              defaultValue={defaults.q}
              placeholder={t("form.queryPlaceholder")}
              className={`${control} placeholder:font-medium placeholder:text-slate-500`}
            />
          </label>
        ) : null}
        <label className={field}>
          <MapPin size={18} className="shrink-0 text-brand-700" aria-hidden />
          <span className="sr-only">{t("form.city")}</span>
          <select name="city" defaultValue={defaults.city ?? ""} className={control}>
            <option value="">{t("form.allCities")}</option>
            {cities.map((c) => (
              <option key={c.city} value={c.city}>
                {c.city}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-brand-700 px-6 text-sm font-bold text-white hover:bg-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
        >
          <Search size={17} aria-hidden /> {t("form.submit")}
        </button>
      </div>

      {compact ? (
        <details className="mt-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200/70" open={active > 0}>
          <summary className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700">
            <SlidersHorizontal size={16} aria-hidden /> {active ? t("form.filtersOn", { count: active }) : t("form.filters")}
          </summary>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label htmlFor={`${id}lang`} className={label}>
                {t("form.language")}
              </label>
              <Select id={`${id}lang`} name="lang" defaultValue={defaults.lang ?? ""}>
                <option value="">{t("form.anyLanguage")}</option>
                {SPOKEN_LANGUAGES.map((l) => (
                  <option key={l} value={l}>
                    {tc(`languages.${l}`)}
                  </option>
                ))}
              </Select>
            </div>
            {funds.length ? (
              <div>
                <label htmlFor={`${id}fund`} className={label}>
                  {t("form.fund")}
                </label>
                <Select id={`${id}fund`} name="fund" defaultValue={defaults.fund ?? ""}>
                  <option value="">{t("form.anyFund")}</option>
                  {funds.map((f) => (
                    <option key={f.slug} value={f.slug}>
                      {f.name}
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}
            <div>
              <label htmlFor={`${id}max`} className={label}>
                {t("form.maxPrice")}
              </label>
              <Input id={`${id}max`} name="maxPrice" type="number" inputMode="numeric" min={0} max={100000} step={5} defaultValue={defaults.maxPrice ?? ""} />
            </div>
            <div>
              <label htmlFor={`${id}ptype`} className={label}>
                {t("form.priceType")}
              </label>
              <Select id={`${id}ptype`} name="priceType" defaultValue={defaults.priceType ?? ""}>
                <option value="">{t("form.anyPriceType")}</option>
                {PRICE_TYPES.map((p) => (
                  <option key={p} value={p}>
                    {t(`priceTypes.${p}`)}
                  </option>
                ))}
              </Select>
            </div>
            <fieldset className="sm:col-span-2">
              <legend className={label}>{t("form.access")}</legend>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {ACCESS_KEYS.map((k) => (
                  <label key={k} className={check}>
                    <input type="checkbox" name="access" value={k} defaultChecked={defaults.access?.includes(k)} className="h-4 w-4 accent-brand-700" />
                    {t(`access.${k}`)}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className="sm:col-span-2">
              <legend className={label}>{t("form.care")}</legend>
              <div className="grid gap-1.5">
                {(["children", "anxiety", "sedation"] as const).map((k) => (
                  <label key={k} className={check}>
                    <input type="checkbox" name={k} value="1" defaultChecked={defaults[k]} className="h-4 w-4 accent-brand-700" />
                    {t(`form.${k}`)}
                  </label>
                ))}
                <label className={check}>
                  <input type="checkbox" name="urgent" value="1" defaultChecked={defaults.urgent} className="h-4 w-4 accent-brand-700" />
                  {t("form.urgent")}
                </label>
              </div>
            </fieldset>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="submit" className="inline-flex h-10 items-center rounded-xl bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800">
              {t("form.apply")}
            </button>
            {active ? (
              <Link
                href={lhref(
                  locale,
                  `/search?${new URLSearchParams(Object.entries({ city: defaults.city ?? "", category: defaults.category ?? "", q: defaults.q ?? "" }).filter(([, v]) => v))}`,
                )}
                className="text-sm font-semibold text-slate-600 hover:text-ink hover:underline"
              >
                {t("form.reset")}
              </Link>
            ) : null}
          </div>
        </details>
      ) : null}
    </form>
  );
}
