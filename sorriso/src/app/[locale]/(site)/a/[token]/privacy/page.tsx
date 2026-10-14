import { BellOff, FileText, KeyRound, LinkIcon, ListChecks, ShieldAlert, ShieldCheck, SlidersHorizontal } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import type { ReactNode } from "react";
import { ActionForm } from "@/components/privacy/ActionForm";
import { PreferencesForm } from "@/components/privacy/RecordForms";
import { Card, LinkButton } from "@/components/ui";
import { toLocale, type Locale } from "@/i18n/config";
import { ClientMessages } from "@/i18n/ClientMessages";
import { fmtDay, zonedDate } from "@/i18n/datefmt";
import { lhref } from "@/i18n/href";
import { rich } from "@/i18n/rich";
import { alternatesFor } from "@/i18n/seo";
import { getT } from "@/i18n/server";
import { getAppointmentDetails } from "@/lib/appointments";
import { audit } from "@/lib/audit";
import { recipientFor } from "@/lib/contact";
import { currentConsents } from "@/lib/privacy/consent";
import { channelOptions, consentOptions, linkRecord, maskContact } from "@/lib/privacy/privacy-center";
import { rateLimitByIp } from "@/lib/rate-limit";
import { linkPreferencesAction, linkStepUpAction, linkWithdrawAction } from "./actions";

export const dynamic = "force-dynamic";

type Params = Promise<{ locale: string; token: string }>;

const TOKEN_SHAPE = /^[A-Za-z0-9_-]{8,128}$/;
/** Same budget as the appointment page: generous for a patient, tight for someone guessing tokens. */
const LINK_LIMIT = 30;
const LINK_WINDOW_MS = 10 * 60 * 1000;
/** Link-preview fetchers get a page without any practice or patient data. */
const PREVIEW_BOT = /facebookexternalhit|whatsapp\/|telegrambot|slackbot|twitterbot|linkedinbot|discordbot|skypeuripreview|microsoftpreview|teamsbot|googlebot|bingbot|bingpreview|applebot/i;

/** Generic on purpose, like the appointment page: link previews must name neither practice nor patient. */
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale: raw, token } = await params;
  const locale = toLocale(raw);
  const t = getT(locale, "privacy");
  return {
    title: t("linkPage.meta.title"),
    robots: { index: false, follow: false, nocache: true },
    referrer: "no-referrer",
    alternates: alternatesFor(`/a/${token}/privacy`, locale),
  };
}

function Blank({ locale, icon, children }: { locale: Locale; icon: ReactNode; children: ReactNode }) {
  const t = getT(locale, "privacy");
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-600" aria-hidden>
        {icon}
      </div>
      <h1 className="mt-4 text-2xl font-extrabold tracking-tight">{t("linkPage.title")}</h1>
      <div className="mt-2 text-slate-600">{children}</div>
    </div>
  );
}

/**
 * The privacy choices behind the appointment link (WP4). Without a code: the language and channel
 * of messages, withdrawing optional consents and objections, unsubscribing from SMS or email. To
 * see everything, download it or make a request, a one-time code goes to the contact on file and
 * opens the privacy center. Opening the page changes nothing (mail scanners open links too).
 */
export default async function LinkPrivacyPage({ params }: { params: Params }) {
  const { locale: raw, token } = await params;
  const locale = toLocale(raw);
  const t = getT(locale, "privacy");
  const tc = getT(locale, "consents");
  const tcommon = getT(locale, "common");
  const h = await headers();
  const centerLink = (c: ReactNode) => (
    <Link href={lhref(locale, "/privacy")} className="font-semibold text-brand-700 underline underline-offset-2">
      {c}
    </Link>
  );

  if (PREVIEW_BOT.test(h.get("user-agent") ?? "")) {
    return <Blank locale={locale} icon={<ShieldCheck size={26} />}>{t("manageCard.body")}</Blank>;
  }
  const limit = await rateLimitByIp(h, "patient-link", LINK_LIMIT, LINK_WINDOW_MS);
  const d = limit.ok && TOKEN_SHAPE.test(token) ? await getAppointmentDetails({ token }) : null;
  if (!d) {
    return <Blank locale={locale} icon={limit.ok ? <LinkIcon size={26} /> : <ShieldAlert size={26} />}>{rich(t("linkPage.invalid"), { link: centerLink })}</Blank>;
  }

  const { rec } = linkRecord(d);
  const consents = await currentConsents(rec.patient.id);
  const options = consentOptions(rec, consents);
  const withdrawable = options.filter((o) => o.canTurnOff && o.purpose !== "sms_channel" && o.purpose !== "email_channel");
  const sms = options.find((o) => o.purpose === "sms_channel" && o.canTurnOff);
  const email = options.find((o) => o.purpose === "email_channel" && o.canTurnOff);
  const to = recipientFor({ ...rec.patient, restrictedAt: null, erasedAt: null });
  const contacts = [
    to.phone ? { kind: "phone" as const, label: maskContact({ kind: "phone", value: to.phone }) } : null,
    to.email ? { kind: "email" as const, label: maskContact({ kind: "email", value: to.email }) } : null,
  ].filter((c): c is { kind: "phone" | "email"; label: string } => c !== null);
  const tz = d.location.timezone;
  const hidden = { locale, token };

  // The patient (or their guardian) opened their own privacy choices through the link only they received.
  await audit({
    orgId: d.org.id,
    actor: { type: "patient_link", id: null },
    action: "privacy_center.view",
    entity: { type: "patient", id: rec.patient.id },
    metadata: { via: "manage_link", appointmentId: d.appointment.id },
    headers: h,
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link href={lhref(locale, `/a/${token}`)} className="text-sm font-semibold text-slate-600 hover:text-slate-900">
        ← {getT(locale, "manage")("meta.title")}
      </Link>
      <h1 className="mt-2 text-2xl font-extrabold tracking-tight">{t("linkPage.title")}</h1>
      <p className="mt-1 text-slate-600">{t("linkPage.intro", { practice: d.org.name })}</p>

      <ClientMessages locale={locale} ns={["privacy", "consents"]}>
        <Card className="mt-6 p-5">
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            <SlidersHorizontal size={18} className="text-brand-700" aria-hidden /> {t("me.sections.preferences")}
          </h2>
          <PreferencesForm
            action={linkPreferencesAction}
            hidden={{ token }}
            current={{ locale: rec.patient.locale, channel: rec.patient.preferredChannel }}
            channels={channelOptions(rec)}
            whatsappConsented={consents.whatsapp_channel?.granted === true}
          />
        </Card>

        {withdrawable.length ? (
          <Card className="mt-4 p-5">
            <h2 className="flex items-center gap-2 font-semibold">
              <ListChecks size={18} className="text-brand-700" aria-hidden /> {t("linkPage.choicesHeading")}
            </h2>
            <p className="mt-1 text-sm text-slate-600">{t("linkPage.choicesIntro")}</p>
            <ul className="mt-2 divide-y divide-slate-100">
              {withdrawable.map((o) => (
                <li key={o.purpose} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-semibold text-slate-900">{tc(`${o.purpose}.title`)}</p>
                    <p className="text-xs text-slate-500">
                      {o.at ? t("me.choices.since", { date: fmtDay(zonedDate(o.at, tz), "medium", locale) }) : t("me.choices.default")}
                    </p>
                  </div>
                  <ActionForm
                    action={linkWithdrawAction}
                    hidden={{ ...hidden, purpose: o.purpose }}
                    submit={{
                      label: o.kind === "objection" ? t("me.choices.object") : t("me.choices.withdraw"),
                      pending: tcommon("actions.saving"),
                      variant: "secondary",
                      size: "sm",
                    }}
                  />
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        {sms || email ? (
          <Card className="mt-4 p-5">
            <h2 className="flex items-center gap-2 font-semibold">
              <BellOff size={18} className="text-brand-700" aria-hidden /> {t("linkPage.unsubscribe.heading")}
            </h2>
            <p className="mt-1 text-sm text-slate-600">{t("linkPage.unsubscribe.warning")}</p>
            <div className="mt-3 flex flex-wrap gap-3">
              {sms ? (
                <ActionForm
                  action={linkWithdrawAction}
                  hidden={{ ...hidden, purpose: "sms_channel" }}
                  submit={{ label: t("linkPage.unsubscribe.sms"), pending: tcommon("actions.saving"), variant: "danger", size: "sm" }}
                />
              ) : null}
              {email ? (
                <ActionForm
                  action={linkWithdrawAction}
                  hidden={{ ...hidden, purpose: "email_channel" }}
                  submit={{ label: t("linkPage.unsubscribe.email"), pending: tcommon("actions.saving"), variant: "danger", size: "sm" }}
                />
              ) : null}
            </div>
          </Card>
        ) : null}

        <Card className="mt-4 p-5">
          <h2 className="flex items-center gap-2 font-semibold">
            <KeyRound size={18} className="text-brand-700" aria-hidden /> {t("linkPage.full.heading")}
          </h2>
          <p className="mt-1 text-sm text-slate-600">{t("linkPage.full.body")}</p>
          {contacts.length ? (
            <ActionForm
              action={linkStepUpAction}
              hidden={hidden}
              submit={{ label: t("linkPage.full.send"), pending: t("center.signIn.sending"), size: "sm" }}
              className="mt-3"
            >
              <fieldset>
                <legend className="mb-2 text-[13px] font-semibold text-slate-700">{t("linkPage.full.choose")}</legend>
                <div className="flex flex-wrap gap-2">
                  {contacts.map((c, i) => (
                    <label
                      key={c.kind}
                      className="flex min-h-10 cursor-pointer items-center gap-2 rounded-xl bg-white px-3 text-sm font-semibold ring-1 ring-line-strong has-[input:checked]:bg-brand-50 has-[input:checked]:ring-2 has-[input:checked]:ring-brand-600 has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-brand-600"
                    >
                      <input type="radio" name="kind" value={c.kind} defaultChecked={i === 0} className="h-4 w-4 accent-brand-700" />
                      {c.label}
                    </label>
                  ))}
                </div>
              </fieldset>
            </ActionForm>
          ) : (
            <p className="mt-3 text-sm text-slate-600">{t("linkPage.full.noContact")}</p>
          )}
        </Card>
      </ClientMessages>

      <div className="mt-6 flex flex-wrap gap-3">
        <LinkButton href={lhref(locale, `/c/${d.org.slug}/privacy`)} variant="ghost" size="sm">
          <FileText size={14} aria-hidden /> {t("linkPage.notice", { practice: d.org.name })}
        </LinkButton>
        <LinkButton href={lhref(locale, "/privacy")} variant="ghost" size="sm">
          <ShieldCheck size={14} aria-hidden /> {t("manageCard.privacyCenter")}
        </LinkButton>
      </div>
    </div>
  );
}
