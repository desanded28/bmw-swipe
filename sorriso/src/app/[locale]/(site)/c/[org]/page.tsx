import { CalendarCheck, Globe, HeartHandshake, Info, Mail, MapPin, Phone, Stethoscope } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapEmbed } from "@/components/MapEmbed";
import { AccessibilityList } from "@/components/marketplace/AccessibilityList";
import { priceLabel, TAX_DEDUCTION_RATE, TAX_DEDUCTION_THRESHOLD_CENTS } from "@/components/marketplace/price";
import { RatingBreakdown } from "@/components/RatingBreakdown";
import { ReviewList } from "@/components/ReviewList";
import { Avatar, Badge, Card, LinkButton, Stars } from "@/components/ui";
import { LOCALES, OG_LOCALE, toLocale, type Locale } from "@/i18n/config";
import { ClientMessages } from "@/i18n/ClientMessages";
import { lhref } from "@/i18n/href";
import { formatDecimal, formatMoney, formatPercent } from "@/i18n/number";
import { rich } from "@/i18n/rich";
import { alternatesFor } from "@/i18n/seo";
import { getT } from "@/i18n/server";
import { getPublicClinic, getPublicReviews, getRatingBreakdown, localizedText, type PublicClinic } from "@/lib/directory";
import { practitionerName } from "@/lib/format";
import { verifyPracticeRef } from "@/lib/privacy/context";

export const dynamic = "force-dynamic";

type Params = Promise<{ locale: string; org: string }>;
type SP = Promise<{ ref?: string }>;

/** On the marketplace, or opened from a link the practice itself published (?ref=). */
function visible(clinic: PublicClinic, ref: string | undefined): boolean {
  return clinic.org.listed !== false || verifyPracticeRef(clinic.org.id, ref);
}

export async function generateMetadata({ params, searchParams }: { params: Params; searchParams: SP }): Promise<Metadata> {
  const { locale: raw, org } = await params;
  const locale = toLocale(raw);
  const clinic = await getPublicClinic(org);
  if (!clinic || !visible(clinic, (await searchParams).ref)) return {};
  const t = getT(locale, "marketplace");
  const description = t("clinic.metaDescription", { clinic: clinic.org.name });
  return {
    title: clinic.org.name,
    description,
    alternates: alternatesFor(`/c/${clinic.org.slug}`, locale),
    robots: clinic.org.listed === false ? { index: false, follow: false } : undefined,
    openGraph: { type: "website", title: clinic.org.name, description, locale: OG_LOCALE[locale], alternateLocale: LOCALES.filter((l) => l !== locale).map((l) => OG_LOCALE[l]) },
  };
}

/**
 * A practice's marketplace page: who works there (listed practitioners only), treatments with
 * transparent prices, health funds as declared by the practice, offices with accessibility and a
 * click-to-load map, and verified reviews with their distribution. Neutral: no advertising and
 * nothing about other practices. Booking from here is a marketplace booking unless the visitor
 * came through the practice's own link (?ref=, kept on every booking link).
 */
export default async function ClinicPage({ params, searchParams }: { params: Params; searchParams: SP }) {
  const { locale: raw, org } = await params;
  const locale: Locale = toLocale(raw);
  const clinic = await getPublicClinic(org);
  const { ref } = await searchParams;
  if (!clinic || !visible(clinic, ref)) notFound();
  const practiceRef = verifyPracticeRef(clinic.org.id, ref) ? ref! : null;
  const withRef = (path: string) => lhref(locale, practiceRef ? `${path}${path.includes("?") ? "&" : "?"}ref=${practiceRef}` : path);
  const t = getT(locale, "marketplace");
  const tc = getT(locale, "common");
  const tcat = getT(locale, "catalog");
  const tr = getT(locale, "reviews");
  const ta = getT(locale, "a11y");
  const contentLocale = clinic.org.contentLocale ?? "it";
  const lang = (l: Locale) => (l !== locale ? l : undefined);

  const [reviews, breakdown] = await Promise.all([getPublicReviews(clinic.org.id), getRatingBreakdown({ orgId: clinic.org.id })]);
  const team = clinic.practitioners.filter((p) => p.listed);
  const funds = clinic.funds ?? [];
  const color = clinic.org.brandColor;
  const average = breakdown.count ? formatDecimal(breakdown.average, locale, 1) : null;
  const price = (s: PublicClinic["services"][number]) =>
    priceLabel(s, locale, {
      onRequest: tc("price.onRequest"),
      free: tc("price.free"),
      from: (p) => tc("price.from", { price: p }),
      range: (min, max) => tcat("price.range", { min, max }),
      quote: tcat("price.quote"),
    });
  const serviceName = (id: string) => {
    const s = clinic.services.find((x) => x.id === id);
    return s ? localizedText(s.name, s.nameI18n, locale, contentLocale).text : null;
  };

  return (
    <ClientMessages locale={locale} ns={["marketplace", "reviews"]}>
      <div className="h-28 sm:h-36" style={{ background: `linear-gradient(120deg, ${color}, color-mix(in srgb, ${color} 55%, #0b1324))` }} />
      <div className="mx-auto -mt-14 max-w-6xl px-4 pb-12">
        <Card className="p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="flex items-start gap-5">
              <Avatar name={clinic.org.name} color={color} size={76} className="ring-4 ring-white" />
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{clinic.org.name}</h1>
                {average ? (
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                    <Stars value={breakdown.average} label={ta("rating.stars", { rating: average })} />
                    <span className="font-semibold">{average}</span>
                    <a href="#reviews" className="text-slate-600 hover:underline">
                      {tr("breakdown.reviews", { count: breakdown.count })}
                    </a>
                    <Link href={lhref(locale, "/legal/reviews")} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline">
                      <Info size={12} aria-hidden /> {tr("howWeVerify")}
                    </Link>
                  </div>
                ) : null}
                {clinic.org.description ? (
                  <p className="mt-2 max-w-2xl text-slate-600" lang={lang(contentLocale)}>
                    {clinic.org.description}
                  </p>
                ) : null}
                {clinic.org.medicalDirector ? (
                  <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-600">
                    <Stethoscope size={14} aria-hidden /> {t("clinic.medicalDirector", { name: clinic.org.medicalDirector })}
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-600">
                  {clinic.org.phone ? (
                    <a href={`tel:${clinic.org.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1.5 hover:text-ink">
                      <Phone size={14} aria-hidden /> {clinic.org.phone}
                    </a>
                  ) : null}
                  {clinic.org.email ? (
                    <a href={`mailto:${clinic.org.email}`} className="inline-flex items-center gap-1.5 hover:text-ink">
                      <Mail size={14} aria-hidden /> {clinic.org.email}
                    </a>
                  ) : null}
                  {clinic.org.website ? (
                    <a href={clinic.org.website} className="inline-flex items-center gap-1.5 hover:text-ink" rel="noreferrer noopener" target="_blank">
                      <Globe size={14} aria-hidden /> {t("clinic.website")}
                      <span className="sr-only"> {ta("opensInNewTab")}</span>
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
            <LinkButton href={withRef(`/book/${clinic.org.slug}`)} size="lg">
              <CalendarCheck size={18} aria-hidden /> {t("clinic.bookOnline")}
            </LinkButton>
          </div>
        </Card>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            <Card className="p-6">
              <h2 className="mb-4 text-lg font-bold">{t("clinic.team")}</h2>
              {team.length ? (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {team.map((p) => {
                    const pAverage = p.rating ? formatDecimal(p.rating.average, locale, 1) : null;
                    const own = localizedText(p.specialty, p.profile?.specialtyI18n, locale, contentLocale);
                    // Left empty by the practice: a default in the page's language (not the practice's text).
                    const specialty = own.text.trim() ? own : { text: t("profile.defaultSpecialty"), lang: locale };
                    return (
                      <li key={p.id} className="flex gap-3 rounded-xl p-3 ring-1 ring-slate-200">
                        <Avatar name={p.name} color={p.color} size={48} />
                        <div className="min-w-0 flex-1">
                          <Link href={withRef(`/c/${clinic.org.slug}/${p.slug}`)} className="font-bold hover:underline">
                            {practitionerName(p)}
                          </Link>
                          <p className="text-sm text-slate-600" lang={lang(specialty.lang)}>
                            {specialty.text}
                          </p>
                          {p.rating && pAverage ? (
                            <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-600">
                              <Stars value={p.rating.average} size={12} label={ta("rating.stars", { rating: pAverage })} /> {pAverage} ·{" "}
                              {tr("breakdown.reviews", { count: p.rating.count })}
                            </p>
                          ) : null}
                          <p className="mt-1 text-xs text-slate-600">
                            {p.locationIds.map((id) => clinic.locations.find((l) => l.id === id)?.name).filter(Boolean).join(" · ")}
                          </p>
                          <Link href={withRef(`/book/${clinic.org.slug}?practitioner=${p.id}`)} className="mt-2 inline-block text-sm font-semibold text-brand-700 hover:underline">
                            {t("clinic.bookWith", { name: practitionerName(p) })} <span aria-hidden>→</span>
                          </Link>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-slate-600">{t("clinic.noTeam")}</p>
              )}
            </Card>

            <Card className="p-6">
              <h2 className="mb-4 text-lg font-bold">{t("clinic.treatments")}</h2>
              <ul className="divide-y divide-slate-100">
                {clinic.services.map((s) => {
                  const name = localizedText(s.name, s.nameI18n, locale, contentLocale);
                  const description = s.description ? localizedText(s.description, s.descriptionI18n, locale, contentLocale) : null;
                  return (
                    <li key={s.id} className="flex items-start justify-between gap-4 py-3 first:pt-0">
                      <div>
                        <p className="font-semibold" lang={lang(name.lang)}>
                          {name.text}
                        </p>
                        {description ? (
                          <p className="text-sm text-slate-600" lang={lang(description.lang)}>
                            {description.text}
                          </p>
                        ) : null}
                        {s.priceIncludes ? (
                          <p className="mt-0.5 text-xs text-slate-600">
                            {rich(t("clinic.priceIncludes"), { value: () => <span lang={lang(contentLocale)}>{s.priceIncludes}</span> })}
                          </p>
                        ) : null}
                        <Badge className="mt-1.5">{tc(`categories.${s.category}`)}</Badge>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-bold">{price(s)}</p>
                        <p className="text-xs text-slate-600">{tc("units.minutesShort", { count: s.durationMinutes })}</p>
                        <Link
                          href={withRef(`/book/${clinic.org.slug}?service=${s.id}`)}
                          className="text-xs font-semibold text-brand-700 hover:underline"
                          aria-label={t("clinic.bookTreatment", { treatment: name.text })}
                        >
                          {t("clinic.book")}
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <details className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-600 ring-1 ring-slate-200">
                <summary className="inline-flex cursor-pointer items-center gap-1.5 font-semibold text-slate-700">
                  <Info size={13} aria-hidden /> {tcat("tax.title")}
                </summary>
                <p className="mt-2">{tcat("tax.body", { rate: formatPercent(TAX_DEDUCTION_RATE, locale), threshold: formatMoney(TAX_DEDUCTION_THRESHOLD_CENTS, locale) })}</p>
              </details>
            </Card>

            {funds.length ? (
              <Card className="p-6">
                <h2 className="mb-1 flex items-center gap-2 text-lg font-bold">
                  <HeartHandshake size={18} aria-hidden /> {t("clinic.funds")}
                </h2>
                <p className="mb-4 text-xs text-slate-600">{t("clinic.fundsNote")}</p>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {funds.map((f) => (
                    <li key={f.id} className="rounded-xl p-3 ring-1 ring-slate-200">
                      <p className="font-semibold">{f.name}</p>
                      <p className="mt-0.5 flex flex-wrap gap-1.5">
                        <Badge tone={f.mode === "direct" ? "green" : "blue"}>{t(`clinic.fundModes.${f.mode}`)}</Badge>
                        <Badge>
                          {f.serviceIds ? t("clinic.fundSomeServices", { count: f.serviceIds.length }) : t("clinic.fundAllServices")}
                        </Badge>
                      </p>
                      {f.serviceIds ? (
                        <p className="mt-1 text-xs text-slate-600">{f.serviceIds.map(serviceName).filter(Boolean).join(", ")}</p>
                      ) : null}
                      {f.note ? (
                        <p className="mt-1 text-xs text-slate-600" lang={lang(contentLocale)}>
                          {f.note}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}

            <Card className="p-6" id="reviews">
              <h2 className="mb-4 text-lg font-bold">{t("clinic.reviews")}</h2>
              <RatingBreakdown breakdown={breakdown} />
              {reviews.length ? (
                <div className="mt-6">
                  <ReviewList reviews={reviews} showPractitioner replyLang={contentLocale} />
                </div>
              ) : null}
            </Card>
          </div>

          <div className="space-y-4">
            <h2 className="sr-only">{t("clinic.offices")}</h2>
            {clinic.locations.map((l) => (
              <Card key={l.id} className="overflow-hidden pb-5">
                <MapEmbed lat={l.lat} lng={l.lng} office={l.name} address={`${l.address}, ${l.postalCode ?? ""} ${l.city}`} />
                <div className="px-5 pt-4">
                  <h3 className="font-bold">{l.name}</h3>
                  <p className="mt-1 flex items-start gap-1.5 text-sm text-slate-600">
                    <MapPin size={14} className="mt-0.5 shrink-0" aria-hidden /> {l.address}, {l.postalCode} {l.city}
                  </p>
                  {l.phone ? (
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
                      <Phone size={14} aria-hidden /> {l.phone}
                    </p>
                  ) : null}
                  <div className="mt-3">
                    <AccessibilityList accessibility={l.accessibility} contentLocale={contentLocale} />
                  </div>
                  <LinkButton href={withRef(`/book/${clinic.org.slug}?location=${l.id}`)} size="sm" className="mt-4">
                    {t("clinic.bookHere")}
                  </LinkButton>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </ClientMessages>
  );
}
