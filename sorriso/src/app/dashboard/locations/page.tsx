import { and, asc, eq, gt, inArray } from "drizzle-orm";
import type { Metadata } from "next";
import { saveLocation } from "@/app/dashboard/actions";
import { ActionForm } from "@/components/dashboard/ActionForm";
import { RoomManager } from "@/components/dashboard/RoomManager";
import { TimeOffForm, TimeOffList } from "@/components/dashboard/TimeOff";
import { Badge, Card, Field, Input, PageHeader } from "@/components/ui";
import { db } from "@/db";
import { locations, rooms, timeOff, type Location } from "@/db/schema";
import { MANAGERS, requireStaff } from "@/lib/auth";
import { todayIn } from "@/lib/time";

export const metadata: Metadata = { title: "Offices & chairs" };

function LocationFields({ l }: { l?: Location }) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Office name">
          <Input name="name" defaultValue={l?.name} placeholder="Milano Centro" required />
        </Field>
        <Field label="Phone">
          <Input name="phone" defaultValue={l?.phone ?? ""} type="tel" />
        </Field>
        <Field label="Address">
          <Input name="address" defaultValue={l?.address} required />
        </Field>
        <div className="grid grid-cols-[1fr_100px] gap-3">
          <Field label="City">
            <Input name="city" defaultValue={l?.city} required />
          </Field>
          <Field label="CAP">
            <Input name="postalCode" defaultValue={l?.postalCode ?? ""} />
          </Field>
        </div>
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={l?.active ?? true} className="h-4 w-4 accent-brand-700" /> Open for bookings
      </label>
    </>
  );
}

export default async function LocationsPage() {
  const s = await requireStaff();
  const canManage = MANAGERS.includes(s.role);
  const locs = await db.select().from(locations).where(eq(locations.orgId, s.org.id)).orderBy(asc(locations.name));
  const ids = locs.map((l) => l.id);
  const [roomRows, closures] = await Promise.all([
    ids.length ? db.select().from(rooms).where(inArray(rooms.locationId, ids)).orderBy(asc(rooms.name)) : [],
    ids.length
      ? db.select().from(timeOff).where(and(inArray(timeOff.locationId, ids), gt(timeOff.endsAt, new Date()))).orderBy(asc(timeOff.startsAt))
      : [],
  ]);
  const today = todayIn(s.org.timezone);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Offices & chairs" description="Each office has its own chairs. A booking needs a free chair, so two dentists can't be booked into one chair at the same time." />
      <div className="space-y-6">
        {locs.map((l) => {
          const lRooms = roomRows.filter((r) => r.locationId === l.id);
          return (
            <Card key={l.id} className="p-6">
              <div className="mb-4 flex items-center gap-2">
                <h2 className="text-lg font-bold">{l.name}</h2>
                <Badge>{lRooms.filter((r) => r.active).length} chairs</Badge>
                {!l.active ? <Badge tone="red">Closed</Badge> : null}
              </div>
              <div className="grid gap-6 lg:grid-cols-2">
                <div>
                  {canManage ? (
                    <ActionForm action={saveLocation.bind(null, l.id)}>
                      <LocationFields l={l} />
                    </ActionForm>
                  ) : (
                    <p className="text-sm text-slate-600">
                      {l.address}, {l.postalCode} {l.city}
                    </p>
                  )}
                </div>
                <div className="space-y-5">
                  <div>
                    <p className="mb-2 text-sm font-bold">Chairs</p>
                    {canManage ? <RoomManager locationId={l.id} rooms={lRooms.map((r) => ({ id: r.id, name: r.name, active: r.active }))} /> : null}
                  </div>
                  <div>
                    <p className="mb-1 text-sm font-bold">Closures</p>
                    <TimeOffList items={closures.filter((c) => c.locationId === l.id)} tz={s.org.timezone} label={(t) => (t.roomId ? lRooms.find((r) => r.id === t.roomId)?.name ?? "Chair" : "Whole office")} />
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm font-semibold text-brand-700">Close office / chair for a period…</summary>
                      <div className="mt-3">
                        <TimeOffForm today={today} scopes={[{ value: `location:${l.id}`, label: "Whole office" }, ...lRooms.map((r) => ({ value: `room:${r.id}`, label: `${r.name} out of service` }))]} />
                      </div>
                    </details>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
        {canManage ? (
          <Card className="p-6">
            <h2 className="mb-4 text-lg font-bold">Add an office</h2>
            <ActionForm action={saveLocation.bind(null, null)} submitLabel="Add office">
              <LocationFields />
            </ActionForm>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
