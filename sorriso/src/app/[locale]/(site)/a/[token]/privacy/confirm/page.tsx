import { CalendarClock, FileText, LinkIcon } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { AdultConfirmForm } from "@/components/privacy/AdultConfirmForm";
import { Card } from "@/components/ui";
import { toLocale } from "@/i18n/config";
import { ClientMessages } from "@/i18n/ClientMessages";
import { fmtWhen } from "@/i18n/datefmt";
import { lhref } from "@/i18n/href";
import { getT } from "@/i18n/server";
import { getAppointmentDetails } from "@/lib/appointments";
import { adultConfirmationDeadline, adultContactChoices, awaitsAdultConfirmation } from "@/lib/privacy/adult-confirmation";
import { rateLimitByIp } from "@/lib/rate-limit";
import { adultConfirmAction } from "../actions";

export const dynamic = "force-dynamic";

type Params = Promise<{ locale: string; token: string }>;

const TOKEN_SHAPE = /^[A-Za-z0-9_-]{8,128}$/;

/** Generic on purpose: link previews must name neither practice nor patient. */
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const locale = toLocale((await params).locale);
  return { title: getT(locale, "privacy")("confirm.meta.title"), robots: { index: false, follow: false, nocache: true }, referrer: "no-referrer" };
}

/**
 * Where an adult confirms a marketplace booking someone else made for them (critique 2): the page
 * shows who booked, where and when, Sorriso's notice and the Art. 9(2)(a) consent, unticked. Its
 * address carries the appointment link, which the booker also has, so nothing can be decided here
 * without a one-time code sent to the adult's own phone or email (never the booker's). Opening it
 * changes nothing; confirming or cancelling is an explicit POST (src/lib/privacy/adult-confirmation.ts).
 */
export default async function ConfirmForAdultPage({ params }: { params: Params }) {
  const { locale: raw, token } = await params;
  const locale = toLocale(raw);
  const t = getT(locale, "privacy");
  const limit = await rateLimitByIp(await headers(), "patient-link", 30, 10 * 60_000);
  const d = limit.ok && TOKEN_SHAPE.test(token) ? await getAppointmentDetails({ token }) : null;
  const waiting = d ? await awaitsAdultConfirmation(d.appointment) : false;

  if (!d || !waiting) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-600" aria-hidden>
          <LinkIcon size={26} />
        </div>
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight">{t("confirm.meta.title")}</h1>
        <p className="mt-2 text-slate-600">{t("confirm.notWaiting")}</p>
        {d ? (
          <Link href={lhref(locale, `/a/${token}`)} className="mt-4 inline-block font-semibold text-brand-700 underline underline-offset-2">
            {getT(locale, "manage")("meta.title")}
          </Link>
        ) : null}
      </div>
    );
  }

  const tz = d.location.timezone;
  const deadline = adultConfirmationDeadline(d.appointment);
  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <Card className="p-6 sm:p-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-700" aria-hidden>
          <CalendarClock size={22} />
        </div>
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight">{t("confirm.title")}</h1>
        <p className="mt-2 text-slate-700">
          {t("confirm.body", { booker: d.appointment.bookedByName ?? d.org.name, practice: d.org.name, when: fmtWhen(d.appointment.startsAt, tz, locale) })}
        </p>
        <p className="mt-2 text-sm text-slate-600">{t("confirm.explain", { deadline: fmtWhen(deadline, tz, locale) })}</p>
        <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <Link href={lhref(locale, "/legal/privacy")} className="inline-flex items-center gap-1 font-semibold text-brand-700 underline underline-offset-2">
            <FileText size={14} aria-hidden /> {t("booking.links.platform")}
          </Link>
          <Link href={lhref(locale, `/c/${d.org.slug}/privacy`)} className="inline-flex items-center gap-1 font-semibold text-brand-700 underline underline-offset-2">
            <FileText size={14} aria-hidden /> {t("linkPage.notice", { practice: d.org.name })}
          </Link>
        </p>
        <div className="mt-6">
          <ClientMessages locale={locale} ns={["privacy", "consents"]}>
            <AdultConfirmForm token={token} contacts={adultContactChoices(d)} action={adultConfirmAction} />
          </ClientMessages>
        </div>
      </Card>
    </div>
  );
}
