import { and, asc, count, desc, eq, gt, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { db, type Tx } from "@/db";
import {
  appointments,
  auditLog,
  CONSENT_PURPOSES,
  LOCALES,
  locations,
  memberships,
  messages,
  organizations,
  patients,
  practitioners,
  privacyRequests,
  services,
  verificationCodes,
  waitlist,
  type AuditActorType,
  type ConsentPurpose,
  type Locale,
  type MembershipRole,
  type Organization,
  type OtpPurpose,
  type Patient,
  type PrivacyRequestType,
} from "@/db/schema";
import { fmtDay, zonedDate } from "@/i18n/datefmt";
import { getT } from "@/i18n/t";
import { audit, type AuditEvent } from "../audit";
import { APP_NAME, DEFAULT_TIMEZONE } from "../config";
import {
  contactHash,
  contactMatchDisclosure,
  isContactVerified,
  isMinor,
  markContactVerified,
  normalizeContact,
  passesChallenge,
  recipientFor,
  type ContactKind,
  type ContactMatchRow,
} from "../contact";
import { decrypt, encrypt, hmac, isEncrypted } from "../crypto";
import { newId, newToken } from "../ids";
import { logError, maskEmail, maskPhone } from "../log";
import { deliver } from "../messaging";
import { renderEmailLayout } from "../messaging/layout";
import { OTP_MAX_FAILURES, OTP_TTL_MS, sendOtp, verifyOtp } from "../otp";
import { normalizePhone } from "../phone";
import { clientNetworkHash, rateLimit } from "../rate-limit";
import { listPatientReviews, withdrawReview, type PatientReview } from "../reviews";
import { resolveSettings } from "../settings";
import { ConsentError, currentConsents, PURPOSE_BASIS, recordConsent, type ConsentState } from "./consent";
import { buildPatientExport, type PatientExport } from "./export";
import { createPrivacyRequest } from "./requests";
import type { PatientSession, VerifiedContact } from "./patient-session";

/**
 * The patient privacy center (/[locale]/privacy): rights without an account.
 *
 * 1. Sign-in. The visitor types a phone number or an email address. If any practice holds a
 *    record for it, a one-time code goes there (sendOtp, purpose privacy_center). If none does,
 *    nothing is sent, but a decoy challenge is stored exactly as a real one would be (same rate
 *    limits, same attempt counting, a code that never matches), and the answer is padded to the
 *    same duration: the response, its timing and the behaviour of later guesses never tell an
 *    outsider whether a contact is anyone's patient.
 * 2. The code opens a 30-minute session (patient-session.ts).
 * 3. The session sees every practice holding a patient row whose phone or email is the verified
 *    contact (the one exception to org scoping, F9 rule 3), plus children whose guardian contact
 *    it is, until they turn 18. Shared family phones and mistyped emails mean a verified contact
 *    is not proof of identity: contactMatchDisclosure decides per row (details, or "a record
 *    exists" until the visitor gives that row's surname and birth date).
 * 4. Every view, export and change is audited with actor type patient_session, the session id
 *    (the sha256 of its cookie token: a pseudonym, never the contact) as actor id.
 *
 * Rows where the contact is only the booker's (another adult booked for the patient) never match:
 * the booker's contact is stored on the appointment (booked_by_*), not as the patient's.
 *
 * Server-only by nature (database, crypto); no "server-only" import so tests and jobs can load it.
 */

// ---------------------------------------------------------------- contacts and tickets

/** A phone number (any spelling normalizePhone accepts, with `dialCode` for national numbers) or an email address. */
export function parseContact(input: string, dialCode?: string | null): VerifiedContact | null {
  const raw = input.trim();
  if (!raw) return null;
  const kind: ContactKind = raw.includes("@") ? "email" : "phone";
  const value = kind === "phone" ? normalizePhone(raw, dialCode ?? null) : normalizeContact("email", raw);
  return value ? { kind, value } : null;
}

/** "+39•••4567" / "m•••@d•••": how a contact is shown back to the visitor. */
export function maskContact(c: VerifiedContact): string {
  return c.kind === "email" ? maskEmail(c.value) : maskPhone(c.value);
}

/**
 * What travels between the form that sends a code and the form that checks it: the challenge, the
 * contact it went to, and what the code is for. Sealed with the server key (AES-GCM), so the
 * contact is never readable in the URL or the page, and a ticket can't be forged or retargeted.
 */
export type Ticket = {
  /** Challenge id (verification_codes.id). */
  c: string;
  k: ContactKind;
  /** The normalised contact the code went to. */
  v: string;
  p: OtpPurpose;
  /** Expiry, epoch ms. */
  e: number;
  /** Manage-link step-up: the patient whose contact on file received the code. */
  pid?: string;
  /** Contact change: the records to update, and the session that asked. */
  ids?: string[];
  s?: string;
};

const TICKET_AAD = "privacy_center.ticket";
/** A little longer than the code itself, so "expired" comes from the code check, not the ticket. */
export const TICKET_TTL_MS = OTP_TTL_MS + 5 * 60_000;

export function sealTicket(t: Omit<Ticket, "e">, now: Date = new Date()): string {
  return Buffer.from(encrypt(JSON.stringify({ ...t, e: now.getTime() + TICKET_TTL_MS }), TICKET_AAD)).toString("base64url");
}

export function openTicket(raw: string | null | undefined, purpose: OtpPurpose, now: Date = new Date()): Ticket | null {
  if (!raw || raw.length > 4000) return null;
  try {
    const sealed = Buffer.from(raw, "base64url").toString("utf8");
    if (!isEncrypted(sealed)) return null;
    const t = JSON.parse(decrypt(sealed, TICKET_AAD)) as Ticket;
    if (t.p !== purpose || typeof t.e !== "number" || t.e <= now.getTime()) return null;
    if ((t.k !== "phone" && t.k !== "email") || typeof t.c !== "string" || typeof t.v !== "string") return null;
    return t;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- matching records

export type CenterOrg = Pick<
  Organization,
  "id" | "slug" | "name" | "legalName" | "email" | "phone" | "privacyEmail" | "timezone" | "brandColor" | "settings"
>;

export type CenterRecord = {
  patient: Patient;
  org: CenterOrg;
  /** The verified contact is the patient's own (self) or a guardian's (family view, minors only). */
  via: "self" | "guardian";
  /** details: show it; challenge: only "a record exists" until surname and birth date are given. */
  disclosure: "details" | "challenge";
};

const orgColumns = {
  id: organizations.id,
  slug: organizations.slug,
  name: organizations.name,
  legalName: organizations.legalName,
  email: organizations.email,
  phone: organizations.phone,
  privacyEmail: organizations.privacyEmail,
  timezone: organizations.timezone,
  brandColor: organizations.brandColor,
  settings: organizations.settings,
};

/**
 * Every record the contact may reach, across practices (the privacy center's exception to org
 * scoping). Erased records have no contacts left; merged duplicates are tombstones and are skipped
 * (the kept record carries the data). A guardian match counts only while the patient is a minor;
 * when a parent typed their own number as the child's too, the row is a family view (and ends at
 * 18) rather than "self".
 */
export async function findRecords(contact: VerifiedContact, now: Date = new Date(), tx: Tx = db): Promise<CenterRecord[]> {
  const v = normalizeContact(contact.kind, contact.value);
  if (!v) return [];
  const own: SQL = contact.kind === "phone" ? eq(patients.phone, v) : sql`lower(${patients.email}) = ${v}`;
  const guard: SQL = contact.kind === "phone" ? eq(patients.guardianPhone, v) : sql`lower(${patients.guardianEmail}) = ${v}`;
  const rows = await tx
    .select({ patient: patients, org: orgColumns })
    .from(patients)
    .innerJoin(organizations, eq(organizations.id, patients.orgId))
    .where(and(or(own, guard), isNull(patients.erasedAt), isNull(patients.mergedIntoId)))
    .orderBy(asc(organizations.name), asc(patients.createdAt));

  const same = (a: string | null) => (a ? normalizeContact(contact.kind, a) === v : false);
  const tagged = rows.map((r) => {
    const p = r.patient;
    const ownMatch = contact.kind === "phone" ? same(p.phone) : same(p.email);
    const guardMatch = contact.kind === "phone" ? same(p.guardianPhone) : same(p.guardianEmail);
    const via: "self" | "guardian" = guardMatch && (!ownMatch || isMinor(p, now)) ? "guardian" : "self";
    return { ...r, via };
  });
  const matchRows: ContactMatchRow[] = tagged.map((r) => ({
    id: r.patient.id,
    firstName: r.patient.firstName,
    lastName: r.patient.lastName,
    birthDate: r.patient.birthDate,
    matchedVia: r.via,
    matchedContactVerified: isContactVerified(r.patient, contact.kind, v),
  }));
  const disclosure = contactMatchDisclosure(matchRows, now);
  return tagged.flatMap((r) => {
    const d = disclosure.get(r.patient.id);
    return d === "details" || d === "challenge" ? [{ patient: r.patient, org: r.org, via: r.via, disclosure: d }] : [];
  });
}

/** The record behind an action, if this session may see its details. */
export async function recordFor(session: PatientSession, patientId: string, now: Date = new Date()): Promise<CenterRecord | null> {
  const rec = (await findRecords(session.contact, now)).find((r) => r.patient.id === patientId);
  return rec?.disclosure === "details" ? rec : null;
}

export const actorOf = (session: Pick<PatientSession, "id">): AuditEvent["actor"] => ({ type: "patient_session", id: session.id });

/** The relation in which the visitor acts for this record (the consent ledger's actorRelation). */
export function actingAs(rec: Pick<CenterRecord, "via" | "patient">): "self" | "parent" | "legal_guardian" {
  return rec.via === "guardian" ? (rec.patient.guardianRelation ?? "parent") : "self";
}

// ---------------------------------------------------------------- sign-in

/** Mirrors sendOtp's limits (src/lib/otp.ts), so a decoy is refused exactly when a real code would be. */
const TARGET_LIMIT = { max: 3, windowMs: 15 * 60_000 };
const TARGET_DAILY_LIMIT = 10;
const IP_LIMIT = { max: 10, windowMs: 60 * 60_000 };
const DAY_MS = 86_400_000;

/**
 * A stored challenge for a contact we hold nothing for: same limits as sendOtp and the same row
 * shape, but nothing is sent and the stored hash belongs to no 6-digit code. Checking it behaves
 * like a real one (invalid, then too_many_attempts after 5 tries, expired after 5 minutes).
 */
async function issueDecoyChallenge(
  contact: VerifiedContact,
  headers: Headers,
  now: Date,
): Promise<{ ok: true; challengeId: string } | { ok: false; reason: "rate_limited" }> {
  const targetHash = contactHash(contact.kind, contact.value)!;
  const ipHash = clientNetworkHash(headers);
  const challengeId = newId(16);
  const allowed = await db.transaction(async (tx) => {
    const ago = (ms: number) => now.getTime() - ms;
    const [target] = await tx
      .select({
        today: count(),
        recent: sql<number>`COUNT(CASE WHEN ${verificationCodes.createdAt} > ${ago(TARGET_LIMIT.windowMs)} THEN 1 END)`,
        failures: sql<number>`COALESCE(SUM(${verificationCodes.attempts}), 0) - COUNT(${verificationCodes.consumedAt})`,
      })
      .from(verificationCodes)
      .where(and(eq(verificationCodes.targetHash, targetHash), gt(verificationCodes.createdAt, new Date(ago(DAY_MS)))));
    if (target.recent >= TARGET_LIMIT.max || target.today >= TARGET_DAILY_LIMIT || target.failures >= OTP_MAX_FAILURES) return false;
    const [perIp] = await tx
      .select({ n: count() })
      .from(verificationCodes)
      .where(and(eq(verificationCodes.ipHash, ipHash), gt(verificationCodes.createdAt, new Date(ago(IP_LIMIT.windowMs)))));
    if (perIp.n >= IP_LIMIT.max) return false;
    await tx.insert(verificationCodes).values({
      id: challengeId,
      purpose: "privacy_center",
      channel: contact.kind === "phone" ? "sms" : "email",
      targetHash,
      codeHash: hmac(`decoy:${newToken()}`, "otp"),
      expiresAt: new Date(now.getTime() + OTP_TTL_MS),
      ipHash,
      createdAt: now,
    });
    return true;
  });
  return allowed ? { ok: true, challengeId } : { ok: false, reason: "rate_limited" };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Send a privacy-center code to `contact` if any practice holds a record for it; answer the same
 * either way. `minDurationMs` pads the call so a real send and a decoy take as long (pages pass
 * about a second; tests pass 0).
 */
export async function requestPrivacyCenterCode(i: {
  contact: VerifiedContact;
  locale: Locale;
  headers: Headers;
  now?: Date;
  minDurationMs?: number;
}): Promise<{ ok: true; ticket: string } | { ok: false; reason: "rate_limited" }> {
  const started = Date.now();
  const now = i.now ?? new Date();
  let result: { ok: true; challengeId: string } | { ok: false; reason: "rate_limited" };
  try {
    const known = (await findRecords(i.contact, now)).length > 0;
    result = known
      ? await sendOtp({
          purpose: "privacy_center",
          channel: i.contact.kind === "phone" ? "sms" : "email",
          to: i.contact.value,
          locale: i.locale,
          orgId: null,
          fromName: APP_NAME,
          headers: i.headers,
          now,
        })
      : await issueDecoyChallenge(i.contact, i.headers, now);
  } finally {
    const wait = (i.minDurationMs ?? 0) - (Date.now() - started);
    if (wait > 0) await sleep(wait);
  }
  if (!result.ok) return result;
  return { ok: true, ticket: sealTicket({ c: result.challengeId, k: i.contact.kind, v: i.contact.value, p: "privacy_center" }, now) };
}

export type CodeCheck =
  | { ok: true; contact: VerifiedContact; ticket: Ticket }
  | { ok: false; reason: "invalid" | "expired" | "too_many_attempts" };

/** Check a code against its ticket (any purpose); the contact it proves is returned on success. */
export async function checkTicketCode(raw: string, code: string, purpose: OtpPurpose, now: Date = new Date()): Promise<CodeCheck> {
  const t = openTicket(raw, purpose, now);
  if (!t) return { ok: false, reason: "expired" };
  const res = await verifyOtp({ challengeId: t.c, code, purpose, now });
  if (!res.ok) return res;
  if (res.targetHash !== contactHash(t.k, t.v)) return { ok: false, reason: "invalid" };
  return { ok: true, contact: { kind: t.k, value: t.v }, ticket: t };
}

// ---------------------------------------------------------------- reading a record

export type AccessLogEntry = {
  at: Date;
  actorType: AuditActorType;
  /** The staff member's role in this practice, for actor type user (null: no longer a member). */
  role: MembershipRole | null;
  action: string;
};

export type RecordDetails = {
  appointments: {
    id: string;
    startsAt: Date;
    endsAt: Date;
    status: (typeof appointments.$inferSelect)["status"];
    service: string;
    practitioner: string;
    location: string;
    timezone: string;
    processingContext: (typeof appointments.$inferSelect)["processingContext"];
    bookedFor: (typeof appointments.$inferSelect)["bookedFor"];
  }[];
  messages: {
    id: string;
    createdAt: Date;
    channel: (typeof messages.$inferSelect)["channel"];
    direction: (typeof messages.$inferSelect)["direction"];
    subject: string | null;
    body: string;
    redacted: boolean;
    status: (typeof messages.$inferSelect)["status"];
  }[];
  waitlist: { id: string; service: string; earliestDate: string; latestDate: string; status: (typeof waitlist.$inferSelect)["status"] }[];
  consents: Record<ConsentPurpose, ConsentState | null>;
  reviews: PatientReview[];
  requests: {
    id: string;
    toSorriso: boolean;
    type: PrivacyRequestType;
    status: (typeof privacyRequests.$inferSelect)["status"];
    receivedAt: Date;
    dueAt: Date;
    closedAt: Date | null;
  }[];
  accessLog: AccessLogEntry[];
  /** Sorriso is controller of something here (a marketplace booking or a platform consent). */
  hasPlatformData: boolean;
};

const MAX_ROWS = 200;

export async function loadRecordDetails(rec: CenterRecord, tx: Tx = db): Promise<RecordDetails> {
  const orgId = rec.org.id;
  const pid = rec.patient.id;
  const appts = await tx
    .select({
      id: appointments.id,
      startsAt: appointments.startsAt,
      endsAt: appointments.endsAt,
      status: appointments.status,
      service: services.name,
      practitioner: practitioners.name,
      location: locations.name,
      timezone: locations.timezone,
      processingContext: appointments.processingContext,
      bookedFor: appointments.bookedFor,
    })
    .from(appointments)
    .innerJoin(services, eq(services.id, appointments.serviceId))
    .innerJoin(practitioners, eq(practitioners.id, appointments.practitionerId))
    .innerJoin(locations, eq(locations.id, appointments.locationId))
    .where(and(eq(appointments.orgId, orgId), eq(appointments.patientId, pid)))
    .orderBy(desc(appointments.startsAt))
    .limit(MAX_ROWS);

  const msgs = await tx
    .select({
      id: messages.id,
      createdAt: messages.createdAt,
      channel: messages.channel,
      direction: messages.direction,
      subject: messages.subject,
      body: messages.body,
      redactedAt: messages.redactedAt,
      status: messages.status,
    })
    .from(messages)
    .where(and(eq(messages.orgId, orgId), eq(messages.patientId, pid)))
    .orderBy(desc(messages.createdAt))
    .limit(MAX_ROWS);

  const wl = await tx
    .select({ id: waitlist.id, service: services.name, earliestDate: waitlist.earliestDate, latestDate: waitlist.latestDate, status: waitlist.status })
    .from(waitlist)
    .innerJoin(services, eq(services.id, waitlist.serviceId))
    .where(and(eq(waitlist.orgId, orgId), eq(waitlist.patientId, pid)))
    .orderBy(desc(waitlist.createdAt));

  const reqs = await tx
    .select({
      id: privacyRequests.id,
      orgId: privacyRequests.orgId,
      type: privacyRequests.type,
      status: privacyRequests.status,
      receivedAt: privacyRequests.receivedAt,
      dueAt: privacyRequests.dueAt,
      extendedUntil: privacyRequests.extendedUntil,
      closedAt: privacyRequests.closedAt,
    })
    .from(privacyRequests)
    .where(and(eq(privacyRequests.patientId, pid), or(eq(privacyRequests.orgId, orgId), isNull(privacyRequests.orgId))))
    .orderBy(desc(privacyRequests.receivedAt));

  // Access log: this record and its appointments in the practice's chain, plus Sorriso's own chain
  // (platform consents) for the record. Staff appear by role only.
  const apptIds = appts.map((a) => a.id);
  const aboutRecord = and(eq(auditLog.entityType, "patient"), eq(auditLog.entityId, pid));
  const aboutVisits = apptIds.length ? and(eq(auditLog.entityType, "appointment"), inArray(auditLog.entityId, apptIds)) : undefined;
  const log = await tx
    .select({ at: auditLog.at, actorType: auditLog.actorType, action: auditLog.action, role: memberships.role })
    .from(auditLog)
    .leftJoin(memberships, and(eq(memberships.userId, auditLog.actorId), eq(memberships.orgId, orgId)))
    .where(or(and(eq(auditLog.orgId, orgId), or(aboutRecord, aboutVisits)), and(isNull(auditLog.orgId), aboutRecord)))
    .orderBy(desc(auditLog.at))
    .limit(MAX_ROWS);

  const consents = await currentConsents(pid, tx);
  const reviews = (await listPatientReviews([pid])).filter((r) => r.orgId === orgId);

  return {
    appointments: appts,
    messages: msgs.map((m) => ({
      id: m.id,
      createdAt: m.createdAt,
      channel: m.channel,
      direction: m.direction,
      subject: m.redactedAt ? null : m.subject,
      body: m.redactedAt ? "" : m.body,
      redacted: Boolean(m.redactedAt),
      status: m.status,
    })),
    waitlist: wl,
    consents,
    reviews,
    requests: reqs.map((r) => ({
      id: r.id,
      toSorriso: r.orgId === null,
      type: r.type,
      status: r.status,
      receivedAt: r.receivedAt,
      dueAt: r.extendedUntil ?? r.dueAt,
      closedAt: r.closedAt,
    })),
    accessLog: log.map((l) => ({ at: l.at, actorType: l.actorType, role: l.actorType === "user" ? (l.role ?? null) : null, action: l.action })),
    hasPlatformData: appts.some((a) => a.processingContext === "marketplace") || consents.platform_booking_art9 !== null,
  };
}

/** One privacy_center.view row per record shown in full (the access log the patient then sees includes it). */
export async function auditView(session: PatientSession, records: CenterRecord[], headers?: Headers): Promise<void> {
  for (const r of records) {
    if (r.disclosure !== "details") continue;
    await audit({
      orgId: r.org.id,
      actor: actorOf(session),
      action: "privacy_center.view",
      entity: { type: "patient", id: r.patient.id },
      metadata: { via: r.via },
      headers,
    });
  }
}

// ---------------------------------------------------------------- the identity challenge

export type ChallengeResult = { ok: true } | { ok: false; reason: "wrong" | "rate_limited" | "not_found" };

/** Attempts per record and contact per day: enough for typos, too few to guess a birth date. */
const CHALLENGE_LIMIT = { max: 5, windowMs: DAY_MS };

/**
 * Unlock a "challenge" record with its surname and birth date. Success proves the verified contact
 * belongs to this record, so it is recorded as verified for it (markContactVerified) and the
 * record shows in full from then on.
 */
export async function answerChallenge(
  session: PatientSession,
  patientId: string,
  answer: { lastName: string; birthDate: string },
  opts: { headers?: Headers; now?: Date } = {},
): Promise<ChallengeResult> {
  const now = opts.now ?? new Date();
  const rec = (await findRecords(session.contact, now)).find((r) => r.patient.id === patientId);
  if (!rec) return { ok: false, reason: "not_found" };
  if (rec.disclosure === "details") return { ok: true };
  const limited = await rateLimit(`pc-challenge:${hmac(`${session.contactHash}:${patientId}`, "token").slice(0, 32)}`, CHALLENGE_LIMIT.max, CHALLENGE_LIMIT.windowMs, now);
  if (!limited.ok) return { ok: false, reason: "rate_limited" };
  if (!passesChallenge(rec.patient, answer)) return { ok: false, reason: "wrong" };
  await db.transaction(async (tx) => {
    await markContactVerified(patientId, session.contact, tx, now);
    await audit(
      {
        orgId: rec.org.id,
        actor: actorOf(session),
        action: "patient.update",
        entity: { type: "patient", id: patientId },
        metadata: { change: "contact_verified", source: "privacy_center" },
        headers: opts.headers,
        at: now,
      },
      tx,
    );
  });
  return { ok: true };
}

// ---------------------------------------------------------------- consents and preferences

export type ConsentOption = {
  purpose: ConsentPurpose;
  /** consent: opt-in; channel: a contract channel the patient can switch off; objection: Art. 21. */
  kind: "consent" | "channel" | "objection";
  /** On: granted (consent), receiving (channel), not objected (objection). */
  on: boolean;
  /** When the current state was recorded (null: the default, nothing recorded). */
  at: Date | null;
  canTurnOn: boolean;
  canTurnOff: boolean;
};

/**
 * The choices the privacy center offers for a record, in display order. Turning something on is
 * offered only where it makes sense here: Sorriso's booking consent and WhatsApp are given in the
 * flows that show their notices (booking, the channel choice below), so here they can only be
 * withdrawn; review consents are managed with the reviews themselves.
 */
export function consentOptions(rec: CenterRecord, consents: Record<ConsentPurpose, ConsentState | null>): ConsentOption[] {
  const settings = resolveSettings(rec.org.settings);
  const to = recipientFor({ ...rec.patient, restrictedAt: null, erasedAt: null });
  const out: ConsentOption[] = [];
  const add = (purpose: ConsentPurpose, show: boolean, can: { on: boolean; off: boolean }) => {
    const latest = consents[purpose];
    const basis = PURPOSE_BASIS[purpose];
    const on = basis === "consent" ? latest?.granted === true : latest?.granted !== false;
    if (!show && !latest) return;
    out.push({
      purpose,
      kind: basis === "consent" ? "consent" : basis === "contract" ? "channel" : "objection",
      on,
      at: latest?.at ?? null,
      canTurnOn: !on && can.on,
      canTurnOff: on && can.off,
    });
  };
  add("sms_channel", Boolean(to.phone), { on: Boolean(to.phone), off: true });
  add("email_channel", Boolean(to.email), { on: Boolean(to.email), off: true });
  add("whatsapp_channel", settings.privacy.whatsappEnabled, { on: false, off: true });
  add("feedback_request", true, { on: true, off: true });
  add("marketing", settings.privacy.marketingEnabled, { on: settings.privacy.marketingEnabled, off: true });
  add("recalls", settings.care.recallsEnabled, { on: true, off: true });
  add("no_show_tracking", true, { on: true, off: true });
  add("adaptive_reminders", settings.privacy.riskBasedReminders, { on: true, off: true });
  add("platform_booking_art9", false, { on: false, off: true });
  return out;
}

export type ActionResult = { ok: true } | { ok: false; reason: string };

/**
 * Who acts on a record, for the ledger and the audit log: a privacy-center session, or the
 * appointment link (a link that was delivered only to the patient's, or their guardian's, contact).
 */
export type Acting = {
  actor: AuditEvent["actor"];
  source: "privacy_center" | "manage_link";
  actorRelation: "self" | "parent" | "legal_guardian";
};

const sessionActing = (session: PatientSession, rec: CenterRecord): Acting => ({
  actor: actorOf(session),
  source: "privacy_center",
  actorRelation: actingAs(rec),
});

/**
 * The record behind an appointment link, as the privacy pages see it. The link goes to
 * recipientFor(patient): the guardian's contact under 14, so the guardian acts there.
 */
export function linkRecord(d: { patient: Patient; org: CenterOrg }, now: Date = new Date()): { rec: CenterRecord; acting: Acting } {
  const viaGuardian = recipientFor({ ...d.patient, restrictedAt: null, erasedAt: null }, now).viaGuardian;
  const rec: CenterRecord = { patient: d.patient, org: d.org, via: viaGuardian ? "guardian" : "self", disclosure: "details" };
  return { rec, acting: { actor: { type: "patient_link", id: null }, source: "manage_link", actorRelation: actingAs(rec) } };
}

/** Record one choice for a record (a new ledger row, audited as consent.record), if the options allow it. */
export async function applyConsentChoice(
  rec: CenterRecord,
  acting: Acting,
  i: { purpose: ConsentPurpose; on: boolean; locale: Locale; headers?: Headers; now?: Date },
): Promise<ActionResult> {
  if (!(CONSENT_PURPOSES as readonly string[]).includes(i.purpose)) return { ok: false, reason: "invalid" };
  const now = i.now ?? new Date();
  const option = consentOptions(rec, await currentConsents(rec.patient.id)).find((o) => o.purpose === i.purpose);
  if (!option || (i.on ? !option.canTurnOn : !option.canTurnOff)) return { ok: false, reason: "not_allowed" };
  try {
    await db.transaction((tx) =>
      recordConsent(tx, {
        orgId: rec.org.id,
        patientId: rec.patient.id,
        purpose: i.purpose,
        granted: i.on,
        locale: i.locale,
        method: "web_checkbox",
        source: acting.source,
        actorRelation: acting.actorRelation,
        actor: acting.actor,
        headers: i.headers,
        now,
      }),
    );
  } catch (err) {
    if (err instanceof ConsentError && err.code === "guardian_required") return { ok: false, reason: "guardian_required" };
    throw err;
  }
  return { ok: true };
}

/** Turn one choice on or off from the privacy center. */
export async function setConsentChoice(
  session: PatientSession,
  i: { patientId: string; purpose: ConsentPurpose; on: boolean; locale: Locale; headers?: Headers; now?: Date },
): Promise<ActionResult> {
  const rec = await recordFor(session, i.patientId, i.now ?? new Date());
  if (!rec) return { ok: false, reason: "not_found" };
  return applyConsentChoice(rec, sessionActing(session, rec), i);
}

/** The channels this record can be reached on, for the preferences form. */
export function channelOptions(rec: CenterRecord): ("sms" | "whatsapp" | "email")[] {
  const settings = resolveSettings(rec.org.settings);
  const to = recipientFor({ ...rec.patient, restrictedAt: null, erasedAt: null });
  const out: ("sms" | "whatsapp" | "email")[] = [];
  if (to.phone) out.push("sms");
  if (to.phone && settings.privacy.whatsappEnabled) out.push("whatsapp");
  if (to.email) out.push("email");
  return out;
}

export type PreferencesInput = {
  locale: Locale;
  channel: "sms" | "whatsapp" | "email";
  whatsappConfirmed?: boolean;
  /** The page's language (what the consent text was shown in). */
  shownIn: Locale;
  headers?: Headers;
  now?: Date;
};

/**
 * Change the language and channel of the patient's messages. Choosing WhatsApp needs the
 * confirmation shown with its just-in-time notice: it is recorded as a whatsapp_channel grant.
 */
export async function applyPreferences(rec: CenterRecord, acting: Acting, i: PreferencesInput): Promise<ActionResult> {
  const now = i.now ?? new Date();
  if (!(LOCALES as readonly string[]).includes(i.locale)) return { ok: false, reason: "invalid" };
  if (!channelOptions(rec).includes(i.channel)) return { ok: false, reason: "channel_unavailable" };
  const consents = await currentConsents(rec.patient.id);
  const needsWhatsAppConsent = i.channel === "whatsapp" && consents.whatsapp_channel?.granted !== true;
  if (needsWhatsAppConsent && !i.whatsappConfirmed) return { ok: false, reason: "whatsapp_consent_required" };
  try {
    await db.transaction(async (tx) => {
      if (needsWhatsAppConsent) {
        await recordConsent(tx, {
          orgId: rec.org.id,
          patientId: rec.patient.id,
          purpose: "whatsapp_channel",
          granted: true,
          locale: i.shownIn,
          method: "web_checkbox",
          source: acting.source,
          actorRelation: acting.actorRelation,
          actor: acting.actor,
          headers: i.headers,
          now,
        });
      }
      await tx
        .update(patients)
        .set({ locale: i.locale, preferredChannel: i.channel })
        .where(and(eq(patients.id, rec.patient.id), eq(patients.orgId, rec.org.id)));
      await audit(
        {
          orgId: rec.org.id,
          actor: acting.actor,
          action: "patient.update",
          entity: { type: "patient", id: rec.patient.id },
          metadata: { fields: "locale,preferredChannel", channel: i.channel, locale: i.locale, source: acting.source },
          headers: i.headers,
          at: now,
        },
        tx,
      );
    });
  } catch (err) {
    if (err instanceof ConsentError && err.code === "guardian_required") return { ok: false, reason: "guardian_required" };
    throw err;
  }
  return { ok: true };
}

/** Language and channel from the privacy center. */
export async function updatePreferences(session: PatientSession, i: PreferencesInput & { patientId: string }): Promise<ActionResult> {
  const rec = await recordFor(session, i.patientId, i.now ?? new Date());
  if (!rec) return { ok: false, reason: "not_found" };
  return applyPreferences(rec, sessionActing(session, rec), i);
}

/**
 * The step-up of the appointment link: a privacy-center code to a contact on file (the
 * recipient's: the guardian's under 14). The code opens a privacy-center session and, being an
 * explicit act through that contact, records it as verified for this patient.
 */
export async function requestLinkStepUp(i: {
  rec: CenterRecord;
  kind: ContactKind;
  locale: Locale;
  headers: Headers;
  now?: Date;
}): Promise<{ ok: true; ticket: string } | { ok: false; reason: "no_contact" | "rate_limited" }> {
  const now = i.now ?? new Date();
  const to = recipientFor({ ...i.rec.patient, restrictedAt: null, erasedAt: null }, now);
  const value = i.kind === "phone" ? to.phone : to.email;
  const contact = value ? normalizeContact(i.kind, value) : null;
  if (!contact) return { ok: false, reason: "no_contact" };
  const sent = await sendOtp({
    purpose: "privacy_center",
    channel: i.kind === "phone" ? "sms" : "email",
    to: contact,
    locale: i.locale,
    orgId: i.rec.org.id,
    fromName: i.rec.org.name,
    headers: i.headers,
    now,
  });
  if (!sent.ok) return sent;
  return { ok: true, ticket: sealTicket({ c: sent.challengeId, k: i.kind, v: contact, p: "privacy_center", pid: i.rec.patient.id }, now) };
}

// ---------------------------------------------------------------- correcting contacts

type ContactField = "phone" | "email" | "guardianPhone" | "guardianEmail";

function fieldFor(rec: CenterRecord, kind: ContactKind): ContactField {
  if (rec.via === "guardian") return kind === "phone" ? "guardianPhone" : "guardianEmail";
  return kind;
}

/**
 * Step 1 of a contact correction: a code goes to the new contact (purpose contact_change). The
 * change applies to the listed records this session may see in full; for a family view it is the
 * guardian's contact that changes.
 */
export async function requestContactChange(
  session: PatientSession,
  i: { patientIds: string[]; kind: ContactKind; value: string; dialCode?: string | null; locale: Locale; headers: Headers; now?: Date },
): Promise<{ ok: true; ticket: string; masked: string } | { ok: false; reason: "invalid_contact" | "unchanged" | "not_found" | "rate_limited" }> {
  const now = i.now ?? new Date();
  const parsed = parseContact(i.value, i.dialCode);
  if (!parsed || parsed.kind !== i.kind) return { ok: false, reason: "invalid_contact" };
  const all = await findRecords(session.contact, now);
  const recs = all.filter((r) => r.disclosure === "details" && i.patientIds.includes(r.patient.id));
  if (!recs.length || recs.length !== new Set(i.patientIds).size) return { ok: false, reason: "not_found" };
  if (recs.every((r) => r.patient[fieldFor(r, i.kind)] === parsed.value)) return { ok: false, reason: "unchanged" };
  const sent = await sendOtp({
    purpose: "contact_change",
    channel: i.kind === "phone" ? "sms" : "email",
    to: parsed.value,
    locale: i.locale,
    orgId: null,
    fromName: APP_NAME,
    headers: i.headers,
    now,
  });
  if (!sent.ok) return sent;
  const ticket = sealTicket({ c: sent.challengeId, k: parsed.kind, v: parsed.value, p: "contact_change", ids: recs.map((r) => r.patient.id), s: session.id }, now);
  return { ok: true, ticket, masked: maskContact(parsed) };
}

/**
 * Step 2: the code proves the new contact, which replaces the old one on each record (and counts
 * as verified for it). The old contact is told, in case it wasn't its owner who did it. Returns
 * the new contact when it replaced the very contact this session signed in with, so the caller
 * can move the session over to it.
 */
export async function confirmContactChange(
  session: PatientSession,
  i: { ticket: string; code: string; headers?: Headers; now?: Date },
): Promise<{ ok: true; renewSessionWith: VerifiedContact | null } | { ok: false; reason: "invalid" | "expired" | "too_many_attempts" | "not_found" }> {
  const now = i.now ?? new Date();
  const check = await checkTicketCode(i.ticket, i.code, "contact_change", now);
  if (!check.ok) return check;
  const t = check.ticket;
  if (t.s !== session.id || !t.ids?.length) return { ok: false, reason: "invalid" };
  const recs = (await findRecords(session.contact, now)).filter((r) => r.disclosure === "details" && t.ids!.includes(r.patient.id));
  if (!recs.length) return { ok: false, reason: "not_found" };
  const kind = t.k;
  const value = t.v;
  const replaced: { rec: CenterRecord; old: string | null }[] = [];
  await db.transaction(async (tx) => {
    for (const rec of recs) {
      const field = fieldFor(rec, kind);
      const old = rec.patient[field];
      if (old === value) continue;
      // A contact added where there was none starts receiving the service messages, unless the
      // patient opted out of that channel before (the ledger has the last word).
      const optInField = kind === "phone" ? "smsOptIn" : "emailOptIn";
      const latest = (await currentConsents(rec.patient.id, tx))[kind === "phone" ? "sms_channel" : "email_channel"];
      const optIn = old === null && latest?.granted !== false ? { [optInField]: true } : {};
      await tx
        .update(patients)
        .set({ [field]: value, ...optIn })
        .where(and(eq(patients.id, rec.patient.id), eq(patients.orgId, rec.org.id)));
      await markContactVerified(rec.patient.id, { kind, value }, tx, now);
      await audit(
        {
          orgId: rec.org.id,
          actor: actorOf(session),
          action: "patient.update",
          entity: { type: "patient", id: rec.patient.id },
          metadata: { fields: field, source: "privacy_center", verified: true },
          headers: i.headers,
          at: now,
        },
        tx,
      );
      replaced.push({ rec, old });
    }
  });
  for (const { rec, old } of replaced) {
    if (old) await notifyContactChanged(rec, { kind, value: old }, now);
  }
  const renew = replaced.some(({ old }) => old !== null && kind === session.contact.kind && normalizeContact(kind, old) === session.contact.value);
  return { ok: true, renewSessionWith: renew ? { kind, value } : null };
}

/** Tell the previous contact that it was replaced (best effort, never throws). */
async function notifyContactChanged(rec: CenterRecord, old: VerifiedContact, now: Date): Promise<void> {
  const locale = rec.patient.locale;
  const t = getT(locale, "privacyMessages");
  const vars = {
    field: t(`fields.${old.kind}`),
    practice: rec.org.name,
    date: fmtDay(zonedDate(now, rec.org.timezone || DEFAULT_TIMEZONE), "long", locale),
  };
  try {
    if (old.kind === "email") {
      const { html, text } = renderEmailLayout({
        locale,
        brandColor: rec.org.brandColor,
        brandName: rec.org.name,
        intro: t("contactChanged.body", vars),
        footerLines: [t("footer.privacyCenter"), rec.org.legalName ?? rec.org.name],
      });
      await deliver({ orgId: rec.org.id, patientId: rec.patient.id, channel: "email", to: old.value, subject: t("contactChanged.subject"), text, html, fromName: rec.org.name, locale });
    } else {
      await deliver({ orgId: rec.org.id, patientId: rec.patient.id, channel: "sms", to: old.value, text: t("contactChanged.sms", vars), locale });
    }
  } catch (err) {
    logError("privacy-center", err, { step: "contact_changed_notice", orgId: rec.org.id });
  }
}

// ---------------------------------------------------------------- requests, reviews, export

/** The requests the privacy center files; the rest of PRIVACY_REQUEST_TYPES are staff-logged. */
export const CENTER_REQUEST_TYPES = ["access", "rectification", "erasure", "restriction", "objection", "portability"] as const satisfies readonly PrivacyRequestType[];
export type CenterRequestType = (typeof CENTER_REQUEST_TYPES)[number];

export const MAX_REQUEST_DETAILS = 2000;

/**
 * File a rights request with the practice, or with Sorriso for what it controls (marketplace
 * bookings, platform consents, reviews). It lands in the practice's inbox (or Sorriso's platform
 * inbox) with the one-month deadline, linked to the record and to the verified contact; the
 * requester gets a receipt with the due date. An open request of the same type is not filed twice.
 */
export async function fileRequest(
  session: PatientSession,
  i: {
    patientId: string;
    type: CenterRequestType;
    toSorriso?: boolean;
    details?: string | null;
    locale: Locale;
    headers?: Headers;
    now?: Date;
  },
): Promise<{ ok: true; id: string; dueAt: Date; duplicate: boolean } | { ok: false; reason: "not_found" | "invalid" }> {
  const now = i.now ?? new Date();
  if (!(CENTER_REQUEST_TYPES as readonly string[]).includes(i.type)) return { ok: false, reason: "invalid" };
  const rec = await recordFor(session, i.patientId, now);
  if (!rec) return { ok: false, reason: "not_found" };
  const toSorriso = Boolean(i.toSorriso);
  if (toSorriso && !(await loadRecordDetails(rec)).hasPlatformData) return { ok: false, reason: "invalid" };
  const orgId = toSorriso ? null : rec.org.id;

  const [open] = await db
    .select({ id: privacyRequests.id, dueAt: privacyRequests.dueAt, extendedUntil: privacyRequests.extendedUntil })
    .from(privacyRequests)
    .where(
      and(
        orgId ? eq(privacyRequests.orgId, orgId) : isNull(privacyRequests.orgId),
        eq(privacyRequests.patientId, rec.patient.id),
        eq(privacyRequests.type, i.type),
        inArray(privacyRequests.status, ["open", "in_progress", "extended"]),
      ),
    )
    .limit(1);
  if (open) return { ok: true, id: open.id, dueAt: open.extendedUntil ?? open.dueAt, duplicate: true };

  const created = await db.transaction((tx) =>
    createPrivacyRequest(tx, {
      orgId,
      patientId: rec.patient.id,
      type: i.type,
      channel: "privacy_center",
      details: i.details?.slice(0, MAX_REQUEST_DETAILS) ?? null,
      requesterLocale: i.locale,
      contactHash: session.contactHash,
      actor: actorOf(session),
      headers: i.headers,
      now,
    }),
  );
  await sendRequestReceipt(session, rec, { type: i.type, toSorriso, dueAt: created.dueAt, locale: i.locale, now });
  return { ok: true, ...created, duplicate: false };
}

/** The receipt goes to the contact that filed the request, in the language it was filed in. */
async function sendRequestReceipt(
  session: PatientSession,
  rec: CenterRecord,
  i: { type: PrivacyRequestType; toSorriso: boolean; dueAt: Date; locale: Locale; now: Date },
): Promise<void> {
  const t = getT(i.locale, "privacyMessages");
  const tz = rec.org.timezone || DEFAULT_TIMEZONE;
  const controller = i.toSorriso ? (process.env.PLATFORM_LEGAL_NAME?.trim() || APP_NAME) : (rec.org.legalName ?? rec.org.name);
  const vars = {
    controller,
    type: t(`requestTypes.${i.type}`),
    date: fmtDay(zonedDate(i.now, tz), "long", i.locale),
    due: fmtDay(zonedDate(i.dueAt, tz), "long", i.locale),
  };
  const base = { orgId: i.toSorriso ? null : rec.org.id, patientId: rec.patient.id, locale: i.locale };
  try {
    if (session.contact.kind === "email") {
      const { html, text } = renderEmailLayout({
        locale: i.locale,
        brandColor: i.toSorriso ? "#0d9488" : rec.org.brandColor,
        brandName: i.toSorriso ? APP_NAME : rec.org.name,
        intro: t("requestReceipt.body", vars),
        footerLines: [t("footer.privacyCenter"), controller],
      });
      await deliver({ ...base, channel: "email", to: session.contact.value, subject: t("requestReceipt.subject"), text, html, fromName: i.toSorriso ? APP_NAME : rec.org.name });
    } else {
      await deliver({ ...base, channel: "sms", to: session.contact.value, text: t("requestReceipt.sms", vars) });
    }
  } catch (err) {
    logError("privacy-center", err, { step: "request_receipt", orgId: rec.org.id });
  }
}

/** Take down one of the session's own reviews (WP7's withdrawReview does the rest). */
export async function withdrawOwnReview(session: PatientSession, reviewId: string, now: Date = new Date()): Promise<ActionResult> {
  const recs = (await findRecords(session.contact, now)).filter((r) => r.disclosure === "details");
  const mine = await listPatientReviews(recs.map((r) => r.patient.id));
  const review = mine.find((r) => r.id === reviewId);
  if (!review) return { ok: false, reason: "not_found" };
  if (review.status === "withdrawn" || review.status === "removed") return { ok: true };
  await withdrawReview(reviewId, actorOf(session));
  return { ok: true };
}

/** The full export of one record (ZIP: JSON, CSV, FHIR, summary), audited as privacy_center.export. */
export async function exportRecord(
  session: PatientSession,
  i: { patientId: string; locale: Locale; headers?: Headers; now?: Date },
): Promise<PatientExport | null> {
  const now = i.now ?? new Date();
  const rec = await recordFor(session, i.patientId, now);
  if (!rec) return null;
  const file = await buildPatientExport(rec.org.id, rec.patient.id, { locale: i.locale, format: "zip", actor: actorOf(session), now });
  await audit({
    orgId: rec.org.id,
    actor: actorOf(session),
    action: "privacy_center.export",
    entity: { type: "patient", id: rec.patient.id },
    metadata: { format: "zip", via: rec.via },
    headers: i.headers,
    at: now,
  });
  return file;
}
