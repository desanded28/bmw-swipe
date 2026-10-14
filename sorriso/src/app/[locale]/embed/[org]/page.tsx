import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { BookingFlow } from "@/components/booking/BookingFlow";
import { toLocale } from "@/i18n/config";
import { ClientMessages } from "@/i18n/ClientMessages";
import { APP_NAME } from "@/lib/config";
import { getPublicClinic } from "@/lib/directory";
import { isFramedRequest, processingContextFor, signPracticeRef } from "@/lib/privacy/context";
import { todayIn } from "@/lib/time";

export const dynamic = "force-dynamic";

/** Only for the practice's iframe: never a search result people land on outside the practice's site. */
export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Chrome-less booking flow loaded by /widget.js inside an iframe on the practice's own website.
 * Framed, it is the practice's own channel, so the practice is controller: the flow posts the
 * practice ref. Opened top-level (a search result, a shared link) it is a Sorriso-hosted page like
 * any other: marketplace, and the page hands out no practice ref (isFramedRequest).
 * The language comes from the URL only (/{locale}/embed/...): a cross-site iframe can't set cookies.
 */
export default async function EmbedPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; org: string }>;
  searchParams: Promise<{ service?: string; practitioner?: string; location?: string }>;
}) {
  const { locale: rawLocale, org } = await params;
  const locale = toLocale(rawLocale);
  const clinic = await getPublicClinic(org);
  if (!clinic) notFound();
  const sp = await searchParams;
  const framed = isFramedRequest(await headers());
  const practiceRef = framed ? signPracticeRef(clinic.org.id) : null;
  const context = processingContextFor({ source: "widget", viaApiKey: false, embedded: framed, practiceRef, orgId: clinic.org.id });
  return (
    <div className="min-h-dvh bg-white p-4 sm:p-6">
      <p className="mb-4 pr-10 text-lg font-bold">{clinic.org.name}</p>
      <ClientMessages locale={locale} ns={["consents"]}>
        <BookingFlow
          clinic={clinic}
          embedded
          today={todayIn(clinic.org.timezone)}
          context={context}
          practiceRef={practiceRef}
          initial={{ serviceId: sp.service, practitionerId: sp.practitioner, locationId: sp.location }}
        />
      </ClientMessages>
      <p className="mt-6 text-center text-[11px] text-slate-400">
        Powered by{" "}
        <a href="/" target="_blank" className="font-semibold hover:text-slate-600">
          {APP_NAME}
        </a>
      </p>
    </div>
  );
}
