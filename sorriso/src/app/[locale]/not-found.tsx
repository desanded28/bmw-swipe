import { SearchX } from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { LinkButton } from "@/components/ui";
import { lhref } from "@/i18n/href";
import { getRequestLocale, getT } from "@/i18n/server";
import { APP_NAME } from "@/lib/config";
import { isDemoMode } from "@/lib/demo";

/**
 * 404 inside a locale (unknown clinic, practitioner…: a page's notFound()), with the site chrome:
 * the not-found boundary sits above the (site) layout, so it brings its own header and footer.
 * Unmatched URLs get the same content from global-not-found.tsx. Next adds robots noindex to 404
 * responses itself.
 */
export default async function NotFound() {
  const locale = await getRequestLocale();
  const t = getT(locale, "common");
  const ts = getT(locale, "site");
  return (
    <>
      {/* React hoists it into <head>: the tab and screen readers say "Page not found", not the home title. */}
      <title>{`${t("pages.notFoundTitle")} · ${APP_NAME}`}</title>
      <SiteHeader />
      <main id="content" tabIndex={-1} className="grid min-h-[60dvh] place-items-center px-4 py-16 text-center outline-none">
        <div className="max-w-md">
          <SearchX size={40} className="mx-auto text-brand-700" aria-hidden />
          <p className="mt-4 text-sm font-bold uppercase tracking-wider text-brand-700">{ts("notFound.code")}</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">{t("pages.notFoundTitle")}</h1>
          <p className="mt-2 text-slate-600">{t("pages.notFoundBody")}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <LinkButton href={lhref(locale, "/")}>{t("pages.home")}</LinkButton>
            <LinkButton href={lhref(locale, "/search")} variant="secondary">
              {ts("header.findDentist")}
            </LinkButton>
          </div>
        </div>
      </main>
      <SiteFooter demo={isDemoMode()} year={new Date().getFullYear()} />
    </>
  );
}
