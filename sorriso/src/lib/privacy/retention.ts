import { and, desc, eq, gte, inArray, isNotNull, isNull, lt, lte, ne, notInArray, or, sql } from "drizzle-orm";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";
import { db } from "@/db";
import {
  appointments,
  auditLog,
  authTokens,
  consents,
  formSubmissions,
  legalAcceptances,
  loginAttempts,
  messages,
  organizations,
  patients,
  patientSessions,
  privacyRequests,
  rateLimits,
  recalls,
  reminders,
  sessions,
  verificationCodes,
  waitlist,
  type LegalDoc,
  type RetentionSettings,
} from "@/db/schema";
import { audit, pruneAuditLog } from "../audit";
import { logError, logInfo } from "../log";
import { resolveSettings } from "../settings";
import { addDays, todayIn } from "../time";
import { withdrawConsent } from "./consent";
import { erasePatient, restrictPatient } from "./erasure";
import { notifySubprocessorChanges } from "./gates";
import { purgeDueOrgs } from "./org-closure";
import { sendDeadlineReminders } from "./requests";
import { DEFAULT_RETENTION } from "./settings";
import { LEGAL_VERSIONS } from "./versions";

/**
 * Automatic retention (Art. 5(1)(e)): purges expired sessions and codes, redacts old message
 * bodies, pseudonymises inactive patients, prunes the audit log behind an anchor, and so on,
 * per org and for the platform's own rows (org_id NULL). Idempotent: a second run in a row
 * changes nothing (and writes no audit row).
 *
 * Called by the retention cron route, scripts/run-retention.ts and the daily job in
 * src/instrumentation.ts. Every boundary is strict: a row exactly at its cutoff is kept, one
 * millisecond older goes. Periods come from the practice's settings (RETENTION_LIMITS) and, for
 * Sorriso's own rows and orphaned audit chains, from DEFAULT_RETENTION. docs/privacy/retention.md
 * lists every rule.
 */

export type RetentionSummary = {
  startedAt: Date;
  finishedAt: Date;
  orgs: number;
  /** Rows affected per step, e.g. { messagesRedacted: 12, patientsPseudonymised: 1 }. */
  counts: Record<string, number>;
};

const DAY_MS = 86_400_000;

/** Platform rows that are not the practices' (technical security data). */
export const PLATFORM_RETENTION = {
  /** One-time codes stay a little after expiry: the send limits count them over a day. */
  verificationCodeDays: 2,
  loginAttemptDays: 90,
  /** Used or expired password-reset, verification and invite tokens. */
  authTokenDays: 1,
  /** Closed waitlist entries (booked or removed). */
  closedWaitlistDays: 30,
  /** Marketing consent lapses after this long without contact (Garante guidance: 24 months). */
  marketingLapseMonths: 24,
  /** No-shows counted for the history shown to staff. */
  noShowWindowMonths: 24,
  /** Superseded acceptances of legal documents (10-year limitation period, art. 2946 c.c.). */
  legalAcceptanceYears: 10,
  /** Closed (booked or dismissed) recalls. */
  closedRecallMonths: 24,
} as const;

/** The same instant `n` calendar months earlier (UTC calendar, clamped to the month's end). */
export function monthsAgo(now: Date, n: number): Date {
  const d = new Date(now.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - n);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d;
}

export function daysAgo(now: Date, n: number): Date {
  return new Date(now.getTime() - n * DAY_MS);
}

type Counts = Record<string, number>;
const bump = (c: Counts, key: string, n: number) => {
  if (n) c[key] = (c[key] ?? 0) + n;
};

// ---------------------------------------------------------------- global, technical rows

async function purgeTechnical(now: Date, c: Counts) {
  const P = PLATFORM_RETENTION;
  bump(c, "sessionsPurged", (await db.delete(sessions).where(lt(sessions.expiresAt, now))).rowsAffected);
  bump(c, "patientSessionsPurged", (await db.delete(patientSessions).where(lt(patientSessions.expiresAt, now))).rowsAffected);
  bump(c, "rateLimitsPurged", (await db.delete(rateLimits).where(lt(rateLimits.resetAt, now))).rowsAffected);
  bump(
    c,
    "verificationCodesPurged",
    (await db.delete(verificationCodes).where(and(lt(verificationCodes.expiresAt, now), lt(verificationCodes.createdAt, daysAgo(now, P.verificationCodeDays))))).rowsAffected,
  );
  bump(c, "loginAttemptsPurged", (await db.delete(loginAttempts).where(lt(loginAttempts.createdAt, daysAgo(now, P.loginAttemptDays)))).rowsAffected);
  const tokenCutoff = daysAgo(now, P.authTokenDays);
  bump(
    c,
    "authTokensPurged",
    (await db.delete(authTokens).where(or(lt(authTokens.expiresAt, tokenCutoff), and(isNotNull(authTokens.usedAt), lt(authTokens.usedAt, tokenCutoff))))).rowsAffected,
  );
}

// ---------------------------------------------------------------- shared by orgs and the platform

const orgScope = (col: SQLiteColumn, orgId: string | null) => (orgId === null ? isNull(col) : eq(col, orgId));

async function retainMessages(orgId: string | null, r: RetentionSettings, now: Date, c: Counts) {
  const scope = orgScope(messages.orgId, orgId);
  bump(
    c,
    "messagesRedacted",
    (
      await db
        .update(messages)
        .set({ body: "", subject: "", html: "", redactedAt: now })
        .where(and(scope, isNull(messages.redactedAt), lt(messages.createdAt, monthsAgo(now, r.messageBodyMonths))))
    ).rowsAffected,
  );
  bump(c, "messagesDeleted", (await db.delete(messages).where(and(scope, lt(messages.createdAt, monthsAgo(now, r.messageMetaMonths))))).rowsAffected);
}

async function retainLedgers(orgId: string | null, r: RetentionSettings, now: Date, c: Counts) {
  // Consent proofs of records that are gone (erased or merged away) after the limitation period.
  bump(
    c,
    "consentProofsDeleted",
    (
      await db
        .delete(consents)
        .where(and(orgScope(consents.orgId, orgId), isNull(consents.patientId), lt(consents.createdAt, monthsAgo(now, r.consentMonths))))
    ).rowsAffected,
  );
  bump(
    c,
    "privacyRequestsDeleted",
    (
      await db
        .delete(privacyRequests)
        .where(
          and(orgScope(privacyRequests.orgId, orgId), isNotNull(privacyRequests.closedAt), lt(privacyRequests.closedAt, monthsAgo(now, r.privacyRequestMonths))),
        )
    ).rowsAffected,
  );
  // Acceptances of versions no longer in force, after the limitation period.
  const oldAcceptance = monthsAgo(now, PLATFORM_RETENTION.legalAcceptanceYears * 12);
  for (const [doc, version] of Object.entries(LEGAL_VERSIONS) as [LegalDoc, string][]) {
    bump(
      c,
      "legalAcceptancesDeleted",
      (
        await db
          .delete(legalAcceptances)
          .where(
            and(
              orgScope(legalAcceptances.orgId, orgId),
              eq(legalAcceptances.documentType, doc),
              ne(legalAcceptances.version, version),
              lt(legalAcceptances.acceptedAt, oldAcceptance),
            ),
          )
      ).rowsAffected,
    );
  }
  bump(c, "auditRowsDeleted", (await pruneAuditLog(orgId, monthsAgo(now, r.auditMonths))).deleted);
}

// ---------------------------------------------------------------- per practice

/**
 * "patients"."id", qualified: drizzle renders a column of a single-table select unqualified
 * ("id"), which inside a correlated subquery would resolve to the subquery's own table.
 */
const PATIENT_ID = sql.raw(`"patients"."id"`);

/** Patients with their last appointment start (null = never booked). */
async function patientActivity(orgId: string) {
  return db
    .select({
      id: patients.id,
      createdAt: patients.createdAt,
      restrictedAt: patients.restrictedAt,
      retainUntil: patients.retainUntil,
      locale: patients.locale,
      lastStart: sql<number | null>`(select max(a.starts_at) from appointments a where a.patient_id = ${PATIENT_ID} and a.org_id = ${orgId})`,
      activeWaitlist: sql<number>`(select count(*) from waitlist w where w.patient_id = ${PATIENT_ID} and w.status = 'active')`,
      unexportedForms: sql<number>`(select count(*) from form_submissions f where f.patient_id = ${PATIENT_ID} and f.exported_at is null)`,
    })
    .from(patients)
    .where(and(eq(patients.orgId, orgId), isNull(patients.erasedAt), isNull(patients.mergedIntoId)));
}

const SYSTEM = { type: "system" as const, id: null };

async function retainPatients(orgId: string, tz: string, settings: ReturnType<typeof resolveSettings>, now: Date, c: Counts) {
  const r = settings.privacy.retention;
  const today = todayIn(tz, now);
  const neverSeenCutoff = monthsAgo(now, r.neverSeenPatientMonths).getTime();
  const inactiveCutoff = monthsAgo(now, r.patientInactiveMonths).getTime();
  const held = (p: { retainUntil: string | null }) => Boolean(p.retainUntil && p.retainUntil >= today);

  for (const p of await patientActivity(orgId)) {
    try {
      const neverSeen = p.lastStart === null && p.activeWaitlist === 0 && p.createdAt.getTime() < neverSeenCutoff;
      const inactive = p.lastStart !== null && p.lastStart < inactiveCutoff;
      if ((!neverSeen && !inactive) || held(p)) continue;
      const anonymise = neverSeen || settings.privacy.erasureDefault === "anonymise";
      if (anonymise && p.unexportedForms === 0) {
        await erasePatient(orgId, p.id, {
          mode: "anonymise",
          reason: neverSeen ? "retention:never_seen" : "retention:inactive",
          actor: SYSTEM,
          now,
          unexportedForms: "restrict",
        });
        bump(c, neverSeen ? "neverSeenPseudonymised" : "inactivePseudonymised", 1);
      } else if (!p.restrictedAt) {
        // Restrict instead: the practice's default, or forms that belong in the clinical record.
        await restrictPatient(orgId, p.id, { reason: neverSeen ? "retention:never_seen" : "retention:inactive", actor: SYSTEM, now });
        bump(c, "inactiveRestricted", 1);
      }
    } catch (err) {
      logError("retention", err, { step: "patients", orgId, patientId: p.id });
    }
  }

  // Guardian access ends at 18 (critique 10): their contacts are dropped from the record.
  const adultBirth = `${Number(today.slice(0, 4)) - 18}${today.slice(4)}`;
  bump(
    c,
    "guardiansCleared",
    (
      await db
        .update(patients)
        .set({ guardianName: null, guardianRelation: null, guardianPhone: null, guardianEmail: null })
        .where(
          and(
            eq(patients.orgId, orgId),
            isNotNull(patients.birthDate),
            lte(patients.birthDate, adultBirth),
            or(isNotNull(patients.guardianName), isNotNull(patients.guardianPhone), isNotNull(patients.guardianEmail), isNotNull(patients.guardianRelation)),
          ),
        )
    ).rowsAffected,
  );
}

/** Marketing consent lapses after 24 months without contact: a withdrawal row, source 'retention'. */
async function lapseMarketing(orgId: string, now: Date, c: Counts) {
  const cutoff = monthsAgo(now, PLATFORM_RETENTION.marketingLapseMonths).getTime();
  const rows = await db
    .select({ patientId: consents.patientId, granted: consents.granted, at: consents.createdAt })
    .from(consents)
    .where(and(eq(consents.orgId, orgId), eq(consents.purpose, "marketing"), isNotNull(consents.patientId)))
    .orderBy(desc(consents.createdAt), desc(sql`${consents}.rowid`));
  const latest = new Map<string, { granted: boolean; at: Date }>();
  for (const r of rows) if (r.patientId && !latest.has(r.patientId)) latest.set(r.patientId, r);
  const granted = [...latest].filter(([, v]) => v.granted && v.at.getTime() < cutoff).map(([id]) => id);
  if (!granted.length) return;
  const activity = await db
    .select({
      id: patients.id,
      locale: patients.locale,
      erasedAt: patients.erasedAt,
      lastAppt: sql<number | null>`(select max(max(a.created_at), coalesce(max(case when a.starts_at <= ${now.getTime()} then a.starts_at end), 0)) from appointments a where a.patient_id = ${PATIENT_ID})`,
      lastReply: sql<number | null>`(select max(m.created_at) from messages m where m.patient_id = ${PATIENT_ID} and m.direction = 'inbound')`,
    })
    .from(patients)
    .where(and(eq(patients.orgId, orgId), inArray(patients.id, granted)));
  for (const p of activity) {
    if (p.erasedAt) continue;
    const last = Math.max(latest.get(p.id)!.at.getTime(), p.lastAppt ?? 0, p.lastReply ?? 0);
    if (last >= cutoff) continue;
    try {
      await db.transaction((tx) =>
        withdrawConsent(tx, {
          orgId,
          patientId: p.id,
          purpose: "marketing",
          source: "retention",
          method: "system",
          actorRelation: "system",
          locale: p.locale,
          actor: SYSTEM,
          now,
        }),
      );
      bump(c, "marketingLapsed", 1);
    } catch (err) {
      logError("retention", err, { step: "marketing", orgId, patientId: p.id });
    }
  }
}

/** noShowCount = no-shows in the last 24 months; 0 for patients who objected to no-show tracking. */
async function recomputeNoShows(orgId: string, now: Date, c: Counts) {
  const since = monthsAgo(now, PLATFORM_RETENTION.noShowWindowMonths);
  const objections = await db
    .select({ patientId: consents.patientId, granted: consents.granted })
    .from(consents)
    .where(and(eq(consents.orgId, orgId), eq(consents.purpose, "no_show_tracking"), isNotNull(consents.patientId)))
    .orderBy(desc(consents.createdAt), desc(sql`${consents}.rowid`));
  const latest = new Map<string, boolean>();
  for (const o of objections) if (o.patientId && !latest.has(o.patientId)) latest.set(o.patientId, o.granted);
  const rows = await db
    .select({
      id: patients.id,
      current: patients.noShowCount,
      counted: sql<number>`(select count(*) from appointments a where a.patient_id = ${PATIENT_ID} and a.org_id = ${orgId} and a.status = 'no_show' and a.starts_at >= ${since.getTime()} and a.starts_at <= ${now.getTime()})`,
    })
    .from(patients)
    .where(eq(patients.orgId, orgId));
  for (const r of rows) {
    const want = latest.get(r.id) === false ? 0 : r.counted;
    if (want === r.current) continue;
    await db.update(patients).set({ noShowCount: want }).where(eq(patients.id, r.id));
    bump(c, "noShowCountsUpdated", 1);
  }
}

async function retainOrg(org: { id: string; timezone: string; settings: unknown }, now: Date): Promise<Counts> {
  const c: Counts = {};
  const settings = resolveSettings(org.settings as never);
  const r = settings.privacy.retention;
  const orgId = org.id;
  const today = todayIn(org.timezone, now);

  await retainMessages(orgId, r, now, c);

  // Reminders reminderDays after their appointment.
  const oldAppts = db
    .select({ id: appointments.id })
    .from(appointments)
    .where(and(eq(appointments.orgId, orgId), lt(appointments.startsAt, daysAgo(now, r.reminderDays))));
  bump(c, "remindersDeleted", (await db.delete(reminders).where(inArray(reminders.appointmentId, oldAppts))).rowsAffected);

  // Waitlist: closed entries 30 days after they closed (the last offer, or creation, stands in
  // for the closing date the schema doesn't keep); active ones waitlistDays after latestDate.
  bump(
    c,
    "waitlistDeleted",
    (
      await db
        .delete(waitlist)
        .where(
          and(
            eq(waitlist.orgId, orgId),
            inArray(waitlist.status, ["booked", "removed"]),
            lt(sql`coalesce(${waitlist.lastOfferedAt}, ${waitlist.createdAt})`, daysAgo(now, PLATFORM_RETENTION.closedWaitlistDays).getTime()),
          ),
        )
    ).rowsAffected,
  );
  bump(
    c,
    "waitlistDeleted",
    (await db.delete(waitlist).where(and(eq(waitlist.orgId, orgId), eq(waitlist.status, "active"), lt(waitlist.latestDate, addDays(today, -r.waitlistDays)))))
      .rowsAffected,
  );

  // The patient's booking note and the cancellation reason, patientNoteDays after the visit.
  bump(
    c,
    "appointmentNotesCleared",
    (
      await db
        .update(appointments)
        .set({ patientNote: null, cancelReason: null })
        .where(
          and(
            eq(appointments.orgId, orgId),
            lt(appointments.endsAt, daysAgo(now, r.patientNoteDays)),
            or(isNotNull(appointments.patientNote), isNotNull(appointments.cancelReason)),
          ),
        )
    ).rowsAffected,
  );

  await retainPatients(orgId, org.timezone, settings, now, c);
  await lapseMarketing(orgId, now, c);
  await recomputeNoShows(orgId, now, c);

  // Anamnesis forms already exported to the clinical record.
  bump(
    c,
    "formsDeleted",
    (
      await db
        .delete(formSubmissions)
        .where(and(eq(formSubmissions.orgId, orgId), isNotNull(formSubmissions.exportedAt), lt(formSubmissions.createdAt, monthsAgo(now, r.formSubmissionMonths))))
    ).rowsAffected,
  );
  bump(
    c,
    "recallsDeleted",
    (
      await db
        .delete(recalls)
        .where(and(eq(recalls.orgId, orgId), inArray(recalls.status, ["booked", "dismissed"]), lt(recalls.updatedAt, monthsAgo(now, PLATFORM_RETENTION.closedRecallMonths))))
    ).rowsAffected,
  );

  // Ledgers and the audit log last, so this run's own audit rows are never candidates.
  await retainLedgers(orgId, r, now, c);
  return c;
}

/** Audit chains of practices that no longer exist: pruned with the default audit retention. */
async function retainOrphanChains(now: Date, c: Counts) {
  const live = db.select({ id: organizations.id }).from(organizations);
  const chains = await db
    .selectDistinct({ orgId: auditLog.orgId })
    .from(auditLog)
    .where(and(isNotNull(auditLog.orgId), notInArray(auditLog.orgId, live)));
  for (const { orgId } of chains) {
    bump(c, "orphanAuditRowsDeleted", (await pruneAuditLog(orgId, monthsAgo(now, DEFAULT_RETENTION.auditMonths))).deleted);
  }
}

const total = (c: Counts) => Object.values(c).reduce((a, b) => a + b, 0);

function merge(into: Counts, from: Counts) {
  for (const [k, v] of Object.entries(from)) bump(into, k, v);
}

export async function runRetention(now: Date = new Date()): Promise<RetentionSummary> {
  const startedAt = new Date();
  const counts: Counts = {};
  const platform: Counts = {};

  const step = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (err) {
      logError("retention", err, { step: name });
    }
  };

  await step("closures", async () => bump(platform, "orgsPurged", await purgeDueOrgs(now)));
  await step("technical", () => purgeTechnical(now, platform));

  const orgs = await db
    .select({ id: organizations.id, timezone: organizations.timezone, settings: organizations.settings })
    .from(organizations)
    .where(or(isNull(organizations.purgeAfter), gte(organizations.purgeAfter, now)));
  for (const org of orgs) {
    try {
      const c = await retainOrg(org, now);
      merge(counts, c);
      if (total(c) > 0) {
        await audit({ orgId: org.id, actor: SYSTEM, action: "retention.run", entity: { type: "org", id: org.id }, metadata: c, at: now });
      }
    } catch (err) {
      logError("retention", err, { step: "org", orgId: org.id });
    }
  }

  // Sorriso's own rows (org_id NULL) with the default periods.
  await step("platform-messages", () => retainMessages(null, DEFAULT_RETENTION, now, platform));
  await step("platform-ledgers", () => retainLedgers(null, DEFAULT_RETENTION, now, platform));
  await step("orphan-chains", () => retainOrphanChains(now, platform));
  await step("deadlines", async () => bump(platform, "deadlineRemindersSent", (await sendDeadlineReminders(now)).sent));
  await step("subprocessors", async () => bump(platform, "subprocessorNotices", await notifySubprocessorChanges(now)));
  merge(counts, platform);
  if (total(platform) > 0) {
    await audit({ orgId: null, actor: SYSTEM, action: "retention.run", metadata: platform, at: now });
  }

  const summary = { startedAt, finishedAt: new Date(), orgs: orgs.length, counts };
  logInfo("retention", "run", { orgs: orgs.length, changed: total(counts) });
  return summary;
}
