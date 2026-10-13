import { BadgeCheck, MapPin } from "lucide-react";
import Link from "next/link";
import type { SearchResult } from "@/lib/directory";
import { formatPrice, practitionerName } from "@/lib/format";
import { formatTime, relativeDayLabel, todayIn, zonedParts } from "@/lib/time";
import { Avatar, Badge, Card, Stars } from "./ui";

const DAYS_SHOWN = 3;
const PER_DAY = 4;

export function bookHref(r: Pick<SearchResult, "org" | "practitioner" | "featuredService">, slot?: { start: Date; locationId: string }) {
  const params = new URLSearchParams({ practitioner: r.practitioner.id, service: r.featuredService.id });
  if (slot) {
    params.set("location", slot.locationId);
    params.set("start", slot.start.toISOString());
  }
  return `/book/${r.org.slug}?${params}`;
}

export function PractitionerCard({ result }: { result: SearchResult }) {
  const { org, practitioner, locations, rating, slots, featuredService, priceFrom } = result;
  const tz = org.timezone;
  const today = todayIn(tz);
  const byDay = new Map<string, typeof slots>();
  for (const s of slots) {
    const day = zonedParts(s.start, tz).date;
    if (!byDay.has(day) && byDay.size >= DAYS_SHOWN) continue;
    byDay.set(day, [...(byDay.get(day) ?? []), s]);
  }
  const profile = `/c/${org.slug}/${practitioner.slug}`;

  return (
    <Card className="grid gap-5 p-5 md:grid-cols-[1fr_1.15fr]">
      <div className="flex gap-4">
        <Link href={profile}>
          <Avatar name={practitioner.name} color={practitioner.color} size={64} />
        </Link>
        <div className="min-w-0">
          <Link href={profile} className="text-lg font-bold text-ink hover:underline">
            {practitionerName(practitioner)}
          </Link>
          <p className="text-sm font-medium text-slate-600">{practitioner.specialty}</p>
          {rating ? (
            <div className="mt-1 flex items-center gap-1.5 text-sm">
              <Stars value={rating.average} />
              <span className="font-semibold">{rating.average.toFixed(1)}</span>
              <span className="text-slate-500">({rating.count} verified)</span>
            </div>
          ) : (
            <p className="mt-1 text-xs text-slate-400">No reviews yet</p>
          )}
          <Link href={`/c/${org.slug}`} className="mt-2 block text-sm font-semibold text-brand-700 hover:underline">
            {org.name}
          </Link>
          {locations.slice(0, 2).map((l) => (
            <p key={l.id} className="mt-1 flex items-start gap-1.5 text-sm text-slate-500">
              <MapPin size={14} className="mt-0.5 shrink-0" />
              {l.address}, {l.city}
            </p>
          ))}
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Badge tone="brand">{featuredService.name}</Badge>
            {priceFrom != null ? <Badge>from {formatPrice(priceFrom)}</Badge> : null}
            {practitioner.acceptsNewPatients ? (
              <Badge tone="green">
                <BadgeCheck size={12} /> New patients
              </Badge>
            ) : null}
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-slate-50 p-3">
        {byDay.size === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 py-6 text-center text-sm text-slate-500">
            No online availability this week.
            <Link href={bookHref(result)} className="font-semibold text-brand-700 hover:underline">
              See later dates →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {[...byDay.entries()].map(([day, daySlots]) => (
              <div key={day}>
                <p className="mb-1.5 text-center text-xs font-bold text-slate-600">{relativeDayLabel(day, today)}</p>
                <div className="flex flex-col gap-1.5">
                  {daySlots.slice(0, PER_DAY).map((s) => (
                    <Link
                      key={s.start.toISOString()}
                      href={bookHref(result, s)}
                      className="rounded-lg bg-white py-1.5 text-center text-sm font-semibold text-brand-800 ring-1 ring-brand-200 hover:bg-brand-700 hover:text-white"
                    >
                      {formatTime(s.start, tz)}
                    </Link>
                  ))}
                  {daySlots.length > PER_DAY ? (
                    <Link href={bookHref(result)} className="text-center text-xs font-semibold text-slate-500 hover:text-ink">
                      +{daySlots.length - PER_DAY} more
                    </Link>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
