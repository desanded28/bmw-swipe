import type { Metadata } from "next";
import { getRequestLocale, getT } from "@/i18n/server";
import { lhref } from "@/i18n/href";
import { jakarta } from "./fonts";
import "./globals.css";

export const metadata: Metadata = { title: "404", robots: { index: false } };

/** For URLs outside both root layouts. Locale pages have their own [locale]/not-found.tsx. */
export default async function GlobalNotFound() {
  const locale = await getRequestLocale();
  const t = getT(locale, "common");
  return (
    <html lang={locale} className={jakarta.variable}>
      <body className="grid min-h-dvh place-items-center bg-slate-50 p-6 text-center">
        <div>
          <p className="text-5xl font-extrabold text-teal-700">404</p>
          <h1 className="mt-3 text-xl font-bold text-slate-900">{t("pages.notFoundTitle")}</h1>
          <p className="mt-2 text-slate-600">{t("pages.notFoundBody")}</p>
          <a href={lhref(locale, "/")} className="mt-6 inline-block font-semibold text-teal-700 hover:underline">
            {t("pages.home")}
          </a>
        </div>
      </body>
    </html>
  );
}
