"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { appointments, locations, practitioners, type Channel } from "@/db/schema";
import {
  approveRequest,
  cancelAppointment,
  confirmAttendance,
  createAppointment,
  rescheduleAppointment,
  sendReminderNow,
  setOutcome,
} from "@/lib/booking";
import { normalizePhone } from "@/lib/phone";
import { hhmmToMinutes, zonedToUtc } from "@/lib/time";
import { fail, guard, ok, ownAppointment, type ActionResult } from "./_shared";

/** Calendar and appointment actions (WP2). */

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
  return guard(
    async (s) => {
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
    },
    { permission: "appointment.write" },
  );
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
  return guard(
    async (s) => {
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
    },
    { permission: "appointment.write" },
  );
}

export async function cancelByStaff(id: string, reason: string, notifyPatient: boolean): Promise<ActionResult> {
  return guard(
    async (s) => {
      await ownAppointment(s.org.id, id);
      const res = await cancelAppointment(id, { by: "staff", reason, notifyPatient });
      return res ? ok("Appointment cancelled. Waitlist notified if anyone matches.") : fail("Already cancelled.");
    },
    { permission: "appointment.write" },
  );
}

export async function recordOutcome(id: string, outcome: "completed" | "no_show" | "scheduled"): Promise<ActionResult> {
  return guard(
    async (s) => {
      await ownAppointment(s.org.id, id);
      await setOutcome(id, outcome);
      return ok(outcome === "completed" ? "Marked as completed." : outcome === "no_show" ? "Marked as no-show." : "Reset.");
    },
    { permission: "appointment.write" },
  );
}

export async function confirmByPhone(id: string): Promise<ActionResult> {
  return guard(
    async (s) => {
      await ownAppointment(s.org.id, id);
      const res = await confirmAttendance(id, "staff");
      return res ? ok("Confirmed.") : fail("Only scheduled appointments can be confirmed.");
    },
    { permission: "appointment.write" },
  );
}

export async function approve(id: string): Promise<ActionResult> {
  return guard(
    async (s) => {
      await ownAppointment(s.org.id, id);
      return (await approveRequest(id)) ? ok("Request approved — patient notified.") : fail("Not a pending request.");
    },
    { permission: "appointment.write" },
  );
}

export async function remindNow(id: string, channel: Channel): Promise<ActionResult> {
  return guard(
    async (s) => {
      const d = await ownAppointment(s.org.id, id);
      if (d.appointment.status !== "scheduled") return fail("Only scheduled appointments get reminders.");
      const summary = await sendReminderNow(id, channel, d.appointment.confirmation === "pending");
      if (summary.sent) return ok(`Reminder sent by ${channel}.`);
      return fail(channel === "email" ? "Patient has no email (or opted out)." : "Patient has no mobile number (or opted out).");
    },
    { permission: "appointment.write" },
  );
}

export async function saveInternalNote(id: string, note: string): Promise<ActionResult> {
  return guard(
    async (s) => {
      await ownAppointment(s.org.id, id);
      await db
        .update(appointments)
        .set({ internalNote: note.trim() || null, updatedAt: new Date() })
        .where(eq(appointments.id, id));
      return ok("Note saved.");
    },
    { permission: "appointment.notes.write" },
  );
}

export async function clearAttention(id: string): Promise<ActionResult> {
  return guard(
    async (s) => {
      await db
        .update(appointments)
        .set({ needsAttention: false })
        .where(and(eq(appointments.id, id), eq(appointments.orgId, s.org.id)));
      return ok("Marked as handled.");
    },
    { permission: "appointment.write" },
  );
}
