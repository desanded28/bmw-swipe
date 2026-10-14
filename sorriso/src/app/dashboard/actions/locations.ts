"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { locations, rooms } from "@/db/schema";
import { newId } from "@/lib/ids";
import { fail, guard, ok, optional, str, type ActionResult } from "./_shared";

/** Offices and chairs (WP7: accessibility flags, transit directions). */

/** Create (id null, with one chair) or update an office. */
export async function saveLocation(id: string | null, _prev: unknown, fd: FormData): Promise<ActionResult> {
  return guard(
    async (s) => {
      const values = {
        name: str(fd, "name"),
        address: str(fd, "address"),
        city: str(fd, "city"),
        postalCode: optional(fd, "postalCode"),
        phone: optional(fd, "phone"),
        active: fd.get("active") === "on",
      };
      if (!values.name || !values.address || !values.city) return fail("Name, address and city are required.");
      if (id) {
        await db.update(locations).set(values).where(and(eq(locations.id, id), eq(locations.orgId, s.org.id)));
        return ok("Office saved.");
      }
      const locationId = newId();
      await db.insert(locations).values({ id: locationId, orgId: s.org.id, timezone: s.org.timezone, ...values });
      await db.insert(rooms).values({ id: newId(), locationId, name: "Chair 1" });
      return ok("Office added with one chair. Add working hours for it on each practitioner's profile.");
    },
    { permission: "catalog.manage" },
  );
}

export async function addRoom(locationId: string, name: string): Promise<ActionResult> {
  return guard(
    async (s) => {
      const [l] = await db
        .select({ id: locations.id })
        .from(locations)
        .where(and(eq(locations.id, locationId), eq(locations.orgId, s.org.id)));
      if (!l) return fail("Office not found.");
      await db.insert(rooms).values({ id: newId(), locationId, name: name.trim() || "Chair" });
      return ok("Chair added.");
    },
    { permission: "catalog.manage" },
  );
}

export async function updateRoom(roomId: string, values: { name?: string; active?: boolean }): Promise<ActionResult> {
  return guard(
    async (s) => {
      const [r] = await db
        .select({ id: rooms.id })
        .from(rooms)
        .innerJoin(locations, eq(locations.id, rooms.locationId))
        .where(and(eq(rooms.id, roomId), eq(locations.orgId, s.org.id)));
      if (!r) return fail("Chair not found.");
      await db
        .update(rooms)
        .set({
          ...(values.name !== undefined ? { name: values.name.trim() || "Chair" } : {}),
          ...(values.active !== undefined ? { active: values.active } : {}),
        })
        .where(eq(rooms.id, roomId));
      return ok("Chair updated.");
    },
    { permission: "catalog.manage" },
  );
}
