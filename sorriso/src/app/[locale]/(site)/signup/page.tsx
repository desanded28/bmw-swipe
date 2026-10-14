import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { redirectIfLoggedIn } from "@/app/auth-actions";
import { SignupForm } from "@/components/AuthForms";
import { Card } from "@/components/ui";
import { ClientMessages } from "@/i18n/ClientMessages";
import { isLocale } from "@/i18n/config";
import { lhref } from "@/i18n/href";
import { alternatesFor } from "@/i18n/seo";
import { getT } from "@/i18n/server";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: getT(locale, "auth")("meta.signup"), alternates: alternatesFor("/signup", locale) };
}

export default async function SignupPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  await redirectIfLoggedIn();
  const t = getT(locale, "auth");
  return (
    <div className="mx-auto max-w-xl px-4 py-14">
      <Card className="p-7">
        <h1 className="text-2xl font-extrabold tracking-tight">{t("signup.title")}</h1>
        <p className="mb-6 mt-1 text-sm text-slate-500">{t("signup.subtitle")}</p>
        <ClientMessages locale={locale} ns={["auth"]}>
          <SignupForm />
        </ClientMessages>
      </Card>
      <p className="mt-5 text-center text-sm text-slate-500">
        {t("signup.haveAccount")}{" "}
        <Link href={lhref(locale, "/login")} className="font-semibold text-brand-700 hover:underline">
          {t("signup.login")}
        </Link>
      </p>
    </div>
  );
}
