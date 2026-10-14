import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ResetRequestForm } from "@/components/AuthForms";
import { Card } from "@/components/ui";
import { ClientMessages } from "@/i18n/ClientMessages";
import { isLocale } from "@/i18n/config";
import { lhref } from "@/i18n/href";
import { getT } from "@/i18n/server";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: getT(locale, "auth")("meta.reset"), robots: { index: false } };
}

export default async function ResetPasswordPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getT(locale, "auth");
  return (
    <div className="mx-auto max-w-md px-4 py-14">
      <Card className="p-7">
        <h1 className="text-2xl font-extrabold tracking-tight">{t("reset.title")}</h1>
        <p className="mb-6 mt-1 text-sm text-slate-500">{t("reset.subtitle")}</p>
        <ClientMessages locale={locale} ns={["auth"]}>
          <ResetRequestForm />
        </ClientMessages>
      </Card>
      <p className="mt-5 text-center text-sm">
        <Link href={lhref(locale, "/login")} className="font-semibold text-brand-700 hover:underline">
          {t("reset.back")}
        </Link>
      </p>
    </div>
  );
}
