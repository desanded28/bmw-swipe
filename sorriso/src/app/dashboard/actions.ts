"use server";

import { and, asc, eq, inArray, like, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import {
  apiKeys,
  appointments,
  CHANNELS,
  locations,
  messages,
  organizations,
  patients,
  practitionerServices,
  practitioners,
  reviews,
  rooms,
  schedules,
  SERVICE_CATEGORIES,
  services,
  sessions,
  timeOff,
  waitlist,
  type Channel,
  type OrgSettings,
  type ReminderRule,
} from "@/db/schema";
import { createApiKey } from "@/lib/api";
import { getOrgAppointmentDetails } from "@/lib/appointments";
import { MANAGERS, requireStaff, type Role } from "@/lib/auth";
import {
  approveRequest,
  BookingError,
  cancelAppointment,
  confirmAttendance,
  createAppointment,
  rescheduleAppointment,
  sendReminderNow,
  setOutcome,
} from "@/lib/booking";
import { newId, newToken, slugify } from "@/lib/ids";
import { handleInboundMessage } from "@/lib/inbound";
import { normalizePhone } from "@/lib/phone";
import { processDueReminders } from "@/lib/reminders";
import { resolveSettings } from "@/lib/settings";
import { hhmmToMinutes, zonedToUtc } from "@/lib/time";

export type ActionResult = { ok: true; message?: string; data?: unknown } | { ok: false; error: string; code?: string };

const ok = (message?: string, data?: unknown): ActionResult => ({ ok: true, message, data });
const fail = (error: string, code?: string): ActionResult => ({ ok: false, error, code });

function refresh() {
  revalidatePath("/dashboard", "layout");
}

async function staff(roles?: Role[]) {
  return requireStaff(roles);
}

/** Run an action, turning domain errors into ActionResults. */
async function guard(fn: () => Promise<ActionResult>): Promise<ActionResult> {
  try {
    const result = await fn();
    if (result.ok) refresh();
    return result;
  } catch (err) {
    if (err instanceof BookingError) return fail(err.message, err.code);
    if (err instanceof z.ZodError) return fail(err.issues[0]?.message ?? "Invalid input");
    // Let Next.js redirects / notFound propagate.
    if (err && typeof err === "object" && "digest" in err) throw err;
    console.error("[dashboard action]", err);
    return fail("Something went wrong.");
  }
}

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const optional = (fd: FormData, key: string) => str(fd, key) || null;

// ---------------------------------------------------------------- session

export async function switchOrg(orgId: string) {
  const s = await staff();
  if (!s.orgs.some((o) => o.org.id === orgId)) return;
  await db.update(sessions).set({ orgId }).where(eq(sessions.id, s.sessionId));
  redirect("/dashboard");
}

// ---------------------------------------------------------------- appointments

async function ownAppointment(orgId: string, id: string) {
  const d = await getOrgAppointmentDetails(orgId, id);
  if (!d) throw new BookingError("not_found", "Appointment not found.");
  return d;
}

const staffBookingSchema = z.object({
  patientId: z.string().optional(),
  firstName: z.string().trim().optional(),
  lastName: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  email: z.string().trim().optional(),
  serviceId: z.string().min(1, "Choose a service"),
  practitionerId: z.string().min(1, "Choose a practitioner"),
  locationId: z.string().min(1, "Choose an office"),
  roomId: z.string().optional(),
  date: z.iso.date("Choose a date"),
  time: z.string().regex(/^\d{1,2}:\d{2}$/, "Choose a time"),
  durationMinutes: z.coerce.number().int().min(5).max(480).optional(),
  internalNote: z.string().optional(),
  notifyPatient: z.boolean(),
  force: z.boolean(),
});

export async function createStaffAppointment(input: z.input<typeof staffBookingSchema>): Promise<ActionResult> {
  return guard(async () => {
    const s = await staff();
    const v = staffBookingSchema.parse(input);
    const [loc] = await db
      .select()
      .from(locations)
      .where(and(eq(locations.id, v.locationId), eq(locations.orgId, s.org.id)));
    if (!loc) return fail("Office not found.");
    const minutes = hhmmToMinutes(v.time);
    if (minutes == null) return fail("Invalid time.");
    let patient: { id: string } | Parameters<typeof createAppointment>[0]["patient"];
    if (v.patientId) patient = { id: v.patientId };
    else {
      if (!v.firstName || !v.lastName) return fail("Enter the patient's first and last name.");
      if (!v.phone && !v.email) return fail("Enter a phone number or email for the patient.");
      if (v.phone && !normalizePhone(v.phone)) return fail("That phone number doesn't look right.");
      patient = { firstName: v.firstName, lastName: v.lastName, phone: v.phone || null, email: v.email || null };
    }
    const d = await createAppointment({
      orgId: s.org.id,
      serviceId: v.serviceId,
      practitionerId: v.practitionerId,
      locationId: v.locationId,
      roomId: v.roomId || undefined,
      startsAt: zonedToUtc(v.date, minutes, loc.timezone),
      durationMinutes: v.durationMinutes,
      patient,
      source: "staff",
      online: false,
      force: v.force,
      internalNote: v.internalNote,
      notifyPatient: v.notifyPatient,
    });
    return ok("Appointment booked.", { id: d.appointment.id });
  });
}

export async function moveAppointment(input: {
  id: string;
  date: string;
  time: string;
  practitionerId?: string;
  locationId?: string;
  roomId?: string | null;
  durationMinutes?: number;
  notifyPatient: boolean;
  force?: boolean;
}): Promise<ActionResult> {
  return guard(async () => {
    const s = await staff();
    const d = await ownAppointment(s.org.id, input.id);
    const locationId = input.locationId ?? d.location.id;
    const [loc] = await db
      .select()
      .from(locations)
      .where(and(eq(locations.id, locationId), eq(locations.orgId, s.org.id)));
    if (!loc) return fail("Office not found.");
    if (input.practitionerId) {
      const [p] = await db
        .select({ id: practitioners.id })
        .from(practitioners)
        .where(and(eq(practitioners.id, input.practitionerId), eq(practitioners.orgId, s.org.id)));
      if (!p) return fail("Practitioner not found.");
    }
    const minutes = hhmmToMinutes(input.time);
    if (minutes == null) return fail("Invalid time.");
    await rescheduleAppointment(input.id, {
      startsAt: zonedToUtc(input.date, minutes, loc.timezone),
      practitionerId: input.practitionerId,
      locationId,
      roomId: input.roomId,
      durationMinutes: input.durationMinutes,
      by: "staff",
      force: input.force,
      notifyPatient: input.notifyPatient,
    });
    return ok(input.notifyPatient ? "Moved — patient notified." : "Moved.");
  });
}

export async function cancelByStaff(id: string, reason: string, notifyPatient: boolean): Promise<ActionResult> {
  return guard(async () => {
    const s = await staff();
    await ownAppointment(s.org.id, id);
    const res = await cancelAppointment(id, { by: "staff", reason, notifyPatient });
    return res ? ok("Appointment cancelled. Waitlist notified if anyone matches.") : fail("Already cancelled.");
  });
}

export async function recordOutcome(id: string, outcome: "completed" | "no_show" | "scheduled"): Promise<ActionResult> {
  return guard(async () => {
    const s = await staff();
    await ownAppointment(s.org.id, id);
    await setOutcome(id, outcome);
    return ok(outcome === "completed" ? "Marked as completed." : outcome === "no_show" ? "Marked as no-show." : "Reset.");
  });
}

export async function confirmByPhone(id: string): Promise<ActionResult> {
  return guard(async () => {
    const s = await staff();
    await ownAppointment(s.org.id, id);
    const res = await confirmAttendance(id, "staff");
    return res ? ok("Confirmed.") : fail("Only scheduled appointments can be confirmed.");
  });
}

export async function approve(id: string): Promise<ActionResult> {
  return guard(async () => {
    const s = await staff();
    await ownAppointment(s.org.id, id);
    return (await approveRequest(id)) ? ok("Request approved — patient notified.") : fail("Not a pending request.");
  });
}

export async function remindNow(id: string, channel: Channel): Promise<ActionResult> {
  return guard(async () => {
    const s = await staff();
    const d = await ownAppointment(s.org.id, id);
    if (d.appointment.status !== "scheduled") return fail("Only scheduled appointments get reminders.");
    const summary = await sendReminderNow(id, channel, d.appointment.confirmation === "pending");
    if (summary.sent) return ok(`Reminder sent by ${channel}.`);
    return fail(channel === "email" ? "Patient has no email (or opted out)." : "Patient has no mobile number (or opted out).");
  });
}

export async function saveInternalNote(id: string, note: string): Promise<ActionResult> {
  return guard(async () => {
    const s = await staff();
    await ownAppointment(s.org.id, id);
    await db
      .update(appointments)
      .set({ internalNote: note.trim() || null, updatedAt: new Date() })
      .where(eq(appointments.id, id));
    return ok("Note saved.");
  });
}

export async function clearAttention(id: string): Promise<ActionResult> {
  return guard(async () => {
    const s = await staff();
    await db
      .update(appointments)
      .set({ needsAttention: false })
      .where(and(eq(appointments.id, id), eq(appointments.orgId, s.org.id)));
    return ok("Marked as handled.");
  });
}

export async function appointmentMessages(id: string) {
  const s = await staff();
  return db
    .select()
    .from(messages)
    .where(and(eq(messages.appointmentId, id), eq(messages.orgId, s.org.id)))
    .orderBy(asc(messages.createdAt));
}

export async function searchPatients(q: string) {
  const s = await staff();
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

// ---------------------------------------------------------------- patients

export async function updatePatient(id: string, _prev: unknown, fd: FormData): Promise<ActionResult> {
  return guard(async () => {
    const s = await staff();
    const phoneRaw = str(fd, "phone");
    const phone = phoneRaw ? normalizePhone(phoneRaw) : null;
    if (phoneRaw && !phone) return fail("That phone number doesn't look right.");
    const email = str(fd, "email").toLowerCase() || null;
    if (email && !z.email().safeParse(email).success) return fail("That email doesn't look right.");
    await db
      .update(patients)
      .set({
        firstName: str(fd, "firstName"),
        lastName: str(fd, "lastName"),
        phone,
        email,
        birthDate: optional(fd, "birthDate"),
        locale: str(fd, "locale") === "en" ? "en" : "it",
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

// ---------------------------------------------------------------- team

export async function savePractitioner(id: string | null, _prev: unknown, fd: FormData): Promise<ActionResult> {
  return guard(async () => {
    const s = await staff(MANAGERS);
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
      await db.insert(practitioners).values({ id: practitionerId, orgId: s.org.id, slug, icsToken: newToken(), ...values });
    }
    await db.transaction(async (tx) => {
      await tx.delete(practitionerServices).where(eq(practitionerServices.practitionerId, practitionerId!));
      if (valid.length)
        await tx.insert(practitionerServices).values(valid.map((serviceId) => ({ practitionerId: practitionerId!, serviceId })));
    });
    if (!id) redirect(`/dashboard/team/${practitionerId}?created=1`);
    return ok("Saved.");
  });
}

const scheduleSchema = z.array(
  z.object({
    weekday: z.number().int().min(0).max(6),
    locationId: z.string().min(1),
    start: z.string(),
    end: z.string(),
  }),
);

export async function saveSchedule(practitionerId: string, rows: z.input<typeof scheduleSchema>): Promise<ActionResult> {
  return guard(async () => {
    const s = await staff(MANAGERS);
    const parsed = scheduleSchema.parse(rows);
    const [p] = await db
      .select({ id: practitioners.id })
      .from(practitioners)
      .where(and(eq(practitioners.id, practitionerId), eq(practitioners.orgId, s.org.id)));
    if (!p) return fail("Practitioner not found.");
    const orgLocations = new Set(
      (await db.select({ id: locations.id }).from(locations).where(eq(locations.orgId, s.org.id))).map((l) => l.id),
    );
    const values: (typeof schedules.$inferInsert)[] = [];
    for (const r of parsed) {
      const start = hhmmToMinutes(r.start);
      const end = hhmmToMinutes(r.end);
      if (start == null || end == null || end <= start) return fail(`Check the hours on ${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][r.weekday]}.`);
      if (!orgLocations.has(r.locationId)) return fail("Unknown office.");
      values.push({ id: newId(), practitionerId, locationId: r.locationId, weekday: r.weekday, startMinute: start, endMinute: end });
    }
    // Overlapping windows on the same day would double-count availability.
    for (const a of values)
      for (const b of values)
        if (a !== b && a.weekday === b.weekday && a.startMinute < b.endMinute && b.startMinute < a.endMinute)
          return fail(`Two time windows overlap on ${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][a.weekday]}.`);
    await db.transaction(async (tx) => {
      await tx.delete(schedules).where(eq(schedules.practitionerId, practitionerId));
      if (values.length) await tx.insert(schedules).values(values);
    });
    return ok("Working hours saved.");
  });
}

export async function addTimeOff(_prev: unknown, fd: FormData): Promise<ActionResult> {
  return guard(async () => {
    const s = await staff();
    const scope = str(fd, "scope"); // practitioner:<id> | location:<id> | room:<id> | org
    const [kind, targetId] = scope.split(":");
    const fromDate = str(fd, "fromDate");
    const toDate = str(fd, "toDate") || fromDate;
    const allDay = fd.get("allDay") === "on";
    const fromMin = allDay ? 0 : hhmmToMinutes(str(fd, "fromTime"));
    const toMin = allDay ? 24 * 60 : hhmmToMinutes(str(fd, "toTime"));
    if (!fromDate || fromMin == null || toMin == null) return fail("Choose dates and times.");
    const tz = s.org.timezone;
    const startsAt = zonedToUtc(fromDate, fromMin, tz);
    const endsAt = zonedToUtc(toDate, toMin, tz);
    if (endsAt <= startsAt) return fail("The end must be after the start.");

    const row = { id: newId(), orgId: s.org.id, startsAt, endsAt, reason: optional(fd, "reason") } as typeof timeOff.$inferInsert;
    if (kind === "practitioner") {
      const [p] = await db.select({ id: practitioners.id }).from(practitioners).where(and(eq(practitioners.id, targetId), eq(practitioners.orgId, s.org.id)));
      if (!p) return fail("Practitioner not found.");
      row.practitionerId = targetId;
    } else if (kind === "location") {
      const [l] = await db.select({ id: locations.id }).from(locations).where(and(eq(locations.id, targetId), eq(locations.orgId, s.org.id)));
      if (!l) return fail("Office not found.");
      row.locationId = targetId;
    } else if (kind === "room") {
      const [r] = await db
        .select({ id: rooms.id, locationId: rooms.locationId })
        .from(rooms)
        .innerJoin(locations, eq(locations.id, rooms.locationId))
        .where(and(eq(rooms.id, targetId), eq(locations.orgId, s.org.id)));
      if (!r) return fail("Chair not found.");
      row.roomId = targetId;
      row.locationId = r.locationId;
    } else if (kind !== "org") return fail("Choose who is unavailable.");

    // Warn about existing appointments that now fall inside the block.
    const clash = await db
      .select({ n: sql<number>`count(*)` })
      .from(appointments)
      .where(
        and(
          eq(appointments.orgId, s.org.id),
          inArray(appointments.status, ["scheduled", "requested"]),
          sql`${appointments.startsAt} < ${endsAt.getTime()} and ${appointments.endsAt} > ${startsAt.getTime()}`,
          row.practitionerId ? eq(appointments.practitionerId, row.practitionerId) : undefined,
          row.roomId ? eq(appointments.roomId, row.roomId) : row.locationId ? eq(appointments.locationId, row.locationId) : undefined,
        ),
      );
    await db.insert(timeOff).values(row);
    const n = Number(clash[0]?.n ?? 0);
    return ok(n ? `Blocked. Heads-up: ${n} existing appointment${n > 1 ? "s" : ""} fall in this period — move or cancel them from the calendar.` : "Blocked.");
  });
}

export async function deleteTimeOff(id: string): Promise<ActionResult> {
  return guard(async () => {
    const s = await staff();
    await db.delete(timeOff).where(and(eq(timeOff.id, id), eq(timeOff.orgId, s.org.id)));
    return ok("Removed.");
  });
}

export async function rotateIcsToken(practitionerId: string): Promise<ActionResult> {
  return guard(async () => {
    const s = await staff(MANAGERS);
    await db
      .update(practitioners)
      .set({ icsToken: newToken() })
      .where(and(eq(practitioners.id, practitionerId), eq(practitioners.orgId, s.org.id)));
    return ok("New calendar link generated. The old one stops working.");
  });
}

// ---------------------------------------------------------------- services

export async function saveService(id: string | null, _prev: unknown, fd: FormData): Promise<ActionResult> {
  return guard(async () => {
    const s = await staff(MANAGERS);
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
  });
}

// ---------------------------------------------------------------- offices

export async function saveLocation(id: string | null, _prev: unknown, fd: FormData): Promise<ActionResult> {
  return guard(async () => {
    const s = await staff(MANAGERS);
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
  });
}

export async function addRoom(locationId: string, name: string): Promise<ActionResult> {
  return guard(async () => {
    const s = await staff(MANAGERS);
    const [l] = await db.select({ id: locations.id }).from(locations).where(and(eq(locations.id, locationId), eq(locations.orgId, s.org.id)));
    if (!l) return fail("Office not found.");
    await db.insert(rooms).values({ id: newId(), locationId, name: name.trim() || "Chair" });
    return ok("Chair added.");
  });
}

export async function updateRoom(roomId: string, values: { name?: string; active?: boolean }): Promise<ActionResult> {
  return guard(async () => {
    const s = await staff(MANAGERS);
    const [r] = await db
      .select({ id: rooms.id })
      .from(rooms)
      .innerJoin(locations, eq(locations.id, rooms.locationId))
      .where(and(eq(rooms.id, roomId), eq(locations.orgId, s.org.id)));
    if (!r) return fail("Chair not found.");
    await db
      .update(rooms)
      .set({ ...(values.name !== undefined ? { name: values.name.trim() || "Chair" } : {}), ...(values.active !== undefined ? { active: values.active } : {}) })
      .where(eq(rooms.id, roomId));
    return ok("Chair updated.");
  });
}

// ---------------------------------------------------------------- settings

async function updateSettings(orgId: string, patch: (s: OrgSettings) => OrgSettings) {
  const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
  await db.update(organizations).set({ settings: patch(resolveSettings(org.settings)) }).where(eq(organizations.id, orgId));
}

export async function saveProfile(_prev: unknown, fd: FormData): Promise<ActionResult> {
  return guard(async () => {
    const s = await staff(MANAGERS);
    const name = str(fd, "name");
    if (!name) return fail("Practice name is required.");
    const color = str(fd, "brandColor");
    await db
      .update(organizations)
      .set({
        name,
        description: optional(fd, "description"),
        phone: optional(fd, "phone"),
        email: optional(fd, "email"),
        website: optional(fd, "website"),
        brandColor: /^#[0-9a-f]{6}$/i.test(color) ? color : s.org.brandColor,
        listed: fd.get("listed") === "on",
      })
      .where(eq(organizations.id, s.org.id));
    return ok("Profile saved.");
  });
}

export async function saveBookingPolicy(_prev: unknown, fd: FormData): Promise<ActionResult> {
  return guard(async () => {
    const s = await staff(MANAGERS);
    const num = (k: string, min: number, max: number) => Math.max(min, Math.min(max, Math.round(Number(str(fd, k)) || 0)));
    await updateSettings(s.org.id, (cur) => ({
      ...cur,
      booking: {
        minNoticeMinutes: num("minNoticeHours", 0, 24 * 14) * 60,
        maxAdvanceDays: num("maxAdvanceDays", 1, 365),
        slotStepMinutes: [5, 10, 15, 20, 30, 60].includes(Number(str(fd, "slotStepMinutes"))) ? Number(str(fd, "slotStepMinutes")) : 15,
        cancelUntilHours: num("cancelUntilHours", 0, 24 * 7),
        requireApproval: fd.get("requireApproval") === "on",
      },
    }));
    return ok("Booking rules saved.");
  });
}

const rulesSchema = z.array(
  z.object({
    id: z.string(),
    channel: z.enum(CHANNELS),
    offsetMinutes: z.number().int().min(15).max(14 * 24 * 60),
    askConfirmation: z.boolean(),
    fallbackToEmail: z.boolean(),
  }),
).max(6);

export async function saveReminderSettings(input: {
  rules: ReminderRule[];
  sendBookingConfirmation: boolean;
  requestReviews: boolean;
  autoOfferToWaitlist: boolean;
}): Promise<ActionResult> {
  return guard(async () => {
    const s = await staff(MANAGERS);
    const rules = rulesSchema.parse(input.rules).sort((a, b) => b.offsetMinutes - a.offsetMinutes);
    await updateSettings(s.org.id, (cur) => ({
      ...cur,
      reminders: {
        rules,
        sendBookingConfirmation: input.sendBookingConfirmation,
        requestReviews: input.requestReviews,
        autoOfferToWaitlist: input.autoOfferToWaitlist,
      },
    }));
    return ok("Reminder rules saved. They apply to new bookings and anything you reschedule.");
  });
}

export async function runRemindersNow(): Promise<ActionResult> {
  return guard(async () => {
    await staff();
    const summary = await processDueReminders();
    return ok(`Processed ${summary.due} due reminder${summary.due === 1 ? "" : "s"}: ${summary.sent} sent, ${summary.skipped} skipped, ${summary.failed} failed.`);
  });
}

export async function newApiKey(name: string): Promise<ActionResult> {
  return guard(async () => {
    const s = await staff(MANAGERS);
    const { secret } = await createApiKey(s.org.id, name.trim() || "API key");
    return ok("Copy this key now — it won't be shown again.", { secret });
  });
}

export async function revokeApiKey(id: string): Promise<ActionResult> {
  return guard(async () => {
    const s = await staff(MANAGERS);
    await db.update(apiKeys).set({ revokedAt: new Date() }).where(and(eq(apiKeys.id, id), eq(apiKeys.orgId, s.org.id)));
    return ok("Key revoked.");
  });
}

// ---------------------------------------------------------------- messages / waitlist / reviews

export async function simulateReply(phone: string, body: string, channel: "sms" | "whatsapp"): Promise<ActionResult> {
  return guard(async () => {
    const s = await staff();
    const normalized = normalizePhone(phone);
    if (!normalized) return fail("Enter a valid phone number.");
    const [p] = await db
      .select({ id: patients.id })
      .from(patients)
      .where(and(eq(patients.orgId, s.org.id), eq(patients.phone, normalized)));
    if (!p) return fail("No patient of this practice has that number.");
    const res = await handleInboundMessage({ channel, from: normalized, body, replyMode: "deliver", orgId: s.org.id });
    return ok(`Understood as “${res.intent}”.${res.reply ? ` Auto-reply: ${res.reply}` : ""}`);
  });
}

export async function removeWaitlistEntry(id: string): Promise<ActionResult> {
  return guard(async () => {
    const s = await staff();
    await db.update(waitlist).set({ status: "removed" }).where(and(eq(waitlist.id, id), eq(waitlist.orgId, s.org.id)));
    return ok("Removed from the waitlist.");
  });
}

export async function replyToReview(id: string, reply: string): Promise<ActionResult> {
  return guard(async () => {
    const s = await staff(MANAGERS);
    await db.update(reviews).set({ reply: reply.trim() || null }).where(and(eq(reviews.id, id), eq(reviews.orgId, s.org.id)));
    return ok("Reply saved.");
  });
}

export async function setReviewPublished(id: string, published: boolean): Promise<ActionResult> {
  return guard(async () => {
    const s = await staff(MANAGERS);
    await db.update(reviews).set({ published }).where(and(eq(reviews.id, id), eq(reviews.orgId, s.org.id)));
    return ok(published ? "Review published." : "Review hidden.");
  });
}
