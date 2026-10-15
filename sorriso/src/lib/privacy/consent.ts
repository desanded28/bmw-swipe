import { desc, eq, inArray, sql } from "drizzle-orm";
import { db, type Tx } from "@/db";
import {
  consents,
  patients,
  type ActorRelation,
  type BookedFor,
  type ConsentMethod,
  type ConsentPurpose,
  type ConsentSource,
  type GuardianRelation,
  type Locale,
  type Patient,
  type ProcessingContext,
} from "@/db/schema";
import { shownLocale } from "@/i18n/registry";
import { audit, type AuditEvent } from "../audit";
import { newId } from "../ids";
import { clientIpHash } from "../rate-limit";
import { ageOn, GUARDIAN_ROUTING_AGE } from "./minors";
import { isPlatformConsentPurpose } from "./roles";
import { CONSENT_TEXT_VERSION } from "./versions";

/**
 * The consent ledger (Art. 7(1): the controller must be able to demonstrate consent).
 *
 * Append-only: a change of mind is a new row, never an update, and the latest row per
 * (patient, purpose) is the current state. Each row stores the exact text key and version
 * shown, the language, how and where it was given, who gave it (the patient, a guardian or
 * staff on their behalf) and an HMAC of the IP — never the address.
 *
 * Not every purpose here is consent-based. The ledger also records objections to processing
 * on legitimate interest or care, and channel choices that are part of the booking contract;
 * PURPOSE_BASIS says which is which, and isAllowed() reads the rows accordingly.
 *
 * platform_booking_art9 and review_publication are Sorriso's own (it is their controller), so
 * their rows carry org_id NULL. Withdrawing platform_booking_art9 stops Sorriso's own
 * processing of the booking (marketplace history, Sorriso-controlled messages and
 * invitations); the practice keeps its copy as controller under Art. 9(2)(h), with Sorriso as
 * its processor. Withdrawal is never retroactive (Art. 7(3)). See WITHDRAWAL_EFFECTS in roles.ts.
 */

/**
 * - consent:             opt-in; allowed only while the latest row is a grant.
 * - contract:            part of the booking service (6(1)(b)); allowed unless opted out.
 * - legitimate_interest: 6(1)(f) paired with 9(2)(h) — no-show history is health data and
 *                        adaptive reminders are profiling; allowed unless the patient objects.
 * - care:                6(1)(b) + 9(2)(h), clinician-set; allowed unless the patient objects.
 */
export type ConsentBasis = "consent" | "contract" | "legitimate_interest" | "care";

export const PURPOSE_BASIS: Record<ConsentPurpose, ConsentBasis> = {
  platform_booking_art9: "consent",
  whatsapp_channel: "consent",
  sms_channel: "contract",
  email_channel: "contract",
  feedback_request: "consent",
  review_publication: "consent",
  marketing: "consent",
  adaptive_reminders: "legitimate_interest",
  no_show_tracking: "legitimate_interest",
  recalls: "care",
};

export function isConsentBased(p: ConsentPurpose): boolean {
  return PURPOSE_BASIS[p] === "consent";
}

/** Purposes the patient can object to (Art. 21) rather than withdraw consent from. */
export function isObjectable(p: ConsentPurpose): boolean {
  return PURPOSE_BASIS[p] === "legitimate_interest" || PURPOSE_BASIS[p] === "care";
}

export type ConsentTextKey = `consents.${ConsentPurpose}.label`;

/** The text shown next to the checkbox, in the frozen 'consents' namespace (Italian authoritative). */
export function consentTextKey(p: ConsentPurpose): ConsentTextKey {
  return `consents.${p}.label`;
}

export class ConsentError extends Error {
  constructor(public code: "guardian_required" | "unknown_patient") {
    super(code === "guardian_required" ? "A parent or legal guardian must give this consent." : "Patient not found.");
    this.name = "ConsentError";
  }
}

/** What the patient ticked on the booking or waitlist form. No notice "acknowledgement": the
 * server records the notice version it displayed (appointments.noticeVersion). */
export type BookingPrivacyChoices = {
  platformConsent?: boolean;
  whatsapp?: boolean;
  feedback?: boolean;
  marketing?: boolean;
};

export type BookingRelationInput = {
  bookedFor: BookedFor;
  guardian?: { name: string; relation: GuardianRelation; phone?: string | null; email?: string | null };
};

export type RecordConsentInput = {
  orgId: string;
  patientId: string;
  purpose: ConsentPurpose;
  granted: boolean;
  locale: Locale;
  method: ConsentMethod;
  source: ConsentSource;
  actorRelation?: ActorRelation;
  actorUserId?: string | null;
  appointmentId?: string | null;
  waitlistId?: string | null;
  headers?: Headers;
  /** Who acted, for the audit log; derived from actorUserId and source when omitted. */
  actor?: AuditEvent["actor"];
  now?: Date;
};

type Subject = Pick<Patient, "id" | "orgId" | "birthDate" | "phone" | "email" | "smsOptIn" | "preferredChannel" | "mergedIntoId">;

const MAX_MERGE_HOPS = 5;

async function loadPatient(t: Tx, id: string): Promise<Subject | null> {
  const [p] = await t
    .select({
      id: patients.id,
      orgId: patients.orgId,
      birthDate: patients.birthDate,
      phone: patients.phone,
      email: patients.email,
      smsOptIn: patients.smsOptIn,
      preferredChannel: patients.preferredChannel,
      mergedIntoId: patients.mergedIntoId,
    })
    .from(patients)
    .where(eq(patients.id, id));
  return p ?? null;
}

/** A merged duplicate is a tombstone: consent lookups and new rows follow it to the kept record. */
async function survivor(t: Tx, patientId: string): Promise<Subject | null> {
  let p = await loadPatient(t, patientId);
  for (let hop = 0; p?.mergedIntoId && hop < MAX_MERGE_HOPS; hop++) {
    const next = await loadPatient(t, p.mergedIntoId);
    if (!next) break;
    p = next;
  }
  return p;
}

/** The kept record plus every record merged into it: their ledgers read as one. */
async function lineage(t: Tx, patientId: string): Promise<string[]> {
  const ids = [patientId];
  let frontier = [patientId];
  for (let hop = 0; frontier.length && hop < MAX_MERGE_HOPS; hop++) {
    const rows = await t.select({ id: patients.id }).from(patients).where(inArray(patients.mergedIntoId, frontier));
    frontier = rows.map((r) => r.id).filter((id) => !ids.includes(id));
    ids.push(...frontier);
  }
  return ids;
}

function actorFor(i: RecordConsentInput): AuditEvent["actor"] {
  if (i.actor) return i.actor;
  if (i.actorUserId) return { type: "user", id: i.actorUserId };
  switch (i.source) {
    case "privacy_center":
      return { type: "patient_session", id: null };
    case "sms_reply":
      return { type: "webhook", id: null };
    case "api":
      return { type: "api_key", id: null };
    case "retention":
      return { type: "system", id: null };
    case "staff":
      return { type: "user", id: null };
    default:
      // Booking, widget, waitlist, manage link and review forms: the patient through the public pages.
      return { type: "patient_link", id: i.appointmentId ?? null };
  }
}

/**
 * Append one ledger row and keep the cached patient flags in step with it. Returns the row id.
 *
 * Under 14 (Art. 2-quinquies Codice privacy) a patient can't give any consent-based grant
 * alone: those need actorRelation 'parent' or 'legal_guardian' (or staff recording what the
 * guardian said). Withdrawals and objections are always accepted.
 */
export async function recordConsent(tx: Tx, i: RecordConsentInput): Promise<string> {
  const now = i.now ?? new Date();
  const patient = await survivor(tx, i.patientId);
  if (!patient || patient.orgId !== i.orgId) throw new ConsentError("unknown_patient");

  const actorRelation = i.actorRelation ?? "self";
  if (i.granted && isConsentBased(i.purpose) && actorRelation === "self") {
    const age = ageOn(patient.birthDate, now);
    if (age !== null && age < GUARDIAN_ROUTING_AGE) throw new ConsentError("guardian_required");
  }

  const platform = isPlatformConsentPurpose(i.purpose);
  const id = newId();
  await tx.insert(consents).values({
    id,
    orgId: platform ? null : i.orgId,
    patientId: patient.id,
    appointmentId: i.appointmentId ?? null,
    waitlistId: i.waitlistId ?? null,
    purpose: i.purpose,
    granted: i.granted,
    textKey: consentTextKey(i.purpose),
    textVersion: CONSENT_TEXT_VERSION[i.purpose],
    // The language the text was shown in: a locale without its own consent text showed the English one.
    locale: shownLocale(i.locale, "consents", `${i.purpose}.label`),
    method: i.method,
    source: i.source,
    actorRelation,
    actorUserId: i.actorUserId ?? null,
    ipHash: clientIpHash(i.headers),
    createdAt: now,
  });

  // The ledger is the truth; these columns are the fast path the messaging code reads.
  if (i.purpose === "sms_channel") {
    await tx.update(patients).set({ smsOptIn: i.granted }).where(eq(patients.id, patient.id));
  } else if (i.purpose === "email_channel") {
    await tx.update(patients).set({ emailOptIn: i.granted }).where(eq(patients.id, patient.id));
  } else if (i.purpose === "whatsapp_channel" && !i.granted && patient.preferredChannel === "whatsapp") {
    const fallback = patient.phone && patient.smsOptIn ? "sms" : patient.email ? "email" : "sms";
    await tx.update(patients).set({ preferredChannel: fallback }).where(eq(patients.id, patient.id));
  } else if (i.purpose === "no_show_tracking" && !i.granted) {
    // An objection to no-show tracking (Art. 21) takes effect at once: no count is kept, shown or
    // sent (dashboard badge, partner API), rather than waiting for the nightly recount.
    await tx.update(patients).set({ noShowCount: 0 }).where(eq(patients.id, patient.id));
  }

  await audit(
    {
      orgId: platform ? null : i.orgId,
      actor: actorFor(i),
      action: "consent.record",
      entity: { type: "patient", id: patient.id },
      metadata: {
        consentId: id,
        purpose: i.purpose,
        granted: i.granted,
        source: i.source,
        actorRelation,
        appointmentId: i.appointmentId ?? null,
      },
      headers: i.headers,
      at: now,
    },
    tx,
  );
  return id;
}

/**
 * Withdraw a consent, opt out of a channel, or object to a legitimate-interest or care purpose:
 * all are a `granted: false` row.
 */
export async function withdrawConsent(
  tx: Tx,
  i: Omit<RecordConsentInput, "granted" | "appointmentId" | "waitlistId">,
): Promise<void> {
  await recordConsent(tx, { ...i, granted: false });
}

/**
 * The optional consents ticked on a booking or waitlist form. Only grants are written (an
 * unticked box records nothing), and the Art. 9(2)(a) platform consent only for marketplace
 * bookings. Pass choices already filtered by effectiveBookingChoices().
 */
export async function recordBookingConsents(
  tx: Tx,
  i: {
    orgId: string;
    patientId: string;
    appointmentId?: string | null;
    waitlistId?: string | null;
    context: ProcessingContext;
    choices: BookingPrivacyChoices;
    locale: Locale;
    source: Extract<ConsentSource, "booking" | "widget" | "waitlist" | "api" | "staff">;
    actorRelation: ActorRelation;
    actorUserId?: string | null;
    headers?: Headers;
    now?: Date;
  },
): Promise<void> {
  const purposes: ConsentPurpose[] = [];
  if (i.context === "marketplace" && i.choices.platformConsent) purposes.push("platform_booking_art9");
  if (i.choices.whatsapp) purposes.push("whatsapp_channel");
  if (i.choices.feedback) purposes.push("feedback_request");
  if (i.choices.marketing) purposes.push("marketing");
  const method: ConsentMethod = i.source === "api" ? "api" : i.source === "staff" ? "staff_recorded" : "web_checkbox";
  for (const purpose of purposes) {
    await recordConsent(tx, {
      orgId: i.orgId,
      patientId: i.patientId,
      purpose,
      granted: true,
      locale: i.locale,
      method,
      source: i.source,
      actorRelation: i.actorRelation,
      actorUserId: i.actorUserId,
      appointmentId: i.appointmentId,
      waitlistId: i.waitlistId,
      headers: i.headers,
      now: i.now,
    });
  }
}

export type ConsentState = { granted: boolean; at: Date; source: ConsentSource };

/**
 * The latest ledger row per purpose (null = never recorded). A patient id identifies one
 * practice's record, so this is org-scoped by construction; merged duplicates are included.
 */
export async function currentConsents(patientId: string, tx: Tx = db): Promise<Record<ConsentPurpose, ConsentState | null>> {
  const kept = await survivor(tx, patientId);
  const ids = kept ? await lineage(tx, kept.id) : [patientId];
  const rows = await tx
    .select({ purpose: consents.purpose, granted: consents.granted, at: consents.createdAt, source: consents.source })
    .from(consents)
    .where(inArray(consents.patientId, ids))
    // rowid breaks ties between rows written in the same millisecond.
    .orderBy(desc(consents.createdAt), desc(sql`${consents}.rowid`));
  const out = Object.fromEntries(Object.keys(PURPOSE_BASIS).map((p) => [p, null])) as Record<ConsentPurpose, ConsentState | null>;
  for (const r of rows) out[r.purpose] ??= { granted: r.granted, at: r.at, source: r.source };
  return out;
}

/**
 * May we process this patient's data for `purpose`? Consent purposes need a current grant;
 * contract, legitimate-interest and care purposes are allowed until the patient opts out or
 * objects.
 */
export async function isAllowed(patientId: string, purpose: ConsentPurpose, tx: Tx = db): Promise<boolean> {
  const latest = (await currentConsents(patientId, tx))[purpose];
  return isConsentBased(purpose) ? latest?.granted === true : latest?.granted !== false;
}
