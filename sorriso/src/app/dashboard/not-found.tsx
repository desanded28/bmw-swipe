import { SearchX } from "lucide-react";
import Link from "next/link";
import { getStaffLocale, getT } from "@/i18n/server";
import { APP_NAME } from "@/lib/config";

/** notFound() in a dashboard page (unknown patient…), inside the dashboard layout. Unmatched dashboard URLs: global-not-found.tsx. */
export default async function DashboardNotFound() {
  const t = getT(await getStaffLocale(), "dashboard");
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      {/* React hoists it into <head>: not the title of the page that called notFound(). */}
      <title>{`${t("notFound.title")} · ${APP_NAME}`}</title>
      <SearchX size={32} className="mx-auto mb-3 text-slate-400" aria-hidden />
      <h1 className="text-xl font-bold text-slate-900">{t("notFound.title")}</h1>
      <p className="mt-2 text-slate-600">{t("notFound.body")}</p>
      <Link href="/dashboard" className="mt-6 inline-block font-semibold text-brand-700 hover:underline">
        {t("notFound.back")}
      </Link>
    </div>
  );
}
