"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { practitionerServices, practitioners, services } from "@/db/schema";
import { newId, slugify } from "@/lib/ids";
import { fail, guard, ok, optional, str, type ActionResult } from "./_shared";

/** Practitioner records and their treatments (WP7: public profiles, approval, Albo). */

/** Create (id null, then redirects to the new profile) or update a practitioner and the treatments they offer. */
export async function savePractitioner(id: string | null, _prev: unknown, fd: FormData): Promise<ActionResult> {
  return guard(
    async (s) => {
      const name = str(fd, "name");
      if (!name) return fail("Name is required.");
      const values = {
        title: str(fd, "title"),
        name,
        specialty: str(fd, "specialty") || "Dentist",
        bio: optional(fd, "bio"),
        languages: str(fd, "languages") || "Italiano",
        color: /^#[0-9a-f]{6}$/i.test(str(fd, "color")) ? str(fd, "color") : "#0d9488",
        licenseNumber: optional(fd, "licenseNumber"),
        acceptsNewPatients: fd.get("acceptsNewPatients") === "on",
        active: fd.get("active") === "on",
      };
      const serviceIds = fd.getAll("serviceIds").map(String);
      const orgServices = await db.select({ id: services.id }).from(services).where(eq(services.orgId, s.org.id));
      const valid = serviceIds.filter((sid) => orgServices.some((o) => o.id === sid));

      let practitionerId = id;
      if (id) {
        const res = await db
          .update(practitioners)
          .set(values)
          .where(and(eq(practitioners.id, id), eq(practitioners.orgId, s.org.id)))
          .returning({ id: practitioners.id });
        if (!res.length) return fail("Practitioner not found.");
      } else {
        practitionerId = newId();
        let slug = slugify(name) || practitionerId.toLowerCase();
        const [taken] = await db
          .select({ id: practitioners.id })
          .from(practitioners)
          .where(and(eq(practitioners.orgId, s.org.id), eq(practitioners.slug, slug)));
        if (taken) slug = `${slug}-${newId(4).toLowerCase()}`;
        // No feed secret at creation: the column keeps a non-secret placeholder (a plaintext token here
        // would be turned into a live feed by the next db:migrate backfill). Feeds are issued by rotateIcsToken.
        await db.insert(practitioners).values({ id: practitionerId, orgId: s.org.id, slug, icsToken: `h:${practitionerId}`, ...values });
      }
      await db.transaction(async (tx) => {
        await tx.delete(practitionerServices).where(eq(practitionerServices.practitionerId, practitionerId!));
        if (valid.length)
          await tx.insert(practitionerServices).values(valid.map((serviceId) => ({ practitionerId: practitionerId!, serviceId })));
      });
      if (!id) redirect(`/dashboard/team/${practitionerId}?created=1`);
      return ok("Saved.");
    },
    { permission: "team.manage" },
  );
}
