import { ArrowRight, Download, Eraser, FileText, Hand, KeyRound, Lock, Pencil, ShieldCheck, Undo2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SignInForm } from "@/components/privacy/SignInForms";
import { Card, LinkButton } from "@/components/ui";
import { isLocale } from "@/i18n/config";
import { ClientMessages } from "@/i18n/ClientMessages";
import { lhref } from "@/i18n/href";
import { rich } from "@/i18n/rich";
import { alternatesFor } from "@/i18n/seo";
import { getT } from "@/i18n/server";
import { getPatientSession } from "@/lib/privacy/patient-session";
import { maskContact } from "@/lib/privacy/privacy-center";
import { requestCodeAction, signOutAction } from "./actions";

export const dynamic = "force-dynamic";

type Params = Promise<{ locale: string }>;
type SP = Promise<{ signedOut?: string; expired?: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getT(locale, "privacy");
  return { title: t("center.meta.title"), description: t("center.meta.description"), alternates: alternatesFor("/privacy", locale) };
}

const RIGHTS = [
  ["access", FileText],
  ["rectification", Pencil],
  ["erasure", Eraser],
  ["restriction", Lock],
  ["portability", Download],
  ["objection", Hand],
  ["withdraw", Undo2],
] as const;

/**
 * The patient privacy center's front door: what it is, the sign-in with a one-time code (no
 * account), the rights and how to exercise them, and the right to complain to the Garante.
 */
export default async function PrivacyCenterPage({ params, searchParams }: { params: Params; searchParams: SP }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const sp = await searchParams;
  const t = getT(locale, "privacy");
  const session = await getPatientSession();
  const garante = (c: React.ReactNode) => (
    <a href="https://www.garanteprivacy.it" rel="noopener" target="_blank" className="font-semibold text-brand-700 underline underline-offset-2">
      {c}
    </a>
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:items-start">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-800 ring-1 ring-brand-200">
            <ShieldCheck size={14} aria-hidden /> {t("center.eyebrow")}
          </p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">{t("center.title")}</h1>
          <p className="mt-3 text-lg leading-relaxed text-slate-600">{t("center.intro")}</p>
          <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-slate-500">{t("center.steps.heading")}</h2>
          <ol className="mt-3 space-y-3">
            {(["one", "two", "three"] as const).map((k, i) => (
              <li key={k} className="flex gap-3 text-slate-700">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-700 text-sm font-bold text-white" aria-hidden>
                  {i + 1}
                </span>
                <span className="pt-0.5">{t(`center.steps.${k}`)}</span>
              </li>
            ))}
          </ol>
        </div>

        <Card className="p-6">
          {sp.signedOut ? <p className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 ring-1 ring-emerald-200" role="status">{t("me.signedOut")}</p> : null}
          {sp.expired && !session ? <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200" role="status">{t("me.expired")}</p> : null}
          {session ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-700">{t("center.signIn.signedIn", { contact: maskContact(session.contact) })}</p>
              <LinkButton href={lhref(locale, "/privacy/me")} className="w-full sm:w-auto">
                {t("center.signIn.continue")} <ArrowRight size={16} aria-hidden />
              </LinkButton>
              <form action={signOutAction}>
                <input type="hidden" name="locale" value={locale} />
                <button type="submit" className="text-sm font-semibold text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline">
                  {t("me.signOut")}
                </button>
              </form>
            </div>
          ) : (
            <>
              <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
                <KeyRound size={18} className="text-brand-700" aria-hidden /> {t("center.signIn.heading")}
              </h2>
              <ClientMessages locale={locale} ns={["privacy"]}>
                <SignInForm action={requestCodeAction} />
              </ClientMessages>
            </>
          )}
        </Card>
      </div>

      <section aria-labelledby="rights" className="mt-14">
        <h2 id="rights" className="text-2xl font-bold tracking-tight">
          {t("center.rights.heading")}
        </h2>
        <p className="mt-1 text-slate-600">{t("center.rights.intro")}</p>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {RIGHTS.map(([key, Icon]) => (
            <li key={key} className="flex gap-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200/70">
              <Icon size={20} className="mt-0.5 shrink-0 text-brand-700" aria-hidden />
              <p className="text-sm text-slate-600">
                <span className="block font-semibold text-slate-900">{t(`center.rights.${key}.title`)}</span>
                {t(`center.rights.${key}.body`)}
              </p>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-slate-600">{t("center.rights.deadline")}</p>
      </section>

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        <section aria-labelledby="complaint" className="rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-200/70">
          <h2 id="complaint" className="font-bold">
            {t("center.complaint.heading")}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">{rich(t("center.complaint.body"), { link: garante })}</p>
        </section>
        <section aria-labelledby="who" className="rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-200/70">
          <h2 id="who" className="font-bold">
            {t("center.controller.heading")}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            {rich(t("center.controller.body"), {
              link: (c) => (
                <Link href={lhref(locale, "/legal/privacy")} className="font-semibold text-brand-700 underline underline-offset-2">
                  {c}
                </Link>
              ),
            })}
          </p>
        </section>
      </div>
    </div>
  );
}
