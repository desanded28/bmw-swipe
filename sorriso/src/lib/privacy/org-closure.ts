import { and, desc, eq, inArray, isNotNull, isNull, lt, notInArray, sql } from "drizzle-orm";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";
import { db, type Tx } from "@/db";
import {
  apiKeys,
  appointments,
  auditLog,
  authTokens,
  consents,
  formSubmissions,
  formTemplates,
  legalAcceptances,
  locations,
  memberships,
  messages,
  noticeVersions,
  organizations,
  orgFunds,
  patients,
  practitionerServices,
  practitioners,
  privacyRequests,
  profileStats,
  recalls,
  reminders,
  reviewReports,
  reviews,
  rooms,
  schedules,
  services,
  sessions,
  timeOff,
  users,
  waitlist,
} from "@/db/schema";
import { audit, type AuditEvent } from "../audit";
import { absoluteUrl } from "../config";
import { hmac } from "../crypto";
import { logError } from "../log";
import { deleteProviderMessage } from "../messaging/providers";
import { emailOwners, messageDate, ownerRecipients } from "./requests";

/**
 * Closing a practice's account and leaving cleanly (Art. 28(3)(g) GDPR; EU Data Act ch. VI).
 *
 * 1. The owner requests closure (step-up, org.close): online bookings stop at once
 *    (canAcceptOnlineBookings), the practice leaves the public search, and the purge is
 *    scheduled CLOSURE_TRANSITION_DAYS + CLOSURE_RETRIEVAL_DAYS later. Until then the practice
 *    keeps full access to download everything (/dashboard/settings/export) and can cancel.
 *    (Data Act art. 25: a transition of up to 30 days, then at least 30 days to retrieve data.)
 * 2. The retention job purges the practice once purgeAfter has passed: every row of the
 *    practice, its patients and staff accounts that belong to no other practice, provider copies
 *    of its messages, API keys, sessions and tokens.
 * 3. A deletion certificate is issued: a row in Sorriso's own audit chain (tamper-evident) with
 *    the tables and row counts purged, the date, and when the last backups containing the data
 *    expire; owners get it by email with a link to a printable page.
 *
 * The practice's own audit chain has no foreign key and survives the purge; the retention job
 * deletes it after the default audit retention (orphaned chains).
 */

export const CLOSURE_TRANSITION_DAYS = 30;
export const CLOSURE_RETRIEVAL_DAYS = 30;
const DAY_MS = 86_400_000;

/** Point-in-time backups are kept this long by the database provider (BACKUP_RETENTION_DAYS). */
export function backupRetentionDays(): number {
  const n = Number(process.env.BACKUP_RETENTION_DAYS);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 30;
}

export function purgeDateFor(requestedAt: Date): Date {
  return new Date(requestedAt.getTime() + (CLOSURE_TRANSITION_DAYS + CLOSURE_RETRIEVAL_DAYS) * DAY_MS);
}

export class ClosureError extends Error {
  constructor(public code: "not_found" | "already_requested" | "not_requested") {
    super(`Closure: ${code}`);
    this.name = "ClosureError";
  }
}

type Actor = AuditEvent["actor"];

/** Start the closure. Returns the purge date. */
export async function requestClosure(orgId: string, i: { actor: Actor; headers?: Headers; now?: Date }): Promise<{ purgeAfter: Date }> {
  const now = i.now ?? new Date();
  const purgeAfter = purgeDateFor(now);
  await db.transaction(async (tx) => {
    const [org] = await tx.select().from(organizations).where(eq(organizations.id, orgId));
    if (!org) throw new ClosureError("not_found");
    if (org.closureRequestedAt) throw new ClosureError("already_requested");
    await tx.update(organizations).set({ closureRequestedAt: now, purgeAfter, listed: false }).where(eq(organizations.id, orgId));
    await audit(
      {
        orgId,
        actor: i.actor,
        action: "org.close",
        entity: { type: "org", id: orgId },
        metadata: { stage: "requested", purgeAfter: purgeAfter.getTime() },
        headers: i.headers,
        at: now,
      },
      tx,
    );
  });
  await emailOwners(
    orgId,
    "closureRequested",
    (locale) => ({ date: messageDate(now, locale), purge: messageDate(purgeAfter, locale) }),
    { url: absoluteUrl("/dashboard/settings/closure") },
  ).catch((err: unknown) => logError("closure", err, { step: "email", orgId }));
  return { purgeAfter };
}

/** Withdraw the closure before the purge. The practice stays unlisted until it lists itself again. */
export async function cancelClosure(orgId: string, i: { actor: Actor; headers?: Headers; now?: Date }): Promise<void> {
  const now = i.now ?? new Date();
  await db.transaction(async (tx) => {
    const [org] = await tx.select().from(organizations).where(eq(organizations.id, orgId));
    if (!org) throw new ClosureError("not_found");
    if (!org.closureRequestedAt) throw new ClosureError("not_requested");
    await tx.update(organizations).set({ closureRequestedAt: null, purgeAfter: null }).where(eq(organizations.id, orgId));
    await audit(
      { orgId, actor: i.actor, action: "org.close", entity: { type: "org", id: orgId }, metadata: { stage: "cancelled" }, headers: i.headers, at: now },
      tx,
    );
  });
  await emailOwners(orgId, "closureCancelled", () => ({})).catch((err: unknown) => logError("closure", err, { step: "email", orgId }));
}

// ---------------------------------------------------------------- certificate

/** The certificate link's token: the platform audit row id, signed so ids can't be guessed. */
export function certificateToken(auditId: string): string {
  return `${auditId}.${hmac(`closure-certificate:${auditId}`, "token").slice(0, 32)}`;
}

export function verifyCertificateToken(token: string | null | undefined): string | null {
  const [id] = (token ?? "").split(".");
  return id && certificateToken(id) === token ? id : null;
}

export function certificateUrl(auditId: string): string {
  return absoluteUrl(`/dashboard/settings/closure/certificate?c=${encodeURIComponent(certificateToken(auditId))}`);
}

export type DeletionCertificate = {
  id: string;
  orgId: string;
  orgName: string;
  purgedAt: Date;
  backupsExpireAt: Date;
  tables: Record<string, number>;
  /** The certificate row's hash in Sorriso's audit chain. */
  hash: string;
};

const TABLE_PREFIX = "t_";

/** The certificate behind a signed token, or null. */
export async function loadCertificate(token: string | null | undefined): Promise<DeletionCertificate | null> {
  const id = verifyCertificateToken(token);
  if (!id) return null;
  const [row] = await db
    .select()
    .from(auditLog)
    .where(and(eq(auditLog.id, id), isNull(auditLog.orgId), eq(auditLog.action, "org.close")));
  const m = row?.metadata;
  if (!row || !m || m.stage !== "purged") return null;
  const tables: Record<string, number> = {};
  for (const [k, v] of Object.entries(m)) if (k.startsWith(TABLE_PREFIX) && typeof v === "number") tables[k.slice(TABLE_PREFIX.length)] = v;
  return {
    id: row.id,
    orgId: String(row.entityId),
    orgName: String(m.orgName ?? ""),
    purgedAt: row.at,
    backupsExpireAt: new Date(Number(m.backupsExpireAt)),
    tables,
    hash: row.hash,
  };
}

// ---------------------------------------------------------------- purge

async function deleteCount(p: Promise<{ rowsAffected: number }>): Promise<number> {
  return (await p).rowsAffected;
}

/**
 * Delete every row of the practice, children first (foreign keys may or may not cascade on the
 * connection). Returns the rows deleted per table.
 */
async function deleteOrgRows(tx: Tx, orgId: string): Promise<Record<string, number>> {
  const ids = async (q: Promise<{ id: string }[]>) => (await q).map((r) => r.id);
  const appts = await ids(tx.select({ id: appointments.id }).from(appointments).where(eq(appointments.orgId, orgId)));
  const pats = await ids(tx.select({ id: patients.id }).from(patients).where(eq(patients.orgId, orgId)));
  const pracs = await ids(tx.select({ id: practitioners.id }).from(practitioners).where(eq(practitioners.orgId, orgId)));
  const locs = await ids(tx.select({ id: locations.id }).from(locations).where(eq(locations.orgId, orgId)));
  const revs = await ids(tx.select({ id: reviews.id }).from(reviews).where(eq(reviews.orgId, orgId)));
  const staff = (await tx.select({ id: memberships.userId }).from(memberships).where(eq(memberships.orgId, orgId))).map((r) => r.id);
  const inIds = (col: SQLiteColumn, list: string[]) => (list.length ? inArray(col, list) : sql`0`);

  // Sorriso's own rows that point at the practice's patients keep no link to them.
  if (pats.length) {
    await tx.update(consents).set({ patientId: null }).where(and(isNull(consents.orgId), inArray(consents.patientId, pats)));
    await tx.update(privacyRequests).set({ patientId: null }).where(and(isNull(privacyRequests.orgId), inArray(privacyRequests.patientId, pats)));
    await tx.update(messages).set({ patientId: null, appointmentId: null }).where(and(isNull(messages.orgId), inArray(messages.patientId, pats)));
  }

  const c: Record<string, number> = {};
  c.reminders = await deleteCount(tx.delete(reminders).where(inIds(reminders.appointmentId, appts)));
  c.review_reports = await deleteCount(tx.delete(reviewReports).where(eq(reviewReports.orgId, orgId)));
  c.reviews = await deleteCount(tx.delete(reviews).where(inIds(reviews.id, revs)));
  c.form_submissions = await deleteCount(tx.delete(formSubmissions).where(eq(formSubmissions.orgId, orgId)));
  c.recalls = await deleteCount(tx.delete(recalls).where(eq(recalls.orgId, orgId)));
  c.consents = await deleteCount(tx.delete(consents).where(eq(consents.orgId, orgId)));
  c.privacy_requests = await deleteCount(tx.delete(privacyRequests).where(eq(privacyRequests.orgId, orgId)));
  c.messages = await deleteCount(tx.delete(messages).where(eq(messages.orgId, orgId)));
  c.waitlist = await deleteCount(tx.delete(waitlist).where(eq(waitlist.orgId, orgId)));
  c.appointments = await deleteCount(tx.delete(appointments).where(eq(appointments.orgId, orgId)));
  c.patients = await deleteCount(tx.delete(patients).where(eq(patients.orgId, orgId)));
  c.practitioner_services = await deleteCount(tx.delete(practitionerServices).where(inIds(practitionerServices.practitionerId, pracs)));
  c.schedules = await deleteCount(tx.delete(schedules).where(inIds(schedules.practitionerId, pracs)));
  c.profile_stats = await deleteCount(tx.delete(profileStats).where(inIds(profileStats.practitionerId, pracs)));
  c.time_off = await deleteCount(tx.delete(timeOff).where(eq(timeOff.orgId, orgId)));
  c.practitioners = await deleteCount(tx.delete(practitioners).where(eq(practitioners.orgId, orgId)));
  c.rooms = await deleteCount(tx.delete(rooms).where(inIds(rooms.locationId, locs)));
  c.locations = await deleteCount(tx.delete(locations).where(eq(locations.orgId, orgId)));
  c.services = await deleteCount(tx.delete(services).where(eq(services.orgId, orgId)));
  c.org_funds = await deleteCount(tx.delete(orgFunds).where(eq(orgFunds.orgId, orgId)));
  c.form_templates = await deleteCount(tx.delete(formTemplates).where(eq(formTemplates.orgId, orgId)));
  c.notice_versions = await deleteCount(tx.delete(noticeVersions).where(eq(noticeVersions.orgId, orgId)));
  c.legal_acceptances = await deleteCount(tx.delete(legalAcceptances).where(eq(legalAcceptances.orgId, orgId)));
  c.api_keys = await deleteCount(tx.delete(apiKeys).where(eq(apiKeys.orgId, orgId)));
  c.auth_tokens = await deleteCount(tx.delete(authTokens).where(eq(authTokens.orgId, orgId)));
  c.sessions = await deleteCount(tx.delete(sessions).where(eq(sessions.orgId, orgId)));
  c.memberships = await deleteCount(tx.delete(memberships).where(eq(memberships.orgId, orgId)));
  c.organizations = await deleteCount(tx.delete(organizations).where(eq(organizations.id, orgId)));

  // Staff accounts that belonged only to this practice (Sorriso's own staff stay).
  const remaining = staff.length
    ? (await tx.select({ id: memberships.userId }).from(memberships).where(inArray(memberships.userId, staff))).map((r) => r.id)
    : [];
  const orphans = staff.length
    ? (
        await tx
          .select({ id: users.id })
          .from(users)
          .where(and(inArray(users.id, staff), remaining.length ? notInArray(users.id, remaining) : undefined, eq(users.isPlatformAdmin, false)))
      ).map((r) => r.id)
    : [];
  if (orphans.length) {
    await tx.delete(sessions).where(inArray(sessions.userId, orphans));
    await tx.delete(authTokens).where(inArray(authTokens.userId, orphans));
    c.users = await deleteCount(tx.delete(users).where(inArray(users.id, orphans)));
  } else c.users = 0;
  return c;
}

/**
 * Purge a practice whose closure is due. Provider copies of its messages are deleted first (a
 * network call per message), then the rows in one transaction; finally the certificate is
 * recorded in Sorriso's audit chain and emailed to the owners collected before the purge.
 */
export async function purgeOrg(orgId: string, i: { now?: Date; actor?: Actor } = {}): Promise<{ counts: Record<string, number>; certificateId: string | null }> {
  const now = i.now ?? new Date();
  const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
  if (!org) throw new ClosureError("not_found");
  const owners = await ownerRecipients(orgId);

  const copies = await db
    .select({ id: messages.id, provider: messages.provider, providerId: messages.providerId })
    .from(messages)
    .where(and(eq(messages.orgId, orgId), isNotNull(messages.providerId), isNull(messages.providerDeletedAt)));
  for (const m of copies) {
    try {
      await deleteProviderMessage(m.provider, m.providerId!);
    } catch (err) {
      logError("closure", err, { step: "provider-delete", messageId: m.id });
    }
  }

  const counts = await db.transaction((tx) => deleteOrgRows(tx, orgId));
  const backupsExpireAt = new Date(now.getTime() + backupRetentionDays() * DAY_MS);
  const metadata: Record<string, string | number | boolean | null> = {
    stage: "purged",
    orgName: org.name,
    backupsExpireAt: backupsExpireAt.getTime(),
    providerCopies: copies.length,
  };
  for (const [table, n] of Object.entries(counts)) metadata[`${TABLE_PREFIX}${table}`] = n;
  await audit({ orgId: null, actor: i.actor ?? { type: "system", id: null }, action: "org.close", entity: { type: "org", id: orgId }, metadata, at: now });
  const [cert] = await db
    .select({ id: auditLog.id })
    .from(auditLog)
    .where(and(isNull(auditLog.orgId), eq(auditLog.action, "org.close"), eq(auditLog.entityId, orgId)))
    .orderBy(desc(auditLog.seq))
    .limit(1);
  const certificateId = cert?.id ?? null;
  if (certificateId) {
    await emailOwners(
      null,
      "closureCertificate",
      (locale) => ({ practice: org.name, date: messageDate(now, locale), backups: messageDate(backupsExpireAt, locale) }),
      { url: certificateUrl(certificateId), recipients: owners, brandName: org.name },
    ).catch((err: unknown) => logError("closure", err, { step: "certificate-email", orgId }));
  }
  return { counts, certificateId };
}

/** Purge every practice whose purge date has passed (the retention job). Returns how many. */
export async function purgeDueOrgs(now: Date = new Date()): Promise<number> {
  const due = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(and(isNotNull(organizations.closureRequestedAt), isNotNull(organizations.purgeAfter), lt(organizations.purgeAfter, now)));
  let purged = 0;
  for (const { id } of due) {
    try {
      await purgeOrg(id, { now });
      purged++;
    } catch (err) {
      logError("closure", err, { step: "purge", orgId: id });
    }
  }
  return purged;
}
