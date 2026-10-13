import { migrate } from "drizzle-orm/libsql/migrator";
import { db } from "@/db";
import {
  locations,
  organizations,
  practitionerServices,
  practitioners,
  rooms,
  schedules,
  services,
  type OrgSettings,
} from "@/db/schema";
import { newId, newToken } from "@/lib/ids";
import { DEFAULT_SETTINGS } from "@/lib/settings";

let migrated = false;
export async function migrateOnce() {
  if (migrated) return;
  await migrate(db, { migrationsFolder: "./drizzle" });
  migrated = true;
}

export const TZ = "Europe/Rome";

/**
 * One practice, two offices (Milano with 2 chairs, Monza with 1),
 * Dr. A works Mon–Fri 09–13 in Milano, Dr. B works Mon 09–13 in Milano and Tue in Monza.
 */
export async function createPractice(overrides: Partial<OrgSettings["booking"]> = {}) {
  await migrateOnce();
  const orgId = newId();
  const settings: OrgSettings = {
    booking: { ...DEFAULT_SETTINGS.booking, minNoticeMinutes: 60, ...overrides },
    reminders: { ...DEFAULT_SETTINGS.reminders },
  };
  await db.insert(organizations).values({ id: orgId, slug: `test-${orgId.toLowerCase()}`, name: "Studio Test", timezone: TZ, settings });

  const milano = newId();
  const monza = newId();
  await db.insert(locations).values([
    { id: milano, orgId, name: "Milano", address: "Via Roma 1", city: "Milano", timezone: TZ },
    { id: monza, orgId, name: "Monza", address: "Via Italia 2", city: "Monza", timezone: TZ },
  ]);
  const chair1 = newId();
  const chair2 = newId();
  const chairMonza = newId();
  await db.insert(rooms).values([
    { id: chair1, locationId: milano, name: "Chair 1" },
    { id: chair2, locationId: milano, name: "Chair 2" },
    { id: chairMonza, locationId: monza, name: "Chair 1" },
  ]);

  const visit = newId();
  const cleaning = newId();
  await db.insert(services).values([
    { id: visit, orgId, name: "Visit", category: "checkup", durationMinutes: 30, priceCents: 5000 },
    { id: cleaning, orgId, name: "Cleaning", category: "hygiene", durationMinutes: 45, bufferMinutes: 15, priceCents: 9000 },
  ]);

  const drA = newId();
  const drB = newId();
  const drC = newId();
  await db.insert(practitioners).values([
    { id: drA, orgId, slug: "a", name: "Anna A", specialty: "Dentist", icsToken: newToken() },
    { id: drB, orgId, slug: "b", name: "Bruno B", specialty: "Dentist", icsToken: newToken() },
    { id: drC, orgId, slug: "c", name: "Carla C", specialty: "Dentist", icsToken: newToken() },
  ]);
  await db.insert(practitionerServices).values([
    { practitionerId: drA, serviceId: visit },
    { practitionerId: drA, serviceId: cleaning },
    { practitionerId: drB, serviceId: visit },
    { practitionerId: drC, serviceId: visit },
  ]);
  const sch = (practitionerId: string, locationId: string, weekday: number, start = 9 * 60, end = 13 * 60) => ({
    id: newId(),
    practitionerId,
    locationId,
    weekday,
    startMinute: start,
    endMinute: end,
  });
  await db.insert(schedules).values([
    ...[1, 2, 3, 4, 5].map((d) => sch(drA, milano, d)),
    sch(drB, milano, 1),
    sch(drB, monza, 2),
    sch(drC, milano, 1),
  ]);

  return { orgId, milano, monza, chair1, chair2, chairMonza, visit, cleaning, drA, drB, drC, settings };
}

/** A Monday well in the future (local date string). */
export const MONDAY = "2030-03-04";
export const TUESDAY = "2030-03-05";
/** "now" used in tests: the Friday before MONDAY at 10:00 Rome. */
export const NOW = new Date("2030-03-01T09:00:00Z");
