import { and, eq, sql } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { appointments, patients, reminders, waitlist, type Appointment, type Channel, type Patient } from "@/db/schema";
import {
  appointmentLinks,
  canReachByEmail,
  canReachByPhone,
  getAppointmentDetails,
  templateData,
  type AppointmentDetails,
} from "./appointments";
import { evaluateSlot, loadAvailabilityContext, REJECTION_LABELS, type SlotRejection } from "./availability";
import { newId, newToken } from "./ids";
import { deliver } from "./messaging";
import { templates } from "./messaging/templates";
import { normalizePhone } from "./phone";
import { cancelPendingReminders, enqueueNow, processDueReminders, scheduleReminders } from "./reminders";
import { resolveSettings } from "./settings";
import { offerFreedSlot } from "./waitlist";

export class BookingError extends Error {
  constructor(
    public code: SlotRejection | "not_found" | "invalid" | "not_allowed",
    message: string,
  ) {
    super(message);
    this.name = "BookingError";
  }
}

export type NewPatientInput = {
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  birthDate?: string | null;
  locale?: "it" | "en";
  emailOptIn?: boolean;
  smsOptIn?: boolean;
  preferredChannel?: Patient["preferredChannel"];
};

/**
 * Find the patient's existing record in this practice or create one.
 * Matches on (email or phone) AND first name, so a parent booking for their
 * child with the same contact details still gets two separate records.
 */
export async function upsertPatient(tx: Tx, orgId: string, input: NewPatientInput): Promise<{ patient: Patient; created: boolean }> {
  const email = input.email?.trim().toLowerCase() || null;
  const phone = normalizePhone(input.phone);
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  if (!email && !phone) throw new BookingError("invalid", "An email address or phone number is required.");

  const candidates = await tx
    .select()
    .from(patients)
    .where(
      and(
        eq(patients.orgId, orgId),
        sql`lower(${patients.firstName}) = ${firstName.toLowerCase()}`,
        email && phone
          ? sql`(${patients.email} = ${email} OR ${patients.phone} = ${phone})`
          : email
            ? eq(patients.email, email)
            : eq(patients.phone, phone!),
      ),
    )
    .limit(1);

  const existing = candidates[0];
  if (existing) {
    const [updated] = await tx
      .update(patients)
      .set({
        lastName: lastName || existing.lastName,
        email: email ?? existing.email,
        phone: phone ?? existing.phone,
        birthDate: input.birthDate || existing.birthDate,
        locale: input.locale ?? existing.locale,
        emailOptIn: input.emailOptIn ?? existing.emailOptIn,
        smsOptIn: input.smsOptIn ?? existing.smsOptIn,
        preferredChannel: input.preferredChannel ?? existing.preferredChannel,
      })
      .where(eq(patients.id, existing.id))
      .returning();
    return { patient: updated, created: false };
  }

  const [created] = await tx
    .insert(patients)
    .values({
      id: newId(),
      orgId,
      firstName,
      lastName,
      email,
      phone,
      birthDate: input.birthDate || null,
      locale: input.locale ?? "it",
      emailOptIn: input.emailOptIn ?? true,
      smsOptIn: input.smsOptIn ?? true,
      preferredChannel: input.preferredChannel ?? (phone ? "sms" : "email"),
    })
    .returning();
  return { patient: created, created: true };
}

export type CreateAppointmentInput = {
  orgId: string;
  serviceId: string;
  practitionerId: string;
  locationId: string;
  startsAt: Date;
  patient: { id: string } | NewPatientInput;
  source: Appointment["source"];
  /** Online = booked by the patient: enforces policy, working hours and service links. */
  online: boolean;
  durationMinutes?: number;
  roomId?: string | null;
  patientNote?: string | null;
  internalNote?: string | null;
  isNewPatient?: boolean;
  /** Staff only: book even if it conflicts. */
  force?: boolean;
  /** Send the booking confirmation (always for online bookings). */
  notifyPatient?: boolean;
  waitlistEntryId?: string | null;
  now?: Date;
};

export async function createAppointment(input: CreateAppointmentInput): Promise<AppointmentDetails> {
  const now = input.now ?? new Date();
  const start = input.startsAt;
  if (Number.isNaN(start.getTime())) throw new BookingError("invalid", "Invalid start time.");

  const appointmentId = await db.transaction(async (tx) => {
    const ctx = await loadAvailabilityContext(
      {
        orgId: input.orgId,
        serviceId: input.serviceId,
        practitionerIds: [input.practitionerId],
        locationId: input.locationId,
        rangeStart: new Date(start.getTime() - 86_400_000),
        rangeEnd: new Date(start.getTime() + 2 * 86_400_000),
        requireServiceLink: input.online,
      },
      tx,
    );
    if (!ctx) throw new BookingError("not_found", "Service not found.");
    if (!ctx.locations.has(input.locationId)) throw new BookingError("not_found", "Location not found.");
    if (input.online && (!ctx.service.onlineBookable || !ctx.service.active))
      throw new BookingError("not_allowed", "This service can't be booked online.");

    const duration = input.durationMinutes ?? ctx.service.durationMinutes;
    const evaluation = evaluateSlot(ctx, {
      practitionerId: input.practitionerId,
      locationId: input.locationId,
      start,
      durationMinutes: duration,
      roomId: input.roomId,
      enforcePolicy: input.online,
      requireWorkingHours: input.online,
      now,
    });
    if (!evaluation.ok && (input.online || !input.force)) {
      throw new BookingError(evaluation.reason, REJECTION_LABELS[evaluation.reason]);
    }
    const roomId = evaluation.ok ? evaluation.roomId : (input.roomId ?? null);

    let patient: Patient;
    let createdPatient = false;
    if ("id" in input.patient) {
      const [p] = await tx
        .select()
        .from(patients)
        .where(and(eq(patients.id, input.patient.id), eq(patients.orgId, input.orgId)));
      if (!p) throw new BookingError("not_found", "Patient not found.");
      patient = p;
    } else {
      const res = await upsertPatient(tx, input.orgId, input.patient);
      patient = res.patient;
      createdPatient = res.created;
    }

    const status = input.online && ctx.settings.booking.requireApproval ? "requested" : "scheduled";
    const endsAt = new Date(start.getTime() + duration * 60_000);
    const [appointment] = await tx
      .insert(appointments)
      .values({
        id: newId(),
        orgId: input.orgId,
        locationId: input.locationId,
        practitionerId: input.practitionerId,
        roomId,
        serviceId: input.serviceId,
        patientId: patient.id,
        startsAt: start,
        endsAt,
        blockedUntil: new Date(endsAt.getTime() + ctx.service.bufferMinutes * 60_000),
        status,
        source: input.source,
        isNewPatient: input.isNewPatient ?? createdPatient,
        patientNote: input.patientNote?.trim() || null,
        internalNote: input.internalNote?.trim() || null,
        manageToken: newToken(),
      })
      .returning();

    const willAsk = await scheduleReminders(tx, appointment, ctx.settings, now);
    // Booked by the patient themselves too close to the visit for a confirmation
    // request: booking it is confirmation enough.
    if (input.online && status === "scheduled" && !willAsk) {
      await tx
        .update(appointments)
        .set({ confirmation: "confirmed", confirmedAt: now, confirmedVia: "booking" })
        .where(eq(appointments.id, appointment.id));
    }

    const notify = input.online || input.notifyPatient;
    if (notify && ctx.settings.reminders.sendBookingConfirmation) {
      await enqueueNow(tx, appointment.id, "booking_confirmation", "email", now);
    }

    if (input.waitlistEntryId) {
      await tx
        .update(waitlist)
        .set({ status: "booked" })
        .where(
          and(eq(waitlist.id, input.waitlistEntryId), eq(waitlist.orgId, input.orgId), eq(waitlist.patientId, patient.id)),
        );
    }
    return appointment.id;
  });

  // Send the confirmation right away (best effort; the cron retries on failure).
  await processDueReminders({ appointmentId, now }).catch((err) => console.error("[booking] confirmation failed", err));
  return (await getAppointmentDetails({ id: appointmentId }))!;
}

async function textOrEmail(d: AppointmentDetails): Promise<Channel | null> {
  if (canReachByPhone(d.patient) && d.patient.preferredChannel !== "email")
    return d.patient.preferredChannel === "whatsapp" ? "whatsapp" : "sms";
  if (canReachByEmail(d.patient)) return "email";
  return null;
}

/** Patient confirmed they'll attend (reply, link, or staff phoned them). */
export async function confirmAttendance(appointmentId: string, via: string, now = new Date()) {
  const [updated] = await db
    .update(appointments)
    .set({ confirmation: "confirmed", confirmedAt: now, confirmedVia: via, needsAttention: false, updatedAt: now })
    .where(and(eq(appointments.id, appointmentId), eq(appointments.status, "scheduled")))
    .returning();
  return updated ?? null;
}

export async function cancelAppointment(
  appointmentId: string,
  opts: { by: "patient" | "staff"; reason?: string | null; notifyPatient?: boolean; via?: string; now?: Date },
): Promise<AppointmentDetails | null> {
  const now = opts.now ?? new Date();
  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(appointments)
      .set({
        status: "cancelled",
        confirmation: opts.by === "patient" ? "declined" : undefined,
        confirmedVia: opts.by === "patient" ? (opts.via ?? "web") : undefined,
        cancelledAt: now,
        cancelledBy: opts.by,
        cancelReason: opts.reason?.trim() || null,
        needsAttention: false,
        updatedAt: now,
      })
      .where(and(eq(appointments.id, appointmentId), sql`${appointments.status} in ('scheduled', 'requested')`))
      .returning();
    if (row) await cancelPendingReminders(tx, appointmentId);
    return row;
  });
  if (!updated) return null;

  const details = (await getAppointmentDetails({ id: appointmentId }))!;
  const shouldNotify = opts.notifyPatient ?? true;
  if (shouldNotify) {
    const data = templateData(details);
    const { rebookUrl } = appointmentLinks(details);
    // Patients who cancelled get an email receipt; staff cancellations go out on their preferred channel.
    const channel = opts.by === "patient" ? (canReachByEmail(details.patient) ? "email" : null) : await textOrEmail(details);
    if (channel) {
      const email = templates.cancelledEmail(data, opts.by, rebookUrl);
      await deliver({
        orgId: details.org.id,
        appointmentId,
        patientId: details.patient.id,
        channel,
        to: channel === "email" ? details.patient.email! : details.patient.phone!,
        subject: channel === "email" ? email.subject : undefined,
        text: channel === "email" ? email.text : templates.cancelledSms(data, rebookUrl),
        html: channel === "email" ? email.html : undefined,
        fromName: details.org.name,
        replyTo: details.org.email,
      });
    }
  }

  await offerFreedSlot(
    {
      orgId: updated.orgId,
      serviceId: updated.serviceId,
      practitionerId: updated.practitionerId,
      locationId: updated.locationId,
      startsAt: updated.startsAt,
    },
    now,
  ).catch((err) => console.error("[waitlist] offer failed", err));

  return details;
}

export async function rescheduleAppointment(
  appointmentId: string,
  opts: {
    startsAt: Date;
    practitionerId?: string;
    locationId?: string;
    roomId?: string | null;
    durationMinutes?: number;
    by: "patient" | "staff";
    force?: boolean;
    notifyPatient?: boolean;
    now?: Date;
  },
): Promise<AppointmentDetails> {
  const now = opts.now ?? new Date();
  const before = await getAppointmentDetails({ id: appointmentId });
  if (!before) throw new BookingError("not_found", "Appointment not found.");
  if (!["scheduled", "requested"].includes(before.appointment.status))
    throw new BookingError("not_allowed", "Only upcoming appointments can be moved.");

  const online = opts.by === "patient";
  const practitionerId = opts.practitionerId ?? before.appointment.practitionerId;
  const locationId = opts.locationId ?? before.appointment.locationId;
  const duration =
    opts.durationMinutes ??
    Math.round((before.appointment.endsAt.getTime() - before.appointment.startsAt.getTime()) / 60_000);

  await db.transaction(async (tx) => {
    const ctx = await loadAvailabilityContext(
      {
        orgId: before.org.id,
        serviceId: before.service.id,
        practitionerIds: [practitionerId],
        locationId,
        rangeStart: new Date(opts.startsAt.getTime() - 86_400_000),
        rangeEnd: new Date(opts.startsAt.getTime() + 2 * 86_400_000),
        requireServiceLink: online,
      },
      tx,
    );
    if (!ctx || !ctx.locations.has(locationId)) throw new BookingError("not_found", "Location not found.");
    // Keep the same chair if it's still free at the same office.
    const keepRoom = locationId === before.appointment.locationId ? before.appointment.roomId : null;
    let evaluation = evaluateSlot(ctx, {
      practitionerId,
      locationId,
      start: opts.startsAt,
      durationMinutes: duration,
      roomId: opts.roomId !== undefined ? opts.roomId : keepRoom,
      ignoreAppointmentId: appointmentId,
      enforcePolicy: online,
      requireWorkingHours: online,
      now,
    });
    if (!evaluation.ok && evaluation.reason === "no_room" && opts.roomId === undefined && keepRoom) {
      evaluation = evaluateSlot(ctx, {
        practitionerId,
        locationId,
        start: opts.startsAt,
        durationMinutes: duration,
        ignoreAppointmentId: appointmentId,
        enforcePolicy: online,
        requireWorkingHours: online,
        now,
      });
    }
    if (!evaluation.ok && (online || !opts.force)) {
      throw new BookingError(evaluation.reason, REJECTION_LABELS[evaluation.reason]);
    }
    const endsAt = new Date(opts.startsAt.getTime() + duration * 60_000);
    const [updated] = await tx
      .update(appointments)
      .set({
        startsAt: opts.startsAt,
        endsAt,
        blockedUntil: new Date(endsAt.getTime() + ctx.service.bufferMinutes * 60_000),
        practitionerId,
        locationId,
        roomId: evaluation.ok ? evaluation.roomId : (opts.roomId ?? null),
        // A patient picking the new time themselves has confirmed it; a move by the practice needs re-confirmation.
        confirmation: online ? "confirmed" : "pending",
        confirmedAt: online ? now : null,
        confirmedVia: online ? "web" : null,
        needsAttention: false,
        updatedAt: now,
      })
      .where(eq(appointments.id, appointmentId))
      .returning();
    await scheduleReminders(tx, updated, ctx.settings, now);
  });

  const after = (await getAppointmentDetails({ id: appointmentId }))!;

  if (opts.notifyPatient ?? true) {
    const data = templateData(after);
    const channel = online ? (canReachByEmail(after.patient) ? "email" : null) : await textOrEmail(after);
    if (channel) {
      const email = templates.rescheduledEmail(data);
      await deliver({
        orgId: after.org.id,
        appointmentId,
        patientId: after.patient.id,
        channel,
        to: channel === "email" ? after.patient.email! : after.patient.phone!,
        subject: channel === "email" ? email.subject : undefined,
        text: channel === "email" ? email.text : templates.rescheduledSms(data),
        html: channel === "email" ? email.html : undefined,
        fromName: after.org.name,
        replyTo: after.org.email,
      });
    }
  }

  await offerFreedSlot(
    {
      orgId: before.org.id,
      serviceId: before.service.id,
      practitionerId: before.appointment.practitionerId,
      locationId: before.appointment.locationId,
      startsAt: before.appointment.startsAt,
    },
    now,
  ).catch((err) => console.error("[waitlist] offer failed", err));

  return after;
}

/** Front desk accepts an online booking request. */
export async function approveRequest(appointmentId: string, now = new Date()) {
  const ok = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(appointments)
      .set({ status: "scheduled", updatedAt: now })
      .where(and(eq(appointments.id, appointmentId), eq(appointments.status, "requested")))
      .returning();
    if (!updated) return false;
    const details = (await getAppointmentDetails({ id: appointmentId }, tx))!;
    await scheduleReminders(tx, updated, resolveSettings(details.org.settings), now);
    await enqueueNow(tx, appointmentId, "approval", "email", now);
    return true;
  });
  if (ok) await processDueReminders({ appointmentId, now });
  return ok;
}

/** Record how the visit went. Completed visits can trigger a review request. */
export async function setOutcome(appointmentId: string, outcome: "completed" | "no_show" | "scheduled", now = new Date()) {
  const before = await getAppointmentDetails({ id: appointmentId });
  if (!before) throw new BookingError("not_found", "Appointment not found.");
  if (!["scheduled", "completed", "no_show"].includes(before.appointment.status))
    throw new BookingError("not_allowed", "This appointment can't be updated.");
  if (before.appointment.status === outcome) return before;

  await db.transaction(async (tx) => {
    await tx.update(appointments).set({ status: outcome, updatedAt: now }).where(eq(appointments.id, appointmentId));
    const delta = (outcome === "no_show" ? 1 : 0) - (before.appointment.status === "no_show" ? 1 : 0);
    if (delta !== 0) {
      await tx
        .update(patients)
        .set({ noShowCount: sql`max(0, ${patients.noShowCount} + ${delta})` })
        .where(eq(patients.id, before.patient.id));
    }
    if (outcome !== "scheduled") await cancelPendingReminders(tx, appointmentId, ["reminder"]);
    const settings = resolveSettings(before.org.settings);
    if (outcome === "completed" && settings.reminders.requestReviews) {
      // Give the patient a couple of hours after the visit.
      const at = new Date(Math.max(now.getTime(), before.appointment.endsAt.getTime()) + 2 * 3_600_000);
      await cancelPendingReminders(tx, appointmentId, ["review_request"]);
      await enqueueNow(tx, appointmentId, "review_request", "email", at);
    }
  });
  return (await getAppointmentDetails({ id: appointmentId }))!;
}

/** Staff-triggered "send a reminder now" from the calendar. */
export async function sendReminderNow(appointmentId: string, channel: Channel, askConfirmation = true) {
  const now = new Date();
  await db.insert(reminders).values({
    id: newId(),
    appointmentId,
    kind: "reminder",
    channel,
    askConfirmation,
    fallbackToEmail: false,
    sendAt: now,
  });
  return processDueReminders({ appointmentId, now });
}
