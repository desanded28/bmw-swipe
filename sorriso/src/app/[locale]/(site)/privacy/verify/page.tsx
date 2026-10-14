import { Hourglass, KeyRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CodeForm } from "@/components/privacy/SignInForms";
import { Card, LinkButton } from "@/components/ui";
import { isLocale } from "@/i18n/config";
import { ClientMessages } from "@/i18n/ClientMessages";
import { lhref } from "@/i18n/href";
import { rich } from "@/i18n/rich";
import { getT } from "@/i18n/server";
import { maskContact, openTicket } from "@/lib/privacy/privacy-center";
import { verifyCodeAction } from "../actions";

export const dynamic = "force-dynamic";

type Params = Promise<{ locale: string }>;
type SP = Promise<{ t?: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: getT(locale, "privacy")("verify.meta.title"), robots: { index: false, follow: false }, referrer: "no-referrer" };
}

/**
 * Step 2 of the privacy-center sign-in: the 6-digit code. The page says where the code went
 * (masked) and that it went only if a practice holds data for that contact: the same page for a
 * known and an unknown contact.
 */
export default async function VerifyPage({ params, searchParams }: { params: Params; searchParams: SP }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getT(locale, "privacy");
  const raw = (await searchParams).t ?? "";
  const ticket = openTicket(raw, "privacy_center");

  if (!ticket) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-600" aria-hidden>
          <Hourglass size={26} />
        </div>
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight">{t("verify.title")}</h1>
        <p className="mt-2 text-slate-600">{t("verify.errors.ticket")}</p>
        <LinkButton href={lhref(locale, "/privacy")} variant="secondary" className="mt-6">
          {t("center.signIn.submit")}
        </LinkButton>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <Card className="p-6 sm:p-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-700" aria-hidden>
          <KeyRound size={22} />
        </div>
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight">{t("verify.title")}</h1>
        <p className="mt-2 text-slate-600">{t("verify.sentTo", { contact: maskContact({ kind: ticket.k, value: ticket.v }) })}</p>
        <div className="mt-6">
          <ClientMessages locale={locale} ns={["privacy"]}>
            <CodeForm action={verifyCodeAction} ticket={raw} />
          </ClientMessages>
        </div>
        <p className="mt-6 text-sm text-slate-600">
          {rich(t("verify.again"), {
            link: (c) => (
              <Link href={lhref(locale, "/privacy")} className="font-semibold text-brand-700 underline underline-offset-2">
                {c}
              </Link>
            ),
          })}
        </p>
      </Card>
    </div>
  );
}
