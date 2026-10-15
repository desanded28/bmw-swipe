import { and, asc, count, eq, gte } from "drizzle-orm";
import { Mail, MessageCircle, Smartphone } from "lucide-react";
import type { Metadata } from "next";
import { MessagePreview, type MessagePreviewData, type SmsPreview } from "@/components/dashboard/MessagePreview";
import { InboundNumberEditor, RulesEditor } from "@/components/dashboard/RulesEditor";
import { Badge, Card, PageHeader, ScrollRegion } from "@/components/ui";
import { db } from "@/db";
import { appointments, locations, practitioners, reminders, services, type ReminderRule } from "@/db/schema";
import { LOCALES, type Locale } from "@/i18n/config";
import { lhref } from "@/i18n/href";
import { getStaffLocale, getT } from "@/i18n/server";
import { absoluteUrl } from "@/lib/config";
import { practitionerName } from "@/lib/format";
import { KEYWORDS, SAMPLE_REPLIES } from "@/lib/inbound";
import { providerStatus } from "@/lib/messaging";
import { providerDetails } from "@/lib/messaging/providers";
import { segments, withinBudget } from "@/lib/messaging/sms-encoding";
import { templates, type AppointmentTemplateData } from "@/lib/messaging/templates";
import { whatsappTemplates } from "@/lib/messaging/whatsapp";
import { can, requirePermission } from "@/lib/permissions";
import { resolveSettings } from "@/lib/settings";
import { addDays, todayIn, zonedToUtc } from "@/lib/time";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getStaffLocale(), "reminders")("page.title") };
}

/** A manage link as long as a real one (43-character token), so segment counts are realistic. */
const SAMPLE_TOKEN = "Pr3v13wT0k3n-0nly-f0r-th3-d4shb04rd-pr3v13w".slice(0, 43);

export default async function RemindersPage() {
  // Every staff role sees the rules and previews (no patient data here); editing needs reminders.manage.
  const s = await requirePermission("messages.read");
  const locale = await getStaffLocale();
  const t = getT(locale, "reminders");
  const tc = getT(locale, "common");
  const settings = resolveSettings(s.org.settings);
  const providers = providerStatus();
  const details = providerDetails();
  const templateCount = Object.values(whatsappTemplates()).reduce((n, byLocale) => n + Object.keys(byLocale).length, 0);
  const since = new Date(Date.now() - 30 * 86_400_000);
  const [stats, [office], [service], [practitioner]] = await Promise.all([
    db
      .select({ status: reminders.status, n: count() })
      .from(reminders)
      .innerJoin(appointments, eq(appointments.id, reminders.appointmentId))
      .where(and(eq(appointments.orgId, s.org.id), gte(reminders.sendAt, since)))
      .groupBy(reminders.status),
    db
      .select()
      .from(locations)
      .where(and(eq(locations.orgId, s.org.id), eq(locations.active, true)))
      .orderBy(asc(locations.name))
      .limit(1),
    db
      .select()
      .from(services)
      .where(and(eq(services.orgId, s.org.id), eq(services.active, true)))
      .orderBy(asc(services.sortOrder))
      .limit(1),
    db
      .select()
      .from(practitioners)
      .where(and(eq(practitioners.orgId, s.org.id), eq(practitioners.active, true)))
      .orderBy(asc(practitioners.name))
      .limit(1),
  ]);
  const stat = (k: string) => stats.find((x) => x.status === k)?.n ?? 0;

  // Previews in every language, at the practice's current content level (the detailed one as a
  // verified patient would see it for a treatment not marked sensitive).
  const level = settings.privacy.messageContentLevel;
  const tz = office?.timezone ?? s.org.timezone;
  const start = zonedToUtc(addDays(todayIn(tz), 2), 10 * 60 + 30, tz);
  const address = office ? `${office.address}, ${office.city}` : (s.org.registeredAddress ?? "");
  const manageUrl = absoluteUrl(`/a/${SAMPLE_TOKEN}`);
  const toSms = (text: string, plain: string): SmsPreview => {
    const seg = segments(text);
    return { text, encoding: seg.encoding, units: seg.units, segments: seg.segments, withinBudget: withinBudget(text), ascii: text !== plain };
  };
  const previews: Partial<Record<Locale, MessagePreviewData>> = {};
  for (const l of LOCALES) {
    const data: AppointmentTemplateData = {
      locale: l,
      patientFirstName: getT(l, "patientMessages")("preview.sampleFirstName"),
      clinicName: s.org.name,
      clinicPhone: office?.phone ?? s.org.phone,
      brandColor: s.org.brandColor,
      practitionerName: practitioner ? practitionerName(practitioner) : "",
      serviceName: service?.name ?? "",
      start,
      timezone: tz,
      locationName: office?.name ?? "",
      address,
      manageUrl,
      icsUrl: absoluteUrl(`/api/ics/appointment/${SAMPLE_TOKEN}`),
      contentLevel: level === "detailed" && service && !service.sensitive ? { email: "detailed", text: "detailed" } : undefined,
      smsAsciiFallback: settings.reminders.smsAsciiFallback,
      legalName: s.org.legalName ?? s.org.name,
      legalAddress: s.org.registeredAddress ?? address,
      privacyUrl: absoluteUrl(lhref(l, `/c/${s.org.slug}/privacy`)),
      preferencesUrl: absoluteUrl(`/a/${SAMPLE_TOKEN}/privacy`),
    };
    const unaccented = { ...data, smsAsciiFallback: false };
    const ask = templates.reminderSms(data, true);
    const plain = templates.reminderSms(data, false);
    const email = templates.reminderEmail(data, true);
    previews[l] = {
      smsAsk: toSms(ask, templates.reminderSms(unaccented, true)),
      sms: toSms(plain, templates.reminderSms(unaccented, false)),
      reply: { patient: SAMPLE_REPLIES[l][0], answer: templates.reply.confirmed(data) },
      email: { subject: email.subject, html: email.html },
    };
  }

  const ruleLabel = (r: ReminderRule) => {
    const m = r.offsetMinutes;
    const offset =
      m % 1440 === 0
        ? t("schedule.offset.days", { count: m / 1440 })
        : m % 60 === 0
          ? t("schedule.offset.hours", { count: m / 60 })
          : t("schedule.offset.minutes", { count: m });
    return { channel: t(r.channel === "email" ? "schedule.channel.email" : "schedule.channel.text"), offset };
  };

  const providerRow = (icon: React.ReactNode, label: string, value: string, notes: string[]) => (
    <div className="flex items-start gap-3 py-3">
      <span className="mt-0.5 text-slate-500" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
          {label}{" "}
          {value === "captured" ? (
            <Badge tone="amber">{t("providers.captured")}</Badge>
          ) : (
            <Badge tone="green">{t("providers.live", { provider: value })}</Badge>
          )}
        </p>
        {notes.map((n) => (
          <p key={n} className="mt-0.5 text-xs text-slate-500">
            {n}
          </p>
        ))}
      </div>
    </div>
  );

  // Stems ("spost*") match any word that starts with them: shown as "spost…".
  const keywordCell = (words: readonly string[]) => (
    <td className="px-3 py-2 align-top text-slate-700">
      {words
        .slice(0, 6)
        .map((w) => (w.endsWith("*") ? `${w.slice(0, -1)}…` : w))
        .join(", ")}
    </td>
  );

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title={t("page.title")} description={t("page.description")} />
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="min-w-0 space-y-6">
          <Card className="p-4 sm:p-6">
            <h2 className="mb-2 text-lg font-bold">{t("schedule.title")}</h2>
            {settings.reminders.rules.length ? (
              <>
                <p className="text-sm font-semibold text-slate-700">{t("schedule.current")}</p>
                <ul className="mb-2 mt-2 flex flex-wrap gap-2">
                  {settings.reminders.rules.map((r) => {
                    const { channel, offset } = ruleLabel(r);
                    return (
                      <li key={r.id} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                        {channel} · {offset}
                        {r.askConfirmation ? ` · ${t("schedule.asks")}` : ""}
                        {r.onlyIfRisk ? ` · ${t(`schedule.risk.${r.onlyIfRisk}`)}` : ""}
                      </li>
                    );
                  })}
                </ul>
                <p className="mb-4 text-sm text-slate-500">{t("schedule.confirmNote")}</p>
              </>
            ) : (
              <p className="mb-4 text-sm text-slate-500">{t("schedule.none")}</p>
            )}
            <RulesEditor
              initial={settings.reminders}
              canManage={can(s.role, "reminders.manage")}
              canRun={can(s.role, "reminders.run")}
              riskEnabled={settings.privacy.riskBasedReminders}
            />
          </Card>

          <Card className="p-4 sm:p-6">
            <h2 className="mb-3 text-lg font-bold">{t("stats.title")}</h2>
            <dl className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
              {(["sent", "pending", "skipped", "failed"] as const).map((k) => (
                <div key={k} className="flex flex-col-reverse rounded-xl bg-slate-50 p-3">
                  <dt className="text-xs font-semibold text-slate-500">{t(`stats.${k}`)}</dt>
                  <dd className="text-2xl font-extrabold tabular-nums">{stat(k)}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-xs text-slate-500">{t("stats.hint")}</p>
          </Card>

          <Card className="p-4 sm:p-6">
            <h2 className="mb-1 text-lg font-bold">{t("inbound.title")}</h2>
            <p className="mb-4 text-sm text-slate-500">{t("inbound.description")}</p>
            <InboundNumberEditor initial={s.org.inboundNumber} canEdit={s.role === "owner"} />
          </Card>

          <Card className="p-4 sm:p-6">
            <h2 className="mb-1 text-lg font-bold">{t("replies.title")}</h2>
            <p className="mb-4 text-sm text-slate-500">{t("replies.description")}</p>
            <ScrollRegion label={t("replies.title")} className="-mx-4 px-4 sm:mx-0 sm:px-0">
              <table className="w-full min-w-[640px] text-left text-xs">
                <caption className="sr-only">{t("replies.title")}</caption>
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    {(["language", "confirm", "cancel", "reschedule", "stop", "start"] as const).map((c) => (
                      <th key={c} scope="col" className="px-3 py-2 font-semibold">
                        {t(`replies.${c}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {LOCALES.map((l) => (
                    <tr key={l} lang={l}>
                      <th scope="row" className="px-3 py-2 font-semibold text-slate-800" lang={locale}>
                        {tc(`languages.${l}`)}
                      </th>
                      {keywordCell(KEYWORDS[l].confirm)}
                      {keywordCell(KEYWORDS[l].cancel)}
                      {keywordCell(KEYWORDS[l].reschedule)}
                      {keywordCell(KEYWORDS[l].stop)}
                      {keywordCell(KEYWORDS[l].start)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollRegion>
            <p className="mt-3 text-xs text-slate-500">{t("replies.emoji")}</p>
          </Card>

          <Card className="p-4 sm:p-6">
            <h2 className="mb-1 text-lg font-bold">{t("providers.title")}</h2>
            <div className="divide-y divide-slate-100">
              {providerRow(<Mail size={18} />, t("providers.email"), providers.email, [
                t("providers.emailEnv"),
                details.smtpRequireTls ? t("providers.smtpTls") : t("providers.smtpNoTls"),
              ])}
              {providerRow(<Smartphone size={18} />, t("providers.sms"), providers.sms, [
                details.smsRegion && details.smsEdge
                  ? t("providers.smsRegion", { region: details.smsRegion.toUpperCase(), edge: details.smsEdge })
                  : t("providers.smsDefaultRegion"),
              ])}
              {providerRow(<MessageCircle size={18} />, t("providers.whatsapp"), providers.whatsapp, [
                templateCount ? t("providers.whatsappTemplates", { count: templateCount }) : t("providers.whatsappNoTemplates"),
              ])}
            </div>
            <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
              <p className="font-semibold text-slate-800">{t("providers.repliesTitle")}</p>
              {t("providers.repliesBody")}
              <code className="mt-1 block break-all rounded bg-white p-2">{absoluteUrl("/api/webhooks/twilio")}</code>
            </div>
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          <Card className="p-4 sm:p-6">
            <h2 className="mb-3 text-lg font-bold">{t("preview.title")}</h2>
            <MessagePreview
              previews={previews}
              locales={LOCALES}
              initialLocale={s.org.defaultLocale}
              level={level}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}
