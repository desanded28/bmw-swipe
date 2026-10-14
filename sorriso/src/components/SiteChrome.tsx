"use client";

import Link from "next/link";
import { lhref } from "@/i18n/href";
import { useLocale, useT } from "@/i18n/provider";
import { APP_NAME } from "@/lib/config";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { LinkButton, Logo } from "./ui";

export function SiteHeader() {
  const t = useT("site");
  const ta = useT("a11y");
  const locale = useLocale();
  const href = (path: string) => lhref(locale, path);
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
        <Link href={href("/")} aria-label={ta("home", { app: APP_NAME })} className="rounded-lg">
          <Logo />
        </Link>
        <nav aria-label={ta("nav.main")} className="hidden md:block">
          <ul className="flex items-center gap-6 text-sm font-semibold text-slate-600">
            <li>
              <Link href={href("/search")} className="hover:text-ink">
                {t("header.findDentist")}
              </Link>
            </li>
            <li>
              <Link href={href("/for-clinics")} className="hover:text-ink">
                {t("header.forPractices")}
              </Link>
            </li>
            <li>
              <Link href={href("/developers")} className="hover:text-ink">
                {t("header.api")}
              </Link>
            </li>
          </ul>
        </nav>
        <div className="flex items-center gap-1 sm:gap-2">
          <LanguageSwitcher />
          <LinkButton href={href("/login")} variant="ghost" size="sm">
            {t("header.login")}
          </LinkButton>
          <LinkButton href={href("/search")} size="sm" className="hidden sm:inline-flex">
            {t("header.bookNow")}
          </LinkButton>
        </div>
      </div>
    </header>
  );
}

/**
 * The site footer: patient and practice links, every legal page and the privacy center, the
 * language list, and (demo deployments only) the notice that people shown are fictional.
 */
export function SiteFooter({ demo = false, year }: { demo?: boolean; year: number }) {
  const t = useT("site");
  const ta = useT("a11y");
  const locale = useLocale();
  const href = (path: string) => lhref(locale, path);
  const link = "inline-flex min-h-6 items-center hover:text-ink hover:underline";
  const legal: [string, string][] = [
    ["/legal/privacy", t("footer.privacy")],
    ["/legal/cookies", t("footer.cookies")],
    ["/legal/terms", t("footer.terms")],
    ["/legal/dpa", t("footer.dpa")],
    ["/legal/subprocessors", t("footer.subprocessors")],
    ["/legal/accessibility", t("footer.accessibility")],
    ["/legal/reviews", t("footer.reviewPolicy")],
    ["/legal/ranking", t("footer.ranking")],
  ];
  return (
    <footer className="mt-20 border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 text-sm text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Logo />
          <p className="mt-3 max-w-sm">{t("footer.tagline")}</p>
        </div>
        <nav aria-label={ta("nav.patients")}>
          <h2 className="mb-2 font-semibold text-slate-800">{t("footer.patients")}</h2>
          <ul className="space-y-1.5">
            <li>
              <Link href={href("/search")} className={link}>
                {t("footer.findDentist")}
              </Link>
            </li>
            <li>
              <Link href={href("/search?category=emergency")} className={link}>
                {t("footer.emergency")}
              </Link>
            </li>
            <li>
              <Link href={href("/search?category=hygiene")} className={link}>
                {t("footer.cleaning")}
              </Link>
            </li>
            <li>
              <Link href={href("/privacy")} className={link}>
                {t("footer.privacyCenter")}
              </Link>
            </li>
          </ul>
        </nav>
        <nav aria-label={ta("nav.practices")}>
          <h2 className="mb-2 font-semibold text-slate-800">{t("footer.practices")}</h2>
          <ul className="space-y-1.5">
            <li>
              <Link href={href("/for-clinics")} className={link}>
                {t("footer.features")}
              </Link>
            </li>
            <li>
              <Link href={href("/signup")} className={link}>
                {t("footer.createPractice")}
              </Link>
            </li>
            <li>
              <Link href={href("/developers")} className={link}>
                {t("footer.apiWidget")}
              </Link>
            </li>
          </ul>
        </nav>
        <nav aria-label={ta("nav.legal")}>
          <h2 className="mb-2 font-semibold text-slate-800">{t("footer.legal")}</h2>
          <ul className="space-y-1.5">
            {legal.map(([path, label]) => (
              <li key={path}>
                <Link href={href(path)} className={link}>
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="mx-auto max-w-6xl border-t border-slate-100 px-4 py-6 text-sm text-slate-600">
        <LanguageSwitcher variant="inline" />
      </div>
      <div className="border-t border-slate-100 px-4 py-5 text-center text-xs text-slate-600">
        <p>{t("footer.copyright", { year, app: APP_NAME })}</p>
        {demo ? <p className="mt-1">{t("footer.demo")}</p> : null}
      </div>
    </footer>
  );
}
