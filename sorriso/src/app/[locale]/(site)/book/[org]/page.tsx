import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookingFlow } from "@/components/booking/BookingFlow";
import { Avatar, Card } from "@/components/ui";
import { getPublicClinic } from "@/lib/directory";
import { todayIn } from "@/lib/time";

export const dynamic = "force-dynamic";

type Params = Promise<{ org: string }>;
type SP = Promise<{ service?: string; practitioner?: string; location?: string; start?: string; wl?: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const clinic = await getPublicClinic((await params).org);
  return clinic ? { title: `Book — ${clinic.org.name}` } : {};
}

export default async function BookPage({ params, searchParams }: { params: Params; searchParams: SP }) {
  const clinic = await getPublicClinic((await params).org);
  if (!clinic) notFound();
  const sp = await searchParams;
  const start = sp.start && !Number.isNaN(Date.parse(sp.start)) ? sp.start : undefined;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link href={`/c/${clinic.org.slug}`} className="mb-5 flex items-center gap-3">
        <Avatar name={clinic.org.name} color={clinic.org.brandColor} size={40} />
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Book online</p>
          <p className="font-bold">{clinic.org.name}</p>
        </div>
      </Link>
      {sp.wl ? (
        <div className="mb-4 rounded-xl bg-brand-50 p-4 text-sm font-medium text-brand-800 ring-1 ring-brand-200">
          A slot from the waitlist is waiting for you — confirm your details below to grab it before someone else does.
        </div>
      ) : null}
      <Card className="p-5 sm:p-7">
        <BookingFlow
          clinic={clinic}
          today={todayIn(clinic.org.timezone)}
          initial={{
            serviceId: sp.service,
            practitionerId: sp.practitioner,
            locationId: sp.location,
            start,
            waitlistEntryId: sp.wl,
          }}
        />
      </Card>
    </div>
  );
}
