import {
  ArrowRight,
  Baby,
  BellRing,
  Building2,
  CalendarCheck,
  MessageCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  Siren,
  Smile,
  Sparkles,
  Stethoscope,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PractitionerCard } from "@/components/PractitionerCard";
import { SearchForm } from "@/components/SearchForm";
import { LinkButton } from "@/components/ui";
import { LOCALES, OG_LOCALE, toLocale, type Locale } from "@/i18n/config";
import { ClientMessages } from "@/i18n/ClientMessages";
import { lhref } from "@/i18n/href";
import { formatDecimal } from "@/i18n/number";
import { rich } from "@/i18n/rich";
import { alternatesFor } from "@/i18n/seo";
import { getT } from "@/i18n/server";
import { APP_NAME } from "@/lib/config";
import { isDemoMode } from "@/lib/demo";
import { listCities, searchPractitioners } from "@/lib/directory";

export const dynamic = "force-dynamic";

/** Open Graph in the page language, with the other languages as alternates. */
const ogAlternates = (locale: Locale) => LOCALES.filter((l) => l !== locale).map((l) => OG_LOCALE[l]);

type Params = Promise<{ locale: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const locale = toLocale((await params).locale);
  const t = getT(locale, "site");
  const title = t("meta.title", { app: APP_NAME });
  const description = t("meta.description");
  return {
    title: { absolute: title },
    description,
    alternates: alternatesFor("/", locale),
    openGraph: {
      type: "website",
      siteName: APP_NAME,
      title,
      description,
      locale: OG_LOCALE[locale],
      alternateLocale: ogAlternates(locale),
    },
  };
}

const QUICK = [
  { category: "checkup", icon: Stethoscope },
  { category: "hygiene", icon: Sparkles },
  { category: "orthodontics", icon: Smile },
  { category: "pediatric", icon: Baby },
  { category: "emergency", icon: Siren },
] as const;

export default async function Home({ params }: { params: Params }) {
  const locale = toLocale((await params).locale);
  const t = getT(locale, "site");
  const href = (path: string) => lhref(locale, path);
  const [cities, soonest] = await Promise.all([listCities(), searchPractitioners({ days: 3 })]);
  const available = soonest.filter((r) => r.slots.length > 0).slice(0, 3);

  const steps = [
    { icon: Search, title: t("home.how.findTitle"), body: t("home.how.findBody") },
    { icon: CalendarCheck, title: t("home.how.bookTitle"), body: t("home.how.bookBody") },
    { icon: MessageCircle, title: t("home.how.confirmTitle"), body: t("home.how.confirmBody") },
  ];
  const practiceBullets = [
    { icon: Building2, text: t("home.practices.offices") },
    { icon: BellRing, text: t("home.practices.rules") },
    { icon: MessageCircle, text: t("home.practices.replies") },
    { icon: RefreshCw, text: t("home.practices.waitlist") },
  ];

  return (
    <>
      <section aria-labelledby="hero-title" className="relative overflow-hidden bg-gradient-to-b from-brand-50 via-white to-transparent">
        <div aria-hidden className="pointer-events-none absolute -right-40 -top-40 h-[480px] w-[480px] rounded-full bg-brand-200/40 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-14 sm:pt-20">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-bold text-brand-800 ring-1 ring-brand-200">
            <ShieldCheck size={14} aria-hidden /> {t("home.badge")}
          </p>
          <h1 id="hero-title" className="max-w-3xl text-4xl font-extrabold tracking-tight text-ink sm:text-6xl">
            {rich(t("home.heroTitle"), { em: (c) => <span className="text-brand-700">{c}</span> })}
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-slate-600">{rich(t("home.heroBody"), { b: (c) => <strong>{c}</strong> })}</p>
          <div className="mt-8 max-w-3xl">
            <ClientMessages locale={locale} ns={["marketplace"]}>
              <SearchForm cities={cities} />
            </ClientMessages>
          </div>
          <ul aria-label={t("home.quickLabel")} className="mt-5 flex flex-wrap gap-2">
            {QUICK.map(({ category, icon: Icon }) => (
              <li key={category}>
                <Link
                  href={href(`/search?category=${category}`)}
                  className="inline-flex min-h-10 items-center gap-2 rounded-full bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-300 hover:ring-brand-500"
                >
                  <Icon size={15} className="text-brand-700" aria-hidden /> {t(`home.quick.${category}`)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {available.length ? (
        <section aria-labelledby="soonest-title" className="mx-auto max-w-6xl px-4 py-10">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <h2 id="soonest-title" className="text-2xl font-bold tracking-tight">
                {t("home.soonestTitle")}
              </h2>
              <p className="text-sm text-slate-600">{t("home.soonestBody")}</p>
            </div>
            <Link href={href("/search")} className="hidden text-sm font-semibold text-brand-700 hover:underline sm:block">
              {t("home.seeAll")} <span aria-hidden>→</span>
            </Link>
          </div>
          <ClientMessages locale={locale} ns={["marketplace"]}>
            <div className="grid gap-4">
              {available.map((r) => (
                <PractitionerCard key={r.practitioner.id} result={r} headingLevel={3} />
              ))}
            </div>
          </ClientMessages>
        </section>
      ) : null}

      <section aria-labelledby="how-title" className="mx-auto max-w-6xl px-4 py-10">
        <h2 id="how-title" className="mb-6 text-2xl font-bold tracking-tight">
          {t("home.how.title")}
        </h2>
        <ol className="grid gap-4 md:grid-cols-3">
          {steps.map(({ icon: Icon, title, body }, i) => (
            <li key={title} className="rounded-2xl bg-white p-6 shadow-card ring-1 ring-slate-200/70">
              <div className="mb-4 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700" aria-hidden>
                  <Icon size={20} />
                </span>
                <span className="text-xs font-bold uppercase text-slate-600">{t("home.how.step", { n: i + 1 })}</span>
              </div>
              <h3 className="font-bold">{title}</h3>
              <p className="mt-1 text-sm text-slate-600">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      {cities.length ? (
        <section aria-labelledby="cities-title" className="mx-auto max-w-6xl px-4 py-10">
          <h2 id="cities-title" className="mb-5 text-2xl font-bold tracking-tight">
            {t("home.citiesTitle")}
          </h2>
          <ul className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            {cities.map((c) => (
              <li key={c.city}>
                <Link
                  href={href(`/search?city=${encodeURIComponent(c.city)}`)}
                  className="flex min-h-12 items-center justify-between gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold shadow-card ring-1 ring-slate-200/70 hover:ring-brand-500"
                >
                  {t("home.cityLink", { city: c.city })}
                  <span className="text-xs font-medium text-slate-600">
                    <span aria-hidden>{formatDecimal(c.count, locale)}</span>
                    <span className="sr-only">{t("home.cityCount", { count: c.count })}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="practices-title" className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid items-center gap-8 overflow-hidden rounded-3xl bg-ink p-8 text-white sm:p-12 lg:grid-cols-2">
          <div>
            <p className="text-sm font-bold uppercase tracking-wider text-brand-300">{t("home.practices.kicker")}</p>
            <h2 id="practices-title" className="mt-2 text-3xl font-extrabold tracking-tight">
              {t("home.practices.title")}
            </h2>
            <p className="mt-3 text-slate-300">{t("home.practices.body")}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <LinkButton href={href("/for-clinics")} variant="subtle">
                {t("home.practices.features")} <ArrowRight size={16} aria-hidden />
              </LinkButton>
              {isDemoMode() ? (
                <LinkButton href={href("/login?demo=1")} className="bg-white/10 ring-1 ring-white/30 hover:bg-white/20">
                  {t("home.practices.demo")}
                </LinkButton>
              ) : null}
            </div>
          </div>
          <ul className="grid gap-3 text-sm">
            {practiceBullets.map(({ icon: Icon, text }) => (
              <li key={text} className="flex gap-3 rounded-xl bg-white/5 p-4 ring-1 ring-white/10">
                <Icon size={18} className="mt-0.5 shrink-0 text-brand-300" aria-hidden />
                {text}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
