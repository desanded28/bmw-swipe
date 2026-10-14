import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { redirectIfLoggedIn } from "@/app/auth-actions";
import { LoginForm } from "@/components/AuthForms";
import { Card } from "@/components/ui";
import { ClientMessages } from "@/i18n/ClientMessages";
import { isLocale } from "@/i18n/config";
import { lhref } from "@/i18n/href";
import { alternatesFor } from "@/i18n/seo";
import { getT } from "@/i18n/server";
import { safeNext } from "@/lib/auth";
import { isDemoMode } from "@/lib/demo";
import { DEMO_OWNER_EMAIL, DEMO_RECEPTION_EMAIL } from "@/lib/security/demo-accounts";

/** The seeded demo logins (scripts/seed.ts), shown only in demo mode. */
const DEMO_OWNER = DEMO_OWNER_EMAIL;
const DEMO_RECEPTION = DEMO_RECEPTION_EMAIL;

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ demo?: string; next?: string; notice?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: getT(locale, "auth")("meta.login"), alternates: alternatesFor("/login", locale) };
}

export default async function LoginPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  await redirectIfLoggedIn();
  const { demo, next, notice } = await searchParams;
  const t = getT(locale, "auth");
  // The demo box and ?demo=1 exist only on a demo deployment (DEMO_MODE=1).
  const demoMode = isDemoMode();
  const noticeKey = `login.notices.${notice ?? ""}` as const;
  const nextPath = next ? safeNext(next) : undefined;
  return (
    <div className="mx-auto max-w-md px-4 py-14">
      <Card className="p-7">
        <h1 className="text-2xl font-extrabold tracking-tight">{t("login.title")}</h1>
        <p className="mb-6 mt-1 text-sm text-slate-500">{t("login.subtitle")}</p>
        {notice && t.has(noticeKey) ? (
          <p role="status" className="mb-5 rounded-xl bg-brand-50 p-3 text-sm font-medium text-brand-900">
            {t(noticeKey)}
          </p>
        ) : null}
        <ClientMessages locale={locale} ns={["auth"]}>
          <LoginForm demo={demoMode && demo === "1"} next={nextPath} />
        </ClientMessages>
        {demoMode ? (
          <div className="mt-6 rounded-xl bg-brand-50 p-4 text-sm text-brand-900">
            <p className="font-semibold">{t("login.demoTitle")}</p>
            <p className="mt-1">
              <code>{DEMO_OWNER}</code> — {t("login.demoOwner")}
              <br />
              <code>{DEMO_RECEPTION}</code> — {t("login.demoReception")}
            </p>
            {demo !== "1" ? (
              <Link href={lhref(locale, "/login?demo=1")} className="mt-2 inline-block font-semibold underline">
                {t("login.demoFill")}
              </Link>
            ) : null}
          </div>
        ) : null}
      </Card>
      <p className="mt-5 text-center text-sm text-slate-500">
        {t("login.newPractice")}{" "}
        <Link href={lhref(locale, "/signup")} className="font-semibold text-brand-700 hover:underline">
          {t("login.createAccount")}
        </Link>
      </p>
    </div>
  );
}
