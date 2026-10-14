"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { locations, memberships, organizations, practitionerServices, practitioners, rooms, schedules, services, users } from "@/db/schema";
import { createSession, destroySession, getSession } from "@/lib/auth";
import { newId, slugify } from "@/lib/ids";
import { hashPassword, verifyPassword } from "@/lib/password";
import { DEFAULT_SETTINGS } from "@/lib/settings";

export type FormState = { error?: string } | null;

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user || !(await verifyPassword(password, user.passwordHash))) return { error: "Wrong email or password." };
  const all = await db.select().from(memberships).where(eq(memberships.userId, user.id));
  const membership = all.find((m) => m.role === "owner") ?? all[0];
  await createSession(user.id, membership?.orgId ?? null);
  redirect("/dashboard");
}

export async function logout() {
  await destroySession();
  redirect("/");
}

const signupSchema = z.object({
  name: z.string().trim().min(2, "Your name is required"),
  email: z.email("Invalid email").transform((e) => e.toLowerCase()),
  password: z.string().min(8, "Use at least 8 characters"),
  practiceName: z.string().trim().min(2, "Practice name is required"),
  address: z.string().trim().min(3, "Address is required"),
  city: z.string().trim().min(2, "City is required"),
  phone: z.string().trim().optional(),
  isDentist: z.boolean(),
});

/** Create a practice with one office, two chairs, starter services and (optionally) the owner as dentist. */
export async function signup(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    practiceName: formData.get("practiceName"),
    address: formData.get("address"),
    city: formData.get("city"),
    phone: formData.get("phone") || undefined,
    isDentist: formData.get("isDentist") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  const input = parsed.data;

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, input.email));
  if (existing) return { error: "An account with this email already exists. Log in instead." };

  let slug = slugify(input.practiceName) || "practice";
  const [taken] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.slug, slug));
  if (taken) slug = `${slug}-${newId(4).toLowerCase()}`;

  const passwordHash = await hashPassword(input.password);
  const userId = newId();
  const orgId = newId();
  const locationId = newId();
  await db.transaction(async (tx) => {
    await tx.insert(users).values({ id: userId, email: input.email, name: input.name, passwordHash });
    await tx.insert(organizations).values({
      id: orgId,
      slug,
      name: input.practiceName,
      phone: input.phone ?? null,
      email: input.email,
      settings: DEFAULT_SETTINGS,
    });
    await tx.insert(memberships).values({ userId, orgId, role: "owner" });
    await tx.insert(locations).values({ id: locationId, orgId, name: input.city, address: input.address, city: input.city, phone: input.phone ?? null });
    await tx.insert(rooms).values([
      { id: newId(), locationId, name: "Chair 1" },
      { id: newId(), locationId, name: "Chair 2" },
    ]);
    const starter = [
      { name: "First dental visit", category: "checkup" as const, durationMinutes: 30, priceCents: 5000 },
      { name: "Professional cleaning", category: "hygiene" as const, durationMinutes: 45, bufferMinutes: 10, priceCents: 9000 },
      { name: "Dental emergency", category: "emergency" as const, durationMinutes: 30, priceCents: 8000 },
    ].map((s, i) => ({ id: newId(), orgId, sortOrder: i, ...s }));
    await tx.insert(services).values(starter);
    if (input.isDentist) {
      const practitionerId = newId();
      await tx.insert(practitioners).values({
        id: practitionerId,
        orgId,
        userId,
        slug: slugify(input.name),
        title: "Dr.",
        name: input.name,
        specialty: "General dentist",
        // Non-secret placeholder: feeds are issued by rotateIcsToken, which stores only the hash.
        icsToken: `h:${practitionerId}`,
      });
      await tx.insert(practitionerServices).values(starter.map((s) => ({ practitionerId, serviceId: s.id })));
      await tx.insert(schedules).values(
        [1, 2, 3, 4, 5].flatMap((weekday) => [
          { id: newId(), practitionerId, locationId, weekday, startMinute: 9 * 60, endMinute: 13 * 60 },
          { id: newId(), practitionerId, locationId, weekday, startMinute: 14 * 60, endMinute: 18 * 60 },
        ]),
      );
    }
  });
  await createSession(userId, orgId);
  redirect("/dashboard?welcome=1");
}

export async function redirectIfLoggedIn() {
  const session = await getSession();
  if (session?.org) redirect("/dashboard");
}
