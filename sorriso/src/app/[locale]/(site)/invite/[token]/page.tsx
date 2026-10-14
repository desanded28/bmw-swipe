import { eq } from "drizzle-orm";
import { Building2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { logout } from "@/app/auth-actions";
import { InviteForm } from "@/components/AuthForms";
import { Button, Card } from "@/components/ui";
import { db } from "@/db";
import { organizations, users } from "@/db/schema";
import { ClientMessages } from "@/i18n/ClientMessages";
import { isLocale } from "@/i18n/config";
import { lhref } from "@/i18n/href";
import { getT } from "@/i18n/server";
import { getSession } from "@/lib/auth";
import { LEGAL_VERSIONS } from "@/lib/privacy/versions";
import { findAuthToken } from "@/lib/security/tokens";

type Props = { params: Promise<{ locale: string; token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: getT(locale, "auth")("meta.invite"), robots: { index: false } };
}

/**
 * Team invitation (7 days, single use). The invitee reads and accepts the practice's staff
 * instructions (Art. 29 GDPR, Art. 2-quaterdecies Codice privacy; WP5's text), then joins with
 * the account of the invited email (signing in first if it exists) or creates one.
 */
export default async function InvitePage({ params }: Props) {
  const { locale, token } = await params;
  if (!isLocale(locale)) notFound();
  const t = getT(locale, "auth");
  const row = await findAuthToken(token, "invite");
  const [org] = row?.orgId ? await db.select().from(organizations).where(eq(organizations.id, row.orgId)) : [];
  if (!row?.email || !row.role || !org) {
    return (
      <Shell title={t("meta.invite")}>
        <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm font-medium text-amber-900 ring-1 ring-amber-200">
          {t("invite.invalid")}
        </p>
      </Shell>
    );
  }

  const [inviter] = row.createdByUserId ? await db.select({ name: users.name }).from(users).where(eq(users.id, row.createdByUserId)) : [];
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, row.email));
  const session = await getSession();
  const signedInAsInvitee = Boolean(session && existing && session.user.id === existing.id);
  const role = getT(locale, "common")(`roles.${row.role}`);
  const tl = getT(locale, "legalPractice");
  const points = [
    tl("staffInstructions.confidentiality"),
    tl("staffInstructions.needToKnow"),
    tl("staffInstructions.freeText"),
    tl("staffInstructions.breaches"),
    tl("staffInstructions.personalDevices"),
    tl("staffInstructions.calendarSync"),
    tl("staffInstructions.accessLog"),
  ];
  const loginHref = lhref(locale, `/login?next=${encodeURIComponent(`/${locale}/invite/${token}`)}`);

  return (
    <Shell title={t("invite.title", { practice: org.name })}>
      <p className="text-sm text-slate-600">
        {t("invite.body", { inviter: inviter?.name ?? org.name, practice: org.name, role })}
      </p>
      {session && !signedInAsInvitee ? (
        <div className="mt-5 space-y-3">
          <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm font-medium text-amber-900 ring-1 ring-amber-200">
            {t("invite.wrongAccount")}
          </p>
          <form action={logout}>
            <Button type="submit" variant="secondary">
              {t("invite.logout")}
            </Button>
          </form>
        </div>
      ) : existing && !session ? (
        <div className="mt-5 space-y-3">
          <p className="rounded-xl bg-brand-50 p-3 text-sm text-brand-900">{t("invite.existingAccount")}</p>
          <Link href={loginHref} className="inline-flex h-10 items-center rounded-xl bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800">
            {t("invite.login")}
          </Link>
        </div>
      ) : (
        <>
          <section aria-labelledby="staff-instructions" className="mt-6 rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-200">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{t("invite.instructionsLead")}</p>
            <h2 id="staff-instructions" className="text-base font-bold">
              {tl("staffInstructions.title")}
            </h2>
            <p className="mt-2 text-sm text-slate-700">{tl("staffInstructions.intro")}</p>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700">
              {points.map((text) => (
                <li key={text}>{text}</li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-slate-500">{tl("staffInstructions.version", { version: LEGAL_VERSIONS.staff_instructions })}</p>
          </section>
          <div className="mt-6">
            {!existing ? (
              <h2 className="mb-1 text-base font-bold">{t("invite.newAccount")}</h2>
            ) : null}
            {!existing ? <p className="mb-4 text-sm text-slate-500">{row.email}</p> : null}
            <ClientMessages locale={locale} ns={["auth"]}>
              <InviteForm token={token} newAccount={!existing} acceptLabel={tl("staffInstructions.accept")} />
            </ClientMessages>
          </div>
        </>
      )}
    </Shell>
  );
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-14">
      <Card className="p-7">
        <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700" aria-hidden>
          <Building2 size={22} />
        </span>
        <h1 className="mb-2 text-2xl font-extrabold tracking-tight">{title}</h1>
        {children}
      </Card>
    </div>
  );
}
