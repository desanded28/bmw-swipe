import { and, asc, desc, eq, is } from "drizzle-orm";
import { SQLiteTable } from "drizzle-orm/sqlite-core";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import * as schema from "@/db/schema";
import {
  appointments,
  auditAnchors,
  auditLog,
  authTokens,
  consents,
  formSubmissions,
  formTemplates,
  loginAttempts,
  memberships,
  messages,
  noticeVersions,
  organizations,
  patients,
  patientSessions,
  privacyRequests,
  rateLimits,
  reminders,
  reviewReports,
  reviews,
  sessions,
  users,
  verificationCodes,
  waitlist,
  type Patient,
} from "@/db/schema";
import { createPractice } from "@/test/fixtures";
import { audit, verifyAuditChain } from "../audit";
import { newId } from "../ids";
import { addDays } from "../time";
import { recordConsent } from "./consent";
import { ERASED_FIRST_NAME, ERASED_LAST_NAME } from "./erasure";
import { certificateToken, loadCertificate } from "./org-closure";
import { CONTACT_SNAPSHOT_MARK } from "./requests";
import { daysAgo, monthsAgo, runRetention, type RetentionSummary } from "./retention";

/**
 * A fixed clock in the past: rows the code writes with the real time (emails sent by the job)
 * are then newer than every cutoff, so the second run can be compared row for row.
 */
const NOW = new Date("2026-06-15T10:00:00Z");
const TODAY = "2026-06-15";
const MS = 1;

let p: Awaited<ReturnType<typeof createPractice>>;
let userId: string;
let first: RetentionSummary;
let second: RetentionSummary;
const ids: Record<string, string> = {};
let snapshotAfterFirst = "";
let auditRowsAfterFirst = 0;
const hashes: Record<string, string> = {};

async function addPatient(over: Partial<Patient> = {}, orgId = p.orgId): Promise<Patient> {
  const [row] = await db
    .insert(patients)
    .values({ id: newId(), orgId, firstName: "Test", lastName: "Paziente", phone: null, email: null, ...over })
    .returning();
  return row;
}

async function addAppointment(patientId: string, startsAt: Date, over: Partial<typeof appointments.$inferInsert> = {}, orgId = p.orgId) {
  const id = newId();
  await db.insert(appointments).values({
    id,
    orgId,
    locationId: p.milano,
    practitionerId: p.drA,
    serviceId: p.visit,
    patientId,
    startsAt,
    endsAt: new Date(startsAt.getTime() + 30 * 60_000),
    blockedUntil: new Date(startsAt.getTime() + 30 * 60_000),
    status: "completed",
    source: "staff",
    manageToken: `h:${id}`,
    ...over,
  });
  return id;
}

async function addMessage(createdAt: Date, body: string) {
  const id = newId();
  await db.insert(messages).values({ id, orgId: p.orgId, channel: "sms", direction: "outbound", to: "+390000000000", body, status: "sent", provider: "dev", createdAt });
  return id;
}

/** Every row of every table, decrypted, in a stable order. */
async function snapshot(): Promise<string> {
  const out: Record<string, unknown[]> = {};
  for (const [name, table] of Object.entries(schema)) {
    if (!is(table, SQLiteTable)) continue;
    const rows = (await db.select().from(table)) as Record<string, unknown>[];
    out[name] = rows.map((r) => JSON.stringify(r)).sort();
  }
  return JSON.stringify(out);
}

/** A certificate of deletion in Sorriso's chain, as purgeOrg records it. */
async function certificateRow(at: Date, orgName: string) {
  await audit({
    orgId: null,
    actor: { type: "system", id: null },
    action: "org.close",
    entity: { type: "org", id: newId() },
    metadata: { stage: "purged", orgName, backupsExpireAt: at.getTime() + 30 * 86_400_000, t_patients: 3 },
    at,
  });
  const [row] = await db.select().from(auditLog).where(eq(auditLog.action, "org.close")).orderBy(desc(auditLog.seq)).limit(1);
  hashes[row.id] = row.hash;
  return row.id;
}

beforeAll(async () => {
  p = await createPractice();
  // ---- certificates of deletion, first in the platform chain: kept 10 years past the audit pruning
  ids.certGone = await certificateRow(new Date(monthsAgo(NOW, 120).getTime() - MS), "Studio Antico");
  ids.certAt10y = await certificateRow(monthsAgo(NOW, 120), "Studio Decennale");
  ids.certRecent = await certificateRow(new Date(monthsAgo(NOW, 24).getTime() - MS), "Studio Chiuso");
  userId = newId();
  await db.insert(users).values({ id: userId, email: `u-${userId}@example.org`, name: "Owner", passwordHash: "x" });
  await db.insert(memberships).values({ userId, orgId: p.orgId, role: "owner" });

  // ---- technical rows
  ids.sessionKept = newId();
  ids.sessionGone = newId();
  await db.insert(sessions).values([
    { id: ids.sessionKept, userId, expiresAt: NOW },
    { id: ids.sessionGone, userId, expiresAt: new Date(NOW.getTime() - MS) },
  ]);
  await db.insert(patientSessions).values([
    { id: (ids.psKept = newId()), contactHash: "h", contactType: "email", expiresAt: NOW },
    { id: (ids.psGone = newId()), contactHash: "h", contactType: "email", expiresAt: new Date(NOW.getTime() - MS) },
  ]);
  await db.insert(rateLimits).values([
    { key: (ids.rlKept = `k-${newId()}`), count: 1, resetAt: NOW },
    { key: (ids.rlGone = `k-${newId()}`), count: 1, resetAt: new Date(NOW.getTime() - MS) },
  ]);
  const codeBase = { purpose: "privacy_center" as const, channel: "sms" as const, targetHash: "t", codeHash: "c", expiresAt: daysAgo(NOW, 3) };
  await db.insert(verificationCodes).values([
    { ...codeBase, id: (ids.codeKept = newId()), createdAt: daysAgo(NOW, 2) },
    { ...codeBase, id: (ids.codeGone = newId()), createdAt: new Date(daysAgo(NOW, 2).getTime() - MS) },
  ]);
  await db.insert(loginAttempts).values([
    { id: (ids.loginKept = newId()), emailHash: "e", ipHash: "i", success: false, createdAt: daysAgo(NOW, 90) },
    { id: (ids.loginGone = newId()), emailHash: "e", ipHash: "i", success: false, createdAt: new Date(daysAgo(NOW, 90).getTime() - MS) },
  ]);
  await db.insert(authTokens).values([
    { id: (ids.tokenKept = newId()), kind: "password_reset", userId, expiresAt: daysAgo(NOW, 1) },
    { id: (ids.tokenGone = newId()), kind: "password_reset", userId, expiresAt: new Date(daysAgo(NOW, 1).getTime() - MS) },
  ]);

  // ---- messages (12 months body, 24 months metadata by default)
  ids.bodyKept = await addMessage(monthsAgo(NOW, 12), "body kept");
  ids.bodyGone = await addMessage(new Date(monthsAgo(NOW, 12).getTime() - MS), "body redacted");
  ids.metaKept = await addMessage(monthsAgo(NOW, 24), "meta kept");
  ids.metaGone = await addMessage(new Date(monthsAgo(NOW, 24).getTime() - MS), "meta deleted");

  // ---- reminders 90 days after the appointment, notes 90 days after the visit
  const holder = await addPatient();
  ids.holder = holder.id;
  ids.apptRemKept = await addAppointment(holder.id, daysAgo(NOW, 90), { patientNote: "note kept", cancelReason: "reason kept" });
  ids.apptRemGone = await addAppointment(holder.id, new Date(daysAgo(NOW, 90).getTime() - MS));
  await db.insert(reminders).values([
    { id: (ids.remKept = newId()), appointmentId: ids.apptRemKept, kind: "reminder", channel: "sms", sendAt: daysAgo(NOW, 91), status: "sent" },
    { id: (ids.remGone = newId()), appointmentId: ids.apptRemGone, kind: "reminder", channel: "sms", sendAt: daysAgo(NOW, 91), status: "sent" },
  ]);
  // endsAt = startsAt + 30 min: the note boundary is on endsAt.
  ids.noteKept = await addAppointment(holder.id, new Date(daysAgo(NOW, 90).getTime() - 30 * 60_000), { patientNote: "note kept" });
  ids.noteGone = await addAppointment(holder.id, new Date(daysAgo(NOW, 90).getTime() - 30 * 60_000 - MS), {
    patientNote: "note cleared",
    cancelReason: "reason cleared",
  });

  // ---- waitlist
  const wl = { orgId: p.orgId, patientId: holder.id, serviceId: p.visit, earliestDate: "2026-01-01" };
  await db.insert(waitlist).values([
    { ...wl, id: (ids.wlActiveKept = newId()), latestDate: addDays(TODAY, -90) },
    { ...wl, id: (ids.wlActiveGone = newId()), latestDate: addDays(TODAY, -91) },
    { ...wl, id: (ids.wlClosedKept = newId()), latestDate: TODAY, status: "booked", createdAt: daysAgo(NOW, 30) },
    { ...wl, id: (ids.wlClosedGone = newId()), latestDate: TODAY, status: "removed", createdAt: new Date(daysAgo(NOW, 30).getTime() - MS) },
  ]);

  // ---- never-seen patients (12 months)
  ids.neverKept = (await addPatient({ firstName: "NeverKept", createdAt: monthsAgo(NOW, 12) })).id;
  ids.neverGone = (await addPatient({ firstName: "NeverGone", phone: "+393330001112", createdAt: new Date(monthsAgo(NOW, 12).getTime() - MS) })).id;

  // ---- inactive patients (120 months; this practice restricts)
  ids.inactiveKept = (await addPatient({ firstName: "InactiveKept" })).id;
  await addAppointment(ids.inactiveKept, monthsAgo(NOW, 120));
  ids.inactiveGone = (await addPatient({ firstName: "InactiveGone" })).id;
  await addAppointment(ids.inactiveGone, new Date(monthsAgo(NOW, 120).getTime() - MS));
  ids.inactiveHeld = (await addPatient({ firstName: "Held", retainUntil: "2030-01-01" })).id;
  await addAppointment(ids.inactiveHeld, new Date(monthsAgo(NOW, 130).getTime()));

  // ---- marketing lapses after 24 months without contact
  const grant = (patientId: string, at: Date) =>
    db.transaction((tx) =>
      recordConsent(tx, { orgId: p.orgId, patientId, purpose: "marketing", granted: true, locale: "it", method: "web_checkbox", source: "booking", now: at }),
    );
  ids.mktKept = (await addPatient({ firstName: "MktKept" })).id;
  await grant(ids.mktKept, monthsAgo(NOW, 24));
  ids.mktGone = (await addPatient({ firstName: "MktGone" })).id;
  await grant(ids.mktGone, new Date(monthsAgo(NOW, 24).getTime() - MS));
  ids.mktActive = (await addPatient({ firstName: "MktActive" })).id;
  await grant(ids.mktActive, monthsAgo(NOW, 30));
  await addAppointment(ids.mktActive, daysAgo(NOW, 10));

  // ---- no-show history: the last 24 months only
  ids.noShow = (await addPatient({ firstName: "NoShow", noShowCount: 7 })).id;
  await addAppointment(ids.noShow, monthsAgo(NOW, 24), { status: "no_show" });
  await addAppointment(ids.noShow, daysAgo(NOW, 5), { status: "no_show" });
  await addAppointment(ids.noShow, new Date(monthsAgo(NOW, 24).getTime() - MS), { status: "no_show" });

  // ---- erased and restricted records keep no no-show history
  ids.erasedNoShow = (await addPatient({ firstName: ERASED_FIRST_NAME, lastName: ERASED_LAST_NAME, erasedAt: daysAgo(NOW, 1), noShowCount: 0 })).id;
  await addAppointment(ids.erasedNoShow, daysAgo(NOW, 20), { status: "no_show" });
  await addAppointment(ids.erasedNoShow, daysAgo(NOW, 40), { status: "no_show" });
  ids.restrictedNoShow = (await addPatient({ firstName: "Restricted", restrictedAt: daysAgo(NOW, 1), restrictionReason: "Verifica", noShowCount: 0 })).id;
  await addAppointment(ids.restrictedNoShow, daysAgo(NOW, 20), { status: "no_show" });

  // ---- erasures deferred to retainUntil: carried out the day after, however recent the last visit
  const deferred = { restrictedAt: monthsAgo(NOW, 36), restrictionReason: "erasure:Cartella clinica", phone: "+393335550001" };
  ids.deferredDue = (await addPatient({ ...deferred, firstName: "DeferredDue", retainUntil: addDays(TODAY, -1) })).id;
  await addAppointment(ids.deferredDue, daysAgo(NOW, 10));
  // A form never copied to the clinical record: its keep-until date has passed too.
  const deferredTemplate = newId();
  await db.insert(formTemplates).values({ id: deferredTemplate, orgId: p.orgId, kind: "anamnesis", version: "d1", schema: { version: "1", sections: [] } });
  await db.insert(formSubmissions).values({ id: (ids.deferredForm = newId()), orgId: p.orgId, patientId: ids.deferredDue, templateId: deferredTemplate, version: "1", locale: "it", answers: "{}" });
  ids.deferredHeld = (await addPatient({ ...deferred, firstName: "DeferredHeld", retainUntil: TODAY })).id;
  await addAppointment(ids.deferredHeld, daysAgo(NOW, 10));

  // ---- free text of an erased patient's closed requests: 30 days after closing
  const erasedReq = {
    orgId: p.orgId,
    patientId: ids.erasedNoShow,
    type: "erasure" as const,
    channel: "phone" as const,
    status: "completed" as const,
    details: `Chiede la cancellazione\n\n${CONTACT_SNAPSHOT_MARK}mario@example.org`,
    decisionReason: "Fatto, Mario",
    receivedAt: daysAgo(NOW, 60),
    dueAt: daysAgo(NOW, 30),
  };
  await db.insert(privacyRequests).values([
    { ...erasedReq, id: (ids.erasedReqKept = newId()), closedAt: daysAgo(NOW, 30) },
    { ...erasedReq, id: (ids.erasedReqCleared = newId()), closedAt: new Date(daysAgo(NOW, 30).getTime() - MS) },
  ]);

  // ---- review reports: 24 months after the decision
  const reviewAppt = await addAppointment(holder.id, monthsAgo(NOW, 40));
  const reviewId = newId();
  await db.insert(reviews).values({ id: reviewId, orgId: p.orgId, practitionerId: p.drA, appointmentId: reviewAppt, rating: 4, authorName: "T. P.", status: "published" });
  const report = { reviewId, orgId: p.orgId, ground: "other" as const, details: "dettagli", createdAt: monthsAgo(NOW, 30) };
  await db.insert(reviewReports).values([
    { ...report, id: (ids.reportKept = newId()), status: "decided", decision: "keep", decidedAt: monthsAgo(NOW, 24) },
    { ...report, id: (ids.reportGone = newId()), status: "decided", decision: "keep", decidedAt: new Date(monthsAgo(NOW, 24).getTime() - MS) },
    { ...report, id: (ids.reportOpen = newId()), status: "open" },
  ]);

  // ---- privacy-notice versions: 10 years after a newer one was published
  const notice = { orgId: p.orgId, kind: "practice_patient" as const, version: "1" };
  await db.insert(noticeVersions).values([
    { ...notice, id: (ids.noticeKept = newId()), locale: "it", contentHash: "it-1", publishedAt: monthsAgo(NOW, 130) },
    { ...notice, id: (ids.noticeKeptNext = newId()), locale: "it", contentHash: "it-2", publishedAt: monthsAgo(NOW, 120) },
    { ...notice, id: (ids.noticeGone = newId()), locale: "en", contentHash: "en-1", publishedAt: monthsAgo(NOW, 130) },
    { ...notice, id: (ids.noticeGoneNext = newId()), locale: "en", contentHash: "en-2", publishedAt: new Date(monthsAgo(NOW, 120).getTime() - MS) },
  ]);

  // ---- guardian contacts end at 18
  ids.adult = (await addPatient({ firstName: "Adult", birthDate: "2008-06-15", guardianName: "Mamma", guardianPhone: "+393330009999" })).id;
  await addAppointment(ids.adult, daysAgo(NOW, 3));
  ids.minor = (await addPatient({ firstName: "Minor", birthDate: "2008-06-16", guardianName: "Papà", guardianPhone: "+393330008888" })).id;
  await addAppointment(ids.minor, daysAgo(NOW, 3));

  // ---- consent proofs (unlinked) after 120 months; closed requests after 60 months; exported forms after 120 months
  const proof = { orgId: p.orgId, patientId: null, purpose: "marketing" as const, granted: true, textKey: "consents.marketing.label", textVersion: "1", locale: "it" as const, method: "web_checkbox" as const, source: "booking" as const };
  await db.insert(consents).values([
    { ...proof, id: (ids.proofKept = newId()), createdAt: monthsAgo(NOW, 120) },
    { ...proof, id: (ids.proofGone = newId()), createdAt: new Date(monthsAgo(NOW, 120).getTime() - MS) },
  ]);
  const req = { orgId: p.orgId, type: "access" as const, channel: "email" as const, status: "completed" as const, receivedAt: monthsAgo(NOW, 70), dueAt: monthsAgo(NOW, 69) };
  await db.insert(privacyRequests).values([
    { ...req, id: (ids.reqKept = newId()), closedAt: monthsAgo(NOW, 60) },
    { ...req, id: (ids.reqGone = newId()), closedAt: new Date(monthsAgo(NOW, 60).getTime() - MS) },
  ]);
  const templateId = newId();
  await db.insert(formTemplates).values({ id: templateId, orgId: p.orgId, kind: "anamnesis", version: "r1", schema: { version: "1", sections: [] } });
  const form = { orgId: p.orgId, patientId: holder.id, templateId, version: "1", locale: "it" as const, answers: "{}", exportedAt: daysAgo(NOW, 1) };
  await db.insert(formSubmissions).values([
    { ...form, id: (ids.formKept = newId()), createdAt: monthsAgo(NOW, 120) },
    { ...form, id: (ids.formGone = newId()), createdAt: new Date(monthsAgo(NOW, 120).getTime() - MS) },
    { ...form, id: (ids.formUnexported = newId()), createdAt: monthsAgo(NOW, 200), exportedAt: null },
  ]);

  // ---- an open request due in 3 days: the 7-day reminder goes to the owner once
  await db.insert(privacyRequests).values({
    id: (ids.reqOpen = newId()),
    orgId: p.orgId,
    type: "erasure",
    channel: "phone",
    receivedAt: daysAgo(NOW, 27),
    dueAt: new Date(NOW.getTime() + 3 * 86_400_000),
  });

  // ---- a second practice that pseudonymises at the end of retention
  const anon = await createPractice();
  ids.anonOrg = anon.orgId;
  const [org] = await db.select().from(organizations).where(eq(organizations.id, anon.orgId));
  await db
    .update(organizations)
    .set({ settings: { ...org.settings, privacy: { ...org.settings.privacy, erasureDefault: "anonymise" } } })
    .where(eq(organizations.id, anon.orgId));
  ids.anonInactive = (await addPatient({ firstName: "AnonInactive", phone: "+393334445556" }, anon.orgId)).id;
  await db.insert(appointments).values({
    id: newId(),
    orgId: anon.orgId,
    locationId: anon.milano,
    practitionerId: anon.drA,
    serviceId: anon.visit,
    patientId: ids.anonInactive,
    startsAt: new Date(monthsAgo(NOW, 120).getTime() - MS),
    endsAt: monthsAgo(NOW, 120),
    blockedUntil: monthsAgo(NOW, 120),
    status: "completed",
    source: "staff",
    manageToken: `h:${newId()}`,
  });

  // ---- audit log: a third practice with rows either side of the 24-month cutoff
  const chain = await createPractice();
  ids.chainOrg = chain.orgId;
  await audit({ orgId: chain.orgId, actor: { type: "system", id: null }, action: "settings.update", at: new Date(monthsAgo(NOW, 24).getTime() - MS) });
  await audit({ orgId: chain.orgId, actor: { type: "system", id: null }, action: "settings.update", at: monthsAgo(NOW, 24) });

  // ---- a closed practice whose purge date has passed, and one that is still within it
  const closing = await createPractice();
  ids.purged = closing.orgId;
  await audit({ orgId: closing.orgId, actor: { type: "system", id: null }, action: "settings.update", reason: "Motivo del personale", at: daysAgo(NOW, 70) });
  await db.update(organizations).set({ closureRequestedAt: daysAgo(NOW, 61), purgeAfter: new Date(NOW.getTime() - MS) }).where(eq(organizations.id, closing.orgId));
  const waiting = await createPractice();
  ids.waiting = waiting.orgId;
  await db.update(organizations).set({ closureRequestedAt: daysAgo(NOW, 60), purgeAfter: NOW }).where(eq(organizations.id, waiting.orgId));

  first = await runRetention(NOW);
  snapshotAfterFirst = await snapshot();
  auditRowsAfterFirst = (await db.select({ id: auditLog.id }).from(auditLog)).length;
  second = await runRetention(NOW);
});

const exists = async (table: SQLiteTable, idCol: Parameters<typeof eq>[0], id: string) => (await db.select().from(table).where(eq(idCol, id))).length === 1;

describe("runRetention: each category at its boundary", () => {
  it("purges expired technical rows", async () => {
    expect(await exists(sessions, sessions.id, ids.sessionKept)).toBe(true);
    expect(await exists(sessions, sessions.id, ids.sessionGone)).toBe(false);
    expect(await exists(patientSessions, patientSessions.id, ids.psKept)).toBe(true);
    expect(await exists(patientSessions, patientSessions.id, ids.psGone)).toBe(false);
    expect(await exists(rateLimits, rateLimits.key, ids.rlKept)).toBe(true);
    expect(await exists(rateLimits, rateLimits.key, ids.rlGone)).toBe(false);
    expect(await exists(verificationCodes, verificationCodes.id, ids.codeKept)).toBe(true);
    expect(await exists(verificationCodes, verificationCodes.id, ids.codeGone)).toBe(false);
    expect(await exists(loginAttempts, loginAttempts.id, ids.loginKept)).toBe(true);
    expect(await exists(loginAttempts, loginAttempts.id, ids.loginGone)).toBe(false);
    expect(await exists(authTokens, authTokens.id, ids.tokenKept)).toBe(true);
    expect(await exists(authTokens, authTokens.id, ids.tokenGone)).toBe(false);
  });

  it("redacts message bodies, then deletes the metadata", async () => {
    const get = async (id: string) => (await db.select().from(messages).where(eq(messages.id, id)))[0];
    expect((await get(ids.bodyKept)).body).toBe("body kept");
    const redacted = await get(ids.bodyGone);
    expect(redacted.body).toBe("");
    expect(redacted.redactedAt?.getTime()).toBe(NOW.getTime());
    expect(await get(ids.metaKept)).toBeDefined();
    expect(await get(ids.metaGone)).toBeUndefined();
  });

  it("deletes reminders, waitlist entries and patient notes after their periods", async () => {
    expect(await exists(reminders, reminders.id, ids.remKept)).toBe(true);
    expect(await exists(reminders, reminders.id, ids.remGone)).toBe(false);
    expect(await exists(waitlist, waitlist.id, ids.wlActiveKept)).toBe(true);
    expect(await exists(waitlist, waitlist.id, ids.wlActiveGone)).toBe(false);
    expect(await exists(waitlist, waitlist.id, ids.wlClosedKept)).toBe(true);
    expect(await exists(waitlist, waitlist.id, ids.wlClosedGone)).toBe(false);
    const [kept] = await db.select().from(appointments).where(eq(appointments.id, ids.noteKept));
    expect(kept.patientNote).toBe("note kept");
    const [cleared] = await db.select().from(appointments).where(eq(appointments.id, ids.noteGone));
    expect(cleared).toMatchObject({ patientNote: null, cancelReason: null });
  });

  it("pseudonymises never-seen patients and restricts or pseudonymises inactive ones", async () => {
    const get = async (id: string) => (await db.select().from(patients).where(eq(patients.id, id)))[0];
    expect((await get(ids.neverKept)).erasedAt).toBeNull();
    const never = await get(ids.neverGone);
    expect(never.erasedAt?.getTime()).toBe(NOW.getTime());
    expect(never.phone).toBeNull();
    expect((await get(ids.inactiveKept)).restrictedAt).toBeNull();
    const restricted = await get(ids.inactiveGone);
    expect(restricted.restrictedAt?.getTime()).toBe(NOW.getTime());
    expect(restricted.erasedAt).toBeNull();
    expect((await get(ids.inactiveHeld)).restrictedAt).toBeNull(); // kept on a legal ground until 2030
    const anon = await get(ids.anonInactive);
    expect(anon.erasedAt?.getTime()).toBe(NOW.getTime());
    expect(anon.phone).toBeNull();
  });

  it("lapses marketing consent after 24 months without contact, with a retention row", async () => {
    const latest = async (patientId: string) =>
      (await db.select().from(consents).where(and(eq(consents.patientId, patientId), eq(consents.purpose, "marketing"))).orderBy(asc(consents.createdAt))).at(-1)!;
    expect((await latest(ids.mktKept)).granted).toBe(true);
    expect((await latest(ids.mktActive)).granted).toBe(true);
    const lapsed = await latest(ids.mktGone);
    expect(lapsed).toMatchObject({ granted: false, source: "retention", method: "system", actorRelation: "system" });
  });

  it("recomputes the no-show count over the last 24 months", async () => {
    const [row] = await db.select().from(patients).where(eq(patients.id, ids.noShow));
    expect(row.noShowCount).toBe(2);
  });

  it("drops guardian contacts once the patient is 18", async () => {
    const [adult] = await db.select().from(patients).where(eq(patients.id, ids.adult));
    expect(adult).toMatchObject({ guardianName: null, guardianPhone: null });
    const [minor] = await db.select().from(patients).where(eq(patients.id, ids.minor));
    expect(minor.guardianPhone).toBe("+393330008888");
  });

  it("deletes old consent proofs, closed requests and exported forms only", async () => {
    expect(await exists(consents, consents.id, ids.proofKept)).toBe(true);
    expect(await exists(consents, consents.id, ids.proofGone)).toBe(false);
    expect(await exists(privacyRequests, privacyRequests.id, ids.reqKept)).toBe(true);
    expect(await exists(privacyRequests, privacyRequests.id, ids.reqGone)).toBe(false);
    expect(await exists(formSubmissions, formSubmissions.id, ids.formKept)).toBe(true);
    expect(await exists(formSubmissions, formSubmissions.id, ids.formGone)).toBe(false);
    expect(await exists(formSubmissions, formSubmissions.id, ids.formUnexported)).toBe(true);
  });

  it("prunes the audit log behind an anchor and the chain still verifies", async () => {
    const rows = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.orgId, ids.chainOrg), eq(auditLog.action, "settings.update")));
    expect(rows.map((r) => r.at.getTime())).toEqual([monthsAgo(NOW, 24).getTime()]);
    const [anchor] = await db.select().from(auditAnchors).where(eq(auditAnchors.orgKey, ids.chainOrg));
    expect(anchor.seq).toBe(1);
    expect(await verifyAuditChain(ids.chainOrg)).toEqual({ ok: true });
  });

  it("sends the privacy-request deadline reminder", async () => {
    const [r] = await db.select().from(privacyRequests).where(eq(privacyRequests.id, ids.reqOpen));
    expect(r.remindersSent).toHaveLength(1);
    expect(first.counts.deadlineRemindersSent).toBe(1);
  });

  it("purges practices whose purge date has passed, with their access log", async () => {
    expect(await exists(organizations, organizations.id, ids.purged)).toBe(false);
    expect(await exists(organizations, organizations.id, ids.waiting)).toBe(true);
    expect(first.counts.orgsPurged).toBe(1);
    expect(await db.select().from(auditLog).where(eq(auditLog.orgId, ids.purged))).toEqual([]);
  });

  it("carries out an erasure deferred to retainUntil the day after, forms included", async () => {
    const [due] = await db.select().from(patients).where(eq(patients.id, ids.deferredDue));
    expect(due.erasedAt?.getTime()).toBe(NOW.getTime());
    expect(due).toMatchObject({ firstName: ERASED_FIRST_NAME, phone: null, restrictionReason: null });
    expect(await exists(formSubmissions, formSubmissions.id, ids.deferredForm)).toBe(false);
    const [held] = await db.select().from(patients).where(eq(patients.id, ids.deferredHeld));
    expect(held).toMatchObject({ erasedAt: null, firstName: "DeferredHeld", phone: "+393335550001" });
    expect(first.counts.deferredErasuresCompleted).toBe(1);
  });

  it("never gives erased or restricted records their no-show history back", async () => {
    const [erased] = await db.select().from(patients).where(eq(patients.id, ids.erasedNoShow));
    expect(erased.noShowCount).toBe(0);
    const [restricted] = await db.select().from(patients).where(eq(patients.id, ids.restrictedNoShow));
    expect(restricted.noShowCount).toBe(0);
  });

  it("clears an erased patient's request text 30 days after closing", async () => {
    const [kept] = await db.select().from(privacyRequests).where(eq(privacyRequests.id, ids.erasedReqKept));
    expect(kept.decisionReason).toBe("Fatto, Mario");
    const [cleared] = await db.select().from(privacyRequests).where(eq(privacyRequests.id, ids.erasedReqCleared));
    expect(cleared).toMatchObject({ details: null, decisionReason: null, extensionReason: null, decision: null, status: "completed" });
  });

  it("deletes review reports 24 months after the decision, and superseded notice versions after 10 years", async () => {
    expect(await exists(reviewReports, reviewReports.id, ids.reportKept)).toBe(true);
    expect(await exists(reviewReports, reviewReports.id, ids.reportGone)).toBe(false);
    expect(await exists(reviewReports, reviewReports.id, ids.reportOpen)).toBe(true);
    expect(await exists(noticeVersions, noticeVersions.id, ids.noticeKept)).toBe(true);
    expect(await exists(noticeVersions, noticeVersions.id, ids.noticeKeptNext)).toBe(true);
    expect(await exists(noticeVersions, noticeVersions.id, ids.noticeGone)).toBe(false);
    expect(await exists(noticeVersions, noticeVersions.id, ids.noticeGoneNext)).toBe(true);
  });

  it("keeps certificates of deletion for 10 years, past the audit-log pruning", async () => {
    // The original rows were pruned with the rest of the chain…
    expect(await exists(auditLog, auditLog.id, ids.certRecent)).toBe(false);
    expect(await exists(auditLog, auditLog.id, ids.certGone)).toBe(false);
    // …but the emailed links still open them, with the original date and seal.
    const cert = await loadCertificate(certificateToken(ids.certRecent));
    expect(cert).toMatchObject({ id: ids.certRecent, orgName: "Studio Chiuso", tables: { patients: 3 }, hash: hashes[ids.certRecent] });
    expect(cert!.purgedAt.getTime()).toBe(monthsAgo(NOW, 24).getTime() - MS);
    expect(await loadCertificate(certificateToken(ids.certAt10y))).toMatchObject({ orgName: "Studio Decennale" });
    expect(await loadCertificate(certificateToken(ids.certGone))).toBeNull();
    expect(first.counts.certificatesCarried).toBe(2);
    expect(await verifyAuditChain(null)).toEqual({ ok: true });
  });
});

describe("runRetention: accountability and idempotency", () => {
  it("audits retention.run with counts only", async () => {
    const [row] = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.orgId, p.orgId), eq(auditLog.action, "retention.run")));
    expect(row.actorType).toBe("system");
    expect(row.metadata).toMatchObject({
      // The body of the message kept at 24 months is redacted too; the older one is deleted.
      messagesRedacted: 3,
      messagesDeleted: 1,
      remindersDeleted: 1,
      waitlistDeleted: 2,
      appointmentNotesCleared: 1,
      neverSeenPseudonymised: 1,
      inactiveRestricted: 1,
      marketingLapsed: 1,
      noShowCountsUpdated: 1,
      guardiansCleared: 1,
      consentProofsDeleted: 1,
      privacyRequestsDeleted: 1,
      formsDeleted: 1,
    });
    for (const v of Object.values(row.metadata ?? {})) expect(typeof v).toBe("number");
  });

  it("a second run changes nothing", async () => {
    expect(Object.values(second.counts).reduce((a, b) => a + b, 0)).toBe(0);
    expect(await snapshot()).toBe(snapshotAfterFirst);
    expect((await db.select({ id: auditLog.id }).from(auditLog)).length).toBe(auditRowsAfterFirst);
  });
});
