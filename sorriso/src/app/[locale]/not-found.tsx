import { getRequestLocale, getT } from "@/i18n/server";
import { lhref } from "@/i18n/href";

/** 404 inside a locale (unknown page, unknown clinic…). WP1 restyles it with the site chrome. */
export default async function NotFound() {
  const locale = await getRequestLocale();
  const t = getT(locale, "common");
  return (
    <main className="grid min-h-[60dvh] place-items-center p-6 text-center">
      <div>
        <p className="text-5xl font-extrabold text-teal-700">404</p>
        <h1 className="mt-3 text-xl font-bold text-slate-900">{t("pages.notFoundTitle")}</h1>
        <p className="mt-2 text-slate-600">{t("pages.notFoundBody")}</p>
        <a href={lhref(locale, "/")} className="mt-6 inline-block font-semibold text-teal-700 hover:underline">
          {t("pages.home")}
        </a>
      </div>
    </main>
  );
}
