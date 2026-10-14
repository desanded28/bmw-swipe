import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { MfaForm } from "@/components/AuthForms";
import { Card } from "@/components/ui";
import { ClientMessages } from "@/i18n/ClientMessages";
import { isLocale } from "@/i18n/config";
import { getT } from "@/i18n/server";
import { getPendingMfaSession, getSession, safeNext } from "@/lib/auth";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ next?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: getT(locale, "auth")("meta.mfa"), robots: { index: false } };
}

/** Second sign-in step: only reachable with a session waiting for its code. */
export default async function MfaPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { next } = await searchParams;
  if (await getSession()) redirect(safeNext(next));
  if (!(await getPendingMfaSession())) redirect(`/${locale}/login`);
  const t = getT(locale, "auth");
  return (
    <div className="mx-auto max-w-md px-4 py-14">
      <Card className="p-7">
        <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700" aria-hidden>
          <ShieldCheck size={22} />
        </span>
        <h1 className="text-2xl font-extrabold tracking-tight">{t("mfa.title")}</h1>
        <p className="mb-6 mt-1 text-sm text-slate-500">{t("mfa.subtitle")}</p>
        <ClientMessages locale={locale} ns={["auth"]}>
          <MfaForm next={next ? safeNext(next) : undefined} />
        </ClientMessages>
        <p className="mt-6 text-xs leading-relaxed text-slate-500">{t("mfa.lostDevice")}</p>
      </Card>
    </div>
  );
}
