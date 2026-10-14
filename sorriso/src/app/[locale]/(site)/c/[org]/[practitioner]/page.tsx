import { Languages, MapPin } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookingFlow } from "@/components/booking/BookingFlow";
import { ReviewList } from "@/components/ReviewList";
import { Avatar, Badge, Card, Stars } from "@/components/ui";
import { getPublicClinic, getPublicReviews } from "@/lib/directory";
import { practitionerName } from "@/lib/format";
import { todayIn } from "@/lib/time";

export const dynamic = "force-dynamic";

type Params = Promise<{ org: string; practitioner: string }>;

async function load(params: Params) {
  const { org, practitioner } = await params;
  const clinic = await getPublicClinic(org);
  const p = clinic?.practitioners.find((x) => x.slug === practitioner);
  return clinic && p ? { clinic, p } : null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const data = await load(params);
  return data ? { title: `${practitionerName(data.p)} — ${data.p.specialty}` } : {};
}

export default async function PractitionerPage({ params }: { params: Params }) {
  const data = await load(params);
  if (!data) notFound();
  const { clinic, p } = data;
  const reviews = await getPublicReviews(clinic.org.id, p.id);
  const locs = clinic.locations.filter((l) => p.locationIds.includes(l.id));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link href={`/c/${clinic.org.slug}`} className="text-sm font-semibold text-slate-500 hover:text-ink">
        ← {clinic.org.name}
      </Link>
      <div className="mt-4 grid gap-6 lg:grid-cols-[340px_1fr]">
        <div className="space-y-4">
          <Card className="p-6 text-center">
            <Avatar name={p.name} color={p.color} size={96} className="mx-auto" />
            <h1 className="mt-4 text-2xl font-extrabold tracking-tight">{practitionerName(p)}</h1>
            <p className="text-slate-600">{p.specialty}</p>
            {p.rating ? (
              <div className="mt-2 flex items-center justify-center gap-2 text-sm">
                <Stars value={p.rating.average} />
                <span className="font-semibold">{p.rating.average.toFixed(1)}</span>
                <span className="text-slate-500">({p.rating.count})</span>
              </div>
            ) : null}
            {p.acceptsNewPatients ? (
              <Badge tone="green" className="mt-3">
                Accepting new patients
              </Badge>
            ) : (
              <Badge tone="amber" className="mt-3">
                Existing patients only
              </Badge>
            )}
          </Card>
          <Card className="space-y-3 p-5 text-sm">
            {p.bio ? <p className="text-slate-700">{p.bio}</p> : null}
            <p className="flex items-center gap-2 text-slate-600">
              <Languages size={15} /> {p.languages}
            </p>
            {locs.map((l) => (
              <p key={l.id} className="flex items-start gap-2 text-slate-600">
                <MapPin size={15} className="mt-0.5 shrink-0" />
                <span>
                  <span className="font-semibold text-slate-800">{l.name}</span> — {l.address}, {l.city}
                </span>
              </p>
            ))}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="mb-4 text-lg font-bold">Book with {practitionerName(p)}</h2>
            <BookingFlow clinic={clinic} initial={{ practitionerId: p.id }} today={todayIn(clinic.org.timezone)} />
          </Card>
          <Card className="p-6">
            <h2 className="mb-4 text-lg font-bold">Reviews</h2>
            {reviews.length ? <ReviewList reviews={reviews} /> : <p className="text-sm text-slate-500">No reviews yet.</p>}
          </Card>
        </div>
      </div>
    </div>
  );
}
