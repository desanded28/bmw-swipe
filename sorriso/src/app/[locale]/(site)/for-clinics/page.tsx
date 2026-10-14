import {
  ArrowRight,
  BadgeCheck,
  BellRing,
  Building2,
  CalendarRange,
  Code2,
  Languages,
  ListChecks,
  Lock,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Users,
} from "lucide-react";
import type { Metadata } from "next";
import { Card, LinkButton } from "@/components/ui";
import { LOCALES, OG_LOCALE, toLocale, type Locale } from "@/i18n/config";
import { lhref } from "@/i18n/href";
import { alternatesFor } from "@/i18n/seo";
import { getT } from "@/i18n/server";
import { APP_NAME } from "@/lib/config";
import { isDemoMode } from "@/lib/demo";

/** Open Graph in the page language, with the other languages as alternates. */
const ogAlternates = (locale: Locale) => LOCALES.filter((l) => l !== locale).map((l) => OG_LOCALE[l]);

type Params = Promise<{ locale: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const locale = toLocale((await params).locale);
  const t = getT(locale, "site");
  const title = t("forClinics.metaTitle");
  const description = t("forClinics.metaDescription");
  return {
    title,
    description,
    alternates: alternatesFor("/for-clinics", locale),
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

const FEATURES = [
  { key: "offices", icon: Building2 },
  { key: "chairs", icon: CalendarRange },
  { key: "twoWay", icon: MessageCircle },
  { key: "rules", icon: BellRing },
  { key: "waitlist", icon: RefreshCw },
  { key: "board", icon: ListChecks },
  { key: "reviews", icon: BadgeCheck },
  { key: "api", icon: Code2 },
  { key: "roles", icon: Users },
  { key: "privacy", icon: Lock },
  { key: "languages", icon: Languages },
] as const;

const FLOW = ["book", "email", "text", "reply", "other"] as const;

export default async function ForClinicsPage({ params }: { params: Params }) {
  const locale = toLocale((await params).locale);
  const t = getT(locale, "site");
  const href = (path: string) => lhref(locale, path);
  return (
    <div>
      <section aria-labelledby="fc-title" className="bg-ink text-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
          <p className="text-sm font-bold uppercase tracking-wider text-brand-300">{t("forClinics.kicker")}</p>
          <h1 id="fc-title" className="mt-3 max-w-3xl text-4xl font-extrabold tracking-tight sm:text-5xl">
            {t("forClinics.title")}
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-slate-300">{t("forClinics.body")}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <LinkButton href={href("/signup")} size="lg" variant="subtle">
              {t("forClinics.signup")} <ArrowRight size={17} aria-hidden />
            </LinkButton>
            {isDemoMode() ? (
              <LinkButton href={href("/login?demo=1")} size="lg" className="bg-white/10 ring-1 ring-white/30 hover:bg-white/20">
                {t("forClinics.demo")}
              </LinkButton>
            ) : null}
          </div>
        </div>
      </section>

      <section aria-labelledby="fc-features" className="mx-auto max-w-6xl px-4 py-14">
        <h2 id="fc-features" className="sr-only">
          {t("forClinics.featuresTitle")}
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ key, icon: Icon }) => (
            <li key={key}>
              <Card className="h-full p-6">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700" aria-hidden>
                  <Icon size={20} />
                </span>
                <h3 className="mt-4 font-bold">{t(`forClinics.features.${key}.title`)}</h3>
                <p className="mt-1 text-sm text-slate-600">{t(`forClinics.features.${key}.body`)}</p>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="fc-flow" className="mx-auto max-w-6xl px-4 pb-6">
        <Card className="grid gap-8 p-8 lg:grid-cols-2">
          <div>
            <h2 id="fc-flow" className="text-2xl font-bold tracking-tight">
              {t("forClinics.flow.title")}
            </h2>
            <ol className="mt-5 space-y-4 text-sm">
              {FLOW.map((key, i) => (
                <li key={key} className="flex gap-3">
                  <span
                    aria-hidden
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-700 text-xs font-bold text-white"
                  >
                    {i + 1}
                  </span>
                  <span className="text-slate-700">{t(`forClinics.flow.${key}`)}</span>
                </li>
              ))}
            </ol>
          </div>
          {/* A sample conversation: discreet by default, so the reminder names no treatment. */}
          <figure className="flex flex-col items-center justify-center gap-3 rounded-2xl bg-slate-100 p-6">
            <div className="w-full max-w-xs space-y-3 rounded-[2rem] bg-white p-5 shadow-pop ring-8 ring-slate-800">
              <p className="flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-600">
                <Smartphone size={13} aria-hidden /> {t("forClinics.sms.sender")}
              </p>
              <p className="max-w-[85%] rounded-2xl rounded-bl-sm bg-slate-100 p-3 text-[13px] leading-snug">
                {t("forClinics.sms.reminder")}
              </p>
              <p className="ml-auto w-fit rounded-2xl rounded-br-sm bg-brand-700 px-3 py-2 text-[13px] text-white">
                {t("forClinics.sms.reply")}
              </p>
              <p className="max-w-[85%] rounded-2xl rounded-bl-sm bg-slate-100 p-3 text-[13px] leading-snug">
                {t("forClinics.sms.thanks")}
              </p>
            </div>
            <figcaption className="text-xs text-slate-600">{t("forClinics.sms.caption")}</figcaption>
          </figure>
        </Card>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-brand-50 p-6 ring-1 ring-brand-200">
          <p className="flex items-center gap-2 font-semibold text-brand-900">
            <ShieldCheck size={18} aria-hidden /> {t("forClinics.noLockIn")}
          </p>
          <LinkButton href={href("/developers")} variant="secondary">
            {t("forClinics.apiDocs")}
          </LinkButton>
        </div>
      </section>
    </div>
  );
}
