import { and, eq, inArray, sql } from "drizzle-orm";
import { db, type Tx } from "@/db";
import {
  appointments,
  orgFunds,
  patients,
  reminders,
  waitlist,
  type ActorRelation,
  type Appointment,
  type BookedFor,
  type Channel,
  type GuardianRelation,
  type Locale,
  type Patient,
  type PrivacySettings,
  type ProcessingContext,
} from "@/db/schema";
import {
  appointmentLinks,
  canReachByEmail,
  getAppointmentDetails,
  templateData,
  type AppointmentDetails,
} from "./appointments";
import { evaluateSlot, loadAvailabilityContext, REJECTION_LABELS, type AvailabilityContext, type SlotRejection } from "./availability";
import { isMinor, pickTextChannel } from "./contact";
import { newId } from "./ids";
import { issueManageToken } from "./links";
import { logError } from "./log";
import { deliver } from "./messaging";
import { templates } from "./messaging/templates";
import { normalizePhone } from "./phone";
import { effectiveBookingChoices, noticeVersionFor, validateBookingPrivacy } from "./privacy/booking-rules";
import {
  ConsentError,
  recordBookingConsents,
  type BookingPrivacyChoices,
  type BookingRelationInput,
} from "./privacy/consent";
import { validateBookingRelation } from "./privacy/minors";
import { getPrivacy } from "./privacy/settings";
import { cancelPendingReminders, enqueueNow, processDueReminders, scheduleReminders } from "./reminders";
import { resolveSettings } from "./settings";
import { offerFreedSlot } from "./waitlist";

export class BookingError extends Error {
  /** For "invalid": the privacy or relation rule that failed (e.g. "guardian_required"). */
  public reason?: string;
  /** The form field that rule is about (e.g. "platformConsent", "guardian.name"). */
  public field?: string;

  constructor(
    public code: SlotRejection | "not_found" | "invalid" | "not_allowed",
    message: string,
    detail?: { reason: string; field?: string },
  ) {
    super(message);
    this.name = "BookingError";
    this.reason = detail?.reason;
    this.field = detail?.field;
  }
}

/** A failed privacy or relation rule: BookingError('invalid', code), keeping the code and field for the API. */
function ruleError(code: string, field?: string): BookingError {
  return new BookingError("invalid", code, { reason: code, field });
}

/**
 * English fallback texts for the rule codes the booking API returns (the booking form maps the codes
 * to its own localised texts). Codes not listed get a generic text.
 */
const RULE_MESSAGES: Partial<Record<string, string>> = {
  privacy_required: "Please accept the privacy terms to continue.",
  not_accepting: "This practice isn't accepting online bookings right now. Please contact them directly.",
  platform_consent_required: "To book through Sorriso, please consent to the processing of your booking data.",
  whatsapp_consent_required: "Please confirm that you want to receive messages on WhatsApp.",
  whatsapp_unavailable: "This practice doesn't send WhatsApp messages. Please choose SMS or email.",
  guardian_required: "Patients under 14 must be booked by a parent or legal guardian.",
  birthdate_required: "Please enter the patient's date of birth.",
  invalid_birthdate: "Please check the date of birth.",
  not_a_minor: "The patient will be 18 or older on the day of the appointment.",
  guardian_name_required: "Please enter the parent's or guardian's name.",
  guardian_relation_required: "Please say whether you are a parent or a legal guardian.",
  guardian_contact_required: "Please enter a phone number or an email for the parent or guardian.",
  other_adult_must_book_themselves: "An adult has to book their own appointment here, or book directly with the practice.",
};

export function bookingRuleMessage(code: string): string {
  return RULE_MESSAGES[code] ?? "This booking can't be accepted as entered.";
}

export type NewPatientInput = {
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  /** Dial code for numbers typed without an international prefix (e.g. "49"); DEFAULT_COUNTRY_CODE otherwise. */
  phoneCountry?: string | null;
  birthDate?: string | null;
  locale?: Locale;
  /** Staff only: patient-facing bookings derive the opt-ins from the contacts given. */
  emailOptIn?: boolean;
  smsOptIn?: boolean;
  preferredChannel?: Patient["preferredChannel"];
  /** For minors: the parent or legal guardian who books and, under 14, receives the messages. */
  guardianName?: string | null;
  guardianRelation?: GuardianRelation | null;
  guardianPhone?: string | null;
  guardianEmail?: string | null;
};

function guardianFields(input: NewPatientInput) {
  return {
    guardianName: input.guardianName?.trim() || null,
    guardianRelation: input.guardianRelation ?? null,
    guardianPhone: normalizePhone(input.guardianPhone, input.phoneCountry),
    guardianEmail: input.guardianEmail?.trim().toLowerCase() || null,
  };
}

/**
 * Find the patient's existing record in this practice or create one.
 *
 * - "staff" (front desk, partner API): matches on (email or phone) AND first name and
 *   updates the record with what was entered.
 * - "public" (website, widget, waitlist — unauthenticated): an existing record is reused
 *   only if EVERY identifier given matches it exactly, and it is never modified. Otherwise
 *   a new record is created. This stops anyone who knows a patient's name and number from
 *   redirecting that patient's reminders (and manage links) to their own email.
 *   The opt-ins of a new record follow the contacts given; client-sent flags are ignored.
 *
 * Either way a parent booking for their child with the same contact details gets a
 * separate record, because the first name differs.
 */
export async function upsertPatient(
  tx: Tx,
  orgId: string,
  input: NewPatientInput,
  mode: "public" | "staff" = "public",
): Promise<{ patient: Patient; created: boolean }> {
  const email = input.email?.trim().toLowerCase() || null;
  const phone = normalizePhone(input.phone, input.phoneCountry);
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  if (!email && !phone) throw new BookingError("invalid", "An email address or phone number is required.");
  const guardian = guardianFields(input);

  const contactMatch =
    mode === "public"
      ? and(email ? eq(patients.email, email) : undefined, phone ? eq(patients.phone, phone) : undefined)
      : email && phone
        ? sql`(${patients.email} = ${email} OR ${patients.phone} = ${phone})`
        : email
          ? eq(patients.email, email)
          : eq(patients.phone, phone!);

  const candidates = await tx
    .select()
    .from(patients)
    .where(and(eq(patients.orgId, orgId), sql`lower(${patients.firstName}) = ${firstName.toLowerCase()}`, contactMatch))
    .limit(1);

  const existing = candidates[0];
  if (existing && mode === "public") return { patient: existing, created: false };
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
        guardianName: guardian.guardianName ?? existing.guardianName,
        guardianRelation: guardian.guardianRelation ?? existing.guardianRelation,
        guardianPhone: guardian.guardianPhone ?? existing.guardianPhone,
        guardianEmail: guardian.guardianEmail ?? existing.guardianEmail,
      })
      .where(and(eq(patients.id, existing.id), eq(patients.orgId, orgId)))
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
      // SMS and email are part of the booking service (contract): on for the contacts the patient gave.
      emailOptIn: mode === "public" ? Boolean(email) : (input.emailOptIn ?? true),
      smsOptIn: mode === "public" ? Boolean(phone) : (input.smsOptIn ?? true),
      preferredChannel: input.preferredChannel ?? (phone ? "sms" : "email"),
      ...guardian,
    })
    .returning();
  return { patient: created, created: true };
}

// ---------------------------------------------------------------- privacy and relation

/** Who the appointment is for (validateBookingRelation), plus who booked when it is another adult. */
export type BookingRelation = BookingRelationInput & {
  /** For bookedFor 'other_adult': stored on the appointment (booked_by_*), never as the patient's contacts. */
  bookedBy?: { name: string; phone?: string | null; email?: string | null };
};

/** The privacy part of a patient-facing booking or waitlist entry (the form's choices and how they were given). */
export type BookingPrivacy = {
  choices: BookingPrivacyChoices;
  /** The notice version the form displayed. Informational: the server stores noticeVersionFor(context). */
  noticeVersion: string | null;
  /** The language the notice and consent texts were shown in. */
  locale: Locale;
  source: Parameters<typeof recordBookingConsents>[1]["source"];
  /** Request headers, for the HMAC of the IP on consent rows (never the address itself). */
  headers?: Headers;
};

/** What a booking or waitlist entry records about privacy, decided before the patient record is touched. */
export type BookingPrivacyPlan = {
  context: ProcessingContext;
  bookedFor: BookedFor;
  /** The choices that may be recorded (see planBookingPrivacy). */
  choices: BookingPrivacyChoices;
  actorRelation: ActorRelation;
  noticeVersion: string | null;
  noticeLocale: Locale | null;
};

/**
 * Validate the privacy choices (validateBookingPrivacy; a failure throws BookingError('invalid', code))
 * and decide what may be recorded: only what the context and the practice allow
 * (effectiveBookingChoices), and nothing at all from someone booking for another adult — consent
 * can only come from the data subject, or a minor's guardian. Without `privacy` (staff, partner API)
 * nothing is validated or recorded.
 */
export function planBookingPrivacy(i: {
  context: ProcessingContext;
  relation?: BookingRelation;
  privacy?: BookingPrivacy;
  /** The channel the form asked for, before any downgrade. */
  preferredChannel: Channel;
  org: Pick<PrivacySettings, "whatsappEnabled" | "marketingEnabled">;
}): BookingPrivacyPlan {
  const bookedFor = i.relation?.bookedFor ?? "self";
  const org = { whatsappEnabled: i.org.whatsappEnabled, marketingEnabled: i.org.marketingEnabled };
  let choices: BookingPrivacyChoices = {};
  if (i.privacy) {
    const check = validateBookingPrivacy({
      context: i.context,
      preferredChannel: i.preferredChannel,
      choices: i.privacy.choices,
      noticeVersion: i.privacy.noticeVersion,
      org,
    });
    if (!check.ok) throw ruleError(check.code, check.field);
    choices = effectiveBookingChoices({ context: i.context, choices: i.privacy.choices, org });
  }
  if (bookedFor === "other_adult") {
    // TODO(WP4): on the marketplace, hold a booking for another adult until that adult confirms through a
    // link or one-time code (OTP purpose 'adult_confirmation') sent to their own contact, and record their
    // own choices (platform_booking_art9 included) then. minors.ts refuses these bookings until it exists.
    choices = {};
  }
  return {
    context: i.context,
    bookedFor,
    choices,
    actorRelation: bookedFor === "minor" ? (i.relation?.guardian?.relation ?? "parent") : "self",
    noticeVersion: i.privacy ? noticeVersionFor(i.context) : null,
    noticeLocale: i.privacy?.locale ?? null,
  };
}

/**
 * validateBookingRelation, a failure throwing BookingError('invalid', code). `birthDate` is the one
 * stored on the patient record when it has one (recordConsent checks that one), else the form's.
 * Nothing to check when no relation was given (staff, partner API).
 */
export function checkBookingRelation(
  relation: BookingRelation | undefined,
  birthDate: string | null | undefined,
  at: Date,
  context: ProcessingContext,
  now: Date,
): void {
  if (!relation) return;
  const check = validateBookingRelation(relation, birthDate, at, context, now);
  if (!check.ok) throw ruleError(check.code, check.field);
}

/**
 * The patient as the form gave them, adjusted for this booking: a minor's record carries the
 * guardian, and a patient-facing booking asks for WhatsApp only with a recordable WhatsApp consent
 * (otherwise the default channel for the contacts given).
 */
export function patientForBooking(
  p: NewPatientInput,
  relation: BookingRelation | undefined,
  plan: BookingPrivacyPlan,
  patientFacing: boolean,
): NewPatientInput {
  const g = relation?.bookedFor === "minor" ? relation.guardian : undefined;
  const downgrade = patientFacing && p.preferredChannel === "whatsapp" && !plan.choices.whatsapp;
  return {
    ...p,
    ...(downgrade ? { preferredChannel: undefined } : {}),
    ...(g ? { guardianName: g.name, guardianRelation: g.relation, guardianPhone: g.phone ?? null, guardianEmail: g.email ?? null } : {}),
  };
}

/** recordBookingConsents inside the booking's transaction; a minor consenting alone becomes guardian_required. */
export async function recordBookingChoices(
  tx: Tx,
  i: {
    orgId: string;
    patientId: string;
    appointmentId?: string | null;
    waitlistId?: string | null;
    plan: BookingPrivacyPlan;
    privacy: BookingPrivacy;
    now: Date;
  },
): Promise<void> {
  try {
    await recordBookingConsents(tx, {
      orgId: i.orgId,
      patientId: i.patientId,
      appointmentId: i.appointmentId,
      waitlistId: i.waitlistId,
      context: i.plan.context,
      choices: i.plan.choices,
      locale: i.privacy.locale,
      source: i.privacy.source,
      actorRelation: i.plan.actorRelation,
      headers: i.privacy.headers,
      now: i.now,
    });
  } catch (err) {
    if (err instanceof ConsentError && err.code === "guardian_required") throw ruleError("guardian_required", "bookedFor");
    throw err;
  }
}

/** Who booked for another adult, normalised like the patient's own contacts. */
function bookedByColumns(relation: BookingRelation | undefined, dialCode: string | null | undefined) {
  const b = relation?.bookedFor === "other_adult" ? relation.bookedBy : undefined;
  return {
    bookedByName: b?.name.trim() || null,
    bookedByPhone: normalizePhone(b?.phone, dialCode),
    bookedByEmail: b?.email?.trim().toLowerCase() || null,
  };
}

/** The fund the patient says they'll use, kept only if this practice lists it (for this service). */
async function listedFund(tx: Tx, orgId: string, serviceId: string, fundId: string | null | undefined): Promise<string | null> {
  if (!fundId) return null;
  const [row] = await tx
    .select({ serviceIds: orgFunds.serviceIds })
    .from(orgFunds)
    .where(and(eq(orgFunds.orgId, orgId), eq(orgFunds.fundId, fundId)));
  if (!row) return null;
  return !row.serviceIds || row.serviceIds.includes(serviceId) ? fundId : null;
}

/** Practitioner and chair must belong to this practice / office — `force` never bypasses this. */
function assertBookableResources(
  ctx: AvailabilityContext,
  practitionerId: string,
  locationId: string,
  roomId: string | null | undefined,
  online: boolean,
) {
  // Online, ctx only holds practitioners offering this service; for staff it holds the whole active team.
  if (!ctx.practitioners.some((p) => p.id === practitionerId)) {
    throw online
      ? new BookingError("not_offered", REJECTION_LABELS.not_offered)
      : new BookingError("not_found", "Practitioner not found (or not active) in this practice.");
  }
  if (roomId && !(ctx.roomsByLocation.get(locationId) ?? []).some((r) => r.id === roomId))
    throw new BookingError("not_found", "That chair isn't at this office.");
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
  /** The form's privacy choices. Patient-facing bookings without an API key always have them; staff may omit them. */
  privacy?: BookingPrivacy;
  /** Decided by the server (processingContextFor), never by the client. Default 'practice'. */
  processingContext?: ProcessingContext;
  /** Who the appointment is for. Without it (staff, partner API) the relation isn't checked. */
  relation?: BookingRelation;
  /** "I will use fund X": stored only if org_funds lists it for this practice. */
  fundId?: string | null;
  now?: Date;
};

export async function createAppointment(input: CreateAppointmentInput): Promise<AppointmentDetails> {
  const now = input.now ?? new Date();
  const start = input.startsAt;
  if (Number.isNaN(start.getTime())) throw new BookingError("invalid", "Invalid start time.");
  const context = input.processingContext ?? "practice";

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

    assertBookableResources(ctx, input.practitionerId, input.locationId, input.roomId, input.online);
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
    let plan: BookingPrivacyPlan;
    let createdPatient = false;
    const planFor = (preferredChannel: Channel) =>
      planBookingPrivacy({ context, relation: input.relation, privacy: input.privacy, preferredChannel, org: ctx.settings.privacy });
    if ("id" in input.patient) {
      const [p] = await tx
        .select()
        .from(patients)
        .where(and(eq(patients.id, input.patient.id), eq(patients.orgId, input.orgId)));
      if (!p) throw new BookingError("not_found", "Patient not found.");
      patient = p;
      plan = planFor(p.preferredChannel);
    } else {
      plan = planFor(input.patient.preferredChannel ?? (input.patient.phone ? "sms" : "email"));
      const res = await upsertPatient(
        tx,
        input.orgId,
        patientForBooking(input.patient, input.relation, plan, input.online),
        input.online ? "public" : "staff",
      );
      patient = res.patient;
      createdPatient = res.created;
    }
    const birthDate = patient.birthDate || ("id" in input.patient ? null : input.patient.birthDate) || null;
    checkBookingRelation(input.relation, birthDate, start, context, now);
    const dialCode = "id" in input.patient ? null : input.patient.phoneCountry;

    const status = input.online && ctx.settings.booking.requireApproval ? "requested" : "scheduled";
    const endsAt = new Date(start.getTime() + duration * 60_000);
    const id = newId();
    const link = issueManageToken();
    const [appointment] = await tx
      .insert(appointments)
      .values({
        id,
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
        manageToken: `h:${id}`,
        manageTokenHash: link.hash,
        manageTokenEnc: link.token,
        processingContext: context,
        bookedFor: plan.bookedFor,
        ...bookedByColumns(input.relation, dialCode),
        noticeVersion: plan.noticeVersion,
        noticeLocale: plan.noticeLocale,
        minorFlag: isMinor({ birthDate }, start),
        fundId: await listedFund(tx, input.orgId, input.serviceId, input.fundId),
      })
      .returning();

    if (input.privacy) {
      await recordBookingChoices(tx, { orgId: input.orgId, patientId: patient.id, appointmentId: id, plan, privacy: input.privacy, now });
    }

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
  await processDueReminders({ appointmentId, now }).catch((err) => logError("booking", err, { step: "confirmation", appointmentId }));
  return (await getAppointmentDetails({ id: appointmentId }))!;
}

/** The channel for a message the patient didn't ask for (staff cancelled or moved the visit). */
async function textOrEmail(d: AppointmentDetails): Promise<Channel | null> {
  if (d.patient.preferredChannel !== "email" && d.patient.phone) {
    const text = pickTextChannel(d.patient, getPrivacy(d.org));
    if (text) return text;
  }
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
  ).catch((err) => logError("waitlist", err, { step: "offer" }));

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
    assertBookableResources(ctx, practitionerId, locationId, opts.roomId, online);
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
      .where(and(eq(appointments.id, appointmentId), inArray(appointments.status, ["scheduled", "requested"])))
      .returning();
    if (!updated) throw new BookingError("not_allowed", "This appointment was cancelled or completed in the meantime.");
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
  ).catch((err) => logError("waitlist", err, { step: "offer" }));

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
    // Guard on the status we read: a double-click can't count a no-show twice.
    const [row] = await tx
      .update(appointments)
      .set({ status: outcome, updatedAt: now })
      .where(and(eq(appointments.id, appointmentId), eq(appointments.status, before.appointment.status)))
      .returning();
    if (!row) return;
    const delta = (outcome === "no_show" ? 1 : 0) - (before.appointment.status === "no_show" ? 1 : 0);
    if (delta !== 0) {
      await tx
        .update(patients)
        .set({ noShowCount: sql`max(0, ${patients.noShowCount} + ${delta})` })
        .where(eq(patients.id, before.patient.id));
    }
    const settings = resolveSettings(before.org.settings);
    if (outcome === "scheduled") {
      // Undoing a mistaken outcome: bring back the reminders, drop the review request.
      await cancelPendingReminders(tx, appointmentId, ["review_request"]);
      await scheduleReminders(tx, row, settings, now);
      return;
    }
    await cancelPendingReminders(tx, appointmentId, ["reminder"]);
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
