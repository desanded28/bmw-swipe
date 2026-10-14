import { and, desc, eq, inArray } from "drizzle-orm";
import { Hourglass, Lock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { removeWaitlistEntry } from "@/app/dashboard/actions/waitlist";
import { ActionButton } from "@/components/dashboard/ActionButton";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { db } from "@/db";
import { locations, patients, practitioners, services, waitlist } from "@/db/schema";
import { fmtDay } from "@/i18n/datefmt";
import { getStaffLocale, getT } from "@/i18n/server";
import { auditListView } from "@/lib/dashboard";
import { fullName, practitionerName } from "@/lib/format";
import { can, requirePermission } from "@/lib/permissions";
import { formatPhone } from "@/lib/phone";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getStaffLocale(), "dashboard")("waitlist.title") };
}

/**
 * The waitlist (calendar.read). Contacts only with patient.contact.read, the patient's note only
 * with appointment.notes.read. A restricted (Art. 18) or erased patient shows no contacts and no
 * note to anyone, only the name (a placeholder without patient.restricted.read) and a way to the
 * patient record, which asks for a reason. Showing the list is recorded in the access log
 * (patient.view, count).
 */
export default async function WaitlistPage() {
  const s = await requirePermission("calendar.read");
  const locale = await getStaffLocale();
  const t = getT(locale, "dashboard");
  const tc = getT(locale, "calendar");
  const seeContacts = can(s.role, "patient.contact.read");
  const seeNotes = can(s.role, "appointment.notes.read");
  const seeRestricted = can(s.role, "patient.restricted.read");
  const openRecords = seeRestricted && can(s.role, "patient.read");
  const canWrite = can(s.role, "appointment.write");
  const rows = await db
    .select({
      w: {
        id: waitlist.id,
        status: waitlist.status,
        earliestDate: waitlist.earliestDate,
        latestDate: waitlist.latestDate,
        partOfDay: waitlist.partOfDay,
        offersSent: waitlist.offersSent,
      },
      patient: {
        id: patients.id,
        firstName: patients.firstName,
        lastName: patients.lastName,
        phone: patients.phone,
        email: patients.email,
        restrictedAt: patients.restrictedAt,
        erasedAt: patients.erasedAt,
      },
      service: { name: services.name },
      practitioner: { title: practitioners.title, name: practitioners.name },
      location: { name: locations.name },
    })
    .from(waitlist)
    .innerJoin(patients, eq(patients.id, waitlist.patientId))
    .innerJoin(services, eq(services.id, waitlist.serviceId))
    .leftJoin(practitioners, eq(practitioners.id, waitlist.practitionerId))
    .leftJoin(locations, eq(locations.id, waitlist.locationId))
    .where(and(eq(waitlist.orgId, s.org.id), eq(patients.orgId, s.org.id)))
    .orderBy(desc(waitlist.createdAt))
    .limit(100);
  const active = rows.filter((r) => r.w.status === "active");
  const booked = rows.filter((r) => r.w.status === "booked");
  const restricted = (p: (typeof rows)[number]["patient"]) => Boolean(p.restrictedAt || p.erasedAt);
  const masked = (p: (typeof rows)[number]["patient"]) => restricted(p) && !seeRestricted;
  const nameOf = (p: (typeof rows)[number]["patient"]) =>
    masked(p) ? (p.erasedAt ? tc("erasedPatient") : tc("restrictedPatient")) : fullName(p);

  // Notes are fetched separately, only for viewers who may read them and only for the entries of
  // unrestricted patients shown here (decrypting nothing else).
  const notes = new Map<string, string>();
  const noteIds = seeNotes ? active.filter((r) => !restricted(r.patient)).map((r) => r.w.id) : [];
  if (noteIds.length) {
    const noteRows = await db
      .select({ id: waitlist.id, note: waitlist.note })
      .from(waitlist)
      .where(and(eq(waitlist.orgId, s.org.id), inArray(waitlist.id, noteIds)));
    for (const r of noteRows) if (r.note) notes.set(r.id, r.note);
  }
  await auditListView(s, "waitlist", rows.length, "patient.view");

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={t("waitlist.title")} description={t("waitlist.description")} />
      {active.length === 0 ? (
        <EmptyState icon={<Hourglass size={28} />} title={t("waitlist.emptyTitle")}>
          {t("waitlist.emptyBody")}
        </EmptyState>
      ) : (
        <Card>
          <ul className="divide-y divide-slate-100" aria-label={t("waitlist.waiting")}>
            {active.map(({ w, patient, service, practitioner, location }) => {
              const locked = restricted(patient);
              const note = locked ? undefined : notes.get(w.id);
              return (
                <li key={w.id} className="flex flex-wrap items-center gap-4 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 font-semibold">
                      {locked ? <Lock size={14} className="text-amber-700" aria-hidden /> : null}
                      {nameOf(patient)}
                    </p>
                    {locked ? (
                      <p className="text-xs text-amber-900">
                        {t("waitlist.restricted")}{" "}
                        {openRecords && !patient.erasedAt ? (
                          <Link href={`/dashboard/patients/${patient.id}`} className="font-semibold underline">
                            {t("waitlist.openRecord")}
                          </Link>
                        ) : null}
                      </p>
                    ) : seeContacts ? (
                      <p className="text-xs text-slate-600">{[formatPhone(patient.phone), patient.email].filter(Boolean).join(" · ")}</p>
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-medium">{service.name}</p>
                    <p className="text-xs text-slate-600">
                      {t("waitlist.preference", {
                        practitioner: practitioner ? practitionerName(practitioner) : t("waitlist.anyPractitioner"),
                        office: location ? location.name : t("waitlist.anyOffice"),
                      })}
                    </p>
                  </div>
                  <div className="text-sm">
                    <p className="font-medium">{t("waitlist.window", { from: fmtDay(w.earliestDate, "short", locale), to: fmtDay(w.latestDate, "short", locale) })}</p>
                    <p className="text-xs text-slate-600">{t(`waitlist.partOfDay.${w.partOfDay}`)}</p>
                  </div>
                  <Badge tone={w.offersSent ? "blue" : "slate"}>{t("waitlist.offers", { count: w.offersSent })}</Badge>
                  {canWrite ? (
                    <ActionButton action={removeWaitlistEntry.bind(null, w.id)} variant="ghost" confirm={t("waitlist.removeConfirm")}>
                      {t("waitlist.remove")}
                    </ActionButton>
                  ) : null}
                  {note ? <p className="basis-full text-xs text-slate-600 [overflow-wrap:anywhere]">{t("waitlist.note", { note })}</p> : null}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
      {booked.length ? (
        <section aria-labelledby="waitlist-booked">
          <h2 id="waitlist-booked" className="mb-2 mt-8 font-bold">
            {t("waitlist.booked")}
          </h2>
          <Card>
            <ul className="divide-y divide-slate-100">
              {booked.map(({ w, patient, service }) => (
                <li key={w.id} className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
                  <span className="font-semibold">{nameOf(patient)}</span>
                  <span className="text-slate-600">{service.name}</span>
                  <Badge tone="green">{t("waitlist.bookedBadge")}</Badge>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}
    </div>
  );
}
