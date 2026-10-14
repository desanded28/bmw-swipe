import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { SkipLink } from "@/components/SkipLink";
import { DIR, isLocale, LOCALES, OG_LOCALE, toLocale } from "@/i18n/config";
import { ClientMessages } from "@/i18n/ClientMessages";
import { alternatesFor } from "@/i18n/seo";
import { getT } from "@/i18n/server";
import { APP_NAME, APP_URL } from "@/lib/config";
import { jakarta } from "../fonts";
import "../globals.css";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

/**
 * Defaults for every public page: the localised site title and description, Open Graph in the
 * page's language with the other languages as alternates, and hreflang alternates for the current
 * path (the proxy's x-pathname). Pages set their own title, description and alternates on top.
 */
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = toLocale((await params).locale);
  const t = getT(locale, "site");
  const path = (await headers()).get("x-pathname");
  const title = t("meta.title", { app: APP_NAME });
  const description = t("meta.description");
  return {
    metadataBase: new URL(APP_URL),
    title: { default: title, template: `%s · ${APP_NAME}` },
    description,
    applicationName: APP_NAME,
    icons: { icon: "/icon.svg" },
    ...(path ? { alternates: alternatesFor(path, locale) } : {}),
    openGraph: {
      type: "website",
      siteName: APP_NAME,
      title,
      description,
      locale: OG_LOCALE[locale],
      alternateLocale: LOCALES.filter((l) => l !== locale).map((l) => OG_LOCALE[l]),
    },
  };
}

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0c675d" };

/**
 * Root layout for every public page: /{locale}/... The skip link comes first; each public page
 * renders <main id="content" tabIndex={-1}> as its target. The namespaces below are available to
 * client components on every public page (booking: other packages render the booking flow too).
 *
 * Every public page renders per request (connection()): the CSP nonce is per request
 * (src/lib/security/headers.ts), and a page prerendered at build time would carry none, so the
 * browser would block its scripts. Explicit here rather than left to the headers() read in
 * generateMetadata, so pages without request data (developers, for-clinics, legal/*) stay dynamic.
 */
export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  await connection();
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <html lang={locale} dir={DIR[locale]} className={jakarta.variable}>
      <body className="min-h-dvh">
        <ClientMessages locale={locale} ns={["common", "a11y", "site", "errors", "booking"]}>
          <SkipLink />
          {children}
        </ClientMessages>
      </body>
    </html>
  );
}
