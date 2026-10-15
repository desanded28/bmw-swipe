import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { SkipLink } from "@/components/SkipLink";
import { ClientMessages } from "@/i18n/ClientMessages";
import { DIR } from "@/i18n/config";
import { getRequestLocale, getStaffLocale, getT } from "@/i18n/server";
import { APP_NAME } from "@/lib/config";
import LocaleNotFound from "./[locale]/not-found";
import { jakarta } from "./fonts";
import "./globals.css";

export const metadata: Metadata = { robots: { index: false } };

/**
 * Every unmatched URL: public paths (/{locale}/…, with the site header and footer, as
 * [locale]/not-found) and dashboard paths (/dashboard/…). Rendered on the server with
 * <html lang> and a "Page not found" title, so it reads without JavaScript. (A page's own
 * notFound(), for an unknown practice or patient, renders its segment's not-found.tsx, which
 * Next.js 16 paints on the client: those carry their own <title> too.)
 */
export default async function GlobalNotFound() {
  const path = (await headers()).get("x-pathname") ?? "";
  if (path === "/dashboard" || path.startsWith("/dashboard/")) {
    const locale = await getStaffLocale();
    const t = getT(locale, "dashboard");
    return (
      <html lang={locale} dir={DIR[locale]} className={jakarta.variable}>
        <body className="grid min-h-dvh place-items-center bg-[#f7f9fb] p-6 text-center">
          <title>{`${t("notFound.title")} · ${APP_NAME}`}</title>
          <main id="main" tabIndex={-1} className="max-w-md outline-none">
            <h1 className="text-xl font-bold text-slate-900">{t("notFound.title")}</h1>
            <p className="mt-2 text-slate-600">{t("notFound.body")}</p>
            <Link href="/dashboard" className="mt-6 inline-block font-semibold text-brand-700 hover:underline">
              {t("notFound.back")}
            </Link>
          </main>
        </body>
      </html>
    );
  }
  const locale = await getRequestLocale();
  return (
    <html lang={locale} dir={DIR[locale]} className={jakarta.variable}>
      <body className="min-h-dvh">
        <ClientMessages locale={locale} ns={["common", "a11y", "site", "errors", "booking"]}>
          <SkipLink />
          <LocaleNotFound />
        </ClientMessages>
      </body>
    </html>
  );
}
