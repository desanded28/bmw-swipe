import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PrivacySettingsForm, type WhatsAppStatus } from "@/components/privacy-admin/SettingsForms";
import { Button, Card, PageHeader, Select } from "@/components/ui";
import { ENDONYM, isLocale, LOCALES } from "@/i18n/config";
import { getStaffLocale, getT } from "@/i18n/server";
import { requireStepUp } from "@/lib/auth";
import { providerStatus } from "@/lib/messaging";
import { whatsappTemplates } from "@/lib/messaging/whatsapp";
import { can, requirePermission } from "@/lib/permissions";
import { buildNotice } from "@/lib/privacy/notices";
import { RETENTION_LIMITS, SESSION_HOURS_LIMITS } from "@/lib/privacy/settings";
import { resolveSettings } from "@/lib/settings";

/**
 * Whether turning WhatsApp on has an effect on this server (WP3): connected with approved
 * templates; connected without any (patients get SMS); not connected while SMS is live (patients
 * get SMS); or nothing connected (development: messages are only captured).
 */
function whatsappStatus(): WhatsAppStatus {
  const providers = providerStatus();
  const templates = Object.values(whatsappTemplates()).reduce((n, byLocale) => n + Object.keys(byLocale).length, 0);
  if (providers.whatsapp === "twilio") return { kind: templates ? "live" : "noTemplates", templates };
  return { kind: providers.sms === "twilio" ? "notConnected" : "demo", templates };
}

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getStaffLocale(), "privacyAdmin")("settingsPrivacy.title") };
}

/**
 * Privacy settings (privacy.settings with a fresh second factor; saving is audited as
 * settings.privacy.update): message detail, WhatsApp, marketing, calendar feeds, widget origins,
 * staff sign-in, adaptive reminders with their legitimate-interest summary, retention within
 * RETENTION_LIMITS, the default at the end of retention, and a preview of the patient notice in
 * any language, built by WP4's buildNotice from the saved settings.
 */
export default async function PrivacySettingsPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const s = await requirePermission("privacy.settings");
  await requireStepUp();
  const locale = await getStaffLocale();
  const t = getT(locale, "privacyAdmin");
  const requested = (await searchParams).notice;
  const noticeLocale = isLocale(requested) ? requested : s.org.defaultLocale;
  const settings = resolveSettings(s.org.settings);
  const notice = buildNotice("practice_patient", { org: s.org, locale: noticeLocale });
  const links = [
    { href: "/dashboard/settings/privacy/register", label: t("settingsPrivacy.links.register"), show: true },
    { href: "/dashboard/legal", label: t("settingsPrivacy.links.legal"), show: true },
    { href: "/dashboard/audit", label: t("settingsPrivacy.links.audit"), show: can(s.role, "audit.read") },
    { href: "/dashboard/settings/closure", label: t("settingsPrivacy.links.closure"), show: can(s.role, "org.close") },
  ].filter((l) => l.show);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title={t("settingsPrivacy.title")} description={t("settingsPrivacy.description")} />
      <nav className="flex flex-wrap gap-2" aria-label={t("settingsPrivacy.title")}>
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-brand-800 ring-1 ring-slate-200 hover:bg-brand-50">
            {l.label} <ArrowRight size={13} aria-hidden />
          </Link>
        ))}
      </nav>
      <PrivacySettingsForm settings={settings.privacy} limits={RETENTION_LIMITS} sessionLimits={SESSION_HOURS_LIMITS} whatsappStatus={whatsappStatus()} />

      <Card className="p-5">
        <h2 className="text-lg font-bold">{t("settingsPrivacy.sections.notice")}</h2>
        <p className="mb-3 mt-0.5 text-sm text-slate-500">{t("settingsPrivacy.notice.intro")}</p>
        <form method="get" className="mb-4 flex flex-wrap items-end gap-2">
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold text-slate-700">{t("settingsPrivacy.notice.locale")}</span>
            <Select name="notice" defaultValue={noticeLocale} className="max-w-48">
              {LOCALES.map((l) => (
                <option key={l} value={l} lang={l}>
                  {ENDONYM[l]}
                </option>
              ))}
            </Select>
          </label>
          <Button type="submit" variant="secondary">
            {t("settingsPrivacy.notice.show")}
          </Button>
        </form>
        <article lang={noticeLocale} className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
          <p className="mb-2 text-xs text-slate-500">{t("settingsPrivacy.notice.version", { version: notice.version })}</p>
          {notice.sections.map((sec) => (
            <section key={sec.id} id={`notice-${sec.id}`} className="mb-3">
              <h3 className="font-semibold">{sec.title}</h3>
              <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">{sec.body}</p>
            </section>
          ))}
        </article>
      </Card>
    </div>
  );
}
