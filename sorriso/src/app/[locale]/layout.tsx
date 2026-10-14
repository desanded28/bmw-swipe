import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { DIR, isLocale, LOCALES } from "@/i18n/config";
import { ClientMessages } from "@/i18n/ClientMessages";
import { APP_NAME, APP_URL } from "@/lib/config";
import { jakarta } from "../fonts";
import "../globals.css";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: { default: `${APP_NAME} — Book your dentist online`, template: `%s · ${APP_NAME}` },
  description:
    "Find a dentist near you, see real availability and book in seconds. Reminders by SMS, WhatsApp or email — confirm or reschedule with one tap.",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0c675d" };

/** Root layout for every public page: /{locale}/... */
export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <html lang={locale} dir={DIR[locale]} className={jakarta.variable}>
      <body className="min-h-dvh">
        <ClientMessages locale={locale} ns={["common", "a11y", "site", "errors"]}>
          {children}
        </ClientMessages>
      </body>
    </html>
  );
}
