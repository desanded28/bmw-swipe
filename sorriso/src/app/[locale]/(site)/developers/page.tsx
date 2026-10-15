import { AlertTriangle, FileJson } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card } from "@/components/ui";
import { API_SCOPES } from "@/db/enums";
import { ENDONYM, LOCALES, OG_LOCALE, toLocale, type Locale } from "@/i18n/config";
import { lhref } from "@/i18n/href";
import { rich } from "@/i18n/rich";
import { alternatesFor } from "@/i18n/seo";
import { getT } from "@/i18n/server";
import type siteMessages from "@/i18n/messages/en/site";
import { APP_NAME, APP_URL } from "@/lib/config";

/** Open Graph in the page language, with the other languages as alternates. */
const ogAlternates = (locale: Locale) => LOCALES.filter((l) => l !== locale).map((l) => OG_LOCALE[l]);

type Params = Promise<{ locale: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const locale = toLocale((await params).locale);
  const t = getT(locale, "site");
  const title = t("developers.metaTitle");
  const description = t("developers.metaDescription");
  return {
    title,
    description,
    alternates: alternatesFor("/developers", locale),
    openGraph: {
      type: "website",
      siteName: APP_NAME,
      title,
      description,
      locale: OG_LOCALE[locale],
      alternateLocale: ogAlternates(locale),
    },
  };
}

function Code({ children, label }: { children: string; label: string }) {
  return (
    // Focusable, so keyboard users can scroll wide samples (WCAG 2.1.1); a named group, not a landmark.
    <pre
      tabIndex={0}
      role="group"
      aria-label={label}
      className="scrollbar-thin relative overflow-x-auto rounded-xl bg-ink p-4 text-[13px] leading-relaxed text-slate-100"
    >
      <code>{children.trim()}</code>
    </pre>
  );
}

type Method = "GET" | "POST" | "PATCH" | "DELETE";
type Auth = "public" | "token" | "apiKey" | "secret";
type EndpointId = keyof (typeof siteMessages)["developers"]["endpoints"];
type Endpoint = { id: EndpointId; method: Method; path: string; auth: Auth };

/** The endpoints; their descriptions are site.developers.endpoints.<id>. */
const ENDPOINTS: { group: "public" | "patient" | "partner" | "infra"; items: Endpoint[] }[] = [
  {
    group: "public",
    items: [
      { id: "clinic", method: "GET", path: "/api/v1/clinics/:slug", auth: "public" },
      {
        id: "availability",
        method: "GET",
        path: "/api/v1/clinics/:slug/availability?serviceId=&from=&days=&practitionerId=&locationId=",
        auth: "public",
      },
      { id: "book", method: "POST", path: "/api/v1/clinics/:slug/appointments", auth: "public" },
      { id: "waitlist", method: "POST", path: "/api/v1/clinics/:slug/waitlist", auth: "public" },
    ],
  },
  {
    group: "patient",
    items: [
      { id: "appointment", method: "GET", path: "/api/v1/appointments/:token", auth: "token" },
      { id: "confirm", method: "POST", path: "/api/v1/appointments/:token/confirm", auth: "token" },
      { id: "cancel", method: "POST", path: "/api/v1/appointments/:token/cancel", auth: "token" },
      { id: "reschedule", method: "POST", path: "/api/v1/appointments/:token/reschedule", auth: "token" },
    ],
  },
  {
    group: "partner",
    items: [
      { id: "resources", method: "GET", path: "/api/v1/partner/resources", auth: "apiKey" },
      { id: "list", method: "GET", path: "/api/v1/partner/appointments?from=&to=&updatedSince=&status=", auth: "apiKey" },
      { id: "create", method: "POST", path: "/api/v1/partner/appointments", auth: "apiKey" },
      { id: "update", method: "PATCH", path: "/api/v1/partner/appointments/:id", auth: "apiKey" },
    ],
  },
  {
    group: "infra",
    items: [
      { id: "twilio", method: "POST", path: "/api/webhooks/twilio", auth: "public" },
      { id: "twilioStatus", method: "POST", path: "/api/webhooks/twilio/status", auth: "public" },
      { id: "cron", method: "GET", path: "/api/cron/reminders", auth: "secret" },
      { id: "ics", method: "GET", path: "/api/ics/practitioner/:token", auth: "token" },
    ],
  },
];

const methodTone = { GET: "blue", POST: "green", PATCH: "amber", DELETE: "red" } as const;

/** Widget attributes, documented in site.developers.widget.attributes.<name>. */
const WIDGET_ATTRIBUTES = [
  "data-clinic",
  "data-lang",
  "data-target",
  "data-practitioner",
  "data-service",
  "data-location",
  "data-label",
  "data-color",
  "data-events",
  "data-include-id",
] as const;

/** Booking request fields, documented in site.developers.fields.<key>. */
const BOOKING_FIELDS = [
  ["patient.locale", "locale"],
  ["patient.phoneCountry", "phoneCountry"],
  ["patient.preferredChannel", "preferredChannel"],
  ["privacy", "privacy"],
  ["relation", "relation"],
  ["practiceRef", "practiceRef"],
  ["fundId", "fundId"],
] as const;

export default async function DevelopersPage({ params }: { params: Params }) {
  const locale = toLocale((await params).locale);
  const t = getT(locale, "site");
  const host = APP_URL.replace(/^https?:\/\//, "");
  const code = (c: React.ReactNode) => <code className="rounded bg-slate-100 px-1 py-0.5 text-[13px] text-ink">{c}</code>;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-3xl font-extrabold tracking-tight">{t("developers.title")}</h1>
      <p className="mt-2 max-w-2xl text-slate-600">{t("developers.intro", { host })}</p>

      <h2 className="mb-3 mt-10 text-xl font-bold">{t("developers.widget.title")}</h2>
      <Card className="space-y-4 p-6">
        <p className="text-sm text-slate-600">{t("developers.widget.button")}</p>
        <Code label={t("developers.codeSample")}>{`<script src="${APP_URL}/widget.js" data-clinic="studio-bianchi" async></script>`}</Code>
        <p className="text-sm text-slate-600">{t("developers.widget.inline")}</p>
        <Code label={t("developers.codeSample")}>{`<div id="booking"></div>
<script src="${APP_URL}/widget.js" data-clinic="studio-bianchi" data-lang="de"
        data-target="#booking" data-practitioner="PRACTITIONER_ID" async></script>`}</Code>
        <div className="relative overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{t("developers.widget.attributesCaption")}</caption>
            <thead className="text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th scope="col" className="py-2 pr-4 font-semibold">
                  {t("developers.attribute")}
                </th>
                <th scope="col" className="py-2 font-semibold">
                  {t("developers.description")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {WIDGET_ATTRIBUTES.map((a) => (
                <tr key={a}>
                  <th scope="row" className="whitespace-nowrap py-2 pr-4 align-top font-normal">
                    {code(a)}
                  </th>
                  <td className="py-2 text-slate-600">{t(`developers.widget.attributes.${a}`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-slate-600">{rich(t("developers.widget.languages"), { code })}</p>
        <ul className="flex flex-wrap gap-2 text-sm">
          {LOCALES.map((l) => (
            <li key={l} className="rounded-lg bg-slate-50 px-2 py-1 ring-1 ring-slate-200">
              {code(l)}{" "}
              <span lang={l} className="text-slate-600">
                {ENDONYM[l]}
              </span>
            </li>
          ))}
        </ul>
        <h3 className="pt-2 font-bold">{t("developers.widget.eventsTitle")}</h3>
        <p className="text-sm text-slate-600">{rich(t("developers.widget.events"), { code })}</p>
        <Code label={t("developers.codeSample")}>{`<script src="${APP_URL}/widget.js" data-clinic="studio-bianchi" data-events async></script>
<script>
  window.addEventListener("sorriso:booked", function (e) {
    /* e.detail: { source: "sorriso", type: "booked" } */
  });
</script>`}</Code>
        <p className="flex gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
          <span>{t("developers.widget.eventsWarning")}</span>
        </p>
        <p className="text-sm text-slate-600">{rich(t("developers.widget.origins"), { code })}</p>
      </Card>

      <h2 className="mb-3 mt-10 text-xl font-bold">{t("developers.booking.title")}</h2>
      <Card className="space-y-4 p-6">
        <Code label={t("developers.codeSample")}>{`curl "${APP_URL}/api/v1/clinics/studio-bianchi/availability?serviceId=SERVICE_ID&days=7"

curl -X POST "${APP_URL}/api/v1/clinics/studio-bianchi/appointments" \\
  -H "Content-Type: application/json" \\
  -d '{
    "serviceId": "SERVICE_ID",
    "practitionerId": "PRACTITIONER_ID",
    "locationId": "LOCATION_ID",
    "start": "2026-10-20T08:30:00.000Z",
    "patient": { "firstName": "Marco", "lastName": "Rossi",
                 "phone": "333 123 4567", "phoneCountry": "39",
                 "email": "marco@example.com",
                 "locale": "it", "preferredChannel": "sms" },
    "privacy": { "noticeVersion": "2026-10", "locale": "it",
                 "platformConsent": true, "feedback": false, "marketing": false },
    "relation": { "bookedFor": "self" },
    "fundId": null
  }'`}</Code>
        <div className="relative overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{t("developers.booking.fieldsCaption")}</caption>
            <thead className="text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th scope="col" className="py-2 pr-4 font-semibold">
                  {t("developers.field")}
                </th>
                <th scope="col" className="py-2 font-semibold">
                  {t("developers.description")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {BOOKING_FIELDS.map(([field, key]) => (
                <tr key={field}>
                  <th scope="row" className="whitespace-nowrap py-2 pr-4 align-top font-normal">
                    {code(field)}
                  </th>
                  <td className="py-2 text-slate-600">{rich(t(`developers.fields.${key}`), { code })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-slate-600">{t("developers.booking.context")}</p>
        <p className="text-sm text-slate-600">{rich(t("developers.booking.errors"), { code })}</p>
      </Card>

      <h2 className="mb-3 mt-10 text-xl font-bold">{t("developers.sync.title")}</h2>
      <Card className="space-y-4 p-6">
        <p className="text-sm text-slate-600">{t("developers.sync.keys")}</p>
        <Code label={t("developers.codeSample")}>{`curl -H "Authorization: Bearer sk_…" \\
  "${APP_URL}/api/v1/partner/appointments?updatedSince=2026-10-01T00:00:00Z"

curl -X PATCH -H "Authorization: Bearer sk_…" -H "Content-Type: application/json" \\
  -d '{"status":"no_show"}' "${APP_URL}/api/v1/partner/appointments/APPOINTMENT_ID"`}</Code>
        <h3 className="pt-2 font-bold">{t("developers.sync.scopesTitle")}</h3>
        <dl className="grid gap-2 text-sm sm:grid-cols-[max-content_1fr] sm:gap-x-4">
          {API_SCOPES.map((scope) => (
            <div key={scope} className="contents">
              <dt>{code(scope)}</dt>
              <dd className="mb-2 text-slate-600 sm:mb-0">{t(`developers.scopes.${scope}`)}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <h2 className="mb-3 mt-10 text-xl font-bold">{t("developers.export.title")}</h2>
      <Card className="flex gap-3 p-6 text-sm text-slate-600">
        <FileJson size={20} className="shrink-0 text-brand-700" aria-hidden />
        <p>
          {rich(t("developers.export.body"), {
            link: (c) => (
              <Link href={lhref(locale, "/developers/export-schema")} className="font-semibold text-brand-700 underline underline-offset-2">
                {c}
              </Link>
            ),
          })}
        </p>
      </Card>

      <h2 className="mb-3 mt-10 text-xl font-bold">{t("developers.reference")}</h2>
      <div className="space-y-6">
        {ENDPOINTS.map((g) => (
          <Card key={g.group} className="overflow-hidden">
            <h3 className="border-b border-slate-100 bg-slate-50 px-5 py-3 text-sm font-bold">{t(`developers.groups.${g.group}`)}</h3>
            <ul className="divide-y divide-slate-100">
              {g.items.map((e) => (
                <li key={e.id} className="grid gap-2 px-5 py-3 sm:grid-cols-[64px_1fr_110px]">
                  <Badge tone={methodTone[e.method]} className="h-fit w-fit">
                    {e.method}
                  </Badge>
                  <div className="min-w-0">
                    <code className="break-all text-[13px] font-semibold text-ink">{e.path}</code>
                    <p className="mt-0.5 text-sm text-slate-600">{t(`developers.endpoints.${e.id}`)}</p>
                  </div>
                  <span className="text-xs font-semibold text-slate-600 sm:text-right">{t(`developers.auth.${e.auth}`)}</span>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}
