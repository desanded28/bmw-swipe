import { ArrowRight, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { saveBookingPolicy, saveProfile } from "@/app/dashboard/actions/settings";
import { ActionForm } from "@/components/dashboard/ActionForm";
import { Card, Field, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { lhref } from "@/i18n/href";
import { getStaffLocale, getT } from "@/i18n/server";
import { requireStaff } from "@/lib/auth";
import { APP_URL } from "@/lib/config";
import { can } from "@/lib/permissions";
import { signPracticeRef } from "@/lib/privacy/context";
import { resolveSettings } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getStaffLocale(), "privacyAdmin")("settings.title") };
}

/**
 * Practice profile with the controller's identity (legal name, VAT, registered office, privacy
 * contact, DPO, medical director: shown in the notices, the register and exports), booking rules,
 * the booking widget, and the way to the compliance pages. Every staff member can see it; saving
 * needs settings.manage. API keys are on /dashboard/settings/api, team members on /dashboard/team.
 */
export default async function SettingsPage() {
  const s = await requireStaff();
  const locale = await getStaffLocale();
  const t = getT(locale, "privacyAdmin");
  const tc = getT(locale, "common");
  const org = s.org;
  const settings = resolveSettings(org.settings);
  const canManage = can(s.role, "settings.manage");
  const snippet = `<script src="${APP_URL}/widget.js" data-clinic="${org.slug}" async></script>`;
  const compliance = [
    { href: "/dashboard/settings/privacy", label: t("settingsPrivacy.title"), show: can(s.role, "privacy.settings") },
    { href: "/dashboard/settings/privacy/register", label: t("settingsPrivacy.links.register"), show: can(s.role, "privacy.settings") },
    { href: "/dashboard/privacy", label: t("requests.title"), show: can(s.role, "privacy.requests") },
    { href: "/dashboard/audit", label: t("settingsPrivacy.links.audit"), show: can(s.role, "audit.read") },
    { href: "/dashboard/legal", label: t("settingsPrivacy.links.legal"), show: true },
    { href: "/dashboard/settings/export", label: t("settingsPrivacy.links.export"), show: can(s.role, "org.export"), download: true },
    { href: "/dashboard/settings/closure", label: t("settingsPrivacy.links.closure"), show: can(s.role, "org.close") },
  ].filter((l) => l.show);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title={t("settings.title")} />
      {!canManage ? <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{t("settings.managersOnly")}</p> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-bold">{t("settings.profile.title")}</h2>
          <ActionForm action={saveProfile} className="space-y-3" submitLabel={tc("actions.save")}>
            <Field label={t("settings.profile.name")}>
              <Input name="name" defaultValue={org.name} required maxLength={120} />
            </Field>
            <Field label={t("settings.profile.description")} hint={t("settings.profile.descriptionHint")}>
              <Textarea name="description" rows={3} defaultValue={org.description ?? ""} maxLength={2000} />
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={t("settings.profile.phone")}>
                <Input name="phone" type="tel" defaultValue={org.phone ?? ""} />
              </Field>
              <Field label={t("settings.profile.email")} hint={t("settings.profile.emailHint")}>
                <Input name="email" type="email" defaultValue={org.email ?? ""} />
              </Field>
              <Field label={t("settings.profile.website")} hint={t("settings.profile.websiteHint")}>
                <Input name="website" type="url" inputMode="url" defaultValue={org.website ?? ""} placeholder={t("settings.profile.websitePlaceholder")} />
              </Field>
              <Field label={t("settings.profile.brandColor")}>
                <Input type="color" name="brandColor" defaultValue={org.brandColor} className="h-10 !p-1" />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="listed" defaultChecked={org.listed} className="h-4 w-4 accent-brand-700" /> {t("settings.profile.listed")}
            </label>

            <fieldset className="mt-4 space-y-3 border-t border-slate-100 pt-4">
              <legend className="text-base font-bold">{t("settings.legal.title")}</legend>
              <p className="text-xs text-slate-500">{t("settings.legal.intro")}</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label={t("settings.legal.legalName")}>
                  <Input name="legalName" defaultValue={org.legalName ?? ""} maxLength={200} autoComplete="organization" />
                </Field>
                <Field label={t("settings.legal.vatNumber")}>
                  <Input name="vatNumber" defaultValue={org.vatNumber ?? ""} maxLength={32} />
                </Field>
              </div>
              <Field label={t("settings.legal.registeredAddress")}>
                <Input name="registeredAddress" defaultValue={org.registeredAddress ?? ""} maxLength={300} autoComplete="street-address" />
              </Field>
              <Field label={t("settings.legal.privacyEmail")} hint={t("settings.legal.privacyEmailHint")}>
                <Input name="privacyEmail" type="email" defaultValue={org.privacyEmail ?? ""} />
              </Field>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label={t("settings.legal.dpoName")} hint={t("settings.legal.dpoHint")}>
                  <Input name="dpoName" defaultValue={org.dpoName ?? ""} maxLength={200} />
                </Field>
                <Field label={t("settings.legal.dpoEmail")}>
                  <Input name="dpoEmail" type="email" defaultValue={org.dpoEmail ?? ""} />
                </Field>
              </div>
              <Field label={t("settings.legal.medicalDirector")}>
                <Input name="medicalDirector" defaultValue={org.medicalDirector ?? ""} maxLength={200} />
              </Field>
            </fieldset>
          </ActionForm>
        </Card>

        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="mb-4 text-lg font-bold">{t("settings.booking.title")}</h2>
            <ActionForm action={saveBookingPolicy} className="space-y-3" submitLabel={tc("actions.save")}>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label={t("settings.booking.minNotice")} hint={t("settings.booking.minNoticeHint")}>
                  <Input type="number" name="minNoticeHours" min={0} defaultValue={settings.booking.minNoticeMinutes / 60} />
                </Field>
                <Field label={t("settings.booking.maxAdvance")}>
                  <Input type="number" name="maxAdvanceDays" min={1} max={365} defaultValue={settings.booking.maxAdvanceDays} />
                </Field>
                <Field label={t("settings.booking.slotGrid")}>
                  <Select name="slotStepMinutes" defaultValue={String(settings.booking.slotStepMinutes)}>
                    {[5, 10, 15, 20, 30, 60].map((m) => (
                      <option key={m} value={m}>
                        {t("settings.booking.every", { count: m })}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={t("settings.booking.cancelUntil")}>
                  <Input type="number" name="cancelUntilHours" min={0} defaultValue={settings.booking.cancelUntilHours} />
                </Field>
              </div>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" name="requireApproval" defaultChecked={settings.booking.requireApproval} className="mt-0.5 h-4 w-4 accent-brand-700" />
                <span>{t("settings.booking.requireApproval")}</span>
              </label>
              <p className="text-xs text-slate-500">{t("settings.booking.cancelNote")}</p>
            </ActionForm>
          </Card>

          <Card className="p-6">
            <h2 className="mb-1 text-lg font-bold">{t("settings.compliance.title")}</h2>
            <p className="mb-3 text-sm text-slate-500">{t("settings.compliance.intro")}</p>
            <ul className="divide-y divide-slate-100 text-sm">
              {compliance.map((l) => (
                <li key={l.href}>
                  {l.download ? (
                    <a href={l.href} className="flex items-center justify-between py-2 font-semibold text-brand-700 hover:underline">
                      {l.label} <ArrowRight size={14} aria-hidden />
                    </a>
                  ) : (
                    <Link href={l.href} className="flex items-center justify-between py-2 font-semibold text-brand-700 hover:underline">
                      {l.label} <ArrowRight size={14} aria-hidden />
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <Card className="p-6">
        <h2 className="mb-1 text-lg font-bold">{t("settings.widget.title")}</h2>
        <p className="mb-3 text-sm text-slate-500">{t("settings.widget.intro")}</p>
        <code className="block break-all rounded-xl bg-ink p-4 text-xs text-slate-100">{snippet}</code>
        <div className="mt-3 flex flex-wrap gap-4 text-sm font-semibold">
          <Link href={lhref(locale, `/embed/${org.slug}`)} target="_blank" className="inline-flex items-center gap-1 text-brand-700 hover:underline">
            {t("settings.widget.preview")} <ExternalLink size={13} aria-hidden />
          </Link>
          {/* The practice's own link carries its signed ref, so bookings through it stay 'practice' context. */}
          <Link href={lhref(locale, `/book/${org.slug}?ref=${signPracticeRef(org.id)}`)} target="_blank" className="inline-flex items-center gap-1 text-brand-700 hover:underline">
            {t("settings.widget.directLink")} <ExternalLink size={13} aria-hidden />
          </Link>
          <Link href={lhref(locale, "/developers")} target="_blank" className="inline-flex items-center gap-1 text-brand-700 hover:underline">
            {t("settings.widget.apiDocs")} <ExternalLink size={13} aria-hidden />
          </Link>
          {can(s.role, "apikeys.manage") ? (
            <Link href="/dashboard/settings/api" className="inline-flex items-center gap-1 text-brand-700 hover:underline">
              {t("settings.widget.apiKeys")} <ArrowRight size={13} aria-hidden />
            </Link>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
