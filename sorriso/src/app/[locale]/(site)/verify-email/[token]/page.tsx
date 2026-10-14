import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { VerifyEmailForm } from "@/components/AuthForms";
import { Card } from "@/components/ui";
import { ClientMessages } from "@/i18n/ClientMessages";
import { isLocale } from "@/i18n/config";
import { lhref } from "@/i18n/href";
import { getT } from "@/i18n/server";
import { findAuthToken } from "@/lib/security/tokens";

type Props = { params: Promise<{ locale: string; token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: getT(locale, "auth")("meta.verify"), robots: { index: false } };
}

/**
 * The link from the confirmation email. Confirming takes a click (a POST): mail scanners and link
 * previews open links on their own, and a GET must not change anything.
 */
export default async function VerifyEmailPage({ params }: Props) {
  const { locale, token } = await params;
  if (!isLocale(locale)) notFound();
  const t = getT(locale, "auth");
  const row = await findAuthToken(token, "email_verify");
  return (
    <div className="mx-auto max-w-md px-4 py-14">
      <Card className="p-7">
        <h1 className="text-2xl font-extrabold tracking-tight">{t("verify.title")}</h1>
        {row?.email ? (
          <>
            <p className="mb-6 mt-1 text-sm text-slate-600">{t("verify.body", { email: row.email })}</p>
            <ClientMessages locale={locale} ns={["auth"]}>
              <VerifyEmailForm token={token} />
            </ClientMessages>
          </>
        ) : (
          <div className="mt-4 space-y-4">
            <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm font-medium text-amber-900 ring-1 ring-amber-200">
              {t("verify.invalid")}
            </p>
            <Link href={lhref(locale, "/login")} className="inline-block text-sm font-semibold text-brand-700 hover:underline">
              {t("verify.login")}
            </Link>
          </div>
        )}
      </Card>
    </div>
  );
}
