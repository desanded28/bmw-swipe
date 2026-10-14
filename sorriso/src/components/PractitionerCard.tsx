"use client";

import { BadgeCheck, Info, Languages, MapPin } from "lucide-react";
import Link from "next/link";
import type { Locale } from "@/db/enums";
import { fmtRelativeDay, fmtTime, zonedDate } from "@/i18n/datefmt";
import { lhref } from "@/i18n/href";
import { formatDecimal, formatMoney } from "@/i18n/number";
import { useLocale, useT } from "@/i18n/provider";
import type { SearchResult } from "@/lib/directory";
import { practitionerName } from "@/lib/format";
import { RankReasons } from "./marketplace/RankReasons";
import { Avatar, Badge, Card, Stars } from "./ui";

const DAYS_SHOWN = 3;
const PER_DAY = 4;

/**
 * The booking page for a result (and a slot). Sorriso-hosted, so the booking is a marketplace
 * booking: no ?via marker is needed (the server decides the context; a practice ref is never
 * added here).
 */
export function bookHref(
  locale: Locale,
  r: Pick<SearchResult, "org" | "practitioner" | "featuredService">,
  slot?: { start: Date; locationId: string },
): string {
  const params = new URLSearchParams({ practitioner: r.practitioner.id, service: r.featuredService.id });
  if (slot) {
    params.set("location", slot.locationId);
    params.set("start", slot.start.toISOString());
  }
  return lhref(locale, `/book/${r.org.slug}?${params}`);
}

/** One search result: who, where, rating, price, the next free times, and why it ranks here. */
export function PractitionerCard({ result, headingLevel = 2 }: { result: SearchResult; headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 3 ? "h3" : "h2";
  const t = useT("marketplace");
  const tc = useT("common");
  const ta = useT("a11y");
  const locale = useLocale();
  const { org, practitioner, locations, rating, slots, featuredService, priceFrom } = result;
  const tz = org.timezone;
  const today = result.today ?? zonedDate(slots[0]?.start ?? new Date(0), tz);
  const byDay = new Map<string, typeof slots>();
  for (const s of slots) {
    const day = zonedDate(s.start, tz);
    if (!byDay.has(day) && byDay.size >= DAYS_SHOWN) continue;
    byDay.set(day, [...(byDay.get(day) ?? []), s]);
  }
  const profile = lhref(locale, `/c/${org.slug}/${practitioner.slug}`);
  const name = practitionerName(practitioner);
  const average = rating ? formatDecimal(rating.average, locale, 1) : null;
  const languages = (practitioner.spokenLanguages ?? []).map((l) => tc(`languages.${l}`));

  return (
    <Card className="p-5">
      <article className="grid gap-5 md:grid-cols-[1fr_1.15fr]" aria-labelledby={`result-${practitioner.id}`}>
        <div className="flex gap-4">
          <Link href={profile} tabIndex={-1} aria-hidden>
            <Avatar name={practitioner.name} color={practitioner.color} size={64} />
          </Link>
          <div className="min-w-0">
            <Heading id={`result-${practitioner.id}`} className="text-lg font-bold text-ink">
              <Link href={profile} className="hover:underline">
                {name}
              </Link>
            </Heading>
            <p className="text-sm font-medium text-slate-600">{practitioner.specialty}</p>
            {practitioner.alboVerified ? (
              <p className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                <BadgeCheck size={13} aria-hidden /> {t("card.alboVerified")}
              </p>
            ) : null}
            {rating && average ? (
              <div className="mt-1 flex items-center gap-1.5 text-sm">
                <Stars value={rating.average} label={ta("rating.stars", { rating: average })} />
                <span className="font-semibold">{average}</span>
                <span className="text-slate-600">{t("card.reviews", { count: rating.count })}</span>
                <Link
                  href={lhref(locale, "/legal/reviews")}
                  className="rounded text-slate-500 hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-brand-600"
                  aria-label={t("card.howWeVerify")}
                  title={t("card.howWeVerify")}
                >
                  <Info size={13} aria-hidden />
                </Link>
              </div>
            ) : (
              <p className="mt-1 text-xs text-slate-500">{t("card.noReviews")}</p>
            )}
            <Link href={lhref(locale, `/c/${org.slug}`)} className="mt-2 block text-sm font-semibold text-brand-700 hover:underline">
              {org.name}
            </Link>
            {locations.slice(0, 2).map((l) => (
              <p key={l.id} className="mt-1 flex items-start gap-1.5 text-sm text-slate-600">
                <MapPin size={14} className="mt-0.5 shrink-0" aria-hidden />
                {l.address}, {l.city}
              </p>
            ))}
            {languages.length ? (
              <p className="mt-1 flex items-start gap-1.5 text-sm text-slate-600">
                <Languages size={14} className="mt-0.5 shrink-0" aria-hidden />
                {t("card.speaks", { languages: languages.join(", ") })}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Badge tone="brand">{featuredService.name}</Badge>
              {priceFrom != null ? <Badge>{priceFrom === 0 ? tc("price.free") : tc("price.from", { price: formatMoney(priceFrom, locale) })}</Badge> : null}
              {practitioner.acceptsNewPatients ? (
                <Badge tone="green">
                  <BadgeCheck size={12} aria-hidden /> {t("card.newPatients")}
                </Badge>
              ) : null}
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-slate-50 p-3">
          {byDay.size === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 py-6 text-center text-sm text-slate-600">
              {t("card.noAvailability")}
              <Link href={bookHref(locale, result)} className="font-semibold text-brand-700 hover:underline">
                {t("card.laterDates")}
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2" role="group" aria-label={t("card.availability")}>
              {[...byDay.entries()].map(([day, daySlots]) => {
                const dayLabel = fmtRelativeDay(day, today, locale);
                return (
                  <div key={day}>
                    <p className="mb-1.5 text-center text-xs font-bold text-slate-600">{dayLabel}</p>
                    <ul className="flex flex-col gap-1.5">
                      {daySlots.slice(0, PER_DAY).map((s) => (
                        <li key={s.start.toISOString()}>
                          <Link
                            href={bookHref(locale, result, s)}
                            aria-label={t("card.slotLabel", { day: dayLabel, time: fmtTime(s.start, tz) })}
                            className="block rounded-lg bg-white py-1.5 text-center text-sm font-semibold text-brand-800 ring-1 ring-brand-200 hover:bg-brand-700 hover:text-white"
                          >
                            {fmtTime(s.start, tz)}
                          </Link>
                        </li>
                      ))}
                      {daySlots.length > PER_DAY ? (
                        <li>
                          <Link href={bookHref(locale, result)} className="block text-center text-xs font-semibold text-slate-600 hover:text-ink">
                            {t("card.more", { count: daySlots.length - PER_DAY })}
                          </Link>
                        </li>
                      ) : null}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="md:col-span-2">
          <RankReasons reasons={result.rank?.reasons ?? []} />
        </div>
      </article>
    </Card>
  );
}
