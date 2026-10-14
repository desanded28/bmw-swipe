import { and, desc, eq } from "drizzle-orm";
import { Hourglass } from "lucide-react";
import type { Metadata } from "next";
import { removeWaitlistEntry } from "@/app/dashboard/actions/waitlist";
import { ActionButton } from "@/components/dashboard/ActionButton";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { db } from "@/db";
import { locations, patients, practitioners, services, waitlist } from "@/db/schema";
import { requireStaff } from "@/lib/auth";
import { fmtDay } from "@/lib/datefmt";
import { fullName, practitionerName } from "@/lib/format";
import { formatPhone } from "@/lib/phone";

export const metadata: Metadata = { title: "Waitlist" };

export default async function WaitlistPage() {
  const s = await requireStaff();
  const rows = await db
    .select({ w: waitlist, patient: patients, service: services, practitioner: practitioners, location: locations })
    .from(waitlist)
    .innerJoin(patients, eq(patients.id, waitlist.patientId))
    .innerJoin(services, eq(services.id, waitlist.serviceId))
    .leftJoin(practitioners, eq(practitioners.id, waitlist.practitionerId))
    .leftJoin(locations, eq(locations.id, waitlist.locationId))
    .where(and(eq(waitlist.orgId, s.org.id)))
    .orderBy(desc(waitlist.createdAt))
    .limit(100);
  const active = rows.filter((r) => r.w.status === "active");
  const booked = rows.filter((r) => r.w.status === "booked");

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Waitlist"
        description="When an appointment is cancelled or moved, the slot is offered to up to 3 matching patients by SMS/WhatsApp/email. The first one to book gets it."
      />
      {active.length === 0 ? (
        <EmptyState icon={<Hourglass size={28} />} title="Nobody is waiting">
          Patients can join from the booking page when no time suits them.
        </EmptyState>
      ) : (
        <Card className="divide-y divide-slate-100">
          {active.map(({ w, patient, service, practitioner, location }) => (
            <div key={w.id} className="flex flex-wrap items-center gap-4 p-4">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{fullName(patient)}</p>
                <p className="text-xs text-slate-500">{[formatPhone(patient.phone), patient.email].filter(Boolean).join(" · ")}</p>
              </div>
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-medium">{service.name}</p>
                <p className="text-xs text-slate-500">
                  {practitioner ? practitionerName(practitioner) : "Any practitioner"} · {location ? location.name : "any office"}
                </p>
              </div>
              <div className="text-sm">
                <p className="font-medium">
                  {fmtDay(w.earliestDate, "short")} – {fmtDay(w.latestDate, "short")}
                </p>
                <p className="text-xs text-slate-500">{w.partOfDay === "any" ? "any time" : `${w.partOfDay}s`}</p>
              </div>
              <Badge tone={w.offersSent ? "blue" : "slate"}>{w.offersSent} offer{w.offersSent === 1 ? "" : "s"} sent</Badge>
              <ActionButton action={removeWaitlistEntry.bind(null, w.id)} variant="ghost" confirm="Remove from waitlist?">
                Remove
              </ActionButton>
              {w.note ? <p className="basis-full text-xs text-slate-500">“{w.note}”</p> : null}
            </div>
          ))}
        </Card>
      )}
      {booked.length ? (
        <>
          <h2 className="mb-2 mt-8 font-bold">Recently booked from the waitlist</h2>
          <Card className="divide-y divide-slate-100">
            {booked.map(({ w, patient, service }) => (
              <div key={w.id} className="flex items-center justify-between p-4 text-sm">
                <span className="font-semibold">{fullName(patient)}</span>
                <span className="text-slate-500">{service.name}</span>
                <Badge tone="green">Booked</Badge>
              </div>
            ))}
          </Card>
        </>
      ) : null}
    </div>
  );
}
