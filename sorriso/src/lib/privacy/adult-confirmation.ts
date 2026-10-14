import { and, eq, lt } from "drizzle-orm";
import { db } from "@/db";
import { appointments, consents, type Appointment, type Locale } from "@/db/schema";
import { fmtWhen } from "@/i18n/datefmt";
import { lhref } from "@/i18n/href";
import { getAppointmentDetails, practiceNoticeUrl, type AppointmentDetails } from "../appointments";
import { audit } from "../audit";
import { cancelAppointment } from "../booking";
import { absoluteUrl } from "../config";
import { manageTokenOf } from "../links";
import { logError } from "../log";
import { sendPatientMessage } from "../messaging";
import { scheduleReminders } from "../reminders";
import { resolveSettings } from "../settings";
import { recordConsent } from "./consent";

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
 * until the adult confirms through a link sent to their own contact, where they read the notice
 * and give the consent themselves (confirmAdultBooking), or decline (declineAdultBooking).
 * Unconfirmed holds are cancelled after ADULT_CONFIRMATION_HOURS (expireAdultConfirmations).
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

type Held = Pick<Appointment, "id" | "processingContext" | "bookedFor" | "status" | "createdAt">;

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
  if (now.getTime() - a.createdAt.getTime() > ADULT_CONFIRMATION_HOURS * 3_600_000) return false;
  return !(await adultConsented(a.id));
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

/** The page where the adult confirms (or declines) a booking made for them. */
export function confirmationUrl(d: Pick<AppointmentDetails, "appointment">, locale: Locale): string | null {
  const token = manageTokenOf(d.appointment);
  return token ? absoluteUrl(lhref(locale, `/a/${token}/privacy/confirm`)) : null;
}

/** Ask the adult a marketplace booking was made for to confirm it, at their own contact. */
export async function requestAdultConfirmation(appointmentId: string, now: Date = new Date()): Promise<boolean> {
  const d = await getAppointmentDetails({ id: appointmentId });
  if (!d || !(await awaitsAdultConfirmation(d.appointment, now))) return false;
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

export type AdultConfirmationResult = { ok: true; status: Appointment["status"] } | { ok: false; reason: "not_found" | "not_waiting" };

/**
 * The adult confirms and gives Sorriso's Art. 9(2)(a) consent themselves (actorRelation 'self',
 * through the link delivered to their own contact). The hold is released: the booking becomes
 * 'scheduled' with its reminders, or stays 'requested' for practices that approve online bookings.
 */
export async function confirmAdultBooking(i: { token: string; locale: Locale; headers?: Headers; now?: Date }): Promise<AdultConfirmationResult> {
  const now = i.now ?? new Date();
  const d = await getAppointmentDetails({ token: i.token });
  if (!d) return { ok: false, reason: "not_found" };
  if (!(await awaitsAdultConfirmation(d.appointment, now))) return { ok: false, reason: "not_waiting" };
  const settings = resolveSettings(d.org.settings);
  const status = settings.booking.requireApproval ? "requested" : "scheduled";
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
      actor: { type: "patient_link", id: null },
      headers: i.headers,
      now,
    });
    const [updated] = await tx
      .update(appointments)
      .set({ status, updatedAt: now })
      .where(and(eq(appointments.id, d.appointment.id), eq(appointments.orgId, d.org.id), eq(appointments.status, "requested")))
      .returning();
    if (updated && status === "scheduled") await scheduleReminders(tx, updated, settings, now);
    await audit(
      {
        orgId: d.org.id,
        actor: { type: "patient_link", id: null },
        action: "appointment.update",
        entity: { type: "appointment", id: d.appointment.id },
        metadata: { change: "adult_confirmed", status },
        headers: i.headers,
        at: now,
      },
      tx,
    );
  });
  return { ok: true, status };
}

/** The adult declines: the booking is cancelled and nothing more is processed for it. */
export async function declineAdultBooking(i: { token: string; headers?: Headers; now?: Date }): Promise<AdultConfirmationResult> {
  const now = i.now ?? new Date();
  const d = await getAppointmentDetails({ token: i.token });
  if (!d) return { ok: false, reason: "not_found" };
  if (!(await awaitsAdultConfirmation(d.appointment, now))) return { ok: false, reason: "not_waiting" };
  await cancelAppointment(d.appointment.id, { by: "patient", via: "adult_declined", notifyPatient: false, now });
  await audit({
    orgId: d.org.id,
    actor: { type: "patient_link", id: null },
    action: "appointment.cancel",
    entity: { type: "appointment", id: d.appointment.id },
    metadata: { change: "adult_declined" },
    headers: i.headers,
    at: now,
  });
  return { ok: true, status: "cancelled" };
}

/** Cancel held bookings nobody confirmed in time (for the reminders cron). Returns how many. */
export async function expireAdultConfirmations(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - ADULT_CONFIRMATION_HOURS * 3_600_000);
  const stale = await db
    .select({ id: appointments.id, orgId: appointments.orgId })
    .from(appointments)
    .where(
      and(
        eq(appointments.processingContext, "marketplace"),
        eq(appointments.bookedFor, "other_adult"),
        eq(appointments.status, "requested"),
        lt(appointments.createdAt, cutoff),
      ),
    );
  let n = 0;
  for (const a of stale) {
    if (await adultConsented(a.id)) continue;
    const cancelled = await cancelAppointment(a.id, { by: "staff", reason: null, notifyPatient: false, now });
    if (!cancelled) continue;
    n++;
    await audit({ orgId: a.orgId, actor: { type: "system", id: null }, action: "appointment.cancel", entity: { type: "appointment", id: a.id }, metadata: { change: "adult_not_confirmed" }, at: now });
  }
  return n;
}
