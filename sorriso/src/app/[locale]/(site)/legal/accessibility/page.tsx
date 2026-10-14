import { CheckCircle2, Info } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { LOCALES, OG_LOCALE, toLocale, type Locale } from "@/i18n/config";
import { capitalizeFirst, fmtDay } from "@/i18n/datefmt";
import { lhref } from "@/i18n/href";
import { rich } from "@/i18n/rich";
import { alternatesFor } from "@/i18n/seo";
import { getT } from "@/i18n/server";
import { APP_NAME, APP_URL } from "@/lib/config";

/** Open Graph in the page language, with the other languages as alternates. */
const ogAlternates = (locale: Locale) => LOCALES.filter((l) => l !== locale).map((l) => OG_LOCALE[l]);

type Params = Promise<{ locale: string }>;

/** When the statement was first prepared and last reviewed (update on every review; see docs/accessibility.md). */
const PREPARED_ON = "2026-10-14";
const REVIEWED_ON = "2026-10-14";

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const locale = toLocale((await params).locale);
  const t = getT(locale, "accessibility");
  const title = t("meta.title");
  const description = t("meta.description", { app: APP_NAME });
  return {
    title,
    description,
    alternates: alternatesFor("/legal/accessibility", locale),
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

/** The accessibility statement (European Accessibility Act; Italy: D.Lgs. 82/2022, L. 4/2004). */
export default async function AccessibilityStatementPage({ params }: { params: Params }) {
  const locale = toLocale((await params).locale);
  const t = getT(locale, "accessibility");
  const email = process.env.PLATFORM_ACCESSIBILITY_EMAIL ?? process.env.PLATFORM_PRIVACY_EMAIL ?? null;
  const provider = process.env.PLATFORM_LEGAL_NAME ?? APP_NAME;
  const host = APP_URL.replace(/^https?:\/\//, "");
  const day = (d: string) => capitalizeFirst(fmtDay(d, "long", locale), locale);
  const link = "font-semibold text-brand-700 underline underline-offset-2";
  const features = ["keyboard", "screenReader", "steps", "contrast", "motion", "zoom", "languages", "help"] as const;
  const limitations = ["practiceContent", "dates", "maps", "widget", "messages", "exports"] as const;
  const section = "mt-10 text-xl font-bold";

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 text-slate-700">
      <h1 className="text-3xl font-extrabold tracking-tight text-ink">{t("title")}</h1>
      {locale !== "it" ? (
        <p className="mt-4 flex gap-2 rounded-xl bg-slate-50 p-3 text-sm ring-1 ring-slate-200">
          <Info size={16} className="mt-0.5 shrink-0 text-slate-600" aria-hidden />
          <span>
            {rich(t("translationNotice"), {
              link: (c) => (
                <Link href={lhref("it", "/legal/accessibility")} hrefLang="it" lang="it" className={link}>
                  {c}
                </Link>
              ),
            })}
          </span>
        </p>
      ) : null}
      <p className="mt-6 text-lg">{t("intro", { provider })}</p>
      <p className="mt-3">{t("legalBasis")}</p>

      <h2 className={section}>{t("scope.title")}</h2>
      <p className="mt-3">{t("scope.body", { host })}</p>

      <h2 className={section}>{t("status.title")}</h2>
      <p className="mt-3">{t("status.body")}</p>

      <h2 className={section}>{t("features.title")}</h2>
      <ul className="mt-3 space-y-2">
        {features.map((k) => (
          <li key={k} className="flex gap-2">
            <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-brand-700" aria-hidden />
            {t(`features.${k}`)}
          </li>
        ))}
      </ul>

      <h2 className={section}>{t("limitations.title")}</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5">
        {limitations.map((k) => (
          <li key={k}>{t(`limitations.${k}`)}</li>
        ))}
      </ul>
      <p className="mt-3">{t("limitations.workaround")}</p>

      <h2 className={section}>{t("preparation.title")}</h2>
      <p className="mt-3">{t("preparation.body", { date: day(PREPARED_ON), reviewed: day(REVIEWED_ON) })}</p>

      <h2 id="feedback" className={section}>
        {t("feedback.title")}
      </h2>
      <p className="mt-3">
        {email
          ? rich(t, "feedback.body", { mail: (c) => <a href={`mailto:${email}`} className={link}>{c}</a> }, { email })
          : rich(t("feedback.noEmail"), {
              link: (c) => (
                <Link href={lhref(locale, "/legal/privacy")} className={link}>
                  {c}
                </Link>
              ),
            })}
      </p>

      <h2 className={section}>{t("enforcement.title")}</h2>
      <p className="mt-3">
        {rich(t("enforcement.body"), {
          link: (c) => (
            <a href="https://form.agid.gov.it" className={link} rel="noopener noreferrer">
              {c}
            </a>
          ),
        })}
      </p>
    </article>
  );
}
