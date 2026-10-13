import { notFound } from "next/navigation";
import { BookingFlow } from "@/components/booking/BookingFlow";
import { APP_NAME } from "@/lib/config";
import { getPublicClinic } from "@/lib/directory";
import { todayIn } from "@/lib/time";

export const dynamic = "force-dynamic";

/** Chrome-less booking flow loaded by /widget.js inside an iframe on the practice's own website. */
export default async function EmbedPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<{ service?: string; practitioner?: string; location?: string }>;
}) {
  const clinic = await getPublicClinic((await params).org);
  if (!clinic) notFound();
  const sp = await searchParams;
  return (
    <div className="min-h-dvh bg-white p-4 sm:p-6">
      <p className="mb-4 pr-10 text-lg font-bold">{clinic.org.name}</p>
      <BookingFlow
        clinic={clinic}
        embedded
        today={todayIn(clinic.org.timezone)}
        initial={{ serviceId: sp.service, practitionerId: sp.practitioner, locationId: sp.location }}
      />
      <p className="mt-6 text-center text-[11px] text-slate-400">
        Powered by{" "}
        <a href="/" target="_blank" className="font-semibold hover:text-slate-600">
          {APP_NAME}
        </a>
      </p>
    </div>
  );
}
