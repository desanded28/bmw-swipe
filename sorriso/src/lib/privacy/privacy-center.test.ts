import { and, desc, eq } from "drizzle-orm";
import { unzipSync } from "fflate";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import {
  appointments,
  auditLog,
  consents,
  memberships,
  messages,
  organizations,
  patients,
  privacyRequests,
  reviews,
  users,
  verificationCodes,
} from "@/db/schema";
import { audit } from "@/lib/audit";
import { createAppointment } from "@/lib/booking";
import { contactHash, isContactVerified } from "@/lib/contact";
import { newId } from "@/lib/ids";
import { OTP_TTL_MS, verifyOtp } from "@/lib/otp";
import { zonedToUtc } from "@/lib/time";
import { createPractice, MONDAY, NOW, TZ } from "@/test/fixtures";
import {
  cookieWithUnlocked,
  createPatientSession,
  patientSessionCookie,
  PATIENT_SESSION_TTL_MS,
  resolvePatientSession,
  type PatientSession,
} from "./patient-session";
import {
  answerChallenge,
  auditView,
  checkTicketCode,
  confirmContactChange,
  consentOptions,
  exportRecord,
  fileRequest,
  findRecords,
  linkRecord,
  linkStepUpContacts,
  loadRecordDetails,
  maskContact,
  openTicket,
  parseContact,
  recordFor,
  recordStepUpVerification,
  requestContactChange,
  requestPrivacyCenterCode,
  sealTicket,
  sessionRecords,
  setConsentChoice,
  updatePreferences,
  withdrawOwnReview,
} from "./privacy-center";
import { privacyRequestDueAt } from "./requests";

// What would reach the SMS/email provider (the message log keeps OTP bodies redacted).
const sent: { to: string; text: string }[] = [];
vi.mock("@/lib/messaging/providers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/messaging/providers")>()),
  sendSms: async (i: { to: string; text: string }) => {
    sent.push(i);
    return { status: "captured", provider: "dev", providerId: null, from: null };
  },
  sendEmail: async (i: { to: string; text: string }) => {
    sent.push(i);
    return { status: "captured", provider: "dev", providerId: null, from: null };
  },
}));

let ipSeq = 0;
const visitor = () => new Headers({ "x-real-ip": `198.51.${Math.floor(ipSeq / 250)}.${(ipSeq++ % 250) + 1}`, "user-agent": "test" });
const at = (ms: number) => new Date(NOW.getTime() + ms);
const codeIn = (text: string) => text.match(/\b\d{6}\b/)![0];
const lastTo = (to: string) => sent.filter((m) => m.to === to).at(-1);

const P1 = "+393401110001"; // Mario's own phone, also the guardian phone of his children
const P2 = "+393401110002"; // someone else entirely
const UNKNOWN = "+393401119999";

let a: Awaited<ReturnType<typeof createPractice>>;
let b: Awaited<ReturnType<typeof createPractice>>;
let c: Awaited<ReturnType<typeof createPractice>>;
const ids = { marioA: "", marioB: "", luca: "", giulia: "", other: "" };

async function patient(orgId: string, v: Partial<typeof patients.$inferInsert> & { firstName: string; lastName: string }) {
  const id = newId();
  await db.insert(patients).values({ id, orgId, locale: "en", ...v });
  return id;
}

beforeAll(async () => {
  a = await createPractice();
  b = await createPractice();
  c = await createPractice();
  ids.marioA = await patient(a.orgId, {
    firstName: "Mario",
    lastName: "Rossi",
    phone: P1,
    email: "mario@example.com",
    birthDate: "1980-05-05",
    verifiedContacts: [contactHash("phone", P1)!],
  });
  // The same person at another practice, where his phone was never proven: challenge first.
  ids.marioB = await patient(b.orgId, { firstName: "Mario", lastName: "Rossi", phone: P1, birthDate: "1980-05-05" });
  // His son (under 14): the family view, through the guardian phone.
  ids.luca = await patient(a.orgId, {
    firstName: "Luca",
    lastName: "Rossi",
    phone: null,
    birthDate: "2020-01-01",
    guardianName: "Mario Rossi",
    guardianRelation: "parent",
    guardianPhone: P1,
    verifiedContacts: [contactHash("phone", P1)!],
  });
  // His daughter, now an adult: the guardian match no longer counts.
  ids.giulia = await patient(a.orgId, { firstName: "Giulia", lastName: "Rossi", phone: P2, birthDate: "2000-01-01", guardianPhone: P1 });
  ids.other = await patient(c.orgId, { firstName: "Anna", lastName: "Verdi", phone: P2, birthDate: "1990-01-01" });
});

beforeEach(() => {
  sent.length = 0;
});

async function session(contact = P1): Promise<PatientSession> {
  return (await createPatientSession({ kind: "phone", value: contact }, { headers: visitor(), now: NOW })).session;
}

describe("contacts and tickets", () => {
  it("parses a phone number (national with a dial code, or international) or an email address", () => {
    expect(parseContact("340 111 0001", "39")).toEqual({ kind: "phone", value: P1 });
    expect(parseContact("+39 340 1110001")).toEqual({ kind: "phone", value: P1 });
    expect(parseContact(" Mario@Example.com ")).toEqual({ kind: "email", value: "mario@example.com" });
    expect(parseContact("not a contact")).toBeNull();
    expect(maskContact({ kind: "phone", value: P1 })).toBe("+39•••0001");
  });

  it("seals tickets: unreadable, unforgeable, bound to a purpose and short-lived", () => {
    const raw = sealTicket({ c: "abc", k: "phone", v: P1, p: "privacy_center" }, NOW);
    expect(raw).not.toContain("3401110001");
    expect(openTicket(raw, "privacy_center", NOW)).toMatchObject({ c: "abc", v: P1 });
    expect(openTicket(raw, "contact_change", NOW)).toBeNull();
    expect(openTicket(raw, "privacy_center", at(OTP_TTL_MS + 6 * 60_000))).toBeNull();
    expect(openTicket(`${raw.slice(0, -4)}AAAA`, "privacy_center", NOW)).toBeNull();
    expect(openTicket("garbage", "privacy_center", NOW)).toBeNull();
  });
});

describe("findRecords", () => {
  it("shows every practice holding the verified phone, children until 18, and nothing else", async () => {
    const recs = await findRecords({ kind: "phone", value: P1 }, NOW);
    const byId = new Map(recs.map((r) => [r.patient.id, r]));
    expect(byId.get(ids.marioA)).toMatchObject({ via: "self", disclosure: "details" });
    expect(byId.get(ids.marioB)).toMatchObject({ via: "self", disclosure: "challenge" });
    expect(byId.get(ids.luca)).toMatchObject({ via: "guardian", disclosure: "details" });
    expect(byId.has(ids.giulia)).toBe(false);
    expect(byId.has(ids.other)).toBe(false);
    expect(new Set(recs.map((r) => r.org.id))).toEqual(new Set([a.orgId, b.orgId]));
  });

  it("finds nothing for an unknown contact", async () => {
    expect(await findRecords({ kind: "phone", value: UNKNOWN }, NOW)).toEqual([]);
  });
});

describe("sign-in with a one-time code", () => {
  it("answers an unknown contact exactly like a known one, and sends a code only to the known one", async () => {
    const known = await requestPrivacyCenterCode({ contact: { kind: "phone", value: P1 }, locale: "en", headers: visitor(), now: NOW });
    const unknown = await requestPrivacyCenterCode({ contact: { kind: "phone", value: UNKNOWN }, locale: "en", headers: visitor(), now: NOW });
    expect(known.ok && unknown.ok).toBe(true);
    expect(Object.keys(known).sort()).toEqual(Object.keys(unknown).sort());
    if (!known.ok || !unknown.ok) throw new Error("unreachable");
    expect(known.ticket.length).toBeGreaterThan(100);
    expect(Math.abs(known.ticket.length - unknown.ticket.length)).toBeLessThan(8);
    expect(lastTo(P1)?.text).toMatch(/\b\d{6}\b/);
    expect(lastTo(UNKNOWN)).toBeUndefined();
    // Both stored a challenge the same way.
    const rows = await db.select().from(verificationCodes).where(eq(verificationCodes.targetHash, contactHash("phone", UNKNOWN)!));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ purpose: "privacy_center", channel: "sms", attempts: 0 });
  });

  it("fails the 6th wrong code with too_many_attempts, for known and unknown contacts alike", async () => {
    for (const contact of ["+393401110003", "+393401119998"]) {
      if (contact === "+393401110003") await patient(c.orgId, { firstName: "Tom", lastName: "Neri", phone: contact });
      const r = await requestPrivacyCenterCode({ contact: { kind: "phone", value: contact }, locale: "en", headers: visitor(), now: NOW });
      if (!r.ok) throw new Error("rate limited");
      const wrong = "000000" === (lastTo(contact) ? codeIn(lastTo(contact)!.text) : "") ? "111111" : "000000";
      for (let n = 1; n <= 5; n++) expect(await checkTicketCode(r.ticket, wrong, "privacy_center", NOW), `${contact} #${n}`).toEqual({ ok: false, reason: "invalid" });
      expect(await checkTicketCode(r.ticket, wrong, "privacy_center", NOW)).toEqual({ ok: false, reason: "too_many_attempts" });
    }
  });

  it("rejects a right code after 5 minutes, and accepts it before", async () => {
    const r = await requestPrivacyCenterCode({ contact: { kind: "phone", value: P1 }, locale: "en", headers: visitor(), now: at(60 * 60_000) });
    if (!r.ok) throw new Error("rate limited");
    const code = codeIn(lastTo(P1)!.text);
    expect(await checkTicketCode(r.ticket, code, "privacy_center", at(60 * 60_000 + OTP_TTL_MS))).toEqual({ ok: false, reason: "expired" });

    const r2 = await requestPrivacyCenterCode({ contact: { kind: "phone", value: P1 }, locale: "en", headers: visitor(), now: at(61 * 60_000) });
    if (!r2.ok) throw new Error("rate limited");
    const ok = await checkTicketCode(r2.ticket, codeIn(lastTo(P1)!.text), "privacy_center", at(61 * 60_000 + 60_000));
    expect(ok).toMatchObject({ ok: true, contact: { kind: "phone", value: P1 } });
  });

  it("limits codes to 3 per 15 minutes per contact, known or not", async () => {
    const t0 = at(5 * 60 * 60_000);
    for (const contact of [P1, "+393401119997"]) {
      for (let n = 0; n < 3; n++) {
        expect((await requestPrivacyCenterCode({ contact: { kind: "phone", value: contact }, locale: "en", headers: visitor(), now: t0 })).ok).toBe(true);
      }
      expect(await requestPrivacyCenterCode({ contact: { kind: "phone", value: contact }, locale: "en", headers: visitor(), now: t0 })).toEqual({
        ok: false,
        reason: "rate_limited",
      });
    }
  });

  it("limits codes to 10 per hour per network, known or not (decoys count like real codes)", async () => {
    const t0 = at(10 * 60 * 60_000);
    const net = () => new Headers({ "x-real-ip": "203.0.113.77" });
    for (let n = 0; n < 10; n++) {
      const r = await requestPrivacyCenterCode({ contact: { kind: "phone", value: `+3934022200${String(n).padStart(2, "0")}` }, locale: "en", headers: net(), now: t0 });
      expect(r.ok).toBe(true);
    }
    expect(await requestPrivacyCenterCode({ contact: { kind: "phone", value: P2 }, locale: "en", headers: net(), now: t0 })).toEqual({ ok: false, reason: "rate_limited" });
    expect(await requestPrivacyCenterCode({ contact: { kind: "phone", value: "+393403339999" }, locale: "en", headers: net(), now: t0 })).toEqual({
      ok: false,
      reason: "rate_limited",
    });
    expect(lastTo(P2)).toBeUndefined();
  });
});

describe("patient sessions", () => {
  it("round-trips the verified contact, expires after 30 minutes and refuses a forged cookie", async () => {
    const { session: s, cookieValue } = await createPatientSession({ kind: "phone", value: "340 111 0001" }, { headers: visitor(), now: NOW });
    expect(s.contact).toEqual({ kind: "phone", value: P1 });
    expect(cookieValue).not.toContain("3401110001");
    expect(await resolvePatientSession(cookieValue, at(29 * 60_000))).toMatchObject({ id: s.id, contact: { value: P1 } });
    expect(await resolvePatientSession(cookieValue, at(PATIENT_SESSION_TTL_MS))).toBeNull();

    const other = await createPatientSession({ kind: "phone", value: P2 }, { now: NOW });
    const [token] = cookieValue.split(".");
    const forged = `${token}.${other.cookieValue.slice(other.cookieValue.indexOf(".") + 1)}`;
    expect(await resolvePatientSession(forged, NOW)).toBeNull();
    expect(await resolvePatientSession("nonsense", NOW)).toBeNull();
  });

  it("uses an HttpOnly, SameSite=Lax, 30-minute __Host- cookie on https", () => {
    const cookie = patientSessionCookie("v", at(PATIENT_SESSION_TTL_MS));
    expect(cookie).toMatchObject({ name: "__Host-sorriso_pc", httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 1800 });
    // Re-set during the session (an unlock), it keeps the original end: never 30 fresh minutes.
    expect(patientSessionCookie("v", at(PATIENT_SESSION_TTL_MS), at(20 * 60_000)).maxAge).toBe(600);
  });
});

describe("what a session can see and do", () => {
  let s: PatientSession;
  let apptId: string;

  beforeAll(async () => {
    s = await session();
    const d = await createAppointment({
      orgId: a.orgId,
      serviceId: a.visit,
      practitionerId: a.drA,
      locationId: a.milano,
      startsAt: zonedToUtc(MONDAY, 10 * 60, TZ),
      patient: { id: ids.marioA },
      source: "staff",
      online: false,
      now: NOW,
    });
    apptId = d.appointment.id;
    await db.insert(messages).values({
      id: newId(),
      orgId: a.orgId,
      appointmentId: apptId,
      patientId: ids.marioA,
      channel: "sms",
      direction: "inbound",
      to: "+390000000000",
      from: P1,
      body: "SI grazie",
      status: "received",
      provider: "twilio",
      intent: "confirm",
    });
    // Practice B also has a message for its own Mario: must never show in A's record.
    await db.insert(messages).values({ id: newId(), orgId: b.orgId, patientId: ids.marioB, channel: "sms", direction: "outbound", to: P1, body: "B only", status: "captured", provider: "dev" });
    const userId = newId();
    await db.insert(users).values({ id: userId, email: `rec-${userId}@studio.test`, name: "Front desk", passwordHash: "x" });
    await db.insert(memberships).values({ userId, orgId: a.orgId, role: "reception" });
    await audit({ orgId: a.orgId, actor: { type: "user", id: userId }, action: "patient.view", entity: { type: "patient", id: ids.marioA }, at: NOW });
  });

  it("loads the record's appointments with service names, messages including replies, and the access log by role", async () => {
    const rec = (await recordFor(s, ids.marioA, NOW))!;
    const d = await loadRecordDetails(rec);
    expect(d.appointments).toEqual([expect.objectContaining({ id: apptId, service: "Visit", status: "scheduled" })]);
    expect(d.messages.some((m) => m.direction === "inbound" && m.body === "SI grazie")).toBe(true);
    expect(d.messages.some((m) => m.body === "B only")).toBe(false);
    expect(d.accessLog).toContainEqual(expect.objectContaining({ actorType: "user", role: "reception", action: "patient.view" }));
    expect(d.hasPlatformData).toBe(false);
  });

  it("lists in the access log the rows filed elsewhere that name the patient, from this practice only", async () => {
    const staff = { type: "system" as const, id: null };
    // Filed on a waiting-list entry, a message and an appointment hold: they name Mario in metadata.
    await audit({ orgId: a.orgId, actor: staff, action: "waitlist.update", entity: { type: "waitlist", id: newId() }, metadata: { status: "removed", patientId: ids.marioA }, at: NOW });
    await audit({ orgId: a.orgId, actor: staff, action: "message.view", entity: { type: "message", id: newId() }, metadata: { patientId: ids.marioA }, at: NOW });
    // About his son, and (wrongly) in another practice's chain: never in Mario's log at A.
    await audit({ orgId: a.orgId, actor: staff, action: "recall.update", entity: { type: "recall", id: newId() }, metadata: { patientId: ids.luca }, at: NOW });
    await audit({ orgId: b.orgId, actor: staff, action: "form.submit", entity: { type: "form_submission", id: newId() }, metadata: { patientId: ids.marioA }, at: NOW });
    const d = await loadRecordDetails((await recordFor(s, ids.marioA, NOW))!);
    const actions = d.accessLog.map((e) => e.action);
    expect(actions).toEqual(expect.arrayContaining(["waitlist.update", "message.view", "patient.view"]));
    expect(actions).not.toContain("recall.update");
    expect(actions).not.toContain("form.submit");
    const son = await loadRecordDetails((await recordFor(s, ids.luca, NOW))!);
    expect(son.accessLog.map((e) => e.action)).toContain("recall.update");
  });

  it("audits every record shown in full with actor type patient_session", async () => {
    const recs = await findRecords(s.contact, NOW);
    await auditView(s, recs, visitor());
    const rows = await db.select().from(auditLog).where(and(eq(auditLog.action, "privacy_center.view"), eq(auditLog.actorId, s.id)));
    expect(rows.map((r) => r.entityId).sort()).toEqual([ids.marioA, ids.luca].sort());
    expect(rows.every((r) => r.actorType === "patient_session")).toBe(true);
  });

  it("hides challenge records until surname and birth date match, then remembers the contact", async () => {
    expect(await recordFor(s, ids.marioB, NOW)).toBeNull();
    expect(await exportRecord(s, { patientId: ids.marioB, locale: "en", now: NOW })).toBeNull();
    expect(await answerChallenge(s, ids.marioB, { lastName: "Bianchi", birthDate: "1980-05-05" }, { now: NOW })).toEqual({ ok: false, reason: "wrong" });
    expect(await answerChallenge(s, ids.marioB, { lastName: "rossi ", birthDate: "1980-05-05" }, { now: NOW })).toEqual({ ok: true });
    const [row] = await db.select().from(patients).where(eq(patients.id, ids.marioB));
    expect(isContactVerified(row, "phone", P1)).toBe(true);
    expect(await recordFor(s, ids.marioB, NOW)).not.toBeNull();
  });

  it("withdraws a channel through the ledger, audited as the session", async () => {
    const rec = (await recordFor(s, ids.marioA, NOW))!;
    const options = consentOptions(rec, (await loadRecordDetails(rec)).consents);
    expect(options.find((o) => o.purpose === "sms_channel")).toMatchObject({ on: true, canTurnOff: true });
    expect(options.find((o) => o.purpose === "platform_booking_art9")).toBeUndefined();
    expect(await setConsentChoice(s, { patientId: ids.marioA, purpose: "sms_channel", on: false, locale: "en", now: NOW })).toEqual({ ok: true });
    const [p] = await db.select().from(patients).where(eq(patients.id, ids.marioA));
    expect(p.smsOptIn).toBe(false);
    const [row] = await db.select().from(consents).where(eq(consents.patientId, ids.marioA)).orderBy(desc(consents.createdAt)).limit(1);
    expect(row).toMatchObject({ purpose: "sms_channel", granted: false, source: "privacy_center", actorRelation: "self" });
    const [log] = await db.select().from(auditLog).where(and(eq(auditLog.action, "consent.record"), eq(auditLog.entityId, ids.marioA))).orderBy(desc(auditLog.seq)).limit(1);
    expect(log).toMatchObject({ actorType: "patient_session", actorId: s.id });
    // Turning it back on is allowed (a contract channel), granting the platform consent here is not.
    expect(await setConsentChoice(s, { patientId: ids.marioA, purpose: "sms_channel", on: true, locale: "en", now: NOW })).toEqual({ ok: true });
    expect(await setConsentChoice(s, { patientId: ids.marioA, purpose: "platform_booking_art9", on: true, locale: "en", now: NOW })).toEqual({ ok: false, reason: "not_allowed" });
  });

  it("lets a parent decide for a child under 14 (recorded as the parent)", async () => {
    expect(await setConsentChoice(s, { patientId: ids.luca, purpose: "feedback_request", on: true, locale: "en", now: NOW })).toEqual({ ok: true });
    const [row] = await db.select().from(consents).where(eq(consents.patientId, ids.luca)).orderBy(desc(consents.createdAt)).limit(1);
    expect(row).toMatchObject({ purpose: "feedback_request", granted: true, actorRelation: "parent" });
  });

  it("changes language and channel; WhatsApp only where offered and with its confirmation", async () => {
    expect(await updatePreferences(s, { patientId: ids.marioA, locale: "de", channel: "email", shownIn: "en", now: NOW })).toEqual({ ok: true });
    expect(await updatePreferences(s, { patientId: ids.marioA, locale: "de", channel: "whatsapp", shownIn: "en", now: NOW })).toEqual({
      ok: false,
      reason: "channel_unavailable",
    });
    const [org] = await db.select().from(organizations).where(eq(organizations.id, a.orgId));
    await db
      .update(organizations)
      .set({ settings: { ...org.settings, privacy: { ...org.settings.privacy, whatsappEnabled: true } } })
      .where(eq(organizations.id, a.orgId));
    expect(await updatePreferences(s, { patientId: ids.marioA, locale: "de", channel: "whatsapp", shownIn: "en", now: NOW })).toEqual({
      ok: false,
      reason: "whatsapp_consent_required",
    });
    expect(await updatePreferences(s, { patientId: ids.marioA, locale: "de", channel: "whatsapp", whatsappConfirmed: true, shownIn: "en", now: NOW })).toEqual({ ok: true });
    const [p] = await db.select().from(patients).where(eq(patients.id, ids.marioA));
    expect(p).toMatchObject({ locale: "de", preferredChannel: "whatsapp" });
    const [row] = await db.select().from(consents).where(and(eq(consents.patientId, ids.marioA), eq(consents.purpose, "whatsapp_channel")));
    expect(row).toMatchObject({ granted: true, source: "privacy_center", locale: "en" });
  });

  it("files an erasure request with a one-month deadline, audited, with a receipt to the contact", async () => {
    const r = await fileRequest(s, { patientId: ids.marioA, type: "erasure", details: "Please delete everything", locale: "en", headers: visitor(), now: NOW });
    if (!r.ok) throw new Error(r.reason);
    expect(r.duplicate).toBe(false);
    const [row] = await db.select().from(privacyRequests).where(eq(privacyRequests.id, r.id));
    expect(row).toMatchObject({
      orgId: a.orgId,
      patientId: ids.marioA,
      type: "erasure",
      channel: "privacy_center",
      status: "open",
      details: "Please delete everything",
      contactHash: contactHash("phone", P1),
      requesterLocale: "en",
    });
    expect(row.dueAt).toEqual(privacyRequestDueAt(NOW));
    expect(row.dueAt.toISOString().slice(0, 10)).toBe("2030-04-01");
    const [log] = await db.select().from(auditLog).where(and(eq(auditLog.action, "privacy_request.create"), eq(auditLog.entityId, r.id)));
    expect(log).toMatchObject({ orgId: a.orgId, actorType: "patient_session", actorId: s.id });
    expect(lastTo(P1)?.text).toContain("privacy request");
    // Filing it again while open doesn't create a second one.
    const again = await fileRequest(s, { patientId: ids.marioA, type: "erasure", locale: "en", now: NOW });
    expect(again).toMatchObject({ ok: true, id: r.id, duplicate: true });
    // Nothing goes to Sorriso when it controls nothing for this record.
    expect(await fileRequest(s, { patientId: ids.marioA, type: "access", toSorriso: true, locale: "en", now: NOW })).toEqual({ ok: false, reason: "invalid" });
  });

  it("exports a record as a ZIP and audits the export", async () => {
    const file = await exportRecord(s, { patientId: ids.marioA, locale: "en", headers: visitor(), now: NOW });
    expect(file?.contentType).toBe("application/zip");
    const files = unzipSync(file!.body);
    expect(Object.keys(files)).toContain("patient.json");
    const [log] = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.action, "privacy_center.export"), eq(auditLog.entityId, ids.marioA)))
      .orderBy(desc(auditLog.seq))
      .limit(1);
    expect(log).toMatchObject({ orgId: a.orgId, actorType: "patient_session", actorId: s.id });
  });

  it("withdraws the patient's own review, and only theirs", async () => {
    const reviewId = newId();
    await db.update(appointments).set({ status: "completed" }).where(eq(appointments.id, apptId));
    await db.insert(reviews).values({ id: reviewId, orgId: a.orgId, practitionerId: a.drA, appointmentId: apptId, rating: 5, authorName: "Mario R.", status: "published" });
    expect(await withdrawOwnReview(await session(P2), reviewId, NOW)).toEqual({ ok: false, reason: "not_found" });
    expect(await withdrawOwnReview(s, reviewId, NOW)).toEqual({ ok: true });
    const [row] = await db.select().from(reviews).where(eq(reviews.id, reviewId));
    expect(row.status).toBe("withdrawn");
  });

  it("corrects a contact after a code to the new one, tells the old one, and moves the session", async () => {
    const NEW = "+393409998888";
    const step1 = await requestContactChange(s, { patientIds: [ids.marioB], kind: "phone", value: "340 999 8888", dialCode: "39", locale: "en", headers: visitor(), now: NOW });
    if (!step1.ok) throw new Error(step1.reason);
    expect(step1.masked).toBe("+39•••8888");
    const code = codeIn(lastTo(NEW)!.text);
    // Someone else's session can't use the ticket.
    expect(await confirmContactChange(await session(P2), { ticket: step1.ticket, code, now: NOW })).toMatchObject({ ok: false });
    const step1b = await requestContactChange(s, { patientIds: [ids.marioB], kind: "phone", value: NEW, locale: "en", headers: visitor(), now: NOW });
    if (!step1b.ok) throw new Error(step1b.reason);
    const done = await confirmContactChange(s, { ticket: step1b.ticket, code: codeIn(lastTo(NEW)!.text), headers: visitor(), now: NOW });
    expect(done).toEqual({ ok: true, renewSessionWith: { kind: "phone", value: NEW } });
    const [row] = await db.select().from(patients).where(eq(patients.id, ids.marioB));
    expect(row.phone).toBe(NEW);
    expect(isContactVerified(row, "phone", NEW)).toBe(true);
    expect(lastTo(P1)?.text).toContain("The mobile number on your record");
    // Practice A's record keeps its own number.
    const [other] = await db.select().from(patients).where(eq(patients.id, ids.marioA));
    expect(other.phone).toBe(P1);
  });

  it("refuses records the session can't see", async () => {
    const stranger = await session(P2);
    expect(await recordFor(stranger, ids.marioA, NOW)).toBeNull();
    expect(await fileRequest(stranger, { patientId: ids.marioA, type: "access", locale: "en", now: NOW })).toEqual({ ok: false, reason: "not_found" });
    expect(await setConsentChoice(stranger, { patientId: ids.marioA, purpose: "marketing", on: false, locale: "en", now: NOW })).toEqual({ ok: false, reason: "not_found" });
    expect(await updatePreferences(stranger, { patientId: ids.marioA, locale: "it", channel: "sms", shownIn: "it", now: NOW })).toEqual({ ok: false, reason: "not_found" });
  });
});

describe("objections", () => {
  it("offers objections to recalls, no-show tracking and adaptive reminders, and clears the stored risk on objection", async () => {
    const q = await createPractice();
    const [org] = await db.select().from(organizations).where(eq(organizations.id, q.orgId));
    await db
      .update(organizations)
      .set({ settings: { ...org.settings, privacy: { ...org.settings?.privacy, riskBasedReminders: true } } })
      .where(eq(organizations.id, q.orgId));
    const phone = freshPhone();
    const pid = await patient(q.orgId, { firstName: "Sara", lastName: "Neri", phone, birthDate: "1985-03-03", verifiedContacts: [contactHash("phone", phone)!] });
    const visit = (startsAt: Date) =>
      createAppointment({ orgId: q.orgId, serviceId: q.visit, practitionerId: q.drA, locationId: q.milano, startsAt, patient: { id: pid }, source: "staff", online: false, now: NOW });
    const future = (await visit(zonedToUtc(MONDAY, 11 * 60, TZ))).appointment.id;
    const other = await patient(q.orgId, { firstName: "Ugo", lastName: "Neri", phone: freshPhone() });
    const theirs = (
      await createAppointment({ orgId: q.orgId, serviceId: q.visit, practitionerId: q.drA, locationId: q.milano, startsAt: zonedToUtc(MONDAY, 12 * 60, TZ), patient: { id: other }, source: "staff", online: false, now: NOW })
    ).appointment.id;
    await db.update(appointments).set({ riskLevel: "high", riskReasons: ["history"], riskComputedAt: NOW }).where(eq(appointments.orgId, q.orgId));

    const s = await session(phone);
    const rec = (await recordFor(s, pid, NOW))!;
    const options = consentOptions(rec, (await loadRecordDetails(rec)).consents);
    for (const purpose of ["recalls", "no_show_tracking", "adaptive_reminders"] as const) {
      expect(options.find((o) => o.purpose === purpose)).toMatchObject({ kind: "objection", on: true, canTurnOff: true });
    }

    expect(await setConsentChoice(s, { patientId: pid, purpose: "recalls", on: false, locale: "en", now: NOW })).toEqual({ ok: true });
    const risk = async (id: string) => (await db.select().from(appointments).where(eq(appointments.id, id)))[0].riskLevel;
    // An objection to recalls leaves the risk alone; one to adaptive reminders clears it at once.
    expect(await risk(future)).toBe("high");
    expect(await setConsentChoice(s, { patientId: pid, purpose: "adaptive_reminders", on: false, locale: "en", now: NOW })).toEqual({ ok: true });
    expect(await risk(future)).toBeNull();
    // Another patient's visit keeps its risk.
    expect(await risk(theirs)).toBe("high");
    const [row] = await db.select().from(consents).where(eq(consents.patientId, pid)).orderBy(desc(consents.createdAt)).limit(1);
    expect(row).toMatchObject({ purpose: "adaptive_reminders", granted: false, source: "privacy_center" });
  });

  it("clears the stored risk on an objection to no-show tracking too", async () => {
    const q = await createPractice();
    const phone = freshPhone();
    const pid = await patient(q.orgId, { firstName: "Teo", lastName: "Neri", phone, birthDate: "1975-03-03", verifiedContacts: [contactHash("phone", phone)!] });
    const { appointment } = await createAppointment({
      orgId: q.orgId,
      serviceId: q.visit,
      practitionerId: q.drA,
      locationId: q.milano,
      startsAt: zonedToUtc(MONDAY, 11 * 60, TZ),
      patient: { id: pid },
      source: "staff",
      online: false,
      now: NOW,
    });
    await db.update(appointments).set({ riskLevel: "medium", riskReasons: ["history"], riskComputedAt: NOW }).where(eq(appointments.id, appointment.id));
    const s = await session(phone);
    expect(await setConsentChoice(s, { patientId: pid, purpose: "no_show_tracking", on: false, locale: "en", now: NOW })).toEqual({ ok: true });
    const [after] = await db.select().from(appointments).where(eq(appointments.id, appointment.id));
    expect(after.riskLevel).toBeNull();
  });
});

describe("decoy challenges", () => {
  it("never verify, whatever the code", async () => {
    const r = await requestPrivacyCenterCode({ contact: { kind: "email", value: "nobody@example.com" }, locale: "en", headers: visitor(), now: NOW });
    if (!r.ok) throw new Error("rate limited");
    const t = openTicket(r.ticket, "privacy_center", NOW)!;
    let valid = 0;
    for (const code of ["000000", "123456", "999999"]) if ((await verifyOtp({ challengeId: t.c, code, purpose: "privacy_center", now: NOW })).ok) valid++;
    expect(valid).toBe(0);
    expect(sent).toHaveLength(0);
  });
});

/** A mobile number no other test (or earlier run on the same database) uses. */
const freshPhone = () => `+39345${String(Math.floor(Math.random() * 10_000_000)).padStart(7, "0")}`;

describe("identity challenge on shared contacts", () => {
  const P3 = freshPhone(); // spouses sharing one phone, both proven
  const P4 = freshPhone(); // a record with no birth date
  const pid = { paolo: "", laura: "", sara: "" };

  beforeAll(async () => {
    pid.paolo = await patient(a.orgId, { firstName: "Paolo", lastName: "Neri", phone: P3, birthDate: "1975-02-02", verifiedContacts: [contactHash("phone", P3)!] });
    pid.laura = await patient(a.orgId, { firstName: "Laura", lastName: "Neri", phone: P3, birthDate: "1977-03-03", verifiedContacts: [contactHash("phone", P3)!] });
    pid.sara = await patient(b.orgId, { firstName: "Sara", lastName: "Blu", phone: P4 });
  });

  it("keeps a record unlocked for the rest of the session when two adults share the contact", async () => {
    const { session: s0, cookieValue } = await createPatientSession({ kind: "phone", value: P3 }, { headers: visitor(), now: NOW });
    expect((await findRecords(s0.contact, NOW)).map((r) => r.disclosure)).toEqual(["challenge", "challenge"]);
    expect(await answerChallenge(s0, pid.paolo, { lastName: "Neri", birthDate: "1975-02-02" }, { now: NOW })).toEqual({ ok: true });
    // The contact still matches two adults: the disclosure rule alone would ask again.
    expect(await recordFor(s0, pid.paolo, NOW)).toBeNull();

    const next = (await cookieWithUnlocked(cookieValue, pid.paolo, NOW))!;
    expect(next.cookieValue.split(".")[0]).toBe(cookieValue.split(".")[0]);
    const s1 = (await resolvePatientSession(next.cookieValue, NOW))!;
    expect(s1).toMatchObject({ id: s0.id, unlocked: [pid.paolo], expiresAt: s0.expiresAt });
    expect((await sessionRecords(s1, NOW)).map((r) => [r.patient.id, r.disclosure])).toEqual(
      expect.arrayContaining([
        [pid.paolo, "details"],
        [pid.laura, "challenge"],
      ]),
    );
    expect(await recordFor(s1, pid.paolo, NOW)).not.toBeNull();
    expect(await recordFor(s1, pid.laura, NOW)).toBeNull();
    expect(await exportRecord(s1, { patientId: pid.paolo, locale: "en", now: NOW })).not.toBeNull();
    expect(await exportRecord(s1, { patientId: pid.laura, locale: "en", now: NOW })).toBeNull();
    // Another contact's session gains nothing from the unlock, and the unlock ends with the session.
    expect(await recordFor({ ...(await session(P2)), unlocked: [pid.paolo] }, pid.paolo, NOW)).toBeNull();
    expect(await resolvePatientSession(next.cookieValue, at(PATIENT_SESSION_TTL_MS))).toBeNull();
  });

  it("doesn't offer the challenge for a record without a birth date, and uses up no attempts", async () => {
    const s = await session(P4);
    const [rec] = await findRecords(s.contact, NOW);
    expect(rec).toMatchObject({ disclosure: "challenge", canChallenge: false });
    for (let i = 0; i < 7; i++) {
      expect(await answerChallenge(s, pid.sara, { lastName: "Blu", birthDate: "1990-01-01" }, { now: NOW })).toEqual({ ok: false, reason: "unavailable" });
    }
    expect(await recordFor(s, pid.sara, NOW)).toBeNull();
  });
});

describe("the appointment link's privacy page", () => {
  const T = freshPhone(); // a 15-year-old's own phone
  const G = freshPhone(); // their legal guardian
  const BOOKER = freshPhone();
  const rows: Record<string, typeof patients.$inferSelect> = {};
  const fifteen = `${new Date(NOW).getUTCFullYear() - 15}-01-01`;

  beforeAll(async () => {
    const make = async (key: string, v: Parameters<typeof patient>[1]) => {
      const id = await patient(a.orgId, v);
      rows[key] = (await db.select().from(patients).where(eq(patients.id, id)))[0];
    };
    await make("teen", { firstName: "Teo", lastName: "Gialli", phone: T, birthDate: fifteen, guardianName: "Gina Gialli", guardianRelation: "legal_guardian", guardianPhone: G });
    await make("grown", { firstName: "Ada", lastName: "Gialli", phone: freshPhone(), birthDate: "2000-01-01", guardianPhone: G, guardianRelation: "parent" });
    await make("adult", { firstName: "Nonna", lastName: "Pina", phone: BOOKER, email: "nonna@example.com", birthDate: "1940-01-01" });
  });

  const org = () => ({ id: a.orgId, slug: "studio", name: "Studio Test", legalName: null, email: null, phone: null, privacyEmail: null, timezone: TZ, brandColor: "#0c675d", settings: a.settings });
  const appt = (bookedFor: "self" | "minor" | "other_adult") => ({ id: "x", bookedFor, bookedByPhone: bookedFor === "other_adult" ? BOOKER : null, bookedByEmail: null });

  it("acts as the patient only when the patient booked; a guardian's booking acts as the guardian", () => {
    expect(linkRecord({ patient: rows.teen, org: org(), appointment: appt("self") }, NOW).acting).toMatchObject({ actorRelation: "self" });
    const minor = linkRecord({ patient: rows.teen, org: org(), appointment: appt("minor") }, NOW);
    expect(minor.rec.via).toBe("guardian");
    expect(minor.acting).toMatchObject({ actorRelation: "legal_guardian", source: "manage_link" });
  });

  it("lets nobody act for an adult someone else booked for, or for a minor who has turned 18", () => {
    expect(linkRecord({ patient: rows.adult, org: org(), appointment: appt("other_adult") }, NOW).acting).toBeNull();
    expect(linkRecord({ patient: rows.grown, org: org(), appointment: appt("minor") }, NOW).acting).toBeNull();
  });

  it("never sends the step-up code to the booker's own contact", () => {
    const forOther = linkStepUpContacts({ patient: rows.adult, appointment: appt("other_adult") }, NOW);
    expect(forOther).toEqual([{ kind: "email", value: "nonna@example.com" }]);
    expect(linkStepUpContacts({ patient: rows.adult, appointment: appt("self") }, NOW).map((c) => c.kind)).toEqual(["phone", "email"]);
  });

  it("records the step-up contact as verified, audited as the new session", async () => {
    const s = await session(T);
    expect(await recordStepUpVerification(s, { patientId: rows.teen.id, contact: { kind: "phone", value: T }, now: NOW })).toBe(true);
    const [row] = await db.select().from(patients).where(eq(patients.id, rows.teen.id));
    expect(isContactVerified(row, "phone", T)).toBe(true);
    const [log] = await db.select().from(auditLog).where(and(eq(auditLog.entityId, rows.teen.id), eq(auditLog.actorId, s.id)));
    expect(log).toMatchObject({ actorType: "patient_session", action: "patient.update", orgId: a.orgId });
    expect(log.metadata).toMatchObject({ change: "contact_verified", source: "manage_link_step_up" });
    // A contact that isn't on the record changes and audits nothing.
    expect(await recordStepUpVerification(s, { patientId: rows.teen.id, contact: { kind: "phone", value: P2 }, now: NOW })).toBe(false);
  });
});
