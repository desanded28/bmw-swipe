import { and, asc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  locations,
  organizations,
  patients,
  practitioners,
  services,
  waitlist,
  type ProcessingContext,
  type WaitlistEntry,
} from "@/db/schema";
import { evaluateSlot, loadAvailabilityContext } from "./availability";
import { canReachByEmail, canReachByPhone, textChannelFor } from "./appointments";
import { recipientFor } from "./contact";
// booking.ts imports offerFreedSlot from here: the cycle is safe because neither module uses the
// other's exports while loading.
import {
  BookingError,
  checkBookingRelation,
  patientForBooking,
  planBookingPrivacy,
  recordBookingChoices,
  upsertPatient,
  type BookingPrivacy,
  type BookingRelation,
  type NewPatientInput,
} from "./booking";
import { absoluteUrl } from "./config";
import { practitionerName } from "./format";
import { newId } from "./ids";
import { deliver } from "./messaging";
import { templates, type AppointmentTemplateData } from "./messaging/templates";
import { signPracticeRef } from "./privacy/context";
import { getPrivacy } from "./privacy/settings";
import { resolveSettings } from "./settings";
import { zonedParts } from "./time";

/** How many waitlisted patients to notify per freed slot. First to book wins. */
const OFFERS_PER_SLOT = 3;
/** Don't offer slots that start sooner than this. */
const MIN_LEAD_MS = 2 * 3_600_000;

export type FreedSlot = {
  orgId: string;
  serviceId: string;
  practitionerId: string;
  locationId: string;
  startsAt: Date;
};

/**
 * Link to book a freed slot. `practiceRef` (signPracticeRef) keeps a practice-context waitlist entry
 * in the practice context: the book page is Sorriso-hosted and is marketplace without it.
 */
export function bookSlotUrl(orgSlug: string, slot: FreedSlot, entryId?: string, practiceRef?: string | null) {
  const params = new URLSearchParams({
    service: slot.serviceId,
    practitioner: slot.practitionerId,
    location: slot.locationId,
    start: slot.startsAt.toISOString(),
  });
  if (entryId) params.set("wl", entryId);
  if (practiceRef) params.set("ref", practiceRef);
  return absoluteUrl(`/book/${orgSlug}?${params.toString()}`);
}

export type JoinWaitlistInput = {
  orgId: string;
  /** Checked against the practice by the caller (the waitlist route). */
  serviceId: string;
  practitionerId?: string | null;
  locationId?: string | null;
  /** YYYY-MM-DD, inclusive. */
  earliestDate: string;
  latestDate: string;
  partOfDay: WaitlistEntry["partOfDay"];
  note?: string | null;
  patient: NewPatientInput;
  /** Decided by the server (processingContextFor), never by the client. Default 'practice'. */
  processingContext?: ProcessingContext;
  relation?: BookingRelation;
  /** The form's privacy choices; required by the route for calls without an API key. */
  privacy?: BookingPrivacy;
  now?: Date;
};

/**
 * Put a patient on the waitlist (patient-facing: the record is matched or created in public mode).
 * Runs the same privacy and relation checks as a booking, stores the context, who it is for and the
 * notice version, and records the choices against the entry. A failed check throws
 * BookingError('invalid', code) and leaves nothing behind.
 */
export async function joinWaitlist(input: JoinWaitlistInput): Promise<{ id: string; patientId: string }> {
  const now = input.now ?? new Date();
  const context = input.processingContext ?? "practice";
  // Only a relation the form actually asked is checked (see checkBookingRelation).
  const relation = input.relation;
  const [org] = await db.select({ settings: organizations.settings }).from(organizations).where(eq(organizations.id, input.orgId));
  if (!org) throw new BookingError("not_found", "Clinic not found.");
  // Ages are checked for the start of the range (midday UTC is that calendar day in Europe).
  const at = new Date(`${input.earliestDate}T12:00:00Z`);

  const id = newId();
  // Writes inside the transaction go through `tx` only (src/db/serialize.ts: the root db deadlocks here).
  const patientId = await db.transaction(async (tx) => {
    const plan = planBookingPrivacy({
      context,
      relation,
      privacy: input.privacy,
      preferredChannel: input.patient.preferredChannel ?? (input.patient.phone ? "sms" : "email"),
      org: getPrivacy(org),
    });
    const { patient } = await upsertPatient(tx, input.orgId, patientForBooking(input.patient, relation, plan, true), "public");
    checkBookingRelation(relation, patient.birthDate || input.patient.birthDate, at, context, now);
    await tx.insert(waitlist).values({
      id,
      orgId: input.orgId,
      patientId: patient.id,
      serviceId: input.serviceId,
      practitionerId: input.practitionerId || null,
      locationId: input.locationId || null,
      earliestDate: input.earliestDate,
      latestDate: input.latestDate,
      partOfDay: input.partOfDay,
      note: input.note || null,
      processingContext: context,
      bookedFor: plan.bookedFor,
      noticeVersion: plan.noticeVersion,
    });
    if (input.privacy) {
      await recordBookingChoices(tx, { orgId: input.orgId, patientId: patient.id, waitlistId: id, plan, privacy: input.privacy, now });
    }
    return patient.id;
  });
  return { id, patientId };
}

/**
 * A slot was freed (cancellation or reschedule): offer it to matching waitlist
 * entries. Returns how many patients were notified.
 */
export async function offerFreedSlot(slot: FreedSlot, now = new Date()): Promise<number> {
  if (slot.startsAt.getTime() - now.getTime() < MIN_LEAD_MS) return 0;

  const [org] = await db.select().from(organizations).where(eq(organizations.id, slot.orgId));
  if (!org || !resolveSettings(org.settings).reminders.autoOfferToWaitlist) return 0;
  const [location] = await db.select().from(locations).where(eq(locations.id, slot.locationId));
  const [service] = await db.select().from(services).where(eq(services.id, slot.serviceId));
  const [practitioner] = await db.select().from(practitioners).where(eq(practitioners.id, slot.practitionerId));
  if (!location || !service || !practitioner) return 0;
  // The offer links to online booking, so only offer what patients can book online.
  if (!service.active || !service.onlineBookable || !practitioner.active) return 0;

  const local = zonedParts(slot.startsAt, location.timezone);
  const partOfDay = local.minutes < 13 * 60 ? "morning" : "afternoon";

  const candidates = await db
    .select({ entry: waitlist, patient: patients })
    .from(waitlist)
    .innerJoin(patients, eq(patients.id, waitlist.patientId))
    .where(
      and(
        eq(waitlist.orgId, slot.orgId),
        eq(waitlist.status, "active"),
        eq(waitlist.serviceId, slot.serviceId),
        lte(waitlist.earliestDate, local.date),
        gte(waitlist.latestDate, local.date),
      ),
    )
    .orderBy(asc(waitlist.createdAt))
    .limit(50);

  const matches = candidates
    .filter(({ entry }) => !entry.practitionerId || entry.practitionerId === slot.practitionerId)
    .filter(({ entry }) => !entry.locationId || entry.locationId === slot.locationId)
    .filter(({ entry }) => entry.partOfDay === "any" || entry.partOfDay === partOfDay)
    .filter(({ patient }) => canReachByPhone(patient) || canReachByEmail(patient))
    .slice(0, OFFERS_PER_SLOT);
  if (!matches.length) return 0;

  // Make sure the slot really is bookable online (staff may have refilled it already).
  const ctx = await loadAvailabilityContext({
    orgId: slot.orgId,
    serviceId: slot.serviceId,
    practitionerIds: [slot.practitionerId],
    locationId: slot.locationId,
    rangeStart: new Date(slot.startsAt.getTime() - 86_400_000),
    rangeEnd: new Date(slot.startsAt.getTime() + 86_400_000),
  });
  if (!ctx) return 0;
  const evaluation = evaluateSlot(ctx, {
    practitionerId: slot.practitionerId,
    locationId: slot.locationId,
    start: slot.startsAt,
    requireWorkingHours: true,
    enforcePolicy: true,
    now,
  });
  if (!evaluation.ok) return 0;

  let sent = 0;
  for (const { entry, patient } of matches) {
    const url = bookSlotUrl(org.slug, slot, entry.id, entry.processingContext === "practice" ? signPracticeRef(org.id) : null);
    const data: AppointmentTemplateData = {
      locale: patient.locale,
      patientFirstName: patient.firstName,
      clinicName: org.name,
      clinicPhone: location.phone ?? org.phone,
      brandColor: org.brandColor,
      practitionerName: practitionerName(practitioner),
      serviceName: service.name,
      start: slot.startsAt,
      timezone: location.timezone,
      locationName: location.name,
      address: `${location.address}, ${location.city}`,
      manageUrl: url,
      icsUrl: url,
    };
    // The text channel through textChannelFor (WhatsApp only where enabled and consented), else email.
    const text = patient.preferredChannel !== "email" ? await textChannelFor(patient, org) : null;
    const channel = text ?? "email";
    if (channel === "email" && !canReachByEmail(patient)) continue;
    const email = templates.waitlistOfferEmail(data, url);
    const msg = await deliver({
      orgId: org.id,
      patientId: patient.id,
      channel,
      to: channel === "email" ? recipientFor(patient).email! : recipientFor(patient).phone!,
      subject: channel === "email" ? email.subject : undefined,
      text: channel === "email" ? email.text : templates.waitlistOfferSms(data, url),
      html: channel === "email" ? email.html : undefined,
      fromName: org.name,
      replyTo: org.email,
    });
    if (msg.status !== "failed") {
      sent++;
      await db
        .update(waitlist)
        .set({ offersSent: sql`${waitlist.offersSent} + 1`, lastOfferedAt: now })
        .where(eq(waitlist.id, entry.id));
    }
  }
  return sent;
}
