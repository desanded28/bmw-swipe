import { MapPin } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookingFlow } from "@/components/booking/BookingFlow";
import { AccessibilityList } from "@/components/marketplace/AccessibilityList";
import { bookingLabels } from "@/components/marketplace/price";
import { ProfileFacts } from "@/components/marketplace/ProfileFacts";
import { RatingBreakdown } from "@/components/RatingBreakdown";
import { ReviewList } from "@/components/ReviewList";
import { Avatar, Badge, Card, Stars } from "@/components/ui";
import { LOCALES, OG_LOCALE, toLocale, type Locale } from "@/i18n/config";
import { ClientMessages } from "@/i18n/ClientMessages";
import { lhref } from "@/i18n/href";
import { formatDecimal } from "@/i18n/number";
import { alternatesFor } from "@/i18n/seo";
import { getT } from "@/i18n/server";
import { getPublicClinic, getPublicReviews, getRatingBreakdown, localizedText, recordProfileStats } from "@/lib/directory";
import { practitionerName } from "@/lib/format";
import { processingContextFor, verifyPracticeRef } from "@/lib/privacy/context";
import { todayIn } from "@/lib/time";

export const dynamic = "force-dynamic";

type Params = Promise<{ locale: string; org: string; practitioner: string }>;
type SP = Promise<{ ref?: string }>;

/**
 * Only listed practitioners have a page: an approved public profile and no marketplace opt-out
 * (src/lib/directory.ts). Anyone else is a 404, as is a practice that left the marketplace
 * (unless the visitor came through the practice's own link).
 */
async function load(params: Params, ref: string | undefined) {
  const { org, practitioner } = await params;
  const clinic = await getPublicClinic(org);
  const p = clinic?.practitioners.find((x) => x.slug === practitioner && x.listed);
  if (!clinic || !p?.profile) return null;
  if (clinic.org.listed === false && !verifyPracticeRef(clinic.org.id, ref)) return null;
  return { clinic, p, profile: p.profile };
}

export async function generateMetadata({ params, searchParams }: { params: Params; searchParams: SP }): Promise<Metadata> {
  const locale = toLocale((await params).locale);
  const data = await load(params, (await searchParams).ref);
  if (!data) return {};
  const t = getT(locale, "marketplace");
  const name = practitionerName(data.p);
  const description = t("practitioner.metaDescription", { name, clinic: data.clinic.org.name });
  return {
    title: t("practitioner.metaTitle", { name, clinic: data.clinic.org.name }),
    description,
    alternates: alternatesFor(`/c/${data.clinic.org.slug}/${data.p.slug}`, locale),
    openGraph: { type: "profile", title: name, description, locale: OG_LOCALE[locale], alternateLocale: LOCALES.filter((l) => l !== locale).map((l) => OG_LOCALE[l]) },
  };
}

export default async function PractitionerPage({ params, searchParams }: { params: Params; searchParams: SP }) {
  const locale: Locale = toLocale((await params).locale);
  const { ref } = await searchParams;
  const data = await load(params, ref);
  if (!data) notFound();
  const { clinic, p, profile } = data;
  const t = getT(locale, "marketplace");
  const ta = getT(locale, "a11y");
  const contentLocale = clinic.org.contentLocale ?? "it";
  const lang = (l: Locale) => (l !== locale ? l : undefined);
  const [reviews, breakdown] = await Promise.all([
    getPublicReviews(clinic.org.id, p.id),
    getRatingBreakdown({ orgId: clinic.org.id, practitionerId: p.id }),
    // A daily view counter: no cookie or identifier, bots and prefetches skipped.
    recordProfileStats("views", [p.id], await headers()),
  ]);
  const locs = clinic.locations.filter((l) => p.locationIds.includes(l.id));
  // Sorriso-hosted: marketplace, unless the link came from the practice itself (?ref=, signed per practice).
  const practiceRef = verifyPracticeRef(clinic.org.id, ref) ? ref! : null;
  const context = processingContextFor({ source: "online", viaApiKey: false, embedded: false, practiceRef, orgId: clinic.org.id });
  const name = practitionerName(p);
  const ownSpecialty = localizedText(p.specialty, profile.specialtyI18n, locale, contentLocale);
  // Left empty by the practice: a default in the page's language (not the practice's text).
  const specialty = ownSpecialty.text.trim() ? ownSpecialty : { text: t("profile.defaultSpecialty"), lang: locale };
  const bio = p.bio ? localizedText(p.bio, profile.bioI18n, locale, contentLocale) : null;
  const average = p.rating ? formatDecimal(p.rating.average, locale, 1) : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link href={lhref(locale, `/c/${clinic.org.slug}${practiceRef ? `?ref=${practiceRef}` : ""}`)} className="text-sm font-semibold text-slate-600 hover:text-ink">
        <span aria-hidden>←</span> {t("practitioner.back", { clinic: clinic.org.name })}
      </Link>
      <ClientMessages locale={locale} ns={["marketplace", "reviews"]}>
        <div className="mt-4 grid gap-6 lg:grid-cols-[340px_1fr]">
          <div className="space-y-4">
            <Card className="p-6 text-center">
              <Avatar name={p.name} color={p.color} size={96} className="mx-auto" />
              <h1 className="mt-4 text-2xl font-extrabold tracking-tight">{name}</h1>
              <p className="text-slate-600" lang={lang(specialty.lang)}>
                {specialty.text}
              </p>
              {p.rating && average ? (
                <div className="mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm">
                  <a href="#reviews" className="flex items-center gap-2 hover:underline">
                    <Stars value={p.rating.average} label={ta("rating.stars", { rating: average })} />
                    <span className="font-semibold">{average}</span>
                    <span className="text-slate-600">{getT(locale, "reviews")("breakdown.reviews", { count: p.rating.count })}</span>
                  </a>
                  <Link href={lhref(locale, "/legal/reviews")} className="text-xs font-semibold text-brand-700 hover:underline">
                    {getT(locale, "reviews")("howWeVerify")}
                  </Link>
                </div>
              ) : null}
              {p.acceptsNewPatients ? (
                <Badge tone="green" className="mt-3">
                  {t("practitioner.acceptsNew")}
                </Badge>
              ) : (
                <Badge tone="amber" className="mt-3">
                  {t("practitioner.existingOnly")}
                </Badge>
              )}
            </Card>
            <Card className="space-y-4 p-5 text-sm">
              {bio ? (
                <p className="whitespace-pre-line text-slate-700" lang={lang(bio.lang)}>
                  {bio.text}
                </p>
              ) : null}
              <ProfileFacts profile={profile} />
            </Card>
            {locs.length ? (
              <Card className="space-y-4 p-5">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600">{t("practitioner.offices")}</h2>
                {locs.map((l) => (
                  <div key={l.id} className="space-y-2">
                    <p className="flex items-start gap-2 text-sm text-slate-600">
                      <MapPin size={15} className="mt-0.5 shrink-0" aria-hidden />
                      <span>
                        <span className="font-semibold text-slate-800">{l.name}</span> · {l.address}, {l.city}
                      </span>
                    </p>
                    <AccessibilityList accessibility={l.accessibility} contentLocale={contentLocale} />
                  </div>
                ))}
              </Card>
            ) : null}
          </div>

          <div className="space-y-6">
            <Card className="p-6">
              <h2 className="mb-4 text-lg font-bold">{t("practitioner.book", { name })}</h2>
              <ClientMessages locale={locale} ns={["consents", "privacy", "catalog"]}>
                <BookingFlow
                  clinic={clinic}
                  initial={{ practitionerId: p.id }}
                  today={todayIn(clinic.org.timezone)}
                  context={context}
                  practiceRef={practiceRef}
                  labels={bookingLabels(clinic.services, locale, getT(locale, "common"), getT(locale, "catalog"))}
                />
              </ClientMessages>
            </Card>
            <Card className="p-6" id="reviews">
              <h2 className="mb-4 text-lg font-bold">{t("practitioner.reviews")}</h2>
              <RatingBreakdown breakdown={breakdown} />
              {reviews.length ? (
                <div className="mt-6">
                  <ReviewList reviews={reviews} replyLang={contentLocale} />
                </div>
              ) : null}
            </Card>
          </div>
        </div>
      </ClientMessages>
    </div>
  );
}
