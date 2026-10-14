import type { BookedFor, ProcessingContext } from "@/db/enums";
import { DEFAULT_TIMEZONE } from "../config";
import { isDateString, zonedParts } from "../time";
import type { RuleResult } from "./booking-rules";
import type { BookingRelationInput } from "./consent";

/**
 * Who an appointment is for, checked on the server.
 *
 * - self:        the patient books for themselves. From 14 (Art. 2-quinquies Codice privacy)
 *                that is allowed; under 14 a parent or legal guardian must book.
 * - minor:       a guardian books for a child under 18. The child's birth date is required
 *                (it decides routing and when guardian access ends) and the guardian must give
 *                a name, a relation and a way to reach them.
 * - other_adult: allowed through the practice's channels (the practice gives the Art. 14
 *                notice). On the marketplace Sorriso's Art. 9(2)(a) consent can only come
 *                from the data subject, so the booking is held until the adult confirms it
 *                themselves (OTHER_ADULT_ON_MARKETPLACE).
 *
 * Ages are taken in Italy. Whether the patient may book and consent alone (14) is decided at the
 * moment of booking, the instant recordConsent checks too: a 13-year-old can't book alone for a
 * day after their birthday. Whether the guardian may still book as for a minor (18) is decided
 * on the day of the appointment.
 *
 * Pass the birth date recordConsent will read (the one stored on the patient after the upsert),
 * or the two checks can disagree.
 *
 * Pure (no database or Node imports), so the booking form can run the same checks in the
 * browser; src/lib/contact.ts re-exports the age helpers for server code.
 */

/**
 * Marketplace bookings for another adult: "held" (wired in src/lib/booking.ts): the relation check
 * lets them through and the booking waits for the adult's own confirmation
 * (src/lib/privacy/adult-confirmation.ts). "refused" would answer other_adult_must_book_themselves.
 * The booking form's texts follow this switch. The waitlist has no hold, so planBookingPrivacy
 * (booking.ts) still refuses a marketplace waitlist entry for another adult.
 */
export const OTHER_ADULT_ON_MARKETPLACE = "held" as "refused" | "held";

/** Under this age a patient can't consent alone, and messages go to the guardian. */
export const GUARDIAN_ROUTING_AGE = 14;
/** From this age the guardian's contact no longer matches the patient's records. */
export const GUARDIAN_MATCH_AGE = 18;

/** The calendar date of an instant in Italy (birthdays roll over at local midnight). */
function localDate(on: Date | string): string {
  return typeof on === "string" ? on : zonedParts(on, DEFAULT_TIMEZONE).date;
}

/** Age in whole years on a date or instant, or null when the birth date is missing or invalid. */
export function ageOn(birthDate: string | null | undefined, on: Date | string = new Date()): number | null {
  if (!isDateString(birthDate)) return null;
  const today = localDate(on);
  if (!isDateString(today)) return null;
  const [by, bm, bd] = birthDate.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  if (bm < 1 || bm > 12 || bd < 1 || bd > 31) return null;
  const age = ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
  return age < 0 ? null : age;
}

export type BookingRelationCode =
  | "guardian_required"
  | "birthdate_required"
  | "invalid_birthdate"
  | "not_a_minor"
  | "guardian_name_required"
  | "guardian_relation_required"
  | "guardian_contact_required"
  | "other_adult_must_book_themselves";

export function validateBookingRelation(
  r: BookingRelationInput,
  birthDate: string | null | undefined,
  appointmentAt: Date,
  context: ProcessingContext,
  now: Date = new Date(),
): RuleResult<BookingRelationCode> {
  const given = birthDate?.trim() || null;
  if (given && (!isDateString(given) || ageOn(given, now) === null)) {
    return { ok: false, code: "invalid_birthdate", field: "birthDate" };
  }
  const age = ageOn(given, appointmentAt);

  if (r.bookedFor === "self") {
    const ageNow = ageOn(given, now);
    if (ageNow !== null && ageNow < GUARDIAN_ROUTING_AGE) return { ok: false, code: "guardian_required", field: "bookedFor" };
    return { ok: true };
  }

  if (r.bookedFor === "other_adult") {
    if (context === "marketplace" && OTHER_ADULT_ON_MARKETPLACE === "refused") return { ok: false, code: "other_adult_must_book_themselves", field: "bookedFor" };
    return { ok: true };
  }

  if (age === null) return { ok: false, code: "birthdate_required", field: "birthDate" };
  if (age >= GUARDIAN_MATCH_AGE) return { ok: false, code: "not_a_minor", field: "birthDate" };
  const g = r.guardian;
  if (!g?.name?.trim()) return { ok: false, code: "guardian_name_required", field: "guardian.name" };
  if (!g.relation) return { ok: false, code: "guardian_relation_required", field: "guardian.relation" };
  if (!g.phone?.trim() && !g.email?.trim()) return { ok: false, code: "guardian_contact_required", field: "guardian.phone" };
  return { ok: true };
}

// ---------------------------------------------------------------- for the booking form

/** child: under 14 (a guardian books and decides); teen: 14 to 17 (may book alone); adult; null: unknown. */
export type AgeBand = "child" | "teen" | "adult";

export function ageBand(birthDate: string | null | undefined, on: Date | string = new Date()): AgeBand | null {
  const age = ageOn(birthDate?.trim() || null, on);
  if (age === null) return null;
  return age < GUARDIAN_ROUTING_AGE ? "child" : age < GUARDIAN_MATCH_AGE ? "teen" : "adult";
}

/**
 * The notice that suits the reader: young people from 14 to 17 booking for themselves get the
 * version written for them (with a link to the full one); everyone else, including a parent
 * booking for a child, reads the practice's full notice.
 */
export function noticeKindFor(bookedFor: BookedFor, birthDate: string | null | undefined, on: Date | string = new Date()): "minor" | "practice_patient" {
  return bookedFor === "self" && ageBand(birthDate, on) === "teen" ? "minor" : "practice_patient";
}

/**
 * What the server would answer about the relation, as far as the form can tell before it is sent
 * (the appointment date is not known yet, so ages are taken today; the marketplace refusal of
 * other_adult is left to the server, which knows the context). null when nothing is wrong.
 */
export function relationFormIssue(r: BookingRelationInput, birthDate: string | null | undefined, now: Date = new Date()): RuleResult<BookingRelationCode> {
  return validateBookingRelation(r, birthDate, now, "practice", now);
}
