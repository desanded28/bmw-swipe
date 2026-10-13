import { and, count, eq, gte } from "drizzle-orm";
import { Mail, MessageCircle, Smartphone } from "lucide-react";
import type { Metadata } from "next";
import { RulesEditor } from "@/components/dashboard/RulesEditor";
import { Badge, Card, PageHeader } from "@/components/ui";
import { db } from "@/db";
import { appointments, reminders } from "@/db/schema";
import { MANAGERS, requireStaff } from "@/lib/auth";
import { absoluteUrl } from "@/lib/config";
import { providerStatus } from "@/lib/messaging";
import { templates, type AppointmentTemplateData } from "@/lib/messaging/templates";
import { describeOffset, resolveSettings } from "@/lib/settings";
import { addDays, todayIn, zonedToUtc } from "@/lib/time";

export const metadata: Metadata = { title: "Reminders" };

export default async function RemindersPage() {
  const s = await requireStaff();
  const settings = resolveSettings(s.org.settings);
  const providers = providerStatus();
  const since = new Date(Date.now() - 30 * 86_400_000);
  const stats = await db
    .select({ status: reminders.status, n: count() })
    .from(reminders)
    .innerJoin(appointments, eq(appointments.id, reminders.appointmentId))
    .where(and(eq(appointments.orgId, s.org.id), gte(reminders.sendAt, since)))
    .groupBy(reminders.status);
  const stat = (k: string) => stats.find((x) => x.status === k)?.n ?? 0;

  const sample = (locale: "it" | "en"): AppointmentTemplateData => ({
    locale,
    patientFirstName: locale === "it" ? "Marco" : "Emma",
    clinicName: s.org.name,
    clinicPhone: s.org.phone,
    brandColor: s.org.brandColor,
    practitionerName: "Dr. Luca Bianchi",
    serviceName: locale === "it" ? "Igiene dentale" : "Professional cleaning",
    start: zonedToUtc(addDays(todayIn(s.org.timezone), 2), 10 * 60 + 30, s.org.timezone),
    timezone: s.org.timezone,
    locationName: "Milano Centro",
    address: "Via Torino 42, Milano",
    manageUrl: absoluteUrl("/a/example-token"),
    icsUrl: absoluteUrl("/api/ics/appointment/example-token"),
  });
  const ask = settings.reminders.rules.some((r) => r.askConfirmation);
  const email = templates.reminderEmail(sample("it"), ask);

  const providerRow = (icon: React.ReactNode, label: string, value: string, env: string) => (
    <div className="flex items-start gap-3 py-3">
      <span className="mt-0.5 text-slate-400">{icon}</span>
      <div className="flex-1">
        <p className="flex items-center gap-2 text-sm font-semibold">
          {label} {value === "captured" ? <Badge tone="amber">Demo: captured</Badge> : <Badge tone="green">Live via {value}</Badge>}
        </p>
        <p className="mt-0.5 text-xs text-slate-500">{env}</p>
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Reminders & confirmations" description="When and how patients are reminded. Replies to text reminders update the calendar automatically." />
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="mb-1 text-lg font-bold">Reminder schedule</h2>
            <p className="mb-4 text-sm text-slate-500">
              Currently: {settings.reminders.rules.map((r) => `${r.channel === "sms" ? "text" : r.channel} ${describeOffset(r.offsetMinutes)}`).join(", ") || "no reminders"}. Once a patient confirms, later
              reminders stop asking.
            </p>
            <RulesEditor initial={settings.reminders} canManage={MANAGERS.includes(s.role)} />
          </Card>
          <Card className="p-6">
            <h2 className="mb-3 text-lg font-bold">Last 30 days</h2>
            <div className="grid grid-cols-4 gap-3 text-center">
              {(
                [
                  ["sent", "Sent"],
                  ["pending", "Scheduled"],
                  ["skipped", "Skipped"],
                  ["failed", "Failed"],
                ] as const
              ).map(([k, label]) => (
                <div key={k} className="rounded-xl bg-slate-50 p-3">
                  <p className="text-2xl font-extrabold tabular-nums">{stat(k)}</p>
                  <p className="text-xs font-semibold text-slate-500">{label}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-500">Skipped = appointment cancelled/moved, or the patient can&apos;t be reached on that channel.</p>
          </Card>
          <Card className="p-6">
            <h2 className="mb-1 text-lg font-bold">Delivery providers</h2>
            <div className="divide-y divide-slate-100">
              {providerRow(<Mail size={18} />, "Email", providers.email, "SMTP_URL, EMAIL_FROM — any SMTP service (Resend, Postmark, SES, Gmail…)")}
              {providerRow(<Smartphone size={18} />, "SMS", providers.sms, "TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM or TWILIO_MESSAGING_SERVICE_SID")}
              {providerRow(<MessageCircle size={18} />, "WhatsApp", providers.whatsapp, "TWILIO_WHATSAPP_FROM (+ TWILIO_WHATSAPP_CONTENT_SID for an approved template)")}
            </div>
            <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
              <p className="font-semibold text-slate-800">Two-way replies</p>
              In Twilio, set “A message comes in” for your number / WhatsApp sender to:
              <code className="mt-1 block break-all rounded bg-white p-2">{absoluteUrl("/api/webhooks/twilio")}</code>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="mb-3 text-lg font-bold">Text message preview</h2>
            <div className="space-y-3 rounded-2xl bg-slate-100 p-4">
              <div className="max-w-[90%] rounded-2xl rounded-bl-sm bg-white p-3 text-[13px] leading-snug shadow-sm">{templates.reminderSms(sample("it"), ask)}</div>
              <div className="ml-auto w-fit rounded-2xl rounded-br-sm bg-brand-600 px-3 py-2 text-[13px] text-white">SI</div>
              <div className="max-w-[90%] rounded-2xl rounded-bl-sm bg-white p-3 text-[13px] leading-snug shadow-sm">{templates.reply.confirmed(sample("it"))}</div>
            </div>
            <p className="mt-3 text-xs text-slate-500">English patients get: “{templates.reminderSms(sample("en"), ask)}”</p>
            <p className="mt-2 text-xs text-slate-500">
              Understood replies: SI, Sì, OK, 1, 👍, “ci sarò”, YES → confirm · NO, 2, “non posso”, “annulla” → cancel · “spostare”, “cambiare” → reschedule link · STOP → opt out.
              Anything else is flagged for the front desk.
            </p>
          </Card>
          <Card className="overflow-hidden">
            <p className="border-b border-slate-100 px-5 py-3 text-sm font-bold">Email preview · {email.subject}</p>
            <iframe title="Email preview" srcDoc={email.html} className="h-[520px] w-full border-0 bg-slate-100" sandbox="" />
          </Card>
        </div>
      </div>
    </div>
  );
}
