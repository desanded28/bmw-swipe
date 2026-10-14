import { and, asc, desc, eq, inArray, isNull, lt, sql, type SQL } from "drizzle-orm";
import { db, type Tx } from "@/db";
import {
  memberships,
  organizations,
  patients,
  privacyRequests,
  users,
  type Locale,
  type Organization,
  type Patient,
  type PrivacyRequest,
  type PrivacyRequestChannel,
  type PrivacyRequestDecision,
  type PrivacyRequestStatus,
  type PrivacyRequestType,
} from "@/db/schema";
import { isLocale } from "@/i18n/config";
import { fmtDay, zonedDate } from "@/i18n/datefmt";
import { getT } from "@/i18n/t";
import type { Translator } from "@/i18n/types";
import { audit, type AuditEvent } from "../audit";
import { absoluteUrl, APP_NAME, DEFAULT_TIMEZONE } from "../config";
import { recipientFor } from "../contact";
import { newId } from "../ids";
import { logError } from "../log";
import { deliver } from "../messaging";
import { renderEmailLayout } from "../messaging/layout";
import { pad, zonedParts, zonedToUtc } from "../time";

/**
 * Data-subject requests (Art. 15-22). Each one is answered within one month of receipt
 * (Art. 12(3)), extendable by two further months with reasons. orgId null = a request to
 * Sorriso as controller (marketplace bookings, reviews, the privacy center), handled in the
 * platform inbox.
 *
 * Scope of erasure (Art. 17): only the requesting patient's own rows — their patient record
 * and what is linked to it by patientId or appointmentId. Never rows matched only by a phone
 * number or email: families share phones, and wiping by contact would erase someone else's
 * messages. The result is pseudonymisation (the appointment skeleton stays for the clinical
 * record and statistics), not anonymisation, and is described as such to the patient.
 *
 * Can run outside Next (the retention job sends the deadline reminders), so nothing here may
 * import "server-only" modules.
 */

/** Statuses that still count against the deadline. */
export const OPEN_REQUEST_STATUSES = ["open", "in_progress", "extended"] as const satisfies readonly PrivacyRequestStatus[];

/** Art. 12(3): "may be extended by two further months where necessary". */
export const MAX_EXTENSION_MONTHS = 2;

/** Owners are reminded this many days before the deadline (once each, per deadline). */
export const DEADLINE_REMINDER_DAYS = [7, 2] as const;

const DAY_MS = 86_400_000;

/**
 * The same wall-clock date and time `months` calendar months later in `tz`, clamped to the last
 * day of the target month (31 January + 1 month -> 28/29 February).
 */
export function addMonthsClamped(instant: Date, months: number, tz = DEFAULT_TIMEZONE): Date {
  const p = zonedParts(instant, tz);
  const index = p.month - 1 + months;
  const year = p.year + Math.floor(index / 12);
  const month = (((index % 12) + 12) % 12) + 1;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = Math.min(p.day, lastDay);
  return zonedToUtc(`${year}-${pad(month)}-${pad(day)}`, p.minutes, tz);
}

/**
 * The deadline: the same calendar date next month in Italy, clamped to that month's last day
 * (31 January -> 28/29 February), at the same wall-clock time.
 */
export function privacyRequestDueAt(receivedAt: Date, tz = DEFAULT_TIMEZONE): Date {
  return addMonthsClamped(receivedAt, 1, tz);
}

/** The latest date an extension may reach: the original deadline plus two months. */
export function maxExtensionUntil(dueAt: Date, tz = DEFAULT_TIMEZONE): Date {
  return addMonthsClamped(dueAt, MAX_EXTENSION_MONTHS, tz);
}

/** The deadline in force: the extension when there is one. */
export function effectiveDueAt(r: Pick<PrivacyRequest, "dueAt" | "extendedUntil">): Date {
  return r.extendedUntil ?? r.dueAt;
}

/** Whole days left until the deadline (negative once overdue; 0 on the last day). */
export function daysLeft(r: Pick<PrivacyRequest, "dueAt" | "extendedUntil">, now: Date = new Date()): number {
  const ms = effectiveDueAt(r).getTime() - now.getTime();
  return ms >= 0 ? Math.floor(ms / DAY_MS) : -Math.ceil(-ms / DAY_MS);
}

export function isOpenRequest(r: Pick<PrivacyRequest, "status">): boolean {
  return (OPEN_REQUEST_STATUSES as readonly string[]).includes(r.status);
}

export type PrivacyRequestErrorCode =
  | "not_found"
  | "closed"
  | "reason_required"
  | "extension_too_long"
  | "extension_not_later"
  | "extension_too_late"
  | "already_extended";

/** A refused request-handling step; `code` is a key of privacyAdmin.requests.errors. */
export class PrivacyRequestError extends Error {
  constructor(public code: PrivacyRequestErrorCode) {
    super(`Privacy request: ${code}`);
    this.name = "PrivacyRequestError";
  }
}

const ACTOR_BY_CHANNEL: Partial<Record<PrivacyRequestChannel, AuditEvent["actor"]["type"]>> = {
  privacy_center: "patient_session",
  manage_link: "patient_link",
  api: "api_key",
};

export async function createPrivacyRequest(
  tx: Tx,
  i: {
    orgId: string | null;
    patientId: string | null;
    type: PrivacyRequestType;
    channel: PrivacyRequestChannel;
    /** Free text from the requester: stored encrypted, never logged. */
    details?: string | null;
    requesterLocale: Locale;
    /** contactHash() of the verified contact that filed it (privacy center, manage link). */
    contactHash?: string | null;
    /**
     * Where to send the answer when no patient record is linked (stored encrypted): an email
     * and/or a phone number, joined by joinContacts().
     */
    answerContact?: string | null;
    /** Who filed or logged it; derived from the channel when omitted (staff pass their user). */
    actor?: AuditEvent["actor"];
    headers?: Headers;
    now?: Date;
    /**
     * When the request reached the controller, if earlier than now (a letter or a phone call
     * logged later): the deadline runs from receipt, not from logging.
     */
    receivedAt?: Date;
  },
): Promise<{ id: string; dueAt: Date }> {
  const now = i.now ?? new Date();
  const receivedAt = i.receivedAt && i.receivedAt.getTime() < now.getTime() ? i.receivedAt : now;
  const dueAt = privacyRequestDueAt(receivedAt);
  const id = newId();
  await tx.insert(privacyRequests).values({
    id,
    orgId: i.orgId,
    patientId: i.patientId,
    type: i.type,
    channel: i.channel,
    status: "open",
    details: i.details?.trim() || null,
    contactHash: i.contactHash ?? null,
    answerContact: i.answerContact?.trim() || null,
    requesterLocale: i.requesterLocale,
    receivedAt,
    dueAt,
    createdAt: now,
  });
  await audit(
    {
      orgId: i.orgId,
      actor: i.actor ?? { type: ACTOR_BY_CHANNEL[i.channel] ?? "system", id: null },
      action: "privacy_request.create",
      entity: { type: "privacy_request", id },
      metadata: { type: i.type, channel: i.channel, patientId: i.patientId },
      headers: i.headers,
      at: now,
    },
    tx,
  );
  return { id, dueAt };
}

// ---------------------------------------------------------------- reading

const scopeOf = (orgId: string | null): SQL => (orgId === null ? isNull(privacyRequests.orgId) : eq(privacyRequests.orgId, orgId));

/** One request of this practice (orgId null: the platform inbox), or null. */
export async function getPrivacyRequest(orgId: string | null, id: string, tx: Tx = db): Promise<PrivacyRequest | null> {
  const [row] = await tx
    .select()
    .from(privacyRequests)
    .where(and(scopeOf(orgId), eq(privacyRequests.id, id)));
  return row ?? null;
}

export type PrivacyRequestFilter = {
  status?: "open" | "closed" | "all";
  type?: PrivacyRequestType;
  /** Only requests past their deadline (open ones). */
  overdue?: boolean;
  patientId?: string;
  now?: Date;
  limit?: number;
};

/** The inbox: open requests by deadline first, closed ones newest first. */
export async function listPrivacyRequests(orgId: string | null, f: PrivacyRequestFilter = {}, tx: Tx = db) {
  const now = f.now ?? new Date();
  const status = f.status ?? "open";
  const conditions: (SQL | undefined)[] = [scopeOf(orgId)];
  if (status === "open") conditions.push(inArray(privacyRequests.status, [...OPEN_REQUEST_STATUSES]));
  if (status === "closed") conditions.push(inArray(privacyRequests.status, ["completed", "rejected"]));
  if (f.type) conditions.push(eq(privacyRequests.type, f.type));
  if (f.patientId) conditions.push(eq(privacyRequests.patientId, f.patientId));
  if (f.overdue) {
    conditions.push(inArray(privacyRequests.status, [...OPEN_REQUEST_STATUSES]));
    conditions.push(lt(sql`coalesce(${privacyRequests.extendedUntil}, ${privacyRequests.dueAt})`, now.getTime()));
  }
  const deadline = sql`coalesce(${privacyRequests.extendedUntil}, ${privacyRequests.dueAt})`;
  return tx
    .select({
      request: privacyRequests,
      patient: { id: patients.id, firstName: patients.firstName, lastName: patients.lastName, restrictedAt: patients.restrictedAt, erasedAt: patients.erasedAt },
    })
    .from(privacyRequests)
    .leftJoin(patients, eq(patients.id, privacyRequests.patientId))
    .where(and(...conditions))
    .orderBy(status === "closed" ? desc(privacyRequests.closedAt) : asc(deadline), desc(privacyRequests.receivedAt))
    .limit(f.limit ?? 200);
}

// ---------------------------------------------------------------- handling

type Step = { orgId: string | null; id: string; actor: AuditEvent["actor"]; headers?: Headers; now?: Date };

async function loadOpen(tx: Tx, orgId: string | null, id: string): Promise<PrivacyRequest> {
  const r = await getPrivacyRequest(orgId, id, tx);
  if (!r) throw new PrivacyRequestError("not_found");
  if (!isOpenRequest(r)) throw new PrivacyRequestError("closed");
  return r;
}

async function auditUpdate(tx: Tx, s: Step, r: PrivacyRequest, metadata: Record<string, string | number | boolean | null>, reason?: string) {
  await audit(
    {
      orgId: s.orgId,
      actor: s.actor,
      action: "privacy_request.update",
      entity: { type: "privacy_request", id: r.id },
      metadata: { type: r.type, patientId: r.patientId, ...metadata },
      reason: reason ?? null,
      headers: s.headers,
      at: s.now,
    },
    tx,
  );
}

/** Staff start working on it: status in_progress, handled by the actor. */
export async function startPrivacyRequest(tx: Tx, s: Step): Promise<PrivacyRequest> {
  const r = await loadOpen(tx, s.orgId, s.id);
  const [row] = await tx
    .update(privacyRequests)
    .set({
      // An extended request stays 'extended': its deadline is what matters.
      status: r.status === "extended" ? "extended" : "in_progress",
      handledByUserId: s.actor.type === "user" || s.actor.type === "platform_admin" ? s.actor.id : r.handledByUserId,
    })
    .where(eq(privacyRequests.id, r.id))
    .returning();
  await auditUpdate(tx, s, r, { status: row.status });
  return row;
}

/**
 * Extend the deadline (Art. 12(3)): at most two months beyond the original one, decided and
 * communicated within the first month, with reasons. Only once: a second extension would have to
 * stay within the same two months anyway, so the date is set in one go.
 */
export async function extendPrivacyRequest(tx: Tx, s: Step & { until: Date; reason: string }): Promise<PrivacyRequest> {
  const now = s.now ?? new Date();
  const reason = s.reason.trim();
  if (!reason) throw new PrivacyRequestError("reason_required");
  const r = await loadOpen(tx, s.orgId, s.id);
  if (r.extendedUntil) throw new PrivacyRequestError("already_extended");
  if (now.getTime() > r.dueAt.getTime()) throw new PrivacyRequestError("extension_too_late");
  if (s.until.getTime() <= r.dueAt.getTime()) throw new PrivacyRequestError("extension_not_later");
  if (s.until.getTime() > maxExtensionUntil(r.dueAt).getTime()) throw new PrivacyRequestError("extension_too_long");
  const [row] = await tx
    .update(privacyRequests)
    .set({ status: "extended", extendedUntil: s.until, extensionReason: reason.slice(0, 1000) })
    .where(eq(privacyRequests.id, r.id))
    .returning();
  await auditUpdate(tx, s, r, { status: "extended", extendedUntil: s.until.getTime() });
  return row;
}

/**
 * Close it with a decision and its reasons (sent to the requester afterwards). A refusal is
 * status 'rejected'; granted and partially granted requests are 'completed'.
 */
export async function completePrivacyRequest(
  tx: Tx,
  s: Step & { decision: PrivacyRequestDecision; reason: string },
): Promise<PrivacyRequest> {
  const now = s.now ?? new Date();
  const reason = s.reason.trim();
  if (!reason) throw new PrivacyRequestError("reason_required");
  const r = await loadOpen(tx, s.orgId, s.id);
  const [row] = await tx
    .update(privacyRequests)
    .set({
      status: s.decision === "refused" ? "rejected" : "completed",
      decision: s.decision,
      decisionReason: reason.slice(0, 2000),
      closedAt: now,
      handledByUserId: s.actor.type === "user" || s.actor.type === "platform_admin" ? s.actor.id : r.handledByUserId,
    })
    .where(eq(privacyRequests.id, r.id))
    .returning();
  await auditUpdate(tx, s, r, { status: row.status, decision: s.decision, onTime: now.getTime() <= effectiveDueAt(r).getTime() });
  return row;
}

// ---------------------------------------------------------------- the reply contact

/**
 * A request's reply contact is stored encrypted in privacy_requests.answer_contact: the contact an
 * erased record had, kept by erasePatient() for the requests still open so staff can still answer
 * them (Art. 12(3)-(4)), or the contact given by a requester not linked to a patient record
 * (logged by staff, or filed through the privacy center), to which the answer is then sent. A kept
 * contact goes once the request is answered, or 30 days after it is closed
 * (ERASED_REQUEST_TEXT_DAYS, the retention job). Rows written before the column existed carry the
 * contact in their (encrypted) details after this marker: it is still read (requestTextAndContact).
 */
export const CONTACT_SNAPSHOT_MARK = "[contact] ";

/** Several contacts in one answer_contact value: "a@example.org · +393331234567". */
const CONTACT_SEPARATOR = " · ";

/** Days the free text of a closed request of an erased patient is kept, to answer by hand. */
export const ERASED_REQUEST_TEXT_DAYS = 30;

/** The contacts a record could be answered at (its own and a guardian's), without duplicates. */
export function contactsOf(p: Pick<Patient, "email" | "phone" | "guardianEmail" | "guardianPhone">): string[] {
  return [...new Set([p.email, p.phone, p.guardianEmail, p.guardianPhone].filter((v): v is string => Boolean(v)))];
}

/** The contacts of an answer_contact value, in order. */
export function splitContacts(value: string | null | undefined): string[] {
  return (value ?? "")
    .split(CONTACT_SEPARATOR)
    .map((c) => c.trim())
    .filter(Boolean);
}

/** One answer_contact value for these contacts (duplicates dropped), or null when there are none. */
export function joinContacts(...lists: (readonly string[] | string | null | undefined)[]): string | null {
  const all = lists.flatMap((l) => (typeof l === "string" ? splitContacts(l) : l ? [...l] : []));
  const unique = [...new Set(all.map((c) => c.trim()).filter(Boolean))];
  return unique.length ? unique.join(CONTACT_SEPARATOR) : null;
}

/** Legacy rows: the requester's own words and a contact appended after CONTACT_SNAPSHOT_MARK, apart. */
export function splitContactSnapshot(details: string | null): { text: string | null; contact: string | null } {
  if (!details) return { text: null, contact: null };
  const at = details.startsWith(CONTACT_SNAPSHOT_MARK) ? 0 : details.lastIndexOf(`\n\n${CONTACT_SNAPSHOT_MARK}`);
  if (at < 0) return { text: details, contact: null };
  const markAt = at === 0 ? 0 : at + 2;
  const contact = details.slice(markAt + CONTACT_SNAPSHOT_MARK.length).trim();
  if (!contact || contact.includes("\n")) return { text: details, contact: null };
  return { text: details.slice(0, at).trim() || null, contact };
}

/** The request's text and its reply contact, for display: the column first, else a legacy marker. */
export function requestTextAndContact(r: Pick<PrivacyRequest, "details" | "answerContact">): { text: string | null; contact: string | null } {
  const legacy = splitContactSnapshot(r.details);
  return { text: legacy.text, contact: r.answerContact ?? legacy.contact };
}

/**
 * Where to send the answer of a request not linked to a patient record: the first email of its
 * reply contact, else the first phone number. Null when it has none.
 */
function replyTarget(r: Pick<PrivacyRequest, "answerContact" | "requesterLocale">): ContactTarget | null {
  const contacts = splitContacts(r.answerContact);
  const email = contacts.find((c) => c.includes("@")) ?? null;
  const phone = contacts.find((c) => !c.includes("@")) ?? null;
  if (!email && !phone) return null;
  return { id: null, firstName: "", email, phone, birthDate: null, locale: r.requesterLocale, guardianName: null, guardianPhone: null, guardianEmail: null };
}

// ---------------------------------------------------------------- messages to the requester

/** The privacyAdminEmails kinds sent to patients. */
export type RequesterMessageKind =
  | "requestExtended"
  | "requestGranted"
  | "requestPartiallyGranted"
  | "requestRefused"
  | "restrictionLifted";

export const DECISION_KIND: Record<PrivacyRequestDecision, RequesterMessageKind> = {
  granted: "requestGranted",
  partially_granted: "requestPartiallyGranted",
  refused: "requestRefused",
};

type LooseTranslator = { (key: string, vars?: Record<string, string | number>): string; has(key: string): boolean };
const looseT = (locale: Locale, ns: "privacyAdminEmails") => getT(locale, ns) as unknown as LooseTranslator;

type Sender = Pick<Organization, "id" | "name" | "legalName" | "email" | "brandColor" | "timezone"> | null;

async function senderOf(orgId: string | null, tx: Tx): Promise<Sender> {
  if (!orgId) return null;
  const [org] = await tx
    .select({
      id: organizations.id,
      name: organizations.name,
      legalName: organizations.legalName,
      email: organizations.email,
      brandColor: organizations.brandColor,
      timezone: organizations.timezone,
    })
    .from(organizations)
    .where(eq(organizations.id, orgId));
  return org ?? null;
}

/** A date for a message body, in the recipient's language and the practice's time zone. */
export function messageDate(d: Date, locale: Locale, tz = DEFAULT_TIMEZONE): string {
  return fmtDay(zonedDate(d, tz), "long", locale);
}

/** A patient record, or (id null) a requester known only by the request's reply contact. */
type ContactTarget = Pick<Patient, "firstName" | "email" | "phone" | "birthDate" | "locale" | "guardianName" | "guardianPhone" | "guardianEmail"> & {
  id: string | null;
};

/**
 * Send a privacy notice about the patient's own rights (a request's outcome, an extension, the
 * lifting of a restriction) to their own contact, or a guardian's under 14.
 *
 * Unlike sendPatientMessage() it ignores restriction and channel opt-outs on purpose: these are
 * answers the controller owes the data subject (Art. 12(1), 12(3)-(4), 18(3)), not service
 * messages. Email first (the answer may be long), SMS otherwise. Returns false when there is no
 * contact on file (an erased record, or a request logged without a patient): staff must then
 * answer by other means, and the UI says so.
 */
export async function notifyPatientDirect(
  i: {
    orgId: string | null;
    patient: ContactTarget;
    kind: RequesterMessageKind;
    vars: Record<string, string | number>;
    locale?: Locale;
    now?: Date;
  },
  tx: Tx = db,
): Promise<boolean> {
  const now = i.now ?? new Date();
  const org = await senderOf(i.orgId, tx);
  // recipientFor() returns no contact for restricted records: build the target as if unrestricted.
  const to = recipientFor({ ...i.patient, restrictedAt: null, erasedAt: null, emailOptIn: true, smsOptIn: true, preferredChannel: "email" }, now);
  const locale = i.locale ?? i.patient.locale;
  const t = looseT(locale, "privacyAdminEmails");
  const sender = org?.name ?? APP_NAME;
  const vars = { practice: sender, ...i.vars };
  const footer = [t("footer.rights"), org ? (org.legalName ?? org.name) : (process.env.PLATFORM_LEGAL_NAME ?? APP_NAME)];
  const base = { orgId: i.orgId, patientId: i.patient.id };
  try {
    if (to.email) {
      const { html, text } = renderEmailLayout({
        locale,
        brandColor: org?.brandColor ?? "#0d9488",
        brandName: sender,
        intro: t(`${i.kind}.body`, vars),
        footerLines: footer,
      });
      const msg = await deliver(
        { ...base, channel: "email", to: to.email, subject: t(`${i.kind}.subject`, vars), text, html, fromName: sender, replyTo: org?.email ?? null },
        tx,
      );
      return msg.status !== "failed";
    }
    if (to.phone) {
      const msg = await deliver({ ...base, channel: "sms", to: to.phone, text: t(`${i.kind}.sms`, vars) }, tx);
      return msg.status !== "failed";
    }
  } catch (err) {
    logError("privacy-notify", err, { kind: i.kind, orgId: i.orgId });
  }
  return false;
}

/**
 * Tell the requester about an extension or the outcome, in the language they wrote in: at the
 * contact of the patient record the request is linked to, or, for a request linked to no record,
 * at the reply contact it was filed with. Returns false when there is no contact to use (an erased
 * record's kept contact is for staff to answer by hand: see requestTextAndContact).
 */
export async function notifyRequester(
  r: PrivacyRequest,
  kind: RequesterMessageKind,
  opts: {
    now?: Date;
    /**
     * The record as it was before an erasure (erasePatient answering the request): the answer goes
     * to the contact the patient had, which the erasure is about to remove or has removed.
     */
    patient?: ContactTarget;
  } = {},
  tx: Tx = db,
): Promise<boolean> {
  if (!r.patientId) {
    const target = replyTarget(r);
    return target ? notifyPatientDirect({ orgId: r.orgId, patient: target, kind, vars: await requesterVars(r, kind, r.requesterLocale, tx), locale: r.requesterLocale, now: opts.now }, tx) : false;
  }
  const [patient] = opts.patient
    ? [opts.patient]
    : await tx
        .select()
        .from(patients)
        .where(and(eq(patients.id, r.patientId), r.orgId === null ? undefined : eq(patients.orgId, r.orgId)));
  if (!patient) return false;
  const locale = isLocale(r.requesterLocale) ? r.requesterLocale : patient.locale;
  return notifyPatientDirect({ orgId: r.orgId, patient, kind, vars: await requesterVars(r, kind, locale, tx), locale, now: opts.now }, tx);
}

/** The variables of a message to the requester, in their language and the practice's time zone. */
async function requesterVars(r: PrivacyRequest, kind: RequesterMessageKind, locale: Locale, tx: Tx): Promise<Record<string, string>> {
  const tz = (await senderOf(r.orgId, tx))?.timezone ?? DEFAULT_TIMEZONE;
  const t = looseT(locale, "privacyAdminEmails");
  return {
    type: t(`types.${r.type}`),
    received: messageDate(r.receivedAt, locale, tz),
    until: messageDate(effectiveDueAt(r), locale, tz),
    reason: (kind === "requestExtended" ? r.extensionReason : r.decisionReason) ?? "",
  };
}

// ---------------------------------------------------------------- staff emails

type StaffRecipient = { userId: string; email: string; locale: Locale };

/** The practice's owners (orgId null: Sorriso's platform admins), with the language each reads. */
export async function ownerRecipients(orgId: string | null, tx: Tx = db): Promise<StaffRecipient[]> {
  if (orgId === null) {
    const rows = await tx.select({ id: users.id, email: users.email, locale: users.locale }).from(users).where(eq(users.isPlatformAdmin, true));
    return rows.map((u) => ({ userId: u.id, email: u.email, locale: isLocale(u.locale) ? u.locale : "it" }));
  }
  const rows = await tx
    .select({ id: users.id, email: users.email, locale: users.locale, orgLocale: organizations.defaultLocale })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .innerJoin(organizations, eq(organizations.id, memberships.orgId))
    .where(and(eq(memberships.orgId, orgId), eq(memberships.role, "owner")));
  return rows.map((u) => ({ userId: u.id, email: u.email, locale: isLocale(u.locale) ? u.locale : u.orgLocale }));
}

/** The staff email kinds of privacyAdminEmails. */
export type StaffMessageKind =
  | "ownerDeadline7"
  | "ownerDeadline2"
  | "subprocessorsChanged"
  | "closureRequested"
  | "closureCancelled"
  | "closureCertificate";

/**
 * Email the practice's owners (platform admins for orgId null), each in their own language.
 * `vars` is built per language, so dates and labels match the text around them. Returns how many
 * were sent.
 */
export async function emailOwners(
  orgId: string | null,
  kind: StaffMessageKind,
  vars: (locale: Locale, t: LooseTranslator) => Record<string, string | number>,
  opts: { url?: string; recipients?: StaffRecipient[]; brandName?: string } = {},
  tx: Tx = db,
): Promise<number> {
  const org = await senderOf(orgId, tx);
  const recipients = opts.recipients ?? (await ownerRecipients(orgId, tx));
  let sent = 0;
  for (const r of recipients) {
    const t = looseT(r.locale, "privacyAdminEmails");
    const v = { practice: org?.name ?? opts.brandName ?? APP_NAME, ...vars(r.locale, t) };
    const { html, text } = renderEmailLayout({
      locale: r.locale,
      brandColor: "#0d9488",
      brandName: APP_NAME,
      intro: t(`${kind}.body`, v),
      buttons: opts.url && t.has(`${kind}.cta`) ? [{ label: t(`${kind}.cta`, v), url: opts.url }] : [],
      footerLines: [t("footer.staff"), process.env.PLATFORM_LEGAL_NAME ?? APP_NAME],
    });
    const msg = await deliver({ orgId, channel: "email", to: r.email, subject: t(`${kind}.subject`, v), text, html, fromName: APP_NAME }, tx);
    if (msg.status !== "failed") sent++;
  }
  return sent;
}

/**
 * Remind owners 7 and 2 days before a request's deadline (platform admins for Sorriso's own
 * requests). Each reminder is sent once per deadline: the key, e.g. "d7:<deadline ms>", is added to
 * reminders_sent, so a second run sends nothing and an extension (a new deadline) starts afresh.
 * When both thresholds are already passed (a request logged late), only the 2-day one goes out.
 */
export async function sendDeadlineReminders(now: Date = new Date()): Promise<{ sent: number }> {
  const horizon = now.getTime() + Math.max(...DEADLINE_REMINDER_DAYS) * DAY_MS;
  const due = await db
    .select()
    .from(privacyRequests)
    .where(
      and(
        inArray(privacyRequests.status, [...OPEN_REQUEST_STATUSES]),
        lt(sql`coalesce(${privacyRequests.extendedUntil}, ${privacyRequests.dueAt})`, horizon + 1),
      ),
    );
  let sent = 0;
  for (const r of due) {
    const deadline = effectiveDueAt(r);
    const left = deadline.getTime() - now.getTime();
    if (left < 0) continue; // overdue: the inbox shows it in red; no more emails.
    const keys = DEADLINE_REMINDER_DAYS.map((d) => ({ days: d, key: `d${d}:${deadline.getTime()}` }));
    const applicable = keys.filter((k) => left <= k.days * DAY_MS);
    const pending = applicable.filter((k) => !r.remindersSent.includes(k.key));
    if (!pending.length) continue;
    // The most urgent applicable reminder; the others are marked so they never go out late.
    const urgent = applicable.reduce((a, b) => (b.days < a.days ? b : a));
    const kind: StaffMessageKind = urgent.days <= 2 ? "ownerDeadline2" : "ownerDeadline7";
    await db.transaction(async (tx) => {
      const tz = (await senderOf(r.orgId, tx))?.timezone ?? DEFAULT_TIMEZONE;
      const n = await emailOwners(
        r.orgId,
        kind,
        (locale, t) => ({ type: t(`types.${r.type}`), received: messageDate(r.receivedAt, locale, tz), due: messageDate(deadline, locale, tz) }),
        { url: absoluteUrl(r.orgId ? `/dashboard/privacy/${r.id}` : `/dashboard/platform/privacy/${r.id}`) },
        tx,
      );
      await tx
        .update(privacyRequests)
        .set({ remindersSent: [...new Set([...r.remindersSent, ...applicable.map((k) => k.key)])] })
        .where(eq(privacyRequests.id, r.id));
      sent += n;
    });
  }
  return { sent };
}

/** The countdown shown in the inbox: green/amber/red by days left, or the closing decision. */
export function dueBadge(
  t: Translator<"privacyAdmin">,
  r: Pick<PrivacyRequest, "dueAt" | "extendedUntil" | "status">,
  now: Date = new Date(),
): { tone: "red" | "amber" | "slate" | "green"; label: string } {
  if (!isOpenRequest(r)) return { tone: "green", label: t(`requests.statuses.${r.status === "rejected" ? "rejected" : "completed"}`) };
  const left = daysLeft(r, now);
  if (left < 0) return { tone: "red", label: t("requests.overdue", { count: -left }) };
  if (left === 0) return { tone: "red", label: t("requests.dueToday") };
  return { tone: left <= 7 ? "amber" : "slate", label: t("requests.daysLeft", { count: left }) };
}

// ---------------------------------------------------------------- inbox views

type RequesterPatient = { id: string | null; firstName: string | null; lastName: string | null; restrictedAt: Date | null; erasedAt: Date | null } | null;

/** The requester's name for staff, masked for restricted records they can't open. */
export function requesterLabel(t: Translator<"privacyAdmin">, p: RequesterPatient, canSeeRestricted: boolean): string | null {
  if (!p?.id) return null;
  if ((p.restrictedAt || p.erasedAt) && !canSeeRestricted) return t("patients.restrictedName");
  return [p.lastName, p.firstName].filter(Boolean).join(" ");
}

/** A row of the inbox table, formatted for the viewer. */
export function inboxRow(
  t: Translator<"privacyAdmin">,
  row: { request: PrivacyRequest; patient: RequesterPatient },
  o: { locale: Locale; tz: string; now: Date; canSeeRestricted: boolean },
) {
  const r = row.request;
  return {
    id: r.id,
    type: r.type,
    channel: r.channel,
    status: r.status,
    received: fmtDay(zonedDate(r.receivedAt, o.tz), "short", o.locale),
    requester: requesterLabel(t, row.patient, o.canSeeRestricted),
    due: dueBadge(t, r, o.now),
  };
}
