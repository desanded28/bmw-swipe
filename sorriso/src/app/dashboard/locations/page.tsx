import { and, asc, eq, gt, inArray } from "drizzle-orm";
import type { Metadata } from "next";
import { saveLocation } from "@/app/dashboard/actions/locations";
import { ActionForm } from "@/components/dashboard/ActionForm";
import { RoomManager } from "@/components/dashboard/RoomManager";
import { AdCheckedText } from "@/components/marketplace/AdCheckedText";
import { TimeOffForm, TimeOffList } from "@/components/dashboard/TimeOff";
import { Badge, Card, Field, Input, PageHeader } from "@/components/ui";
import { db } from "@/db";
import { locations, rooms, timeOff, type Location } from "@/db/schema";
import type { Locale } from "@/i18n/config";
import { getStaffLocale, getT } from "@/i18n/server";
import { ACCESS_FEATURES } from "@/lib/directory";
import { can, requirePermission } from "@/lib/permissions";
import { todayIn } from "@/lib/time";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getStaffLocale(), "catalog")("locations.metaTitle") };
}

/** The office form: address, accessibility features (only what is true) and directions. */
function LocationFields({ l, locale }: { l?: Location; locale: Locale }) {
  const t = getT(locale, "catalog");
  const tm = getT(locale, "marketplace");
  const a = l?.accessibility ?? {};
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("locations.name")}>
          <Input name="name" defaultValue={l?.name} placeholder={t("locations.namePlaceholder")} required maxLength={120} />
        </Field>
        <Field label={t("locations.phone")}>
          <Input name="phone" defaultValue={l?.phone ?? ""} type="tel" maxLength={30} />
        </Field>
        <Field label={t("locations.address")}>
          <Input name="address" defaultValue={l?.address} required maxLength={200} />
        </Field>
        <div className="grid grid-cols-[1fr_110px] gap-3">
          <Field label={t("locations.city")}>
            <Input name="city" defaultValue={l?.city} required maxLength={80} />
          </Field>
          <Field label={t("locations.postalCode")}>
            <Input name="postalCode" defaultValue={l?.postalCode ?? ""} maxLength={10} />
          </Field>
        </div>
      </div>
      <fieldset className="mt-4">
        <legend className="text-[13px] font-semibold text-slate-700">{t("locations.accessibility")}</legend>
        <p className="mb-2 text-xs text-slate-500">{t("locations.accessibilityHint")}</p>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {ACCESS_FEATURES.map((f) => (
            <label key={f} className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name={`access.${f}`} defaultChecked={a[f] === true} className="h-4 w-4 accent-brand-700" /> {tm(`access.${f}`)}
            </label>
          ))}
        </div>
      </fieldset>
      <Field label={t("locations.transit")} hint={t("locations.transitHint")} className="mt-3">
        {(control) => <AdCheckedText {...control} multiline name="transit" rows={2} maxLength={300} defaultValue={a.transit ?? ""} />}
      </Field>
      <label className="mt-3 flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={l?.active ?? true} className="h-4 w-4 accent-brand-700" /> {t("locations.open")}
      </label>
    </>
  );
}

/** Offices with their chairs, accessibility and closures. */
export default async function LocationsPage() {
  const s = await requirePermission("calendar.read");
  const locale = await getStaffLocale();
  const t = getT(locale, "catalog");
  const canManage = can(s.role, "catalog.manage");
  const locs = await db.select().from(locations).where(eq(locations.orgId, s.org.id)).orderBy(asc(locations.name));
  const ids = locs.map((l) => l.id);
  const [roomRows, closures] = await Promise.all([
    ids.length ? db.select().from(rooms).where(inArray(rooms.locationId, ids)).orderBy(asc(rooms.name)) : [],
    ids.length
      ? db
          .select()
          .from(timeOff)
          .where(and(eq(timeOff.orgId, s.org.id), inArray(timeOff.locationId, ids), gt(timeOff.endsAt, new Date())))
          .orderBy(asc(timeOff.startsAt))
      : [],
  ]);
  const today = todayIn(s.org.timezone);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={t("locations.title")} description={t("locations.description")} />
      <div className="space-y-6">
        {locs.map((l) => {
          const lRooms = roomRows.filter((r) => r.locationId === l.id);
          return (
            <Card key={l.id} className="p-6">
              <div className="mb-4 flex items-center gap-2">
                <h2 className="text-lg font-bold">{l.name}</h2>
                <Badge>{t("locations.chairs", { count: lRooms.filter((r) => r.active).length })}</Badge>
                {!l.active ? <Badge tone="red">{t("locations.closed")}</Badge> : null}
              </div>
              <div className="grid gap-6 lg:grid-cols-2">
                <div>
                  {canManage ? (
                    <ActionForm action={saveLocation.bind(null, l.id)} submitLabel={t("locations.save")}>
                      <LocationFields l={l} locale={locale} />
                    </ActionForm>
                  ) : (
                    <p className="text-sm text-slate-600">
                      {l.address}, {l.postalCode} {l.city}
                    </p>
                  )}
                </div>
                <div className="space-y-5">
                  <div>
                    <h3 className="mb-2 text-sm font-bold">{t("locations.chairsTitle")}</h3>
                    {canManage ? <RoomManager locationId={l.id} rooms={lRooms.map((r) => ({ id: r.id, name: r.name, active: r.active }))} /> : null}
                  </div>
                  <div>
                    <h3 className="mb-1 text-sm font-bold">{t("locations.closuresTitle")}</h3>
                    <TimeOffList
                      items={closures.filter((c) => c.locationId === l.id)}
                      tz={s.org.timezone}
                      label={(x) => (x.roomId ? (lRooms.find((r) => r.id === x.roomId)?.name ?? t("locations.chair")) : t("locations.wholeOffice"))}
                    />
                    {canManage ? (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-sm font-semibold text-brand-700">{t("locations.closeFor")}</summary>
                        <div className="mt-3">
                          <TimeOffForm
                            today={today}
                            scopes={[
                              { value: `location:${l.id}`, label: t("locations.wholeOffice") },
                              ...lRooms.map((r) => ({ value: `room:${r.id}`, label: t("locations.chairOut", { chair: r.name }) })),
                            ]}
                          />
                        </div>
                      </details>
                    ) : null}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
        {canManage ? (
          <Card className="p-6">
            <h2 className="mb-4 text-lg font-bold">{t("locations.add")}</h2>
            <ActionForm action={saveLocation.bind(null, null)} submitLabel={t("locations.addSubmit")}>
              <LocationFields locale={locale} />
            </ActionForm>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
