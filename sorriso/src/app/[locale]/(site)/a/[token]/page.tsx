import { and, eq } from "drizzle-orm";
import { CalendarCheck, Clock, Hourglass, LinkIcon, MapPin, Phone, ShieldAlert, Star, Stethoscope, XCircle } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { ManageAppointment } from "@/components/booking/ManageAppointment";
import { ClinicHelp } from "@/components/ClinicHelp";
import { Avatar, Badge, Card, LinkButton } from "@/components/ui";
import { db } from "@/db";
import { reviews } from "@/db/schema";
import { toLocale, type Locale } from "@/i18n/config";
import { ClientMessages } from "@/i18n/ClientMessages";
import { capitalizeFirst, fmtDay, fmtTime, zonedDate } from "@/i18n/datefmt";
import { lhref } from "@/i18n/href";
import { formatMoney } from "@/i18n/number";
import { alternatesFor } from "@/i18n/seo";
import { getT } from "@/i18n/server";
import {
  appointmentLinks,
  canPatientCancel,
  canPatientReschedule,
  getAppointmentDetails,
  isLateCancellation,
} from "@/lib/appointments";
import { audit } from "@/lib/audit";
import { practitionerName } from "@/lib/format";
import { signPracticeRef } from "@/lib/privacy/context";
import { rateLimitByIp } from "@/lib/rate-limit";
import { resolveSettings } from "@/lib/settings";
import { todayIn } from "@/lib/time";

export const dynamic = "force-dynamic";

type Params = Promise<{ locale: string; token: string }>;

/** Opens of patient links per network: generous for a patient, tight for someone guessing tokens. */
const LINK_LIMIT = 30;
const LINK_WINDOW_MS = 10 * 60 * 1000;
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{8,128}$/;

/**
 * Link-preview fetchers and crawlers (messaging apps, social networks, search engines). They get a
 * page with no appointment data and don't count against the patient's rate limit. Mail scanners
 * that pose as browsers can't be told apart; that's why opening the page changes nothing (no
 * contact is marked verified on a GET: only an explicit action does that).
 */
const PREVIEW_BOT =
  /facebookexternalhit|facebot|whatsapp\/|telegrambot|slackbot|slack-imgproxy|twitterbot|linkedinbot|discordbot|skypeuripreview|microsoftpreview|teamsbot|applebot|googlebot|google-inspectiontool|bingbot|bingpreview|yandexbot|duckduckbot|pinterestbot|redditbot|embedly|iframely|vkshare|mastodon\/|bitlybot|quora link preview/i;

/**
 * Generic on purpose: the title, description and Open Graph tags are what link previews show,
 * and they must name neither the practice nor the patient (the URL is the only secret).
 */
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale: raw, token } = await params;
  const locale = toLocale(raw);
  const t = getT(locale, "manage");
  return {
    title: t("meta.title"),
    description: t("meta.description"),
    robots: { index: false, follow: false, nocache: true },
    referrer: "no-referrer",
    alternates: alternatesFor(`/a/${token}`, locale),
    openGraph: { title: t("meta.title"), description: t("meta.description") },
  };
}

/** A page with a message and nothing about any practice or patient (invalid, expired, rate limited, preview). */
function Message({
  locale,
  icon,
  title,
  children,
}: {
  locale: Locale;
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  const t = getT(locale, "manage");
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-600" aria-hidden>
        {icon}
      </div>
      <h1 className="mt-4 text-2xl font-extrabold tracking-tight">{title}</h1>
      <div className="mt-2 space-y-2 text-slate-600">{children}</div>
      <LinkButton href={lhref(locale, "/")} variant="secondary" className="mt-6">
        {t("home")}
      </LinkButton>
    </div>
  );
}

export default async function ManagePage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<{ do?: string }>;
}) {
  const { locale: raw, token } = await params;
  const locale = toLocale(raw);
  const t = getT(locale, "manage");
  const h = await headers();

  if (PREVIEW_BOT.test(h.get("user-agent") ?? "")) {
    return (
      <Message locale={locale} icon={<CalendarCheck size={26} />} title={t("preview.title")}>
        <p>{t("preview.body")}</p>
      </Message>
    );
  }

  const limit = await rateLimitByIp(h, "patient-link", LINK_LIMIT, LINK_WINDOW_MS);
  if (!limit.ok) {
    return (
      <Message locale={locale} icon={<ShieldAlert size={26} />} title={t("rateLimited.title")}>
        <p>{t("rateLimited.body", { count: Math.max(1, Math.ceil(limit.retryAfterSec / 60)) })}</p>
      </Message>
    );
  }

  const d = TOKEN_SHAPE.test(token) ? await getAppointmentDetails({ token }) : null;
  if (!d) {
    const expired = TOKEN_SHAPE.test(token) ? Boolean(await getAppointmentDetails({ token, allowExpired: true })) : false;
    return expired ? (
      <Message locale={locale} icon={<Hourglass size={26} />} title={t("expired.title")}>
        <p>{t("expired.body")}</p>
        <p>
          <Link href={lhref(locale, "/privacy")} className="font-semibold text-brand-700 underline underline-offset-2">
            {t("expired.privacyCenter")}
          </Link>
        </p>
      </Message>
    ) : (
      <Message locale={locale} icon={<LinkIcon size={26} />} title={t("invalid.title")}>
        <p>{t("invalid.body")}</p>
      </Message>
    );
  }

  const sp = await searchParams;
  const a = d.appointment;
  const tz = d.location.timezone;
  const tc = getT(locale, "common");
  const settings = resolveSettings(d.org.settings);
  // The patient opened their own appointment through the link only they received.
  await audit({
    orgId: d.org.id,
    actor: { type: "patient_link", id: null },
    action: "appointment.view",
    entity: { type: "appointment", id: a.id },
    headers: h,
  });
  const [review] = await db
    .select({ id: reviews.id })
    .from(reviews)
    .where(and(eq(reviews.orgId, d.org.id), eq(reviews.appointmentId, a.id)));
  const panel = sp.do === "confirm" || sp.do === "cancel" || sp.do === "reschedule" ? sp.do : null;
  // Booking again keeps the controller of this booking: a practice booking links back with the practice ref.
  const rebookRef = a.processingContext === "practice" ? `&ref=${signPracticeRef(d.org.id)}` : "";
  const phone = d.location.phone ?? d.org.phone;
  const price = d.service.priceCents == null ? tc("price.onRequest") : d.service.priceCents === 0 ? tc("price.free") : formatMoney(d.service.priceCents, locale);
  const date = capitalizeFirst(fmtDay(zonedDate(a.startsAt, tz), "long", locale), locale);

  const status =
    a.status === "cancelled" ? (
      <Badge tone="red">
        <XCircle size={12} aria-hidden /> {t("status.cancelled")}
      </Badge>
    ) : a.status === "requested" ? (
      <Badge tone="amber">
        <Hourglass size={12} aria-hidden /> {t("status.requested")}
      </Badge>
    ) : a.status === "completed" ? (
      <Badge tone="slate">{t("status.completed")}</Badge>
    ) : a.status === "no_show" ? (
      <Badge tone="red">{t("status.no_show")}</Badge>
    ) : a.confirmation === "confirmed" ? (
      <Badge tone="green">
        <CalendarCheck size={12} aria-hidden /> {t("status.confirmed")}
      </Badge>
    ) : (
      <Badge tone="blue">{t("status.pending")}</Badge>
    );

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <p className="text-sm font-semibold text-slate-600">{t("greeting", { name: d.patient.firstName })}</p>
      <h1 className="mt-1 text-2xl font-extrabold tracking-tight">{t("title", { clinic: d.org.name })}</h1>
      <div className="mt-2">{status}</div>

      <Card className="mt-6 p-6">
        <div className="flex items-start gap-4">
          <Avatar name={d.practitioner.name} color={d.practitioner.color} size={52} />
          <div>
            <p className="text-lg font-bold">{practitionerName(d.practitioner)}</p>
            <p className="text-sm text-slate-600">{d.practitioner.specialty}</p>
          </div>
        </div>
        <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
          <div className="flex gap-2">
            <dt>
              <Clock size={16} className="mt-0.5 text-slate-500" aria-hidden />
              <span className="sr-only">{t("details.when")}</span>
            </dt>
            <dd>
              <span className="block font-semibold">{date}</span>
              {t("details.timeRange", { start: fmtTime(a.startsAt, tz), end: fmtTime(a.endsAt, tz) })}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt>
              <Stethoscope size={16} className="mt-0.5 text-slate-500" aria-hidden />
              <span className="sr-only">{t("details.treatment")}</span>
            </dt>
            <dd>
              <span className="block font-semibold">{d.service.name}</span>
              {price}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt>
              <MapPin size={16} className="mt-0.5 text-slate-500" aria-hidden />
              <span className="sr-only">{t("details.where")}</span>
            </dt>
            <dd>
              <span className="block font-semibold">{d.location.name}</span>
              {t("details.address", { address: d.location.address, city: d.location.city })}
            </dd>
          </div>
          {phone ? (
            <div className="flex gap-2">
              <dt>
                <Phone size={16} className="mt-0.5 text-slate-500" aria-hidden />
                <span className="sr-only">{t("details.phone")}</span>
              </dt>
              <dd>
                <a className="font-semibold text-brand-700" href={`tel:${phone.replace(/[^\d+]/g, "")}`}>
                  {phone}
                </a>
              </dd>
            </div>
          ) : null}
        </dl>
      </Card>

      <div className="mt-6">
        <ClientMessages locale={locale} ns={["manage", "privacy", "care"]}>
          <ManageAppointment
            initialPanel={panel}
            data={{
              token,
              appointmentId: a.id,
              status: a.status,
              confirmation: a.confirmation,
              start: a.startsAt.toISOString(),
              end: a.endsAt.toISOString(),
              timezone: tz,
              today: todayIn(tz),
              clinicSlug: d.org.slug,
              clinicName: d.org.name,
              clinicPhone: phone,
              serviceId: d.service.id,
              serviceName: d.service.name,
              practitionerId: d.practitioner.id,
              practitionerName: practitionerName(d.practitioner),
              locationLabel: t("details.address", { address: d.location.address, city: d.location.city }),
              canCancel: canPatientCancel(d),
              canReschedule: canPatientReschedule(d),
              lateCancellation: isLateCancellation(d),
              cancelUntilHours: settings.booking.cancelUntilHours,
              maxAdvanceDays: settings.booking.maxAdvanceDays,
              icsUrl: appointmentLinks(d).icsUrl,
            }}
          />
        </ClientMessages>
      </div>

      {a.status === "completed" && !review ? (
        <Card className="mt-6 flex flex-wrap items-center justify-between gap-3 p-5">
          <h2 className="flex items-center gap-2 font-semibold">
            <Star size={18} className="text-amber-600" aria-hidden /> {t("review.title")}
          </h2>
          <LinkButton href={lhref(locale, `/a/${token}/review`)}>{t("review.button")}</LinkButton>
        </Card>
      ) : null}

      {a.status === "cancelled" || a.status === "completed" ? (
        <div className="mt-6">
          <LinkButton
            href={lhref(locale, `/book/${d.org.slug}?service=${d.service.id}&practitioner=${d.practitioner.id}${rebookRef}`)}
            variant="secondary"
          >
            {t("rebook")}
          </LinkButton>
        </div>
      ) : null}

      <ClinicHelp clinicName={d.org.name} phone={phone} email={d.org.email} className="mt-8 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200/70" />

      <p className="mt-8 text-center text-xs text-slate-600">
        {t("privateLink")}{" "}
        <Link href={lhref(locale, `/c/${d.org.slug}`)} className="underline underline-offset-2">
          {t("clinicPage", { clinic: d.org.name })}
        </Link>
      </p>
    </div>
  );
}
