import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookingFlow, type BookingLabels } from "@/components/booking/BookingFlow";
import { Avatar, Card } from "@/components/ui";
import { toLocale, type Locale } from "@/i18n/config";
import { ClientMessages } from "@/i18n/ClientMessages";
import { lhref } from "@/i18n/href";
import { formatMoney } from "@/i18n/number";
import { alternatesFor } from "@/i18n/seo";
import { getT } from "@/i18n/server";
import { getPublicClinic, type PublicClinic } from "@/lib/directory";
import { processingContextFor, verifyPracticeRef } from "@/lib/privacy/context";
import { todayIn } from "@/lib/time";

export const dynamic = "force-dynamic";

type Params = Promise<{ locale: string; org: string }>;
type SP = Promise<{ service?: string; practitioner?: string; location?: string; start?: string; wl?: string; ref?: string }>;

/**
 * A booking form is not a search result: noindex, but links are followed, and the canonical URL is
 * the practice's page (/{locale}/c/{org}), which is what should rank.
 */
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale: raw, org } = await params;
  const locale = toLocale(raw);
  const clinic = await getPublicClinic(org);
  if (!clinic) return { robots: { index: false, follow: true } };
  const t = getT(locale, "booking");
  return {
    title: t("page.metaTitle", { clinic: clinic.org.name }),
    description: t("page.metaDescription", { clinic: clinic.org.name }),
    robots: { index: false, follow: true },
    alternates: {
      canonical: lhref(locale, `/c/${clinic.org.slug}`),
      languages: alternatesFor(`/book/${clinic.org.slug}`, locale).languages,
    },
  };
}

/** Price and duration texts, formatted here so the client flow never formats numbers itself. */
function serviceLabels(clinic: PublicClinic, locale: Locale): BookingLabels {
  const tc = getT(locale, "common");
  const price = (c: number | null) => (c == null ? tc("price.onRequest") : c === 0 ? tc("price.free") : formatMoney(c, locale));
  return {
    services: Object.fromEntries(
      clinic.services.map((s) => [s.id, { price: price(s.priceCents), duration: tc("units.minutesShort", { count: s.durationMinutes }) }]),
    ),
  };
}

export default async function BookPage({ params, searchParams }: { params: Params; searchParams: SP }) {
  const { locale: rawLocale, org } = await params;
  const locale = toLocale(rawLocale);
  const clinic = await getPublicClinic(org);
  if (!clinic) notFound();
  const sp = await searchParams;
  const t = getT(locale, "booking");
  const start = sp.start && !Number.isNaN(Date.parse(sp.start)) ? sp.start : undefined;
  // Sorriso-hosted: marketplace, unless the link came from the practice itself (?ref=, signed per practice).
  const practiceRef = verifyPracticeRef(clinic.org.id, sp.ref) ? sp.ref! : null;
  const context = processingContextFor({ source: "online", viaApiKey: false, embedded: false, practiceRef, orgId: clinic.org.id });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link
        href={lhref(locale, `/c/${clinic.org.slug}${practiceRef ? `?ref=${practiceRef}` : ""}`)}
        className="mb-5 flex w-fit items-center gap-3 rounded-xl"
      >
        <Avatar name={clinic.org.name} color={clinic.org.brandColor} size={40} />
        <span>
          <span className="block text-xs font-semibold uppercase tracking-wider text-slate-600">{t("page.kicker")}</span>
          <span className="block font-bold">{clinic.org.name}</span>
        </span>
      </Link>
      {sp.wl ? (
        <p role="status" className="mb-4 rounded-xl bg-brand-50 p-4 text-sm font-medium text-brand-800 ring-1 ring-brand-200">
          {t("page.waitlistOffer")}
        </p>
      ) : null}
      <Card className="p-5 sm:p-7">
        <ClientMessages locale={locale} ns={["consents", "privacy", "catalog"]}>
          <BookingFlow
            clinic={clinic}
            today={todayIn(clinic.org.timezone)}
            context={context}
            practiceRef={practiceRef}
            labels={serviceLabels(clinic, locale)}
            initial={{
              serviceId: sp.service,
              practitionerId: sp.practitioner,
              locationId: sp.location,
              start,
              waitlistEntryId: sp.wl,
            }}
          />
        </ClientMessages>
      </Card>
    </div>
  );
}
