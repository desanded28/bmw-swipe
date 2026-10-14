import { and, asc, count, desc, eq, inArray, isNotNull, isNull, ne, sql } from "drizzle-orm";
import { db, type Tx } from "@/db";
import {
  appointments,
  consents,
  formSubmissions,
  messages,
  orgFunds,
  patients,
  privacyRequests,
  recalls,
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
  appointmentWhatsApp,
  canReachByEmail,
  getAppointmentDetails,
  templateData,
  textChannelFor,
  type AppointmentDetails,
} from "./appointments";
import { audit, type AuditEvent } from "./audit";
import {
  evaluateSlot,
  findSlots,
  loadAvailabilityContext,
  rangeForDates,
  REJECTION_LABELS,
  type AvailabilityContext,
  type SlotRejection,
} from "./availability";
import { isMinor, isRestricted, recipientFor } from "./contact";
import { newId } from "./ids";
import { issueManageToken } from "./links";
import { logError } from "./log";
import { deliver } from "./messaging";
import { templates } from "./messaging/templates";
import { normalizePhone } from "./phone";
import { adultContacts, requestAdultConfirmation, sendBookedForYouNotice } from "./privacy/adult-confirmation";
import { effectiveBookingChoices, noticeVersionFor, validateBookingPrivacy } from "./privacy/booking-rules";
import {
  ConsentError,
  recordBookingConsents,
  type BookingPrivacyChoices,
  type BookingRelationInput,
} from "./privacy/consent";
import { validateBookingRelation } from "./privacy/minors";
import { recordBookingNotices } from "./privacy/notices";
import { dropRecallForVisit, markRecallBooked, reopenRecallsFor, upsertRecall } from "./recalls";
import { cancelPendingReminders, enqueueNow, processDueReminders, scheduleReminders } from "./reminders";
import { refreshAppointmentRisk } from "./risk";
import { resolveSettings } from "./settings";
import { addDays, diffDays, todayIn, zonedParts } from "./time";
import { offerFreedSlot } from "./waitlist";

export class BookingError extends Error {
  /** For "invalid": the privacy or relation rule that failed (e.g. "guardian_required"). */
  public reason?: string;
  /** The form field that rule is about (e.g. "platformConsent", "guardian.name"). */
  public field?: string;

  constructor(
    /** restricted: the patient's data is restricted (Art. 18) and staff gave no reason to book anyway. */
    public code: SlotRejection | "not_found" | "invalid" | "not_allowed" | "restricted",
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
  other_adult_contact_required:
    "Please enter the patient's own phone number or email (not yours): they confirm the booking through it.",
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
 * Candidates are the practice's records with the same first name and a contact in common
 * (merged tombstones and erased records never match).
 *
 * - "staff" (front desk, partner API): the first candidate whose birth date doesn't contradict
 *   the one entered (both present and different) is reused and updated with what was entered.
 *   Same name and contact but a different birth date is a different person until staff say
 *   otherwise: a new record, flagged possibleDuplicateOfId (never merged silently).
 * - "public" (website, widget, waitlist — unauthenticated): an existing record is reused
 *   only if EVERY identifier given matches it exactly, and it is never modified. Otherwise
 *   a new record is created. This stops anyone who knows a patient's name and number from
 *   redirecting that patient's reminders (and manage links) to their own email.
 *   The birth date counts as an identifier both ways (the record's must equal the one given,
 *   both possibly empty), so every age rule downstream (validateBookingRelation, recordConsent)
 *   sees exactly what the requester typed: a stored record can't change the answer, and the
 *   public routes can't be used to learn whether someone is a patient here, or a minor.
 *   A restricted record (Art. 18) is never reused by a public booking: the new booking gets a
 *   record of its own, flagged as a possible duplicate for the practice to review.
 *   The opt-ins of a new record follow the contacts given — the guardian's too, since a
 *   child's messages go to them (recipientFor); client-sent flags are ignored.
 *
 * Either way a parent booking for their child with the same contact details gets a
 * separate record, because the first name differs; and a new record that shares the first name
 * and a contact with an existing one is flagged for the duplicates queue
 * (/dashboard/patients/duplicates), whatever the mode.
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
  const guardian = guardianFields(input);
  // A child may have no contacts of their own: the guardian's then identify the record (and
  // receive the messages, recipientFor).
  const viaGuardian = !email && !phone;
  if (viaGuardian && !guardian.guardianPhone && !guardian.guardianEmail) {
    throw new BookingError("invalid", "An email address or phone number is required.");
  }
  const birthDate = input.birthDate || null;

  type TextColumn = typeof patients.email | typeof patients.guardianEmail | typeof patients.phone | typeof patients.guardianPhone;
  const contactMatch = (e: string | null, ph: string | null, emailCol: TextColumn, phoneCol: TextColumn) =>
    e && ph ? sql`(${emailCol} = ${e} OR ${phoneCol} = ${ph})` : e ? eq(emailCol, e) : eq(phoneCol, ph!);
  const anyContact = viaGuardian
    ? and(
        contactMatch(guardian.guardianEmail, guardian.guardianPhone, patients.guardianEmail, patients.guardianPhone),
        isNull(patients.email),
        isNull(patients.phone),
      )
    : contactMatch(email, phone, patients.email, patients.phone);
  const candidates = await tx
    .select()
    .from(patients)
    .where(
      and(
        eq(patients.orgId, orgId),
        sql`lower(${patients.firstName}) = ${firstName.toLowerCase()}`,
        anyContact,
        isNull(patients.mergedIntoId),
        isNull(patients.erasedAt),
      ),
    )
    .orderBy(asc(patients.createdAt))
    .limit(20);

  const existing =
    mode === "public"
      ? candidates.find(
          (c) =>
            (viaGuardian
              ? (!guardian.guardianEmail || c.guardianEmail === guardian.guardianEmail) &&
                (!guardian.guardianPhone || c.guardianPhone === guardian.guardianPhone)
              : (!email || c.email === email) && (!phone || c.phone === phone)) &&
            (c.birthDate || "") === (birthDate || "") &&
            !isRestricted(c),
        )
      : (candidates.find((c) => birthDate && c.birthDate === birthDate) ??
        candidates.find((c) => !(birthDate && c.birthDate && c.birthDate !== birthDate)));

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
      birthDate,
      locale: input.locale ?? "it",
      // SMS and email are part of the booking service (contract): on for the contacts given, including
      // the guardian's, which a child under 14's messages go to (recipientFor).
      emailOptIn: mode === "public" ? Boolean(email || guardian.guardianEmail) : (input.emailOptIn ?? true),
      smsOptIn: mode === "public" ? Boolean(phone || guardian.guardianPhone) : (input.smsOptIn ?? true),
      // A child reachable only through the guardian's phone still gets texts.
      preferredChannel: input.preferredChannel ?? (phone || guardian.guardianPhone ? "sms" : "email"),
      possibleDuplicateOfId: candidates[0]?.id ?? null,
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
  /**
   * A marketplace booking for another adult: held (status 'requested', no consent, no reminders)
   * until that adult confirms it themselves (src/lib/privacy/adult-confirmation.ts).
   */
  awaitsAdult: boolean;
};

/**
 * Validate the privacy choices (validateBookingPrivacy; a failure throws BookingError('invalid', code))
 * and decide what may be recorded: only what the context and the practice allow
 * (effectiveBookingChoices), and nothing at all from someone booking for another adult — consent
 * can only come from the data subject, or a minor's guardian. Without `privacy` (staff, partner API)
 * nothing is validated or recorded.
 *
 * Another adult: through the practice's channels the practice gives the Art. 14 notice
 * (sendBookedForYouNotice after the booking). On the marketplace Sorriso's Art. 9(2)(a) consent can
 * only come from that adult, so a booking is held for their own confirmation (`holdForAdult`,
 * createAppointment: requestAdultConfirmation); a caller that can't hold (the waitlist) is refused
 * with other_adult_must_book_themselves. The booker's contact is stored apart (booked_by_*,
 * bookedByColumns) and never matches the patient's records in the privacy center.
 */
export function planBookingPrivacy(i: {
  context: ProcessingContext;
  relation?: BookingRelation;
  privacy?: BookingPrivacy;
  /** The channel the form asked for, before any downgrade. */
  preferredChannel: Channel;
  org: Pick<PrivacySettings, "whatsappEnabled" | "marketingEnabled">;
  /** The caller holds a marketplace booking for another adult until they confirm (createAppointment only). */
  holdForAdult?: boolean;
}): BookingPrivacyPlan {
  const bookedFor = i.relation?.bookedFor ?? "self";
  const awaitsAdult = bookedFor === "other_adult" && i.context === "marketplace";
  if (awaitsAdult && !i.holdForAdult) throw ruleError("other_adult_must_book_themselves", "bookedFor");
  const org = { whatsappEnabled: i.org.whatsappEnabled, marketingEnabled: i.org.marketingEnabled };
  let choices: BookingPrivacyChoices = {};
  if (i.privacy) {
    const check = validateBookingPrivacy({
      context: i.context,
      preferredChannel: i.preferredChannel,
      choices: i.privacy.choices,
      noticeVersion: i.privacy.noticeVersion,
      org,
      bookedFor,
    });
    if (!check.ok) throw ruleError(check.code, check.field);
    // Nothing at all for another adult: only they can consent, later, through their own messages.
    choices = effectiveBookingChoices({ context: i.context, choices: i.privacy.choices, org, bookedFor });
  }
  return {
    context: i.context,
    bookedFor,
    choices,
    actorRelation: bookedFor === "minor" ? (i.relation?.guardian?.relation ?? "parent") : "self",
    noticeVersion: i.privacy ? noticeVersionFor(i.context) : null,
    noticeLocale: i.privacy?.locale ?? null,
    awaitsAdult,
  };
}

/**
 * validateBookingRelation, a failure throwing BookingError('invalid', code). `birthDate` is the one
 * stored on the patient record when it has one (recordConsent checks that one), else the form's; for
 * public bookings the two are the same (upsertPatient reuses a record only with the same birth date).
 *
 * Nothing to check when no relation was given: staff, partner API, and a form that never asked who
 * the appointment is for (until WP4's PatientRelationSection, the booking form doesn't). Such a
 * booking is not taken as 'self': refusing a child "booking alone" when nobody asked would refuse
 * the parent booking for them. Consents are still recorded as the patient's own, so recordConsent
 * refuses any consent for a patient under 14 (guardian_required).
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
  /**
   * Staff only: why a restricted patient (Art. 18) is booked anyway. Without it such a booking
   * fails with BookingError "restricted"; with it the access is audited (patient.restricted_access).
   */
  restrictedAccessReason?: string | null;
  /** Who is booking, for the audit log (default: an unidentified staff user). */
  actor?: AuditEvent["actor"];
  now?: Date;
};

/** Merged duplicates are tombstones: a booking by id lands on the record they were merged into. */
async function survivingPatient(tx: Tx, orgId: string, id: string): Promise<Patient | null> {
  let [p] = await tx
    .select()
    .from(patients)
    .where(and(eq(patients.id, id), eq(patients.orgId, orgId)));
  for (let hop = 0; p?.mergedIntoId && hop < 5; hop++) {
    [p] = await tx
      .select()
      .from(patients)
      .where(and(eq(patients.id, p.mergedIntoId), eq(patients.orgId, orgId)));
  }
  return p ?? null;
}

/**
 * Restriction (Art. 18): the data is kept but not used. A new booking for a restricted patient
 * needs a staff reason, recorded in the audit log; patient-facing bookings never reach a restricted
 * record (upsertPatient gives them a record of their own). Erased records can't be booked.
 */
async function assertMayBook(tx: Tx, patient: Patient, input: CreateAppointmentInput, now: Date): Promise<void> {
  if (patient.erasedAt) throw new BookingError("not_allowed", "This patient record was erased.", { reason: "patient_erased" });
  if (!patient.restrictedAt) return;
  const reason = input.restrictedAccessReason?.trim();
  if (input.online || !reason) {
    throw new BookingError("restricted", "This patient's data is restricted. Give a reason to book anyway.", {
      reason: "restriction_reason_required",
      field: "restrictedAccessReason",
    });
  }
  await audit(
    {
      orgId: input.orgId,
      actor: input.actor ?? { type: "user", id: null },
      action: "patient.restricted_access",
      entity: { type: "patient", id: patient.id },
      reason: reason.slice(0, 500),
      metadata: { purpose: "booking" },
      at: now,
    },
    tx,
  );
}

export async function createAppointment(input: CreateAppointmentInput): Promise<AppointmentDetails> {
  const now = input.now ?? new Date();
  const start = input.startsAt;
  if (Number.isNaN(start.getTime())) throw new BookingError("invalid", "Invalid start time.");
  const context = input.processingContext ?? "practice";
  // Only a relation the form actually asked is checked: none is not 'self' (see checkBookingRelation).
  const relation = input.relation;

  // Writes inside the transaction go through `tx` only (src/db/serialize.ts: the root db deadlocks here).
  const booked = await db.transaction(async (tx) => {
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
      planBookingPrivacy({ context, relation, privacy: input.privacy, preferredChannel, org: ctx.settings.privacy, holdForAdult: true });
    if ("id" in input.patient) {
      const p = await survivingPatient(tx, input.orgId, input.patient.id);
      if (!p) throw new BookingError("not_found", "Patient not found.");
      patient = p;
      plan = planFor(p.preferredChannel);
    } else {
      plan = planFor(input.patient.preferredChannel ?? (input.patient.phone ? "sms" : "email"));
      const res = await upsertPatient(
        tx,
        input.orgId,
        patientForBooking(input.patient, relation, plan, input.online),
        input.online ? "public" : "staff",
      );
      patient = res.patient;
      createdPatient = res.created;
    }
    await assertMayBook(tx, patient, input, now);
    // The stored birth date when there is one: recordConsent reads that one too.
    const birthDate = patient.birthDate || ("id" in input.patient ? null : input.patient.birthDate) || null;
    checkBookingRelation(relation, birthDate, start, context, now);
    const dialCode = "id" in input.patient ? null : input.patient.phoneCountry;

    // A marketplace booking for another adult is held until that adult confirms it themselves
    // (adult-confirmation.ts): 'requested', no consent recorded (plan.choices is empty), no reminders,
    // no receipt; requestAdultConfirmation asks them after the commit.
    const held = plan.awaitsAdult;
    const status = held || (input.online && ctx.settings.booking.requireApproval) ? "requested" : "scheduled";
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
        ...bookedByColumns(relation, dialCode),
        noticeVersion: plan.noticeVersion,
        noticeLocale: plan.noticeLocale,
        minorFlag: isMinor({ birthDate }, start),
        fundId: await listedFund(tx, input.orgId, input.serviceId, input.fundId),
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    // Only the adult can confirm a held booking, with a code sent to a contact of their own: one the
    // booker also gave as theirs doesn't count (adultContacts). Without one it could never be confirmed.
    const ownContact = plan.bookedFor === "other_adult" && adultContacts({ patient, appointment }).length > 0;
    if (held && !ownContact) throw ruleError("other_adult_contact_required", "phone");
    if (input.privacy) {
      await recordBookingChoices(tx, { orgId: input.orgId, patientId: patient.id, appointmentId: id, plan, privacy: input.privacy, now });
    }
    // The patient booked the treatment they were recalled for: the recall stops sending.
    await markRecallBooked(tx, { orgId: input.orgId, patientId: patient.id, serviceId: input.serviceId, appointmentId: id, now });
    // No-show risk, only where the practice uses it and the patient hasn't objected (src/lib/risk.ts).
    await refreshAppointmentRisk(tx, id, now);

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
    if (notify && !held && ctx.settings.reminders.sendBookingConfirmation) {
      await enqueueNow(tx, appointment.id, "booking_confirmation", "email", now);
    }

    if (input.waitlistEntryId) {
      await tx
        .update(waitlist)
        .set({ status: "booked", closedAt: now })
        .where(
          and(
            eq(waitlist.id, input.waitlistEntryId),
            eq(waitlist.orgId, input.orgId),
            eq(waitlist.patientId, patient.id),
            eq(waitlist.status, "active"),
          ),
        );
    }
    // Booked through the practice's channels for another adult reachable at a contact of their own.
    return { id: appointment.id, held, tellAdult: !held && ownContact };
  });
  const appointmentId = booked.id;

  // Send the confirmation right away (best effort; the cron retries on failure).
  await processDueReminders({ appointmentId, now }).catch((err) => logError("booking", err, { step: "confirmation", appointmentId }));
  if (booked.held) {
    // Ask the adult to confirm at their own contact (the hold expires unconfirmed: expireAdultConfirmations).
    await requestAdultConfirmation(appointmentId, now).catch((err) => logError("booking", err, { step: "adult_confirmation", appointmentId }));
  } else if (booked.tellAdult) {
    // Booked through the practice's channels for another adult: the Art. 14 notice, to them (never throws).
    await sendBookedForYouNotice(appointmentId);
  }
  // Patient-facing: the notices the form showed are on record as of now (never throws).
  if (input.privacy) await recordBookingNotices({ orgId: input.orgId, locale: input.privacy.locale, context, now });
  return (await getAppointmentDetails({ id: appointmentId }))!;
}

/**
 * The channel for a message the patient didn't ask for (staff cancelled or moved the visit): the
 * preferred one when it reaches the recipient, else the other. Both look at recipientFor(), so a
 * child under 14 reachable only through the guardian's phone still gets a text. WhatsApp only with
 * an approved template for `kind` in the patient's language (textChannelFor), otherwise SMS.
 */
async function textOrEmail(d: AppointmentDetails, kind: "cancelled" | "rescheduled", now: Date): Promise<Channel | null> {
  const text = await textChannelFor(d.patient, d.org, now, kind);
  const email = canReachByEmail(d.patient) ? ("email" as const) : null;
  return d.patient.preferredChannel === "email" ? (email ?? text) : (text ?? email);
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
    if (row) {
      await cancelPendingReminders(tx, appointmentId);
      // A recall this visit had booked is open again.
      await reopenRecallsFor(tx, row.orgId, appointmentId, now);
    }
    return row;
  });
  if (!updated) return null;

  const details = (await getAppointmentDetails({ id: appointmentId }))!;
  const shouldNotify = opts.notifyPatient ?? true;
  if (shouldNotify) {
    const data = templateData(details);
    const { rebookUrl } = appointmentLinks(details);
    // Patients who cancelled get an email receipt; staff cancellations go out on their preferred channel.
    const channel = opts.by === "patient" ? (canReachByEmail(details.patient) ? "email" : null) : await textOrEmail(details, "cancelled", now);
    if (channel) {
      const email = templates.cancelledEmail(data, opts.by, rebookUrl);
      await deliver({
        orgId: details.org.id,
        appointmentId,
        patientId: details.patient.id,
        channel,
        to: channel === "email" ? recipientFor(details.patient).email! : recipientFor(details.patient).phone!,
        subject: channel === "email" ? email.subject : undefined,
        text: channel === "email" ? email.text : templates.cancelledSms(data, rebookUrl),
        html: channel === "email" ? email.html : undefined,
        // WhatsApp: the approved 'cancelled' template, its link the one to book again.
        ...(channel === "whatsapp" ? appointmentWhatsApp(details, "cancelled", rebookUrl) : {}),
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
    /**
     * The patient picks a new time because the practice closed (rebooking assistant,
     * src/lib/rebooking.ts). The practice caused the move, so the patient policies don't apply
     * (cancelUntilHours, minimum notice, maximum advance) and the same practitioner may keep the
     * visit even without a service link; the slot must still be free, inside working hours and at
     * least MOVE_MIN_LEAD_MS ahead.
     */
    practiceMoved?: boolean;
    now?: Date;
  },
): Promise<AppointmentDetails> {
  const now = opts.now ?? new Date();
  const before = await getAppointmentDetails({ id: appointmentId });
  if (!before) throw new BookingError("not_found", "Appointment not found.");
  if (!["scheduled", "requested"].includes(before.appointment.status))
    throw new BookingError("not_allowed", "Only upcoming appointments can be moved.");

  const online = opts.by === "patient";
  const moved = online && Boolean(opts.practiceMoved);
  if (moved && opts.startsAt.getTime() < now.getTime() + MOVE_MIN_LEAD_MS) {
    throw new BookingError("too_soon", REJECTION_LABELS.too_soon);
  }
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
        requireServiceLink: online && !(moved && practitionerId === before.appointment.practitionerId),
      },
      tx,
    );
    if (!ctx || !ctx.locations.has(locationId)) throw new BookingError("not_found", "Location not found.");
    assertBookableResources(ctx, practitionerId, locationId, opts.roomId, online);
    const enforcePolicy = online && !moved;
    // Keep the same chair if it's still free at the same office.
    const keepRoom = locationId === before.appointment.locationId ? before.appointment.roomId : null;
    let evaluation = evaluateSlot(ctx, {
      practitionerId,
      locationId,
      start: opts.startsAt,
      durationMinutes: duration,
      roomId: opts.roomId !== undefined ? opts.roomId : keepRoom,
      ignoreAppointmentId: appointmentId,
      enforcePolicy,
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
        enforcePolicy,
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
        // A rebooking offer or call request was about the old time (src/lib/rebooking.ts).
        rebookOfferStartsAt: null,
        rebookCallStartsAt: null,
        updatedAt: now,
      })
      .where(and(eq(appointments.id, appointmentId), inArray(appointments.status, ["scheduled", "requested"])))
      .returning();
    if (!updated) throw new BookingError("not_allowed", "This appointment was cancelled or completed in the meantime.");
    await scheduleReminders(tx, updated, ctx.settings, now);
    await refreshAppointmentRisk(tx, appointmentId, now);
  });

  const after = (await getAppointmentDetails({ id: appointmentId }))!;

  if (opts.notifyPatient ?? true) {
    const data = templateData(after);
    const channel = online ? (canReachByEmail(after.patient) ? "email" : null) : await textOrEmail(after, "rescheduled", now);
    if (channel) {
      const email = templates.rescheduledEmail(data);
      await deliver({
        orgId: after.org.id,
        appointmentId,
        patientId: after.patient.id,
        channel,
        to: channel === "email" ? recipientFor(after.patient).email! : recipientFor(after.patient).phone!,
        subject: channel === "email" ? email.subject : undefined,
        text: channel === "email" ? email.text : templates.rescheduledSms(data),
        html: channel === "email" ? email.html : undefined,
        // WhatsApp: the approved 'rescheduled' template (its link: the manage page).
        ...(channel === "whatsapp" ? appointmentWhatsApp(after, "rescheduled") : {}),
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

/**
 * A marketplace booking for another adult the adult hasn't confirmed yet: only their own consent
 * releases it (confirmAdultBooking in src/lib/privacy/adult-confirmation.ts), never the practice.
 */
async function awaitsAdultConsent(tx: Tx, a: Pick<Appointment, "id" | "processingContext" | "bookedFor">): Promise<boolean> {
  if (a.processingContext !== "marketplace" || a.bookedFor !== "other_adult") return false;
  const [given] = await tx
    .select({ id: consents.id })
    .from(consents)
    .where(
      and(
        eq(consents.appointmentId, a.id),
        eq(consents.purpose, "platform_booking_art9"),
        eq(consents.actorRelation, "self"),
        eq(consents.granted, true),
      ),
    )
    .limit(1);
  return !given;
}

/**
 * Front desk accepts an online booking request. A booking held for another adult's own
 * confirmation can't be approved before they confirm (BookingError not_allowed,
 * reason awaiting_adult_confirmation).
 */
export async function approveRequest(appointmentId: string, now = new Date()) {
  const ok = await db.transaction(async (tx) => {
    const [request] = await tx
      .select({ id: appointments.id, processingContext: appointments.processingContext, bookedFor: appointments.bookedFor })
      .from(appointments)
      .where(and(eq(appointments.id, appointmentId), eq(appointments.status, "requested")));
    if (!request) return false;
    if (await awaitsAdultConsent(tx, request)) {
      throw new BookingError("not_allowed", "The patient hasn't confirmed this booking yet.", { reason: "awaiting_adult_confirmation" });
    }
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
    // A completed visit gets its recall (clinician-confirmed before anything is sent, src/lib/recalls.ts);
    // undoing "completed" takes back a recall nothing was sent for.
    if (outcome === "completed") await upsertRecall(tx, { orgId: row.orgId, appointmentId, now });
    else if (before.appointment.status === "completed") await dropRecallForVisit(tx, row.orgId, appointmentId);
    // A recall this visit had booked wasn't honoured: it is open again (sent again, then the call list).
    if (outcome === "no_show") await reopenRecallsFor(tx, row.orgId, appointmentId, now);
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

// ---------------------------------------------------------------- alternatives (rebooking assistant)

/** Alternatives start at least this far ahead (time to read the message and pick one). */
const MOVE_MIN_LEAD_MS = 2 * 3_600_000;
/** How far around the original day alternatives are searched. */
const ALT_DAYS_BEFORE = 14;
const ALT_DAYS_AFTER = 28;

export type Alternative = {
  start: Date;
  end: Date;
  practitionerId: string;
  locationId: string;
  roomId: string | null;
  /** With the same practitioner as the original visit. */
  samePractitioner: boolean;
};

/**
 * Up to `n` free times to move an appointment to, when the practice can't keep it (rebooking
 * assistant). The same practitioner first (at the same office first), then another practitioner
 * offering the service at the same office; within each, the days closest to the original one,
 * one per day before a second on the same day, and the time of day closest to the original.
 * Slots are checked by the availability engine (never busy, never in a closure), keep the
 * visit's own length, and start at least two hours from now; the patient booking policies don't
 * apply (the practice is moving the visit). Returned in chronological order. An appointment
 * that is not upcoming, or not in `orgId`, gets none.
 */
export async function proposeAlternatives(
  appointmentId: string,
  n = 3,
  opts: { now?: Date; orgId?: string } = {},
): Promise<Alternative[]> {
  const now = opts.now ?? new Date();
  const d = await getAppointmentDetails({ id: appointmentId });
  if (!d || (opts.orgId && d.org.id !== opts.orgId)) return [];
  const a = d.appointment;
  if (!["scheduled", "requested"].includes(a.status) || n <= 0) return [];
  const tz = d.location.timezone;
  const duration = Math.round((a.endsAt.getTime() - a.startsAt.getTime()) / 60_000);
  const earliest = now.getTime() + MOVE_MIN_LEAD_MS;
  const original = zonedParts(a.startsAt, tz);
  const today = todayIn(tz, new Date(earliest));
  const fromDate = [today, addDays(original.date, -ALT_DAYS_BEFORE)].sort().at(-1)!;
  const untilDate = addDays([today, original.date].sort().at(-1)!, ALT_DAYS_AFTER);
  const days = diffDays(untilDate, fromDate) + 1;
  const range = rangeForDates(fromDate, days, tz);
  const base = { orgId: d.org.id, serviceId: d.service.id, ...range };

  const [same, others] = await Promise.all([
    loadAvailabilityContext({ ...base, practitionerIds: [a.practitionerId], requireServiceLink: false }),
    loadAvailabilityContext({ ...base, locationId: a.locationId, requireServiceLink: true }),
  ]);
  const slotOpts = { fromDate, days, now, enforcePolicy: false, durationMinutes: duration, ignoreAppointmentId: a.id };
  const sameSlots = same ? findSlots(same, slotOpts) : [];
  const otherSlots = others ? findSlots(others, slotOpts).filter((s) => s.practitionerId !== a.practitionerId) : [];

  const rank = (slots: typeof sameSlots) =>
    slots
      .filter((s) => s.start.getTime() >= earliest)
      .map((s) => {
        const local = zonedParts(s.start, tz);
        return {
          s,
          date: local.date,
          office: s.locationId === a.locationId ? 0 : 1,
          day: Math.abs(diffDays(local.date, original.date)),
          minutes: Math.abs(local.minutes - original.minutes),
        };
      })
      .sort((x, y) => x.office - y.office || x.day - y.day || x.minutes - y.minutes || x.s.start.getTime() - y.s.start.getTime());

  const picked: Alternative[] = [];
  for (const group of [rank(sameSlots), rank(otherSlots)]) {
    // One per day first, then fill from what is left.
    const usedDays = new Set<string>();
    const first = group.filter((r) => !usedDays.has(r.date) && usedDays.add(r.date));
    const rest = group.filter((r) => !first.includes(r));
    for (const r of [...first, ...rest]) {
      if (picked.length >= n) break;
      picked.push({
        start: r.s.start,
        end: r.s.end,
        practitionerId: r.s.practitionerId,
        locationId: r.s.locationId,
        roomId: r.s.roomId,
        samePractitioner: r.s.practitionerId === a.practitionerId,
      });
    }
  }
  return picked.sort((x, y) => x.start.getTime() - y.start.getTime());
}

// ---------------------------------------------------------------- possible duplicates

export type DuplicateSide = {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: string | null;
  /** null unless the viewer may read contacts. */
  email: string | null;
  phone: string | null;
  createdAt: Date;
  restricted: boolean;
  /**
   * A restricted record (Art. 18) and a viewer without patient.restricted.read: names, birth
   * date, contacts and visits are left out (empty, null or 0); show a placeholder instead.
   */
  masked: boolean;
  appointments: number;
  lastVisit: Date | null;
};

export type DuplicatePair = { patient: DuplicateSide; other: DuplicateSide };

/**
 * Records flagged possibleDuplicateOfId (upsertPatient: same first name and a shared contact, but
 * a birth date or identifier that didn't match), each with the record it may duplicate. Both
 * must be live records of this practice (not merged, not erased). A restricted side is masked
 * unless `restricted` (the viewer has patient.restricted.read), like the calendar.
 */
export async function listDuplicatePairs(
  orgId: string,
  opts: { contacts: boolean; restricted?: boolean; limit?: number },
): Promise<DuplicatePair[]> {
  const live = and(eq(patients.orgId, orgId), isNull(patients.mergedIntoId), isNull(patients.erasedAt));
  const flagged = await db
    .select()
    .from(patients)
    .where(and(live, isNotNull(patients.possibleDuplicateOfId)))
    .orderBy(desc(patients.createdAt))
    .limit(opts.limit ?? 100);
  const otherIds = [...new Set(flagged.map((p) => p.possibleDuplicateOfId!))];
  const others = otherIds.length ? await db.select().from(patients).where(and(live, inArray(patients.id, otherIds))) : [];
  const ids = [...flagged.map((p) => p.id), ...others.map((p) => p.id)];
  const visits = ids.length
    ? await db
        .select({ patientId: appointments.patientId, n: count(), last: sql<number | null>`max(case when ${appointments.status} = 'completed' then ${appointments.startsAt} end)` })
        .from(appointments)
        .where(and(eq(appointments.orgId, orgId), inArray(appointments.patientId, ids)))
        .groupBy(appointments.patientId)
    : [];
  const side = (p: Patient): DuplicateSide => {
    const v = visits.find((x) => x.patientId === p.id);
    const restricted = isRestricted(p);
    const masked = restricted && !opts.restricted;
    return {
      id: p.id,
      firstName: masked ? "" : p.firstName,
      lastName: masked ? "" : p.lastName,
      birthDate: masked ? null : p.birthDate,
      email: opts.contacts && !masked ? p.email : null,
      phone: opts.contacts && !masked ? p.phone : null,
      createdAt: p.createdAt,
      restricted,
      masked,
      appointments: masked ? 0 : Number(v?.n ?? 0),
      lastVisit: !masked && v?.last ? new Date(Number(v.last)) : null,
    };
  };
  return flagged.flatMap((p) => {
    const other = others.find((o) => o.id === p.possibleDuplicateOfId);
    return other && other.id !== p.id ? [{ patient: side(p), other: side(other) }] : [];
  });
}

export type MergeResult =
  | { ok: true; moved: Record<"appointments" | "messages" | "recalls" | "forms" | "waitlist" | "privacyRequests", number> }
  | { ok: false; code: "not_found" | "same" | "restricted" };

/**
 * Merge two records of the same person, after staff confirmed it. Everything that belongs to the
 * person moves to `keepId`: appointments (and with them reminders and reviews), messages, recalls,
 * forms, waitlist entries and privacy requests. The consent ledger is append-only and is NOT
 * rewritten: the merged record stays as a tombstone (mergedIntoId) that consent lookups and the
 * privacy center follow. Contacts and birth date missing on the kept record are taken from the
 * other one; no-show counts add up. Restricted records are refused (lift the restriction first:
 * merging would put restricted data back into use). Audited as patient.merge.
 */
export async function mergePatients(i: {
  orgId: string;
  keepId: string;
  mergeId: string;
  actor: AuditEvent["actor"];
  headers?: Headers;
  now?: Date;
}): Promise<MergeResult> {
  const now = i.now ?? new Date();
  if (i.keepId === i.mergeId) return { ok: false, code: "same" };
  return db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(patients)
      .where(and(eq(patients.orgId, i.orgId), inArray(patients.id, [i.keepId, i.mergeId]), isNull(patients.mergedIntoId), isNull(patients.erasedAt)));
    const keep = rows.find((p) => p.id === i.keepId);
    const drop = rows.find((p) => p.id === i.mergeId);
    if (!keep || !drop) return { ok: false, code: "not_found" } as const;
    if (keep.restrictedAt || drop.restrictedAt) return { ok: false, code: "restricted" } as const;

    const move = async (
      table: typeof appointments | typeof messages | typeof recalls | typeof formSubmissions | typeof waitlist | typeof privacyRequests,
    ) => {
      const moved = await tx
        .update(table)
        .set({ patientId: keep.id })
        .where(and(eq(table.orgId, i.orgId), eq(table.patientId, drop.id)))
        .returning({ id: table.id });
      return moved.length;
    };
    const moved = {
      appointments: await move(appointments),
      messages: await move(messages),
      recalls: await move(recalls),
      forms: await move(formSubmissions),
      waitlist: await move(waitlist),
      privacyRequests: await move(privacyRequests),
    };

    // Two open recalls for the same treatment would both send: keep the one due last.
    const open = await tx
      .select({ id: recalls.id, serviceId: recalls.serviceId, dueDate: recalls.dueDate })
      .from(recalls)
      .where(and(eq(recalls.orgId, i.orgId), eq(recalls.patientId, keep.id), inArray(recalls.status, ["due", "sent", "call"])))
      .orderBy(desc(recalls.dueDate));
    const seen = new Set<string>();
    const superseded = open.filter((r) => seen.has(r.serviceId) || !seen.add(r.serviceId)).map((r) => r.id);
    if (superseded.length) {
      await tx
        .update(recalls)
        .set({ status: "dismissed", leaseUntil: null, updatedAt: now })
        .where(and(eq(recalls.orgId, i.orgId), inArray(recalls.id, superseded)));
    }

    await tx
      .update(patients)
      .set({
        email: keep.email ?? drop.email,
        phone: keep.phone ?? drop.phone,
        birthDate: keep.birthDate ?? drop.birthDate,
        guardianName: keep.guardianName ?? drop.guardianName,
        guardianRelation: keep.guardianRelation ?? drop.guardianRelation,
        guardianPhone: keep.guardianPhone ?? drop.guardianPhone,
        guardianEmail: keep.guardianEmail ?? drop.guardianEmail,
        noShowCount: keep.noShowCount + drop.noShowCount,
        verifiedContacts: [...new Set([...keep.verifiedContacts, ...drop.verifiedContacts])],
        possibleDuplicateOfId: keep.possibleDuplicateOfId === drop.id ? null : keep.possibleDuplicateOfId,
      })
      .where(and(eq(patients.id, keep.id), eq(patients.orgId, i.orgId)));
    await tx
      .update(patients)
      .set({ mergedIntoId: keep.id, possibleDuplicateOfId: null })
      .where(and(eq(patients.id, drop.id), eq(patients.orgId, i.orgId)));
    // Records flagged as duplicates of the merged one now point at the survivor.
    await tx
      .update(patients)
      .set({ possibleDuplicateOfId: keep.id })
      .where(and(eq(patients.orgId, i.orgId), eq(patients.possibleDuplicateOfId, drop.id), ne(patients.id, keep.id)));

    await audit(
      {
        orgId: i.orgId,
        actor: i.actor,
        action: "patient.merge",
        entity: { type: "patient", id: keep.id },
        metadata: { mergedId: drop.id, ...moved, recallsSuperseded: superseded.length },
        headers: i.headers,
        at: now,
      },
      tx,
    );
    return { ok: true, moved } as const;
  });
}

/** Staff checked a flagged pair: two different people. Audited as patient.update. */
export async function dismissDuplicate(i: { orgId: string; patientId: string; actor: AuditEvent["actor"]; headers?: Headers; now?: Date }): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ id: patients.id, other: patients.possibleDuplicateOfId })
      .from(patients)
      .where(and(eq(patients.id, i.patientId), eq(patients.orgId, i.orgId), isNotNull(patients.possibleDuplicateOfId)));
    if (!row) return false;
    await tx
      .update(patients)
      .set({ possibleDuplicateOfId: null })
      .where(and(eq(patients.id, row.id), eq(patients.orgId, i.orgId)));
    await audit(
      {
        orgId: i.orgId,
        actor: i.actor,
        action: "patient.update",
        entity: { type: "patient", id: row.id },
        metadata: { duplicate: "dismissed", otherId: row.other },
        headers: i.headers,
        at: i.now,
      },
      tx,
    );
    return true;
  });
}
