import Link from "next/link";
import { getStaffLocale, getT } from "@/i18n/server";

export default async function DashboardNotFound() {
  const t = getT(await getStaffLocale(), "common");
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-xl font-bold text-slate-900">{t("pages.notFoundTitle")}</h1>
      <p className="mt-2 text-slate-600">{t("pages.notFoundBody")}</p>
      <Link href="/dashboard" className="mt-6 inline-block font-semibold text-teal-700 hover:underline">
        Dashboard
      </Link>
    </div>
  );
}
