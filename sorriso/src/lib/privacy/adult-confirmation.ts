import { and, eq, lt, lte, or } from "drizzle-orm";
import { db } from "@/db";
import { appointments, consents, type Appointment, type Locale } from "@/db/schema";
import { fmtWhen } from "@/i18n/datefmt";
import { lhref } from "@/i18n/href";
import { getT } from "@/i18n/t";
import { getAppointmentDetails, practiceNoticeUrl, type AppointmentDetails } from "../appointments";
import { audit } from "../audit";
import { absoluteUrl, APP_NAME } from "../config";
import { contactHash, markContactVerified, normalizeContact, type ContactKind } from "../contact";
import { manageTokenOf } from "../links";
import { logError } from "../log";
import { deliver, sendPatientMessage } from "../messaging";
import { renderEmailLayout } from "../messaging/layout";
import { sendOtp } from "../otp";
import { reopenRecallsFor } from "../recalls";
import { cancelPendingReminders, scheduleReminders } from "../reminders";
import { resolveSettings } from "../settings";
import { recordConsent } from "./consent";
import { recordBookingNotices } from "./notices";
import type { VerifiedContact } from "./patient-session";
import { checkTicketCode, maskContact, openTicket, sealTicket } from "./privacy-center";

/**
 * Bookings made for another adult (bookedFor 'other_adult').
 *
 * Practice channels (Art. 14 GDPR): the practice is controller and may book on someone's behalf;
 * the patient is told who processes their data and where the notice is, at their own contact
 * (sendBookedForYouNotice). The booker's contact is stored apart (appointments.booked_by_*) and
 * never matches the patient's records in the privacy center.
 *
 * Marketplace (critique 2): Sorriso's Art. 9(2)(a) consent can only come from the data subject,
 * not from whoever booked. So the booking is held (status 'requested', no platform consent yet)
 * until the adult confirms it themselves:
 * - requestAdultConfirmation sends a link to the confirmation page to the adult's own contact;
 * - the page is reached through the appointment's manage token, which the booker also has (the
 *   booking's confirmation shows it). So the link alone proves nothing: the adult asks for a
 *   one-time code (OTP purpose adult_confirmation) that goes only to their own phone or email on
 *   the record, never to a contact that is the booker's (adultContacts);
 * - with that code they give the consent and confirm (confirmAdultBooking) or decline
 *   (declineAdultBooking). A code from another booking, or no code, is refused.
 * Unconfirmed holds are cancelled after ADULT_CONFIRMATION_HOURS, or when the visit time comes,
 * as a system cancellation (cancelled_by stays empty: neither the practice nor the patient
 * cancelled, so neither's statistics count it), and the booker is told (expireAdultConfirmations).
 *
 * Wiring (requested from WP8/the lead, see the TODO(WP4) in src/lib/booking.ts): booking.ts lets
 * validateBookingRelation pass other_adult on the marketplace as a held booking, creates it as
 * 'requested' without recording any consent, then calls requestAdultConfirmation(); practice
 * bookings for another adult call sendBookedForYouNotice(); the reminders cron calls
 * expireAdultConfirmations(). Until then the marketplace path stays refused
 * (other_adult_must_book_themselves) and this module is dormant there.
 */

/** How long a marketplace booking for another adult waits for that adult. */
export const ADULT_CONFIRMATION_HOURS = 48;
const HOUR_MS = 3_600_000;

type Held = Pick<Appointment, "id" | "processingContext" | "bookedFor" | "status" | "createdAt" | "startsAt">;

/** Until when the adult can confirm: 48 hours after booking, and never after the visit has started. */
export function adultConfirmationDeadline(a: Pick<Appointment, "createdAt" | "startsAt">): Date {
  return new Date(Math.min(a.createdAt.getTime() + ADULT_CONFIRMATION_HOURS * HOUR_MS, a.startsAt.getTime()));
}

/** Has the patient themselves given Sorriso's consent for this booking? */
async function adultConsented(appointmentId: string): Promise<boolean> {
  const rows = await db
    .select({ granted: consents.granted })
    .from(consents)
    .where(and(eq(consents.appointmentId, appointmentId), eq(consents.purpose, "platform_booking_art9"), eq(consents.actorRelation, "self")));
  return rows.some((r) => r.granted);
}

/** A marketplace booking for another adult, still waiting for them. */
export async function awaitsAdultConfirmation(a: Held, now: Date = new Date()): Promise<boolean> {
  if (a.processingContext !== "marketplace" || a.bookedFor !== "other_adult" || a.status !== "requested") return false;
  if (now.getTime() >= adultConfirmationDeadline(a).getTime()) return false;
  return !(await adultConsented(a.id));
}

/**
 * The patient's own contacts a confirmation code may go to: the phone and email on their record,
 * except any that is also the booker's (a booker who typed their own number as the patient's must
 * not be able to confirm with it).
 */
export function adultContacts(d: Pick<AppointmentDetails, "patient" | "appointment">): VerifiedContact[] {
  if (d.patient.restrictedAt || d.patient.erasedAt) return [];
  const booker = new Set(
    [d.appointment.bookedByPhone ? contactHash("phone", d.appointment.bookedByPhone) : null, d.appointment.bookedByEmail ? contactHash("email", d.appointment.bookedByEmail) : null].filter(Boolean),
  );
  const out: VerifiedContact[] = [];
  for (const kind of ["phone", "email"] as const) {
    const raw = d.patient[kind];
    const value = raw ? normalizeContact(kind, raw) : null;
    if (value && !booker.has(contactHash(kind, value))) out.push({ kind, value });
  }
  return out;
}

/** The contacts the confirmation page offers, masked ("+39•••4567"). */
export function adultContactChoices(d: Pick<AppointmentDetails, "patient" | "appointment">): { kind: ContactKind; label: string }[] {
  return adultContacts(d).map((c) => ({ kind: c.kind, label: maskContact(c) }));
}

function vars(d: AppointmentDetails) {
  const locale = d.patient.locale;
  return {
    booker: d.appointment.bookedByName ?? d.org.name,
    practice: d.org.name,
    when: fmtWhen(d.appointment.startsAt, d.location.timezone, locale),
  };
}

/**
 * Art. 14: tell the adult someone booked for that an appointment exists in their name, who the
 * controller is and where the notice is, at their own contact. Best effort, never throws.
 */
export async function sendBookedForYouNotice(appointmentId: string): Promise<boolean> {
  const d = await getAppointmentDetails({ id: appointmentId });
  if (!d || d.appointment.bookedFor !== "other_adult") return false;
  try {
    const url = practiceNoticeUrl(d.org, d.patient.locale);
    const r = await sendPatientMessage({
      orgId: d.org.id,
      patient: d.patient,
      ns: "privacyMessages",
      kind: "bookedForYou",
      vars: { ...vars(d), url },
      url,
      appointmentId: d.appointment.id,
    });
    return r.ok;
  } catch (err) {
    logError("adult-confirmation", err, { step: "notice", appointmentId });
    return false;
  }
}

/** The page where the adult confirms (or declines) a booking made for them, after a code to their own contact. */
export function confirmationUrl(d: Pick<AppointmentDetails, "appointment">, locale: Locale): string | null {
  const token = manageTokenOf(d.appointment);
  return token ? absoluteUrl(lhref(locale, `/a/${token}/privacy/confirm`)) : null;
}

/** Ask the adult a marketplace booking was made for to confirm it, at their own contact. */
export async function requestAdultConfirmation(appointmentId: string, now: Date = new Date()): Promise<boolean> {
  const d = await getAppointmentDetails({ id: appointmentId });
  if (!d || !(await awaitsAdultConfirmation(d.appointment, now))) return false;
  if (!adultContacts(d).length) return false;
  const url = confirmationUrl(d, d.patient.locale);
  if (!url) return false;
  try {
    const r = await sendPatientMessage({
      orgId: d.org.id,
      patient: d.patient,
      ns: "privacyMessages",
      kind: "confirmBooking",
      vars: { ...vars(d), hours: ADULT_CONFIRMATION_HOURS, url },
      url,
      appointmentId: d.appointment.id,
      now,
    });
    return r.ok;
  } catch (err) {
    logError("adult-confirmation", err, { step: "request", appointmentId });
    return false;
  }
}

export type AdultCodeResult = { ok: true; ticket: string; masked: string } | { ok: false; reason: "not_found" | "not_waiting" | "no_contact" | "rate_limited" };

/**
 * Step 1 on the confirmation page: a one-time code (purpose adult_confirmation) to the adult's own
 * phone or email (adultContacts). The sealed ticket names the patient and the appointment, so the
 * code can confirm nothing else.
 */
export async function requestAdultConfirmationCode(i: { token: string; kind: ContactKind; locale: Locale; headers: Headers; now?: Date }): Promise<AdultCodeResult> {
  const now = i.now ?? new Date();
  const d = await getAppointmentDetails({ token: i.token });
  if (!d) return { ok: false, reason: "not_found" };
  if (!(await awaitsAdultConfirmation(d.appointment, now))) return { ok: false, reason: "not_waiting" };
  const contact = adultContacts(d).find((c) => c.kind === i.kind);
  if (!contact) return { ok: false, reason: "no_contact" };
  const sent = await sendOtp({
    purpose: "adult_confirmation",
    channel: contact.kind === "phone" ? "sms" : "email",
    to: contact.value,
    locale: i.locale,
    orgId: null,
    fromName: APP_NAME,
    headers: i.headers,
    now,
  });
  if (!sent.ok) return sent;
  const ticket = sealTicket({ c: sent.challengeId, k: contact.kind, v: contact.value, p: "adult_confirmation", pid: d.patient.id, a: d.appointment.id }, now);
  return { ok: true, ticket, masked: maskContact(contact) };
}

type ProofFailure = "invalid" | "expired" | "too_many_attempts";

export type AdultConfirmationResult =
  | { ok: true; status: Appointment["status"] }
  | { ok: false; reason: "not_found" | "not_waiting" | "consent_required" | ProofFailure };

type ProofInput = { token: string; ticket: string; code: string; headers?: Headers; now?: Date };

/**
 * The code proves the visitor holds one of the adult's own contacts, for this booking: the ticket
 * must name this appointment and patient, the code must match it, and the contact must still be
 * one the adult may confirm with.
 */
async function prove(i: ProofInput, now: Date): Promise<{ ok: true; d: AppointmentDetails; contact: VerifiedContact } | { ok: false; reason: "not_found" | "not_waiting" | ProofFailure }> {
  const d = await getAppointmentDetails({ token: i.token });
  if (!d) return { ok: false, reason: "not_found" };
  if (!(await awaitsAdultConfirmation(d.appointment, now))) return { ok: false, reason: "not_waiting" };
  const t = openTicket(i.ticket, "adult_confirmation", now);
  if (!t) return { ok: false, reason: "expired" };
  if (t.a !== d.appointment.id || t.pid !== d.patient.id) return { ok: false, reason: "invalid" };
  const check = await checkTicketCode(i.ticket, i.code, "adult_confirmation", now);
  if (!check.ok) return check;
  const allowed = adultContacts(d).some((c) => c.kind === check.contact.kind && c.value === check.contact.value);
  if (!allowed) return { ok: false, reason: "invalid" };
  return { ok: true, d, contact: check.contact };
}

/**
 * The adult confirms and gives Sorriso's Art. 9(2)(a) consent themselves (actorRelation 'self',
 * proven by the code sent to their own contact). The hold is released: the booking becomes
 * 'scheduled' with its reminders, or stays 'requested' for practices that approve online bookings.
 * The contact the code went to is recorded as verified for them.
 */
export async function confirmAdultBooking(i: ProofInput & { consent: boolean; locale: Locale }): Promise<AdultConfirmationResult> {
  const now = i.now ?? new Date();
  if (!i.consent) return { ok: false, reason: "consent_required" };
  const proof = await prove(i, now);
  if (!proof.ok) return proof;
  const { d, contact } = proof;
  const settings = resolveSettings(d.org.settings);
  const status = settings.booking.requireApproval ? "requested" : "scheduled";
  const actor = { type: "patient_link" as const, id: null };
  await db.transaction(async (tx) => {
    await recordConsent(tx, {
      orgId: d.org.id,
      patientId: d.patient.id,
      purpose: "platform_booking_art9",
      granted: true,
      locale: i.locale,
      method: "web_checkbox",
      source: "manage_link",
      actorRelation: "self",
      appointmentId: d.appointment.id,
      actor,
      headers: i.headers,
      now,
    });
    if (await markContactVerified(d.patient.id, contact, tx, now)) {
      await audit(
        {
          orgId: d.org.id,
          actor,
          action: "patient.update",
          entity: { type: "patient", id: d.patient.id },
          metadata: { change: "contact_verified", source: "adult_confirmation", kind: contact.kind },
          headers: i.headers,
          at: now,
        },
        tx,
      );
    }
    const [updated] = await tx
      .update(appointments)
      .set({ status, updatedAt: now })
      .where(and(eq(appointments.id, d.appointment.id), eq(appointments.orgId, d.org.id), eq(appointments.status, "requested")))
      .returning();
    if (updated && status === "scheduled") await scheduleReminders(tx, updated, settings, now);
    await audit(
      {
        orgId: d.org.id,
        actor,
        action: "appointment.update",
        entity: { type: "appointment", id: d.appointment.id },
        metadata: { change: "adult_confirmed", status, proof: `otp_${contact.kind}` },
        headers: i.headers,
        at: now,
      },
      tx,
    );
  });
  // The notices the adult was shown are on record in the language they confirmed in.
  await recordBookingNotices({ orgId: d.org.id, locale: i.locale, context: "marketplace", now });
  return { ok: true, status };
}

/** The adult declines (with the same code): the booking is cancelled and nothing more is processed for it. */
export async function declineAdultBooking(i: ProofInput): Promise<AdultConfirmationResult> {
  const now = i.now ?? new Date();
  const proof = await prove(i, now);
  if (!proof.ok) return proof;
  const done = await cancelHold(proof.d.appointment, { declined: true, actor: { type: "patient_link", id: null }, change: "adult_declined", headers: i.headers, now });
  return done ? { ok: true, status: "cancelled" } : { ok: false, reason: "not_waiting" };
}

/**
 * Cancel a held booking as the system: cancelled_by stays empty (neither 'staff', which would
 * count against the practice's reliability ranking, nor 'patient', which would count as the
 * patient's late cancellation), pending reminders go, a recall it had booked reopens. Audited.
 */
async function cancelHold(
  a: Pick<Appointment, "id" | "orgId">,
  i: { declined: boolean; actor: { type: "patient_link" | "system"; id: null }; change: string; headers?: Headers; now: Date },
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(appointments)
      .set({
        status: "cancelled",
        ...(i.declined ? { confirmation: "declined" as const, confirmedVia: i.change } : {}),
        cancelledAt: i.now,
        cancelledBy: null,
        needsAttention: false,
        updatedAt: i.now,
      })
      .where(and(eq(appointments.id, a.id), eq(appointments.orgId, a.orgId), eq(appointments.status, "requested")))
      .returning({ id: appointments.id });
    if (!row) return false;
    await cancelPendingReminders(tx, a.id);
    await reopenRecallsFor(tx, a.orgId, a.id, i.now);
    await audit(
      { orgId: a.orgId, actor: i.actor, action: "appointment.cancel", entity: { type: "appointment", id: a.id }, metadata: { change: i.change }, headers: i.headers, at: i.now },
      tx,
    );
    return true;
  });
}

/** Tell whoever booked that the adult never confirmed and the booking is gone (best effort, never throws). */
async function notifyBooker(appointmentId: string): Promise<boolean> {
  const d = await getAppointmentDetails({ id: appointmentId });
  if (!d) return false;
  const phone = d.appointment.bookedByPhone ? normalizeContact("phone", d.appointment.bookedByPhone) : null;
  const email = d.appointment.bookedByEmail ? normalizeContact("email", d.appointment.bookedByEmail) : null;
  if (!phone && !email) return false;
  const locale = d.patient.locale;
  const t = getT(locale, "privacyMessages");
  const v = { name: d.patient.firstName, practice: d.org.name, when: fmtWhen(d.appointment.startsAt, d.location.timezone, locale) };
  const base = { orgId: d.org.id, appointmentId, locale };
  try {
    if (phone) {
      await deliver({ ...base, channel: "sms", to: phone, text: t("adultNotConfirmed.sms", v) });
    } else {
      const { html, text } = renderEmailLayout({ locale, brandColor: "#0d9488", brandName: APP_NAME, intro: t("adultNotConfirmed.body", v), footerLines: [APP_NAME] });
      await deliver({ ...base, channel: "email", to: email!, subject: t("adultNotConfirmed.subject"), text, html, fromName: APP_NAME });
    }
    return true;
  } catch (err) {
    logError("adult-confirmation", err, { step: "booker_notice", appointmentId });
    return false;
  }
}

/**
 * Cancel held bookings nobody confirmed in time (for the reminders cron): 48 hours after booking,
 * or once the visit time has come. The booker is told when they left a contact. Returns how many.
 */
export async function expireAdultConfirmations(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - ADULT_CONFIRMATION_HOURS * HOUR_MS);
  const stale = await db
    .select({ id: appointments.id, orgId: appointments.orgId })
    .from(appointments)
    .where(
      and(
        eq(appointments.processingContext, "marketplace"),
        eq(appointments.bookedFor, "other_adult"),
        eq(appointments.status, "requested"),
        or(lt(appointments.createdAt, cutoff), lte(appointments.startsAt, now)),
      ),
    );
  let n = 0;
  for (const a of stale) {
    if (await adultConsented(a.id)) continue;
    if (!(await cancelHold(a, { declined: false, actor: { type: "system", id: null }, change: "adult_not_confirmed", now }))) continue;
    n++;
    await notifyBooker(a.id);
  }
  return n;
}
