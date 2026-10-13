import { CalendarCheck, Globe, Mail, MapPin, Navigation, Phone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReviewList } from "@/components/ReviewList";
import { Avatar, Badge, Card, LinkButton, Stars } from "@/components/ui";
import { getPublicClinic, getPublicReviews } from "@/lib/directory";
import { CATEGORY_LABELS, formatPrice, practitionerName } from "@/lib/format";

export const dynamic = "force-dynamic";

type Params = Promise<{ org: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const clinic = await getPublicClinic((await params).org);
  return clinic ? { title: clinic.org.name, description: clinic.org.description ?? undefined } : {};
}

export default async function ClinicPage({ params }: { params: Params }) {
  const clinic = await getPublicClinic((await params).org);
  if (!clinic) notFound();
  const reviews = await getPublicReviews(clinic.org.id);
  const rated = clinic.practitioners.filter((p) => p.rating);
  const totalReviews = rated.reduce((n, p) => n + p.rating!.count, 0);
  const average = totalReviews ? rated.reduce((n, p) => n + p.rating!.average * p.rating!.count, 0) / totalReviews : 0;
  const color = clinic.org.brandColor;

  return (
    <div>
      <div className="h-28 sm:h-36" style={{ background: `linear-gradient(120deg, ${color}, color-mix(in srgb, ${color} 55%, #0b1324))` }} />
      <div className="mx-auto -mt-14 max-w-6xl px-4">
        <Card className="p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="flex items-start gap-5">
              <Avatar name={clinic.org.name} color={color} size={76} className="ring-4 ring-white" />
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{clinic.org.name}</h1>
                {totalReviews ? (
                  <div className="mt-1 flex items-center gap-2 text-sm">
                    <Stars value={average} />
                    <span className="font-semibold">{average.toFixed(1)}</span>
                    <span className="text-slate-500">{totalReviews} verified reviews</span>
                  </div>
                ) : null}
                <p className="mt-2 max-w-2xl text-slate-600">{clinic.org.description}</p>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-600">
                  {clinic.org.phone ? (
                    <a href={`tel:${clinic.org.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1.5 hover:text-ink">
                      <Phone size={14} /> {clinic.org.phone}
                    </a>
                  ) : null}
                  {clinic.org.email ? (
                    <a href={`mailto:${clinic.org.email}`} className="inline-flex items-center gap-1.5 hover:text-ink">
                      <Mail size={14} /> {clinic.org.email}
                    </a>
                  ) : null}
                  {clinic.org.website ? (
                    <a href={clinic.org.website} className="inline-flex items-center gap-1.5 hover:text-ink" rel="noreferrer" target="_blank">
                      <Globe size={14} /> Website
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
            <LinkButton href={`/book/${clinic.org.slug}`} size="lg">
              <CalendarCheck size={18} /> Book online
            </LinkButton>
          </div>
        </Card>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            <Card className="p-6">
              <h2 className="mb-4 text-lg font-bold">Our team</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {clinic.practitioners.map((p) => (
                  <div key={p.id} className="flex gap-3 rounded-xl p-3 ring-1 ring-slate-200">
                    <Avatar name={p.name} color={p.color} size={48} />
                    <div className="min-w-0 flex-1">
                      <Link href={`/c/${clinic.org.slug}/${p.slug}`} className="font-bold hover:underline">
                        {practitionerName(p)}
                      </Link>
                      <p className="text-sm text-slate-500">{p.specialty}</p>
                      {p.rating ? (
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                          <Stars value={p.rating.average} size={12} /> {p.rating.average.toFixed(1)} ({p.rating.count})
                        </p>
                      ) : null}
                      <p className="mt-1 text-xs text-slate-500">
                        {p.locationIds.map((id) => clinic.locations.find((l) => l.id === id)?.name).filter(Boolean).join(" · ")}
                      </p>
                      <Link
                        href={`/book/${clinic.org.slug}?practitioner=${p.id}`}
                        className="mt-2 inline-block text-sm font-semibold text-brand-700 hover:underline"
                      >
                        Book with {p.title ? `${p.title} ` : ""}{p.name.split(" ").slice(-1)[0]} →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="mb-4 text-lg font-bold">Treatments & prices</h2>
              <div className="divide-y divide-slate-100">
                {clinic.services.map((s) => (
                  <div key={s.id} className="flex items-start justify-between gap-4 py-3 first:pt-0">
                    <div>
                      <p className="font-semibold">{s.name}</p>
                      <p className="text-sm text-slate-500">{s.description}</p>
                      <Badge className="mt-1.5">{CATEGORY_LABELS[s.category]}</Badge>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-bold">{formatPrice(s.priceCents)}</p>
                      <p className="text-xs text-slate-500">{s.durationMinutes} min</p>
                      <Link href={`/book/${clinic.org.slug}?service=${s.id}`} className="text-xs font-semibold text-brand-700 hover:underline">
                        Book
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="mb-4 text-lg font-bold">Patient reviews</h2>
              {reviews.length ? (
                <ReviewList reviews={reviews} showPractitioner />
              ) : (
                <p className="text-sm text-slate-500">No reviews yet.</p>
              )}
              <p className="mt-4 text-xs text-slate-400">
                Reviews can only be written by patients after a completed visit booked through {clinic.org.name}.
              </p>
            </Card>
          </div>

          <div className="space-y-4">
            {clinic.locations.map((l) => (
              <Card key={l.id} className="overflow-hidden">
                {l.lat && l.lng ? (
                  <iframe
                    title={`Map of ${l.name}`}
                    className="h-40 w-full border-0"
                    loading="lazy"
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${l.lng - 0.006},${l.lat - 0.003},${l.lng + 0.006},${l.lat + 0.003}&layer=mapnik&marker=${l.lat},${l.lng}`}
                  />
                ) : null}
                <div className="p-5">
                  <p className="font-bold">{l.name}</p>
                  <p className="mt-1 flex items-start gap-1.5 text-sm text-slate-600">
                    <MapPin size={14} className="mt-0.5 shrink-0" /> {l.address}, {l.postalCode} {l.city}
                  </p>
                  {l.phone ? (
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
                      <Phone size={14} /> {l.phone}
                    </p>
                  ) : null}
                  <div className="mt-3 flex gap-2">
                    <LinkButton href={`/book/${clinic.org.slug}?location=${l.id}`} size="sm">
                      Book here
                    </LinkButton>
                    <a
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                      target="_blank"
                      rel="noreferrer"
                      href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${l.address}, ${l.city}`)}`}
                    >
                      <Navigation size={13} /> Directions
                    </a>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
