import { eq } from "drizzle-orm";
import { CalendarCheck, Clock, Hourglass, MapPin, Phone, Star, Stethoscope, XCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ManageAppointment } from "@/components/booking/ManageAppointment";
import { Avatar, Badge, Card, LinkButton } from "@/components/ui";
import { db } from "@/db";
import { reviews } from "@/db/schema";
import { appointmentLinks, canPatientCancel, canPatientReschedule, getAppointmentDetails, isLateCancellation } from "@/lib/appointments";
import { formatPrice, practitionerName } from "@/lib/format";
import { resolveSettings } from "@/lib/settings";
import { formatDate, formatTime, todayIn } from "@/lib/time";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your appointment", robots: { index: false } };

export default async function ManagePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ do?: string }>;
}) {
  const { token } = await params;
  const d = await getAppointmentDetails({ token });
  if (!d) notFound();
  const sp = await searchParams;
  const a = d.appointment;
  const tz = d.location.timezone;
  const settings = resolveSettings(d.org.settings);
  const [review] = await db.select({ id: reviews.id }).from(reviews).where(eq(reviews.appointmentId, a.id));
  const panel = sp.do === "confirm" || sp.do === "cancel" || sp.do === "reschedule" ? sp.do : null;

  const status =
    a.status === "cancelled" ? (
      <Badge tone="red">
        <XCircle size={12} /> Cancelled
      </Badge>
    ) : a.status === "requested" ? (
      <Badge tone="amber">
        <Hourglass size={12} /> Waiting for the practice to confirm
      </Badge>
    ) : a.status === "completed" ? (
      <Badge tone="slate">Completed</Badge>
    ) : a.status === "no_show" ? (
      <Badge tone="red">Missed</Badge>
    ) : a.confirmation === "confirmed" ? (
      <Badge tone="green">
        <CalendarCheck size={12} /> Booked & confirmed
      </Badge>
    ) : (
      <Badge tone="blue">Booked — please confirm</Badge>
    );

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <p className="text-sm font-semibold text-slate-500">Hi {d.patient.firstName},</p>
      <h1 className="mt-1 text-2xl font-extrabold tracking-tight">Your appointment at {d.org.name}</h1>
      <div className="mt-2">{status}</div>

      <Card className="mt-6 p-6">
        <div className="flex items-start gap-4">
          <Avatar name={d.practitioner.name} color={d.practitioner.color} size={52} />
          <div>
            <p className="text-lg font-bold">{practitionerName(d.practitioner)}</p>
            <p className="text-sm text-slate-500">{d.practitioner.specialty}</p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
          <p className="flex gap-2">
            <Clock size={16} className="mt-0.5 text-slate-400" />
            <span>
              <span className="block font-semibold capitalize">{formatDate(a.startsAt, tz, "en", "long")}</span>
              {formatTime(a.startsAt, tz)} – {formatTime(a.endsAt, tz)}
            </span>
          </p>
          <p className="flex gap-2">
            <Stethoscope size={16} className="mt-0.5 text-slate-400" />
            <span>
              <span className="block font-semibold">{d.service.name}</span>
              {formatPrice(d.service.priceCents)}
            </span>
          </p>
          <p className="flex gap-2">
            <MapPin size={16} className="mt-0.5 text-slate-400" />
            <span>
              <span className="block font-semibold">{d.location.name}</span>
              {d.location.address}, {d.location.city}
            </span>
          </p>
          {d.location.phone ?? d.org.phone ? (
            <p className="flex gap-2">
              <Phone size={16} className="mt-0.5 text-slate-400" />
              <a className="font-semibold text-brand-700" href={`tel:${(d.location.phone ?? d.org.phone)!.replace(/\s/g, "")}`}>
                {d.location.phone ?? d.org.phone}
              </a>
            </p>
          ) : null}
        </div>
      </Card>

      <div className="mt-6">
        <ManageAppointment
          initialPanel={panel}
          data={{
            token,
            status: a.status,
            confirmation: a.confirmation,
            start: a.startsAt.toISOString(),
            end: a.endsAt.toISOString(),
            timezone: tz,
            today: todayIn(tz),
            clinicSlug: d.org.slug,
            clinicName: d.org.name,
            clinicPhone: d.location.phone ?? d.org.phone,
            serviceId: d.service.id,
            serviceName: d.service.name,
            practitionerId: d.practitioner.id,
            practitionerName: practitionerName(d.practitioner),
            locationLabel: `${d.location.name}, ${d.location.address}, ${d.location.city}`,
            canCancel: canPatientCancel(d),
            canReschedule: canPatientReschedule(d),
            lateCancellation: isLateCancellation(d),
            cancelUntilHours: settings.booking.cancelUntilHours,
            maxAdvanceDays: settings.booking.maxAdvanceDays,
            icsUrl: appointmentLinks(d).icsUrl,
          }}
        />
      </div>

      {a.status === "completed" && !review ? (
        <Card className="mt-6 flex flex-wrap items-center justify-between gap-3 p-5">
          <p className="flex items-center gap-2 font-semibold">
            <Star size={18} className="text-amber-500" /> How was your visit?
          </p>
          <LinkButton href={`/a/${token}/review`}>Leave a review</LinkButton>
        </Card>
      ) : null}

      {a.status === "cancelled" || a.status === "completed" ? (
        <div className="mt-6">
          <LinkButton href={`/book/${d.org.slug}?service=${d.service.id}&practitioner=${d.practitioner.id}`} variant="secondary">
            Book another appointment
          </LinkButton>
        </div>
      ) : null}

      <p className="mt-10 text-center text-xs text-slate-400">
        Keep this link private — anyone with it can manage this appointment.{" "}
        <Link href={`/c/${d.org.slug}`} className="underline">
          {d.org.name}
        </Link>
      </p>
    </div>
  );
}
