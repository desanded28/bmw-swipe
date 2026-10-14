"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { locations, rooms, type LocationAccessibility } from "@/db/schema";
import { DEFAULT_LOCALE, type Locale } from "@/i18n/config";
import { getStaffLocale, getT } from "@/i18n/server";
import { blockedWords, checkAdvertisingFields } from "@/lib/compliance/advertising";
import { ACCESS_FEATURES } from "@/lib/directory";
import { newId } from "@/lib/ids";
import { fail, guard, ok, optional, str, type ActionResult } from "./_shared";

/**
 * Offices and chairs (WP7): accessibility features and directions, shown on the practice page and
 * used by the accessibility filter in search. The directions are public text and go through the
 * health-advertising check (Law 145/2018): promotional wording blocks the save.
 */

/** The staff member's language. Outside a request (tests, scripts) the default: never fails the action. */
async function staffLocale(): Promise<Locale> {
  try {
    return await getStaffLocale();
  } catch {
    return DEFAULT_LOCALE;
  }
}

const TRANSIT_MAX = 300;

/** Every feature is stored explicitly (true or false): an office with all false has been described. */
function accessibilityFrom(fd: FormData): LocationAccessibility {
  const flags = Object.fromEntries(ACCESS_FEATURES.map((f) => [f, fd.get(`access.${f}`) === "on"])) as LocationAccessibility;
  const transit = optional(fd, "transit");
  return transit ? { ...flags, transit } : flags;
}

/** Create (id null, with one chair) or update an office. */
export async function saveLocation(id: string | null, _prev: unknown, fd: FormData): Promise<ActionResult> {
  return guard(
    async (s) => {
      const t = getT(await staffLocale(), "catalog");
      const values = {
        name: str(fd, "name").slice(0, 120),
        address: str(fd, "address").slice(0, 200),
        city: str(fd, "city").slice(0, 80),
        postalCode: optional(fd, "postalCode")?.slice(0, 10) ?? null,
        phone: optional(fd, "phone")?.slice(0, 30) ?? null,
        active: fd.get("active") === "on",
        accessibility: accessibilityFrom(fd),
      };
      if (!values.name || !values.address || !values.city) return fail(t("locations.required"));
      if ((values.accessibility.transit ?? "").length > TRANSIT_MAX) return fail(t("locations.transitTooLong"));
      const ads = checkAdvertisingFields({ transit: values.accessibility.transit });
      if (ads.verdict === "block") return fail(t("advertising.blocked", { words: blockedWords(ads.byField) }), "advertising");
      const warned = ads.verdict === "warn";
      if (id) {
        const res = await db
          .update(locations)
          .set(values)
          .where(and(eq(locations.id, id), eq(locations.orgId, s.org.id)))
          .returning({ id: locations.id });
        if (!res.length) return fail(t("locations.notFound"), "not_found");
        return ok(warned ? t("locations.savedWithWarnings") : t("locations.saved"));
      }
      const locationId = newId();
      await db.insert(locations).values({ id: locationId, orgId: s.org.id, timezone: s.org.timezone, ...values });
      await db.insert(rooms).values({ id: newId(), locationId, name: t("rooms.newName", { n: 1 }) });
      return ok(warned ? t("locations.savedWithWarnings") : t("locations.added"));
    },
    { permission: "catalog.manage" },
  );
}

export async function addRoom(locationId: string, name: string): Promise<ActionResult> {
  return guard(
    async (s) => {
      const t = getT(await staffLocale(), "catalog");
      const [l] = await db
        .select({ id: locations.id })
        .from(locations)
        .where(and(eq(locations.id, locationId), eq(locations.orgId, s.org.id)));
      if (!l) return fail(t("locations.notFound"), "not_found");
      await db.insert(rooms).values({ id: newId(), locationId, name: name.trim().slice(0, 60) || t("locations.chair") });
      return ok(t("rooms.added"));
    },
    { permission: "catalog.manage" },
  );
}

export async function updateRoom(roomId: string, values: { name?: string; active?: boolean }): Promise<ActionResult> {
  return guard(
    async (s) => {
      const t = getT(await staffLocale(), "catalog");
      const [r] = await db
        .select({ id: rooms.id })
        .from(rooms)
        .innerJoin(locations, eq(locations.id, rooms.locationId))
        .where(and(eq(rooms.id, roomId), eq(locations.orgId, s.org.id)));
      if (!r) return fail(t("rooms.notFound"), "not_found");
      await db
        .update(rooms)
        .set({
          ...(values.name !== undefined ? { name: values.name.trim().slice(0, 60) || t("locations.chair") } : {}),
          ...(values.active !== undefined ? { active: values.active } : {}),
        })
        .where(eq(rooms.id, roomId));
      return ok(t("rooms.updated"));
    },
    { permission: "catalog.manage" },
  );
}
