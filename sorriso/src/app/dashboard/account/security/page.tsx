import { eq } from "drizzle-orm";
import { Fingerprint, KeyRound, LaptopMinimal, Mail } from "lucide-react";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { EmailStatus, PasswordForm, SessionsList } from "@/components/security/AccountSecurity";
import { MfaPanel } from "@/components/security/MfaPanel";
import { Card, PageHeader } from "@/components/ui";
import { db } from "@/db";
import { users } from "@/db/schema";
import { fmtDay, fmtWhen, zonedDate } from "@/i18n/datefmt";
import { getStaffLocale, getT } from "@/i18n/server";
import { listUserSessions, mfaRequiredAnywhere, requireStaff, sessionLifetimeMs } from "@/lib/auth";
import { describeUserAgent } from "@/lib/security/user-agent";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getStaffLocale(), "security")("account.title") };
}

/**
 * The signed-in user's own security: email confirmation, password, two-step verification and
 * signed-in devices. Every member reaches it, including those who must still enrol in two-step
 * verification (requireStaff() sends them here and nowhere else).
 */
export default async function AccountSecurityPage({ searchParams }: { searchParams: Promise<{ setup?: string }> }) {
  const s = await requireStaff();
  const { setup } = await searchParams;
  const locale = await getStaffLocale();
  const t = getT(locale, "security");
  const tz = s.org.timezone;
  const [user] = await db.select().from(users).where(eq(users.id, s.user.id));
  const rows = await listUserSessions(s.user.id);
  const sessions = rows.map((r) => ({
    id: r.id,
    device: describeUserAgent(r.userAgent, locale),
    signedIn: fmtWhen(r.createdAt, tz, locale, "weekday"),
    lastActive: fmtWhen(r.lastSeenAt ?? r.createdAt, tz, locale, "weekday"),
    current: r.id === s.sessionId,
  }));
  const hours = Math.round(sessionLifetimeMs(s.org) / 3_600_000);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={t("account.title")} description={t("account.description")} />
      <Section icon={<Fingerprint size={18} />} title={t("mfa.title")} id="mfa">
        <MfaPanel
          enabled={Boolean(user?.totpEnabledAt)}
          since={user?.totpEnabledAt ? fmtDay(zonedDate(user.totpEnabledAt, tz), "long", locale) : null}
          recoveryLeft={user?.recoveryCodeHashes.length ?? 0}
          required={mfaRequiredAnywhere(s)}
          practice={s.org.name}
          startOpen={setup === "mfa"}
        />
      </Section>
      <Section icon={<Mail size={18} />} title={t("email.title")}>
        <EmailStatus email={s.user.email} verified={Boolean(user?.emailVerifiedAt)} />
      </Section>
      <Section icon={<KeyRound size={18} />} title={t("password.title")} description={t("password.description")}>
        <PasswordForm />
      </Section>
      <Section icon={<LaptopMinimal size={18} />} title={t("sessions.title")} description={t("sessions.description", { hours })}>
        <SessionsList sessions={sessions} />
      </Section>
    </div>
  );
}

function Section({ icon, title, description, id, children }: { icon: ReactNode; title: string; description?: string; id?: string; children: ReactNode }) {
  return (
    <Card className="p-6" id={id}>
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <span className="text-brand-700" aria-hidden>
          {icon}
        </span>
        {title}
      </h2>
      {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
      <div className="mt-4">{children}</div>
    </Card>
  );
}
