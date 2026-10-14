import { eq } from "drizzle-orm";
import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { BookingFlow, type BookingLabels } from "@/components/booking/BookingFlow";
import { bookingLabels } from "@/components/marketplace/price";
import { db } from "@/db";
import { organizations } from "@/db/schema";
import { toLocale, type Locale } from "@/i18n/config";
import { ClientMessages } from "@/i18n/ClientMessages";
import { lhref } from "@/i18n/href";
import { rich } from "@/i18n/rich";
import { alternatesFor } from "@/i18n/seo";
import { getT } from "@/i18n/server";
import { APP_NAME, APP_URL } from "@/lib/config";
import { getPublicClinic, type PublicClinic } from "@/lib/directory";
import { isFramedRequest, processingContextFor, signPracticeRef } from "@/lib/privacy/context";
import { getPrivacy } from "@/lib/privacy/settings";
import { todayIn } from "@/lib/time";

export const dynamic = "force-dynamic";

type Params = Promise<{ locale: string; org: string }>;
type SP = Promise<{ service?: string; practitioner?: string; location?: string; parent?: string; events?: string; id?: string }>;

/** Only for the practice's iframe: never a search result people land on outside the practice's site. */
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale: raw, org } = await params;
  const locale = toLocale(raw);
  const clinic = await getPublicClinic(org);
  return {
    title: clinic ? getT(locale, "booking")("page.metaTitle", { clinic: clinic.org.name }) : undefined,
    robots: { index: false, follow: false },
    alternates: alternatesFor(`/embed/${org}`, locale),
  };
}

/**
 * What the browser's Referer says about the page that framed us, given the claimed parent origin:
 * - "parent": the claimed parent itself (widget.js sets referrerpolicy=strict-origin-when-cross-origin,
 *   so a real host always sends at least its origin);
 * - "ownEmbed": this practice's embed page with the same ?parent (the frame moved on inside itself,
 *   e.g. to another language; same-origin Referers are full URLs). Only our own page can be that
 *   Referer, and it showed the flow only if it passed these checks itself;
 * - "ownPage": another page of ours; "other": a different site;
 * - "none": no Referer (e.g. referrerpolicy=no-referrer on the iframe) or an unparsable one.
 */
type RefererSays = "parent" | "ownEmbed" | "ownPage" | "other" | "none";

function refererSays(referer: string | null, origin: string, ownHost: string | null, slug: string): RefererSays {
  if (!referer) return "none";
  let from: URL;
  try {
    from = new URL(referer);
  } catch {
    return "none";
  }
  if (from.origin === origin) return "parent";
  if (from.host !== ownHost && from.origin !== new URL(APP_URL).origin) return "other";
  const embedOf = /^\/[^/]+\/embed\/([^/]+)\/?$/.exec(from.pathname)?.[1];
  return embedOf === slug && from.searchParams.get("parent") === origin ? "ownEmbed" : "ownPage";
}

/**
 * The host page's origin as the widget reported it (?parent=), if it may receive messages: an
 * exact origin, https (http only for localhost outside production).
 * - No allowed websites set (any https host may embed): a Referer from a different site contradicts
 *   ?parent and no messages are posted; a missing Referer or one of our own pages proves nothing.
 * - Allowed websites set: fail closed. The parent must be listed AND the Referer must vouch for it
 *   ("parent" or "ownEmbed"); without one (no-referrer framing with a spoofed ?parent) the frame is
 *   blocked, so an unlisted site can't show the practice's flow by hiding who it is.
 * null origin: no messages are posted at all.
 */
function allowedParent(
  parent: string | undefined,
  allowed: string[],
  referer: string | null,
  ownHost: string | null,
  slug: string,
): { origin: string | null; blocked: boolean } {
  let origin: string | null = null;
  try {
    const u = parent ? new URL(parent) : null;
    const local = u?.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1");
    if (u && u.origin === parent && (u.protocol === "https:" || (local && process.env.NODE_ENV !== "production"))) origin = u.origin;
  } catch {
    origin = null;
  }
  const says = origin ? refererSays(referer, origin, ownHost, slug) : "none";
  if (!allowed.length) return { origin: says === "other" ? null : origin, blocked: false };
  const ok = Boolean(origin && allowed.includes(origin) && (says === "parent" || says === "ownEmbed"));
  return { origin: ok ? origin : null, blocked: !ok };
}

/** The flow's server-made texts, as on the book page: prices with their price type, durations, the default specialty. */
function flowLabels(clinic: PublicClinic, locale: Locale): BookingLabels {
  return {
    ...bookingLabels(clinic.services, locale, getT(locale, "common"), getT(locale, "catalog")),
    defaultSpecialty: getT(locale, "marketplace")("profile.defaultSpecialty"),
  };
}

/**
 * Chrome-less booking flow loaded by /widget.js inside an iframe on the practice's own website.
 *
 * Framed, it is the practice's own channel, so the practice is controller: the flow posts the
 * practice ref. Opened top-level (a search result, a shared link) it is a Sorriso-hosted page like
 * any other: marketplace, and the page hands out no practice ref (isFramedRequest).
 *
 * If the practice listed the websites allowed to embed it (privacy settings, embedOrigins), a frame
 * on any other site shows only a link that opens the booking page in a new tab.
 *
 * The language comes from the URL only (/{locale}/embed/...): a cross-site iframe can't set cookies,
 * so the language switcher links to the same URL in another language.
 */
export default async function EmbedPage({ params, searchParams }: { params: Params; searchParams: SP }) {
  const { locale: rawLocale, org } = await params;
  const locale = toLocale(rawLocale);
  const clinic = await getPublicClinic(org);
  if (!clinic) notFound();
  const sp = await searchParams;
  const t = getT(locale, "booking");
  const h = await headers();
  const framed = isFramedRequest(h);
  // A browser without Fetch Metadata sends no Sec-Fetch-Dest: with a ?parent the page may well be
  // framed, so the allowed-websites rule applies to it too (it still counts as top-level for the
  // processing context: no practice ref, no messages).
  const mayBeFramed = framed || (h.get("sec-fetch-dest") === null && Boolean(sp.parent));
  const [row] = await db.select({ settings: organizations.settings }).from(organizations).where(eq(organizations.id, clinic.org.id));
  const parent = allowedParent(
    sp.parent,
    row ? getPrivacy(row).embedOrigins : [],
    mayBeFramed ? h.get("referer") : null,
    h.get("host"),
    clinic.org.slug,
  );
  const bookHref = lhref(locale, `/book/${clinic.org.slug}`);

  if (mayBeFramed && parent.blocked) {
    return (
      <main id="content" tabIndex={-1} className="grid min-h-dvh place-items-center bg-white p-6 text-center outline-none">
        <div className="max-w-sm">
          <h1 className="text-lg font-bold">{clinic.org.name}</h1>
          <p className="mt-2 text-sm text-slate-600">{t("embed.blocked")}</p>
          <a
            href={bookHref}
            target="_blank"
            rel="noopener"
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-700 px-5 font-semibold text-white hover:bg-brand-800"
          >
            {t("embed.openNewTab")} <ExternalLink size={16} aria-hidden />
            <span className="sr-only">{getT(locale, "a11y")("opensInNewTab")}</span>
          </a>
        </div>
      </main>
    );
  }

  const practiceRef = framed ? signPracticeRef(clinic.org.id) : null;
  const context = processingContextFor({ source: "widget", viaApiKey: false, embedded: framed, practiceRef, orgId: clinic.org.id });
  const ta = getT(locale, "a11y");
  const link = "font-semibold text-slate-700 underline underline-offset-2 hover:text-ink";
  return (
    <main id="content" tabIndex={-1} className="min-h-dvh bg-white p-4 outline-none sm:p-6">
      <h1 className="mb-4 pr-10 text-lg font-bold">{clinic.org.name}</h1>
      <ClientMessages locale={locale} ns={["consents", "privacy", "catalog"]}>
        <BookingFlow
          clinic={clinic}
          embedded
          today={todayIn(clinic.org.timezone)}
          context={context}
          practiceRef={practiceRef}
          labels={flowLabels(clinic, locale)}
          search={h.get("x-search") ?? ""}
          embed={{ parentOrigin: framed ? parent.origin : null, events: sp.events === "1", includeId: sp.id === "1" }}
          initial={{ serviceId: sp.service, practitionerId: sp.practitioner, locationId: sp.location }}
        />
      </ClientMessages>
      <footer className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-center text-xs text-slate-600">
        <a href={lhref(locale, `/c/${clinic.org.slug}/privacy`)} target="_blank" rel="noopener" className={link}>
          {t("embed.privacyNotice", { controller: clinic.legal.controllerName })}
          <span className="sr-only"> {ta("opensInNewTab")}</span>
        </a>
        <span>
          {rich(
            t,
            "embed.poweredBy",
            {
              link: (c) => (
                <a href={lhref(locale, "/")} target="_blank" rel="noopener" className={link}>
                  {c}
                  <span className="sr-only"> {ta("opensInNewTab")}</span>
                </a>
              ),
            },
            { app: APP_NAME },
          )}
        </span>
      </footer>
    </main>
  );
}
