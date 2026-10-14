"use server";

import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { practitionerServices, practitioners, SERVICE_CATEGORIES, services } from "@/db/schema";
import { newId } from "@/lib/ids";
import { fail, guard, ok, optional, str, type ActionResult } from "./_shared";

/** The treatment catalogue (WP7: price types, recall interval, sensitive flag, advertising rules). */

/** Create (id null) or update a treatment. */
export async function saveService(id: string | null, _prev: unknown, fd: FormData): Promise<ActionResult> {
  return guard(
    async (s) => {
      const category = str(fd, "category");
      if (!(SERVICE_CATEGORIES as readonly string[]).includes(category)) return fail("Choose a category.");
      const duration = Number(str(fd, "durationMinutes"));
      if (!Number.isInteger(duration) || duration < 5 || duration > 480) return fail("Duration must be 5–480 minutes.");
      const priceRaw = str(fd, "price").replace(",", ".");
      const price = priceRaw === "" ? null : Math.round(Number(priceRaw) * 100);
      if (price != null && (Number.isNaN(price) || price < 0)) return fail("Invalid price.");
      const values = {
        name: str(fd, "name"),
        category: category as (typeof SERVICE_CATEGORIES)[number],
        description: optional(fd, "description"),
        durationMinutes: duration,
        bufferMinutes: Math.max(0, Math.min(120, Number(str(fd, "bufferMinutes")) || 0)),
        priceCents: price,
        onlineBookable: fd.get("onlineBookable") === "on",
        requiresRoom: fd.get("requiresRoom") === "on",
        active: fd.get("active") === "on",
      };
      if (!values.name) return fail("Name is required.");
      if (id) {
        await db.update(services).set(values).where(and(eq(services.id, id), eq(services.orgId, s.org.id)));
        return ok("Service saved.");
      }
      const [{ max }] = await db
        .select({ max: sql<number>`coalesce(max(${services.sortOrder}), 0)` })
        .from(services)
        .where(eq(services.orgId, s.org.id));
      const newServiceId = newId();
      await db.insert(services).values({ id: newServiceId, orgId: s.org.id, sortOrder: Number(max) + 1, ...values });
      // Practitioners who should offer it are linked on their profile; link all for convenience if only one.
      const team = await db.select({ id: practitioners.id }).from(practitioners).where(eq(practitioners.orgId, s.org.id));
      if (team.length === 1) await db.insert(practitionerServices).values({ practitionerId: team[0].id, serviceId: newServiceId });
      return ok("Service added. Choose who offers it on each practitioner's profile.");
    },
    { permission: "catalog.manage" },
  );
}
