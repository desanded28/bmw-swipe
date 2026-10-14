import { CalendarCheck, CalendarClock, Hourglass, LinkIcon } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { RebookChooser } from "@/components/care/RebookChooser";
import { LinkButton } from "@/components/ui";
import { toLocale, type Locale } from "@/i18n/config";
import { ClientMessages } from "@/i18n/ClientMessages";
import { capitalizeFirst, fmtWhen } from "@/i18n/datefmt";
import { lhref } from "@/i18n/href";
import { getT } from "@/i18n/server";
import { audit } from "@/lib/audit";
import { isPreviewBot, TOKEN_SHAPE } from "@/lib/forms";
import { rateLimitByIp } from "@/lib/rate-limit";
import { REBOOK_CHOICES, REBOOK_MORE_CHOICES, rebookState } from "@/lib/rebooking";

export const dynamic = "force-dynamic";

type Params = Promise<{ locale: string; token: string }>;
type Search = Promise<{ more?: string | string[] }>;

const LINK_LIMIT = 30;
const LINK_WINDOW_MS = 10 * 60 * 1000;

/** Generic: link previews must show neither the practice nor the patient. */
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const locale = toLocale((await params).locale);
  const t = getT(locale, "care");
  return {
    title: t("rebook.metaTitle"),
    robots: { index: false, follow: false, nocache: true },
    referrer: "no-referrer",
  };
}

function Message({
  locale,
  title,
  text,
  icon,
  manageToken,
}: {
  locale: Locale;
  title: string;
  text: string;
  icon: React.ReactNode;
  manageToken?: string;
}) {
  const t = getT(locale, "care");
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-600" aria-hidden>
        {icon}
      </div>
      <h1 className="mt-4 text-2xl font-extrabold tracking-tight">{title}</h1>
      <p className="mt-2 text-slate-600">{text}</p>
      {manageToken ? (
        <LinkButton href={lhref(locale, `/a/${manageToken}`)} variant="secondary" className="mt-6">
          {t("rebook.manage")}
        </LinkButton>
      ) : null}
    </div>
  );
}

/**
 * The rebooking assistant's page: the practice closed during this visit and offered new times;
 * the patient picks one in one tap (?more=1 shows more of them, still moving this visit), or asks
 * to be called. Reached from careMessages.practiceMoved.
 */
export default async function RebookPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { locale: raw, token } = await params;
  const more = (await searchParams).more === "1";
  const locale = toLocale(raw);
  const t = getT(locale, "care");
  const h = await headers();

  if (isPreviewBot(h.get("user-agent"))) {
    return <Message locale={locale} title={t("rebook.metaTitle")} text={t("rebook.preview")} icon={<CalendarClock size={26} />} />;
  }
  const limit = await rateLimitByIp(h, "patient-link", LINK_LIMIT, LINK_WINDOW_MS);
  if (!limit.ok) {
    return <Message locale={locale} title={t("rebook.metaTitle")} text={t("form.errors.rate_limited")} icon={<Hourglass size={26} />} />;
  }

  const state = TOKEN_SHAPE.test(token) ? await rebookState(token, new Date(), more ? REBOOK_MORE_CHOICES : REBOOK_CHOICES) : ({ kind: "invalid" } as const);
  if (state.kind === "invalid") {
    return <Message locale={locale} title={t("rebook.metaTitle")} text={t("rebook.invalid")} icon={<LinkIcon size={26} />} />;
  }
  const d = state.d;
  await audit({
    orgId: d.org.id,
    actor: { type: "patient_link", id: d.appointment.id },
    action: "appointment.view",
    entity: { type: "appointment", id: d.appointment.id },
    metadata: { page: "rebook" },
    headers: h,
  });
  if (state.kind === "not_needed") {
    return (
      <Message
        locale={locale}
        title={t("rebook.notNeededTitle")}
        text={t("rebook.notNeededBody")}
        icon={<CalendarCheck size={26} />}
        manageToken={token}
      />
    );
  }

  const tz = d.location.timezone;
  // More times of the same assistant (each one moves this visit), never the public booking page:
  // a booking there would be a second appointment next to the one that can't take place.
  const moreTimesHref = !more && state.choices.length >= REBOOK_CHOICES ? lhref(locale, `/a/${token}/rebook?more=1`) : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <p className="text-sm font-semibold text-slate-600">{d.org.name}</p>
      <h1 className="mt-1 text-2xl font-extrabold tracking-tight">{t("rebook.title")}</h1>
      <p className="mt-2 text-slate-700">
        {t("rebook.body", { clinic: d.org.name, when: fmtWhen(d.appointment.startsAt, tz, locale) })}
      </p>
      <div className="mt-6">
        <ClientMessages locale={locale} ns={["care"]}>
          <RebookChooser
            token={token}
            clinic={d.org.name}
            callRequested={state.callRequested}
            moreTimesHref={moreTimesHref}
            options={state.choices.map((c) => ({
              key: c.key,
              when: capitalizeFirst(fmtWhen(c.start, tz, locale), locale),
              practitioner: c.practitionerName,
              location: c.locationName,
            }))}
          />
        </ClientMessages>
      </div>
    </div>
  );
}
