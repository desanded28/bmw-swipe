"use server";

import { and, asc, eq, like, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { patients } from "@/db/schema";
import { isLocale } from "@/i18n/config";
import { normalizePhone } from "@/lib/phone";
import { fail, guard, ok, optional, staff, str, type ActionResult } from "./_shared";

/** Patient records (WP5). */

/** Patient lookup for the new-appointment drawer (8 matches by name, phone digits or email). */
export async function searchPatients(q: string) {
  const s = await staff("patient.read");
  const term = q.trim();
  if (term.length < 2) return [];
  const digits = term.replace(/\D/g, "");
  const words = term.toLowerCase().split(/\s+/).filter(Boolean);
  const nameMatch = and(
    ...words.map((w) =>
      or(like(sql`lower(${patients.firstName})`, `%${w}%`), like(sql`lower(${patients.lastName})`, `%${w}%`)),
    ),
  );
  return db
    .select({
      id: patients.id,
      firstName: patients.firstName,
      lastName: patients.lastName,
      phone: patients.phone,
      email: patients.email,
      noShowCount: patients.noShowCount,
    })
    .from(patients)
    .where(
      and(
        eq(patients.orgId, s.org.id),
        or(nameMatch, digits.length >= 4 ? like(patients.phone, `%${digits}%`) : undefined, like(patients.email, `%${term.toLowerCase()}%`)),
      ),
    )
    .orderBy(asc(patients.lastName))
    .limit(8);
}

/**
 * Any staff member may edit a patient today. No permission is checked on purpose: patient.write
 * would lock practitioners out (ROLE_PERMISSIONS); WP5 decides the rule.
 */
export async function updatePatient(id: string, _prev: unknown, fd: FormData): Promise<ActionResult> {
  return guard(async (s) => {
    const phoneRaw = str(fd, "phone");
    const phone = phoneRaw ? normalizePhone(phoneRaw) : null;
    if (phoneRaw && !phone) return fail("That phone number doesn't look right.");
    const email = str(fd, "email").toLowerCase() || null;
    if (email && !z.email().safeParse(email).success) return fail("That email doesn't look right.");
    // Any of the message languages; anything else keeps the patient's current one.
    const locale = str(fd, "locale");
    await db
      .update(patients)
      .set({
        firstName: str(fd, "firstName"),
        lastName: str(fd, "lastName"),
        phone,
        email,
        birthDate: optional(fd, "birthDate"),
        ...(isLocale(locale) ? { locale } : {}),
        preferredChannel: (["sms", "whatsapp", "email"].includes(str(fd, "preferredChannel"))
          ? str(fd, "preferredChannel")
          : "sms") as "sms" | "whatsapp" | "email",
        smsOptIn: fd.get("smsOptIn") === "on",
        emailOptIn: fd.get("emailOptIn") === "on",
        notes: optional(fd, "notes"),
      })
      .where(and(eq(patients.id, id), eq(patients.orgId, s.org.id)));
    return ok("Patient saved.");
  });
}
