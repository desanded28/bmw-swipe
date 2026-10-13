import { eq } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { patients, type Patient, type PrivacySettings } from "@/db/schema";
import { hmac } from "./crypto";
import { normalizePhone } from "./phone";
import { ageOn, GUARDIAN_MATCH_AGE, GUARDIAN_ROUTING_AGE } from "./privacy/minors";
import { isDateString } from "./time";

export { ageOn, GUARDIAN_MATCH_AGE, GUARDIAN_ROUTING_AGE };

/**
 * Who we may contact about a patient, and how.
 *
 * Italian law (Art. 2-quinquies Codice privacy) sets the age of digital consent at 14:
 * below it, messages go to the guardian. Guardian access (matching the guardian's contact,
 * e.g. in the privacy center's family view) ends when the patient turns 18 — an adult's
 * dental history is not their parents' business. Restricted (Art. 18) and erased patients
 * receive nothing.
 */

type BirthDated = Pick<Patient, "birthDate">;
type Restrictable = Pick<Patient, "restrictedAt" | "erasedAt">;
export type ContactPatient = BirthDated &
  Restrictable &
  Pick<
    Patient,
    "firstName" | "email" | "phone" | "locale" | "emailOptIn" | "smsOptIn" | "preferredChannel" | "guardianName" | "guardianPhone" | "guardianEmail"
  >;

/** Unknown birth dates count as adult: there is nothing to route or restrict on. */
export function isMinor(p: BirthDated, on: Date | string = new Date(), threshold = GUARDIAN_MATCH_AGE): boolean {
  const age = ageOn(p.birthDate, on);
  return age !== null && age < threshold;
}

export function isRestricted(p: Restrictable): boolean {
  return Boolean(p.restrictedAt || p.erasedAt);
}

/** May a match on guardianPhone / guardianEmail reveal this patient? Only while a known minor. */
export function guardianMatchAllowed(p: BirthDated, now: Date | string = new Date()): boolean {
  return isMinor(p, now, GUARDIAN_MATCH_AGE);
}

export type Recipient = {
  name: string | null;
  email: string | null;
  phone: string | null;
  /** Messages go to the guardian (patient under 14). */
  viaGuardian: boolean;
  locale: Patient["locale"];
};

/**
 * Where messages about this patient go. Under 14 with guardian contacts on file, the guardian's
 * contacts (never the child's); otherwise the patient's own. Restricted or erased: nowhere.
 */
export function recipientFor(p: ContactPatient, now: Date = new Date()): Recipient {
  if (isRestricted(p)) return { name: null, email: null, phone: null, viaGuardian: false, locale: p.locale };
  if (isMinor(p, now, GUARDIAN_ROUTING_AGE) && (p.guardianPhone || p.guardianEmail)) {
    return { name: p.guardianName, email: p.guardianEmail, phone: p.guardianPhone, viaGuardian: true, locale: p.locale };
  }
  return { name: p.firstName, email: p.email, phone: p.phone, viaGuardian: false, locale: p.locale };
}

export function canReachByEmail(p: ContactPatient, now: Date = new Date()): boolean {
  return Boolean(p.emailOptIn && recipientFor(p, now).email);
}

export function canReachByPhone(p: ContactPatient, now: Date = new Date()): boolean {
  return Boolean(p.smsOptIn && recipientFor(p, now).phone);
}

/**
 * The text channel for this patient, or null when we can't text them. WhatsApp only when the
 * practice enabled it and the patient chose it (preferredChannel is set to 'whatsapp' only
 * with a whatsapp_channel consent and reset when it is withdrawn); otherwise SMS if opted in.
 */
export function pickTextChannel(
  p: ContactPatient,
  privacy: Pick<PrivacySettings, "whatsappEnabled">,
  now: Date = new Date(),
): "sms" | "whatsapp" | null {
  if (!recipientFor(p, now).phone) return null;
  if (privacy.whatsappEnabled && p.preferredChannel === "whatsapp") return "whatsapp";
  return p.smsOptIn ? "sms" : null;
}

/** A contact shown to reach the patient, and how it is written (any spelling normalizes). */
export type ProvenContact = { kind: ContactKind; value: string };

/**
 * Record that `contact` is proven to reach this patient. Call it only after an explicit act
 * through that very contact: a correct one-time code sent to it, an SMS reply from it, or a POST
 * from a manage link that was delivered only to it. Never on a GET: mail scanners (Safe Links,
 * Gmail) and link-preview bots open links without the patient. Returns false, recording
 * nothing, when the contact is not (or no longer) one of the record's own or guardian contacts.
 *
 * patients.contactVerifiedAt is one timestamp for the whole record: it can't say which contact
 * was proven, and it outlives a changed phone. So it is a "last proven" date for display, never
 * proof for a particular contact; per-contact proof needs the contact hashes stored (requested
 * from the lead as patients.verified_contacts), and until then callers of
 * contactMatchDisclosure pass matchedContactVerified: false.
 */
export async function markContactVerified(patientId: string, contact: ProvenContact, tx: Tx = db, now: Date = new Date()): Promise<boolean> {
  const [p] = await tx
    .select({ phone: patients.phone, email: patients.email, guardianPhone: patients.guardianPhone, guardianEmail: patients.guardianEmail })
    .from(patients)
    .where(eq(patients.id, patientId));
  const hash = contactHash(contact.kind, contact.value);
  if (!p || !hash || !matchedVia(p, hash)) return false;
  await tx.update(patients).set({ contactVerifiedAt: now }).where(eq(patients.id, patientId));
  return true;
}

// ---------------------------------------------------------------- contact hashing

export type ContactKind = "email" | "phone";

/** Canonical form for comparing and hashing: lower-case email, E.164 phone. */
export function normalizeContact(kind: ContactKind, value: string): string | null {
  if (kind === "email") {
    const v = value.trim().toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : null;
  }
  return normalizePhone(value);
}

/** HMAC of a normalised contact: what OTP challenges, privacy sessions and requests store. */
export function contactHash(kind: ContactKind, value: string): string | null {
  const v = normalizeContact(kind, value);
  return v ? hmac(`${kind}:${v}`, "contact") : null;
}

type ContactFields = Pick<Patient, "phone" | "email" | "guardianPhone" | "guardianEmail">;

const hashOf = (kind: ContactKind, value: string | null) => (value ? contactHash(kind, value) : null);

/**
 * Which of a record's contacts a contact hash (e.g. an OTP-verified one) is: the patient's own
 * phone or email, a guardian's, or none. Own contacts win when a family shares one.
 */
export function matchedVia(p: ContactFields, hash: string): "self" | "guardian" | null {
  if (hash === hashOf("phone", p.phone) || hash === hashOf("email", p.email)) return "self";
  if (hash === hashOf("phone", p.guardianPhone) || hash === hashOf("email", p.guardianEmail)) return "guardian";
  return null;
}

// ---------------------------------------------------------------- privacy-center disclosure

export type ContactMatchRow = Pick<Patient, "id" | "firstName" | "lastName" | "birthDate"> & {
  /** How the verified contact matched: the patient's own phone/email, or a guardian field (matchedVia()). */
  matchedVia: "self" | "guardian";
  /**
   * The contact that matched was itself proven to belong to this record. Never derive it from
   * patients.contactVerifiedAt (see markContactVerified): a verified phone would vouch for a
   * mistyped email, a child's own confirmation for a mistyped guardian email.
   */
  matchedContactVerified: boolean;
};

/**
 * - details:   show the record.
 * - challenge: show only "a record exists at practice X" until the visitor gives this row's
 *              birth date and surname (passesChallenge).
 * - hidden:    don't show it at all (guardian match on someone who is no longer a minor).
 */
export type MatchDisclosure = "details" | "challenge" | "hidden";

const fold = (s: string | null | undefined) =>
  (s ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .toLowerCase();

const identityOf = (r: ContactMatchRow) => `${fold(r.firstName)}|${fold(r.lastName)}|${r.birthDate ?? ""}`;

/**
 * Decide what the privacy center may show for each record matched by an OTP-verified contact.
 * Shared family phones and mistyped emails mean a verified contact is not proof of identity:
 * - a guardian-field match shows a minor's record; at 18 it disappears;
 * - a record where the matching contact was never proven (it may have been mistyped, so the
 *   visitor may be a stranger who owns it) needs the challenge, whatever its other contacts;
 * - when the contact matches more than one adult, every adult record needs the challenge.
 */
export function contactMatchDisclosure(rows: ContactMatchRow[], now: Date = new Date()): Map<string, MatchDisclosure> {
  const out = new Map<string, MatchDisclosure>();
  const adults = rows.filter((r) => r.matchedVia === "self" && !isMinor(r, now));
  const sharedByAdults = new Set(adults.map(identityOf)).size > 1;

  for (const r of rows) {
    if (r.matchedVia === "guardian" && !guardianMatchAllowed(r, now)) out.set(r.id, "hidden");
    else if (!r.matchedContactVerified) out.set(r.id, "challenge");
    else if (r.matchedVia === "self" && sharedByAdults && !isMinor(r, now)) out.set(r.id, "challenge");
    else out.set(r.id, "details");
  }
  return out;
}

/** Ids of the rows that need birth date + surname before their details are shown. */
export function contactMatchesNeedingChallenge(rows: ContactMatchRow[], now: Date = new Date()): string[] {
  const d = contactMatchDisclosure(rows, now);
  return rows.filter((r) => d.get(r.id) === "challenge").map((r) => r.id);
}

/** Both answers must match; surnames compare without case, accents, spaces or punctuation. */
export function passesChallenge(
  row: Pick<Patient, "lastName" | "birthDate">,
  answer: { lastName: string; birthDate: string },
): boolean {
  if (!row.birthDate || !isDateString(answer.birthDate)) return false;
  const surname = fold(row.lastName);
  return surname.length > 0 && surname === fold(answer.lastName) && row.birthDate === answer.birthDate;
}
