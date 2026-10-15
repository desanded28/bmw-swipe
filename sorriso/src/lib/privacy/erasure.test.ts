import { and, eq } from "drizzle-orm";
import { is } from "drizzle-orm";
import { SQLiteTable } from "drizzle-orm/sqlite-core";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import * as schema from "@/db/schema";
import {
  appointments,
  auditLog,
  consents,
  formSubmissions,
  formTemplates,
  messages,
  patients,
  privacyRequests,
  recalls,
  reminders,
  reviewReports,
  reviews,
  users,
  waitlist,
  type Patient,
} from "@/db/schema";
import { createPractice } from "@/test/fixtures";
import { decrypt } from "../crypto";
import { newId } from "../ids";
import { processDueReminders } from "../reminders";
import { recordConsent } from "./consent";
import {
  ERASED_NAME,
  ErasureError,
  erasePatient,
  erasePlatformData,
  grantRestrictedAccess,
  hasRestrictedAccess,
  isDeferredErasure,
  restrictedView,
  restrictionReasonView,
  restrictPatient,
  unrestrictPatient,
} from "./erasure";
import { completePrivacyRequest, decisionsAllowed, notifyRequester } from "./requests";

const NOW = new Date("2030-03-01T09:00:00Z");
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const STAFF = { type: "user" as const, id: "staff-1" };

let p: Awaited<ReturnType<typeof createPractice>>;
beforeAll(async () => {
  p = await createPractice();
  // Closing a request records who handled it (a real user).
  await db.insert(users).values({ id: STAFF.id, email: "staff-1@example.org", name: "Staff One", passwordHash: "x" }).onConflictDoNothing();
});

let phoneSeq = 3471230000;
async function addPatient(over: Partial<Patient> = {}): Promise<Patient> {
  const n = phoneSeq++;
  const [row] = await db
    .insert(patients)
    .values({
      id: newId(),
      orgId: p.orgId,
      firstName: "Zebedeo",
      lastName: "Quaglierini",
      phone: `+39${n}`,
      email: `zebedeo.${n}@example.org`,
      birthDate: "1971-05-17",
      notes: "Allergia penicillina ZQ-note",
      createdAt: new Date(NOW.getTime() - 400 * DAY),
      ...over,
    })
    .returning();
  return row;
}

async function addAppointment(patientId: string, startsAt: Date, over: Partial<typeof appointments.$inferInsert> = {}) {
  const id = newId();
  const [row] = await db
    .insert(appointments)
    .values({
      id,
      orgId: p.orgId,
      locationId: p.milano,
      practitionerId: p.drA,
      serviceId: p.visit,
      patientId,
      startsAt,
      endsAt: new Date(startsAt.getTime() + 30 * 60_000),
      blockedUntil: new Date(startsAt.getTime() + 30 * 60_000),
      source: "online",
      manageToken: `h:${id}`,
      manageTokenHash: `hash-${id}`,
      manageTokenEnc: `token-${id}`,
      ...over,
    })
    .returning();
  return row;
}

/** Every string in every table, decrypted (encrypted columns are read through the driver). */
async function allText(): Promise<string[]> {
  const out: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === "string") out.push(v.startsWith("v1:") ? decrypt(v) : v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object" && !(v instanceof Date)) Object.values(v).forEach(walk);
  };
  for (const table of Object.values(schema)) {
    if (!is(table, SQLiteTable)) continue;
    walk(await db.select().from(table));
  }
  return out;
}

describe("erasePatient: anonymise (pseudonymisation)", () => {
  it("leaves no trace of the identity, contacts or notes anywhere", async () => {
    const patient = await addPatient();
    const past = await addAppointment(patient.id, new Date(NOW.getTime() - 30 * DAY), {
      status: "completed",
      patientNote: "Dolore molare sinistro ZQ-booking",
      internalNote: "Paziente Quaglierini ansioso",
      bookedByName: "Zebedeo Quaglierini",
    });
    const future = await addAppointment(patient.id, new Date(NOW.getTime() + 10 * DAY), {
      status: "scheduled",
      patientNote: "Vorrei il pomeriggio ZQ-future",
    });
    const cancelled = await addAppointment(patient.id, new Date(NOW.getTime() - 60 * DAY), {
      status: "cancelled",
      cancelReason: "Influenza di Zebedeo",
    });
    await db.insert(reminders).values([
      { id: newId(), appointmentId: future.id, kind: "reminder", channel: "sms", sendAt: new Date(NOW.getTime() + 9 * DAY) },
      { id: newId(), appointmentId: future.id, kind: "reminder", channel: "email", sendAt: new Date(NOW.getTime() + 8 * DAY) },
    ]);
    await db.insert(messages).values([
      {
        id: newId(),
        orgId: p.orgId,
        patientId: patient.id,
        appointmentId: past.id,
        channel: "sms",
        direction: "outbound",
        to: patient.phone!,
        body: "Ciao Zebedeo, promemoria per domani",
        status: "sent",
        provider: "twilio",
        providerId: "SM123",
      },
      {
        id: newId(),
        orgId: p.orgId,
        patientId: patient.id,
        channel: "email",
        direction: "outbound",
        to: patient.email!,
        subject: "Appuntamento per Zebedeo Quaglierini",
        body: "Gentile Zebedeo Quaglierini",
        html: "<p>Gentile Zebedeo Quaglierini</p>",
        status: "sent",
        provider: "smtp",
      },
      {
        id: newId(),
        orgId: p.orgId,
        appointmentId: future.id,
        channel: "sms",
        direction: "inbound",
        to: "+390212345678",
        from: patient.phone,
        body: "SI confermo, Zebedeo",
        status: "received",
        provider: "twilio",
      },
    ]);
    await db.insert(waitlist).values({
      id: newId(),
      orgId: p.orgId,
      patientId: patient.id,
      serviceId: p.visit,
      earliestDate: "2030-03-02",
      latestDate: "2030-04-01",
      note: "Zebedeo preferisce mattina",
    });
    await db.insert(recalls).values({ id: newId(), orgId: p.orgId, patientId: patient.id, serviceId: p.visit, dueDate: "2030-09-01", intervalMonths: 6 });
    const templateId = newId();
    await db.insert(formTemplates).values({ id: templateId, orgId: p.orgId, kind: "anamnesis", version: "1", schema: { version: "1", sections: [] } });
    await db.insert(formSubmissions).values({
      id: newId(),
      orgId: p.orgId,
      patientId: patient.id,
      templateId,
      version: "1",
      locale: "it",
      answers: JSON.stringify({ name: "Zebedeo Quaglierini", anticoagulants: true }),
      signerName: "Zebedeo Quaglierini",
      exportedAt: new Date(NOW.getTime() - DAY),
    });
    const reviewId = newId();
    await db.insert(reviews).values({
      id: reviewId,
      orgId: p.orgId,
      practitionerId: p.drA,
      appointmentId: past.id,
      rating: 5,
      comment: "Grazie, Zebedeo Q. è contento",
      authorName: "Zebedeo Q.",
      authorDisplay: "first_initial",
      status: "published",
      reply: "Gentile Sig. Quaglierini, grazie!",
      removedReason: "Nomina Zebedeo",
    });
    await db.insert(reviewReports).values({
      id: newId(),
      reviewId,
      orgId: p.orgId,
      ground: "other",
      details: "La recensione di Quaglierini cita un collega",
      patientResponse: "Sono Zebedeo, confermo quanto scritto",
      decision: "keep",
      decisionReason: "Il sig. Quaglierini ha confermato",
      status: "decided",
      decidedAt: NOW,
    });
    // The request this erasure answers, and an older one already closed.
    const requestId = newId();
    await db.insert(privacyRequests).values({
      id: requestId,
      orgId: p.orgId,
      patientId: patient.id,
      type: "erasure",
      channel: "email",
      details: "Io, Zebedeo Quaglierini, chiedo la cancellazione",
      receivedAt: NOW,
      dueAt: new Date(NOW.getTime() + 28 * DAY),
    });
    await db.insert(privacyRequests).values({
      id: newId(),
      orgId: p.orgId,
      patientId: patient.id,
      type: "access",
      channel: "phone",
      status: "completed",
      details: "Zebedeo chiede copia",
      extensionReason: "Molti dati di Quaglierini",
      decision: "granted",
      decisionReason: "Gentile Zebedeo Quaglierini, in allegato",
      receivedAt: new Date(NOW.getTime() - 90 * DAY),
      dueAt: new Date(NOW.getTime() - 60 * DAY),
      closedAt: new Date(NOW.getTime() - 70 * DAY),
    });
    await db.transaction((tx) =>
      recordConsent(tx, { orgId: p.orgId, patientId: patient.id, purpose: "marketing", granted: true, locale: "it", method: "web_checkbox", source: "booking", now: NOW }),
    );

    const before = await allText();
    expect(before.some((s) => s.includes("Quaglierini"))).toBe(true);

    const result = await erasePatient(p.orgId, patient.id, {
      mode: "anonymise",
      reason: "Richiesta di cancellazione",
      actor: STAFF,
      now: NOW,
      answer: { requestId, text: "Gentile Zebedeo Quaglierini, i suoi dati sono stati cancellati." },
    });
    expect(result.mode).toBe("anonymise");
    // The request was answered to the address the record had, before it was removed.
    expect(result.answered).toEqual({ requestId, notified: true });
    const [answeredRow] = await db.select().from(privacyRequests).where(eq(privacyRequests.id, requestId));
    expect(answeredRow).toMatchObject({ status: "completed", decision: "granted", details: null, decisionReason: null, extensionReason: null });
    expect(answeredRow.closedAt?.getTime()).toBe(NOW.getTime());

    const after = await allText();
    const secrets = [
      "Zebedeo",
      "Quaglierini",
      patient.phone!,
      patient.phone!.slice(3),
      patient.email!,
      "Allergia penicillina ZQ-note",
      "ZQ-booking",
      "ZQ-future",
      "1971-05-17",
    ];
    for (const secret of secrets) expect(after.filter((s) => s.includes(secret)), secret).toEqual([]);

    const [erased] = await db.select().from(patients).where(eq(patients.id, patient.id));
    expect(`${erased.firstName} ${erased.lastName}`).toBe(ERASED_NAME);
    expect(erased).toMatchObject({ email: null, phone: null, birthDate: null, notes: null, smsOptIn: false, emailOptIn: false });
    expect(erased.erasedAt?.getTime()).toBe(NOW.getTime());

    // Messages linked to the patient keep only masked metadata: the answer too, once sent.
    const msgs = await db.select().from(messages).where(and(eq(messages.orgId, p.orgId), eq(messages.patientId, patient.id)));
    expect(msgs.length).toBe(3);
    for (const m of msgs) {
      expect(m.body).toBe("");
      expect(m.subject).toBeNull();
      expect(m.html).toBeNull();
      expect(m.redactedAt).not.toBeNull();
    }
    expect(msgs.filter((m) => m.channel === "email" && m.status !== "failed")).toHaveLength(2);

    // Future visits are cancelled with their reminders; the past ones stay as anonymous history.
    const [fut] = await db.select().from(appointments).where(eq(appointments.id, future.id));
    expect(fut.status).toBe("cancelled");
    expect(fut.manageTokenHash).toBeNull();
    const rems = await db.select().from(reminders).where(eq(reminders.appointmentId, future.id));
    expect(rems.map((r) => r.status)).toEqual(["cancelled", "cancelled"]);
    const [pastRow] = await db.select().from(appointments).where(eq(appointments.id, past.id));
    expect(pastRow).toMatchObject({ status: "completed", patientNote: null, internalNote: null, bookedByName: null });
    const [cancelledRow] = await db.select().from(appointments).where(eq(appointments.id, cancelled.id));
    expect(cancelledRow.cancelReason).toBeNull();

    // Deleted: waitlist, recalls, forms.
    expect(await db.select().from(waitlist).where(eq(waitlist.patientId, patient.id))).toEqual([]);
    expect(await db.select().from(recalls).where(eq(recalls.patientId, patient.id))).toEqual([]);
    expect(await db.select().from(formSubmissions).where(eq(formSubmissions.patientId, patient.id))).toEqual([]);

    // One consent proof row remains, unlinked.
    const proofs = await db.select().from(consents).where(and(eq(consents.orgId, p.orgId), eq(consents.purpose, "marketing")));
    expect(proofs).toHaveLength(1);
    expect(proofs[0].patientId).toBeNull();
    // Retention counts consentMonths from the unlinking, not from the consent's own date.
    expect(proofs[0].unlinkedAt?.getTime()).toBe(NOW.getTime());
    expect(await db.select().from(consents).where(eq(consents.patientId, patient.id))).toEqual([]);

    // Review shown under a pseudonym; comment, reply and removal reason gone, and the reports' text.
    const [review] = await db.select().from(reviews).where(eq(reviews.appointmentId, past.id));
    expect(review).toMatchObject({ authorDisplay: "pseudonym", comment: null, reply: null, removedReason: null, rating: 5 });
    const [report] = await db.select().from(reviewReports).where(eq(reviewReports.reviewId, reviewId));
    expect(report).toMatchObject({ details: null, patientResponse: null, decisionReason: null, decision: "keep" });

    // Closed requests keep their type, dates and decision, not their text.
    const closed = await db.select().from(privacyRequests).where(and(eq(privacyRequests.patientId, patient.id), eq(privacyRequests.type, "access")));
    expect(closed[0]).toMatchObject({ decision: "granted", details: null, decisionReason: null, extensionReason: null, answerContact: null });

    const [row] = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.orgId, p.orgId), eq(auditLog.action, "patient.erase"), eq(auditLog.entityId, patient.id)));
    expect(row).toBeDefined();
    expect(row.actorId).toBe(STAFF.id);
    expect(row.metadata).toMatchObject({ mode: "anonymise", messagesRedacted: 3, waitlistDeleted: 1, appointmentsCancelled: 1, requestId, reviewReportsScrubbed: 1 });
  });

  it("keeps an open request answerable: its text and the contact the record had", async () => {
    const patient = await addPatient();
    const id = newId();
    await db.insert(privacyRequests).values({
      id,
      orgId: p.orgId,
      patientId: patient.id,
      type: "erasure",
      channel: "phone",
      details: "Chiede la cancellazione, rispondere via email",
      receivedAt: NOW,
      dueAt: new Date(NOW.getTime() + 28 * DAY),
    });
    await erasePatient(p.orgId, patient.id, { mode: "anonymise", reason: "Richiesta", actor: STAFF, now: NOW });
    const [r] = await db.select().from(privacyRequests).where(eq(privacyRequests.id, id));
    expect(r.status).toBe("open");
    // The requester's words untouched; the contact in answerContact (encrypted), not in the text.
    expect(r.details).toBe("Chiede la cancellazione, rispondere via email");
    expect(r.answerContact).toBe(`${patient.email} · ${patient.phone}`);
    // Staff answer it by hand: notifyRequester doesn't send to an erased record's kept contact.
    const closed = await db.transaction((tx) => completePrivacyRequest(tx, { orgId: p.orgId, id, decision: "granted", reason: "Fatto.", actor: STAFF, now: NOW }));
    expect(await notifyRequester(closed, "requestGranted")).toBe(false);
  });

  it("answers only an open request of this patient, all or nothing", async () => {
    const patient = await addPatient();
    const other = await addPatient();
    const foreign = newId();
    await db.insert(privacyRequests).values({ id: foreign, orgId: p.orgId, patientId: other.id, type: "erasure", channel: "email", receivedAt: NOW, dueAt: new Date(NOW.getTime() + 28 * DAY) });
    const done = newId();
    await db.insert(privacyRequests).values({
      id: done,
      orgId: p.orgId,
      patientId: patient.id,
      type: "erasure",
      channel: "email",
      status: "completed",
      receivedAt: NOW,
      dueAt: new Date(NOW.getTime() + 28 * DAY),
      closedAt: NOW,
    });
    const base = { mode: "anonymise" as const, reason: "Richiesta", actor: STAFF, now: NOW };
    await expect(erasePatient(p.orgId, patient.id, { ...base, answer: { requestId: foreign, text: "Fatto." } })).rejects.toMatchObject({ code: "request_invalid" });
    await expect(erasePatient(p.orgId, patient.id, { ...base, answer: { requestId: done, text: "Fatto." } })).rejects.toMatchObject({ code: "request_closed" });
    await expect(erasePatient(p.orgId, patient.id, { ...base, answer: { requestId: foreign, text: " " } })).rejects.toMatchObject({ code: "answer_required" });
    const [row] = await db.select().from(patients).where(eq(patients.id, patient.id));
    expect(row.erasedAt).toBeNull();
    expect(row.phone).toBe(patient.phone);
  });

  it("never touches a family member who shares the phone (critique 18)", async () => {
    const shared = `+39${phoneSeq++}`;
    const a = await addPatient({ phone: shared });
    const b = await addPatient({ phone: shared, firstName: "Sorella", lastName: "Quaglierini" });
    const msgId = newId();
    await db.insert(messages).values({
      id: msgId,
      orgId: p.orgId,
      patientId: b.id,
      channel: "sms",
      direction: "outbound",
      to: shared,
      body: "Promemoria per Sorella",
      status: "sent",
      provider: "twilio",
    });
    await erasePatient(p.orgId, a.id, { mode: "anonymise", reason: "Richiesta", actor: STAFF, now: NOW });
    const [m] = await db.select().from(messages).where(eq(messages.id, msgId));
    expect(m.body).toBe("Promemoria per Sorella");
    expect(m.to).toBe(shared);
    const [sister] = await db.select().from(patients).where(eq(patients.id, b.id));
    expect(sister.phone).toBe(shared);
  });

  it("is not held up by an unsigned form (only the record of an invitation sent)", async () => {
    const patient = await addPatient();
    const templateId = newId();
    await db.insert(formTemplates).values({ id: templateId, orgId: p.orgId, kind: "anamnesis", version: `i${templateId}`, schema: { version: "1", sections: [] } });
    await db.insert(formSubmissions).values({ id: newId(), orgId: p.orgId, patientId: patient.id, templateId, version: "1", locale: "it", answers: "{}" });
    const r = await erasePatient(p.orgId, patient.id, { mode: "anonymise", reason: "Richiesta", actor: STAFF, now: NOW });
    expect(r.mode).toBe("anonymise");
    expect(await db.select().from(formSubmissions).where(eq(formSubmissions.patientId, patient.id))).toEqual([]);
  });

  it("refuses to delete medical history forms not yet in the clinical record", async () => {
    const patient = await addPatient();
    const templateId = newId();
    await db.insert(formTemplates).values({ id: templateId, orgId: p.orgId, kind: "anamnesis", version: `x${templateId}`, schema: { version: "1", sections: [] } });
    await db
      .insert(formSubmissions)
      .values({ id: newId(), orgId: p.orgId, patientId: patient.id, templateId, version: "1", locale: "it", answers: "{}", signerName: "Zebedeo", signedAt: NOW });
    await expect(erasePatient(p.orgId, patient.id, { mode: "anonymise", reason: "Richiesta", actor: STAFF, now: NOW })).rejects.toMatchObject({
      code: "forms_not_exported",
    });
    // The retention job's policy: restrict instead.
    const r = await erasePatient(p.orgId, patient.id, { mode: "anonymise", reason: "retention", actor: STAFF, now: NOW, unexportedForms: "restrict" });
    expect(r.mode).toBe("restrict");
    const [row] = await db.select().from(patients).where(eq(patients.id, patient.id));
    expect(row.restrictedAt).not.toBeNull();
    expect(row.erasedAt).toBeNull();
    // Restricted for the forms, not on an erasure request: no deferred erasure.
    expect(row.erasureRequestedAt).toBeNull();
    expect(isDeferredErasure(row)).toBe(false);
  });

  it("is scoped to the practice and refuses a second erasure", async () => {
    const patient = await addPatient();
    const other = await createPractice();
    await expect(erasePatient(other.orgId, patient.id, { mode: "anonymise", reason: "x", actor: STAFF })).rejects.toMatchObject({ code: "not_found" });
    await erasePatient(p.orgId, patient.id, { mode: "anonymise", reason: "x", actor: STAFF, now: NOW });
    await expect(erasePatient(p.orgId, patient.id, { mode: "anonymise", reason: "x", actor: STAFF })).rejects.toMatchObject({ code: "already_erased" });
    await expect(erasePatient(p.orgId, patient.id, { mode: "anonymise", reason: " ", actor: STAFF })).rejects.toBeInstanceOf(ErasureError);
  });
});

describe("erasePatient: keep on a legal ground and restrict", () => {
  it("needs a future keep-until date, restricts and cancels future visits", async () => {
    const patient = await addPatient();
    const future = await addAppointment(patient.id, new Date(NOW.getTime() + 5 * DAY));
    await expect(erasePatient(p.orgId, patient.id, { mode: "restrict", reason: "Cartella clinica", actor: STAFF, now: NOW })).rejects.toMatchObject({
      code: "retain_until_required",
    });
    await expect(
      erasePatient(p.orgId, patient.id, { mode: "restrict", reason: "Cartella clinica", retainUntil: "2020-01-01", actor: STAFF, now: NOW }),
    ).rejects.toMatchObject({ code: "invalid_retain_until" });
    await erasePatient(p.orgId, patient.id, { mode: "restrict", reason: "Cartella clinica", retainUntil: "2040-03-01", actor: STAFF, now: NOW });
    const [row] = await db.select().from(patients).where(eq(patients.id, patient.id));
    expect(row).toMatchObject({ retainUntil: "2040-03-01", erasedAt: null, firstName: "Zebedeo" });
    expect(row.restrictedAt?.getTime()).toBe(NOW.getTime());
    // Marked as a deferred erasure (the retention job carries it out after retainUntil), also
    // when staff later update the restriction's reason.
    expect(row.erasureRequestedAt?.getTime()).toBe(NOW.getTime());
    expect(isDeferredErasure(row)).toBe(true);
    expect(restrictionReasonView(row.restrictionReason)).toEqual({ kind: "text", text: "Cartella clinica" });
    await restrictPatient(p.orgId, patient.id, { reason: "Cartella clinica, 10 anni", actor: STAFF, now: new Date(NOW.getTime() + DAY) });
    const [updated] = await db.select().from(patients).where(eq(patients.id, patient.id));
    expect(isDeferredErasure(updated)).toBe(true);
    expect(updated.erasureRequestedAt?.getTime()).toBe(NOW.getTime());
    expect(updated.retainUntil).toBe("2040-03-01");
    const [appt] = await db.select().from(appointments).where(eq(appointments.id, future.id));
    expect(appt.status).toBe("cancelled");
    const [audited] = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.action, "patient.restrict"), eq(auditLog.entityId, patient.id)));
    expect(audited.metadata).toMatchObject({ erasureRequest: true, retainUntil: "2040-03-01" });
  });

  it("answering the request grants it in part, to the contact the record keeps", async () => {
    const patient = await addPatient();
    const requestId = newId();
    await db.insert(privacyRequests).values({ id: requestId, orgId: p.orgId, patientId: patient.id, type: "erasure", channel: "email", receivedAt: NOW, dueAt: new Date(NOW.getTime() + 28 * DAY) });
    const res = await erasePatient(p.orgId, patient.id, {
      mode: "restrict",
      reason: "Cartella clinica",
      retainUntil: "2040-03-01",
      actor: STAFF,
      now: NOW,
      answer: { requestId, text: "Conserviamo la cartella clinica fino al 2040, poi la cancelliamo." },
    });
    expect(res.answered).toEqual({ requestId, notified: true });
    const [r] = await db.select().from(privacyRequests).where(eq(privacyRequests.id, requestId));
    expect(r).toMatchObject({ status: "completed", decision: "partially_granted", decisionReason: "Conserviamo la cartella clinica fino al 2040, poi la cancelliamo." });
    const [sent] = await db.select().from(messages).where(eq(messages.patientId, patient.id));
    expect(sent).toMatchObject({ to: patient.email, channel: "email" });
  });

  it("still reads a deferred erasure marked the old way (restrictionReason prefix), and moves it to the column", async () => {
    const patient = await addPatient({ restrictedAt: NOW, restrictionReason: "erasure:Cartella clinica", retainUntil: "2040-03-01" });
    expect(isDeferredErasure(patient)).toBe(true);
    expect(restrictionReasonView(patient.restrictionReason)).toEqual({ kind: "erasure", text: "Cartella clinica" });
    await restrictPatient(p.orgId, patient.id, { reason: "Cartella clinica, 10 anni", actor: STAFF, now: NOW });
    const [row] = await db.select().from(patients).where(eq(patients.id, patient.id));
    expect(row).toMatchObject({ restrictionReason: "Cartella clinica, 10 anni" });
    expect(row.erasureRequestedAt?.getTime()).toBe(NOW.getTime());
    expect(isDeferredErasure(row)).toBe(true);
    // Lifting the restriction (the patient withdrew the request) ends the deferred erasure.
    await unrestrictPatient(p.orgId, patient.id, { reason: "Ritirata", actor: STAFF, now: NOW });
    const [lifted] = await db.select().from(patients).where(eq(patients.id, patient.id));
    expect(lifted).toMatchObject({ restrictedAt: null, restrictionReason: null, erasureRequestedAt: null });
  });

  it("shows retention codes as codes, and staff text as text", () => {
    expect(restrictionReasonView("retention:inactive").kind).toBe("retention_inactive");
    expect(restrictionReasonView("retention:never_seen").kind).toBe("retention_never_seen");
    expect(restrictionReasonView("Contesta i dati")).toEqual({ kind: "text", text: "Contesta i dati" });
    expect(restrictionReasonView(null)).toEqual({ kind: "text", text: null });
  });
});

describe("restriction (Art. 18)", () => {
  it("a restricted patient gets no reminder", async () => {
    const patient = await addPatient();
    const appt = await addAppointment(patient.id, new Date(Date.now() + 2 * DAY));
    const reminderId = newId();
    await db.insert(reminders).values({ id: reminderId, appointmentId: appt.id, kind: "reminder", channel: "sms", sendAt: new Date(Date.now() - 60_000) });
    await restrictPatient(p.orgId, patient.id, { reason: "Contesta l'esattezza dei dati", actor: STAFF });
    await processDueReminders({ appointmentId: appt.id });
    const [r] = await db.select().from(reminders).where(eq(reminders.id, reminderId));
    expect(r.status).toBe("skipped");
    expect(await db.select().from(messages).where(eq(messages.patientId, patient.id))).toEqual([]);
  });

  it("hides the record without permission and needs an audited reason with it", async () => {
    const patient = await addPatient();
    await restrictPatient(p.orgId, patient.id, { reason: "Opposizione in corso", actor: STAFF, now: NOW });
    const [row] = await db.select().from(patients).where(eq(patients.id, patient.id));
    expect(restrictedView(row, false)).toBe("placeholder");
    expect(restrictedView(row, true)).toBe("needs_reason");

    const viewer = { user: { id: "user-owner" }, org: { id: p.orgId } };
    expect(await hasRestrictedAccess(viewer, patient.id)).toBe(false);
    await expect(grantRestrictedAccess(viewer, patient.id, "")).rejects.toMatchObject({ code: "reason_required" });
    expect(await hasRestrictedAccess(viewer, patient.id)).toBe(false);

    await grantRestrictedAccess(viewer, patient.id, "Il paziente chiede copia dei dati");
    expect(await hasRestrictedAccess(viewer, patient.id)).toBe(true);
    // Another member's reason doesn't open it for someone else.
    expect(await hasRestrictedAccess({ user: { id: "someone-else" }, org: { id: p.orgId } }, patient.id)).toBe(false);
    const [audited] = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.action, "patient.restricted_access"), eq(auditLog.entityId, patient.id)));
    expect(audited.reason).toBe("Il paziente chiede copia dei dati");
    expect(audited.actorId).toBe("user-owner");
  });

  it("lifting it tells the patient first, or needs confirmation they were told", async () => {
    const patient = await addPatient();
    await restrictPatient(p.orgId, patient.id, { reason: "Verifica", actor: STAFF, now: NOW });
    // A reason is required to lift it.
    await expect(unrestrictPatient(p.orgId, patient.id, { reason: " ", actor: STAFF })).rejects.toMatchObject({ code: "reason_required" });
    expect(await db.select().from(messages).where(eq(messages.patientId, patient.id))).toEqual([]);
    const res = await unrestrictPatient(p.orgId, patient.id, { reason: "Dati verificati", actor: STAFF });
    expect(res.notified).toBe(true);
    const sent = await db.select().from(messages).where(eq(messages.patientId, patient.id));
    expect(sent).toHaveLength(1);
    expect(sent[0].channel).toBe("email");
    const [row] = await db.select().from(patients).where(eq(patients.id, patient.id));
    expect(row.restrictedAt).toBeNull();

    const silent = await addPatient({ email: null, phone: null });
    await restrictPatient(p.orgId, silent.id, { reason: "Verifica", actor: STAFF, now: NOW });
    await expect(unrestrictPatient(p.orgId, silent.id, { reason: "Dati verificati", actor: STAFF })).rejects.toMatchObject({ code: "notice_required" });
    await expect(unrestrictPatient(p.orgId, silent.id, { reason: "Dati verificati", actor: STAFF, informedOtherwise: true })).resolves.toEqual({ notified: false });
    const [audited] = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.action, "patient.unrestrict"), eq(auditLog.entityId, silent.id)));
    expect(audited.metadata).toMatchObject({ notified: false, informedOtherwise: true });
    expect(audited.reason).toBe("Dati verificati");
  });
});

describe("answering an erasure, restriction or objection (only once carried out)", () => {
  const request = async (patientId: string, type: "erasure" | "restriction" | "objection", orgId: string | null = p.orgId) => {
    const id = newId();
    await db.insert(privacyRequests).values({ id, orgId, patientId, type, channel: "privacy_center", receivedAt: NOW, dueAt: new Date(NOW.getTime() + 28 * DAY) });
    return id;
  };
  const answer = (id: string, decision: "granted" | "partially_granted" | "refused", orgId: string | null = p.orgId) =>
    db.transaction((tx) => completePrivacyRequest(tx, { orgId, id, decision, reason: "Abbiamo cancellato i dati.", actor: STAFF, now: NOW }));

  it("refuses 'granted' for an erasure while the record still holds the data, and offers it once erased", async () => {
    const patient = await addPatient();
    const id = await request(patient.id, "erasure");
    expect(await decisionsAllowed({ orgId: p.orgId, patientId: patient.id, type: "erasure" })).toEqual(["refused"]);
    await expect(answer(id, "granted")).rejects.toMatchObject({ code: "erasure_not_done" });
    await expect(answer(id, "partially_granted")).rejects.toMatchObject({ code: "erasure_not_done" });
    const [still] = await db.select().from(privacyRequests).where(eq(privacyRequests.id, id));
    expect(still).toMatchObject({ status: "open", decision: null });
    // The one-click erasure closes it as granted, with the record pseudonymised first.
    await erasePatient(p.orgId, patient.id, { mode: "anonymise", reason: "Richiesta", actor: STAFF, now: NOW, answer: { requestId: id, text: "Fatto." } });
    const [closed] = await db.select().from(privacyRequests).where(eq(privacyRequests.id, id));
    expect(closed).toMatchObject({ status: "completed", decision: "granted" });
  });

  it("offers 'granted in part' for an erasure kept and restricted, never 'granted'", async () => {
    const patient = await addPatient();
    const id = await request(patient.id, "erasure");
    await erasePatient(p.orgId, patient.id, { mode: "restrict", reason: "Cartella clinica", retainUntil: "2040-01-01", actor: STAFF, now: NOW });
    expect(await decisionsAllowed({ orgId: p.orgId, patientId: patient.id, type: "erasure" })).toEqual(["partially_granted", "refused"]);
    await expect(answer(id, "granted")).rejects.toMatchObject({ code: "erasure_not_done" });
    expect(await answer(id, "partially_granted")).toMatchObject({ status: "completed", decision: "partially_granted" });
  });

  it("a restriction once the record is restricted, an objection once it is in the ledger", async () => {
    const patient = await addPatient();
    const restriction = await request(patient.id, "restriction");
    await expect(answer(restriction, "granted")).rejects.toMatchObject({ code: "restriction_not_done" });
    await restrictPatient(p.orgId, patient.id, { reason: "Contesta l'esattezza", actor: STAFF, now: NOW });
    expect(await answer(restriction, "granted")).toMatchObject({ decision: "granted" });

    const other = await addPatient();
    const objection = await request(other.id, "objection");
    await expect(answer(objection, "granted")).rejects.toMatchObject({ code: "objection_not_done" });
    // A channel opt-out is not an objection.
    await db.transaction((tx) =>
      recordConsent(tx, { orgId: p.orgId, patientId: other.id, purpose: "sms_channel", granted: false, locale: "it", method: "staff_recorded", source: "staff", now: NOW }),
    );
    await expect(answer(objection, "granted")).rejects.toMatchObject({ code: "objection_not_done" });
    await db.transaction((tx) =>
      recordConsent(tx, { orgId: p.orgId, patientId: other.id, purpose: "no_show_tracking", granted: false, locale: "it", method: "staff_recorded", source: "staff", now: NOW }),
    );
    expect(await answer(objection, "granted")).toMatchObject({ decision: "granted" });
  });

  it("a refusal is always possible, and a request linked to no record is left to staff", async () => {
    const patient = await addPatient();
    expect(await answer(await request(patient.id, "erasure"), "refused")).toMatchObject({ status: "rejected" });
    expect(await decisionsAllowed({ orgId: p.orgId, patientId: null, type: "erasure" })).toEqual(["granted", "partially_granted", "refused"]);
  });

  it("Sorriso's inbox: granted once Sorriso erased its own data (consents unlinked, reviews pseudonymised)", async () => {
    const patient = await addPatient();
    const appt = await addAppointment(patient.id, new Date(NOW.getTime() - 20 * DAY), { status: "completed", processingContext: "marketplace" });
    await db.transaction((tx) =>
      recordConsent(tx, { orgId: p.orgId, patientId: patient.id, appointmentId: appt.id, purpose: "platform_booking_art9", granted: true, locale: "it", method: "web_checkbox", source: "booking", now: NOW }),
    );
    await db.insert(reviews).values({ id: newId(), orgId: p.orgId, practitionerId: p.drA, appointmentId: appt.id, rating: 5, comment: "Bravissimi ZQ-review", authorName: "Zebedeo Q.", status: "published" });
    const id = await request(patient.id, "erasure", null);
    await expect(answer(id, "granted", null)).rejects.toMatchObject({ code: "erasure_not_done" });
    const counts = await erasePlatformData(patient.id, { mode: "erase", actor: { type: "platform_admin", id: STAFF.id }, requestId: id, now: NOW });
    expect(counts).toMatchObject({ platformConsentsUnlinked: 1, reviewsPseudonymised: 1 });
    expect(await answer(id, "granted", null)).toMatchObject({ decision: "granted" });
    // The practice's record is untouched.
    const [kept] = await db.select().from(patients).where(eq(patients.id, patient.id));
    expect(kept).toMatchObject({ firstName: "Zebedeo", erasedAt: null });
  });

  it("Sorriso's inbox: an objection once Sorriso's consents are withdrawn ('stop')", async () => {
    const patient = await addPatient();
    await db.transaction((tx) =>
      recordConsent(tx, { orgId: p.orgId, patientId: patient.id, purpose: "platform_booking_art9", granted: true, locale: "it", method: "web_checkbox", source: "booking", now: NOW }),
    );
    const id = await request(patient.id, "objection", null);
    await expect(answer(id, "granted", null)).rejects.toMatchObject({ code: "objection_not_done" });
    expect(await erasePlatformData(patient.id, { mode: "stop", actor: { type: "platform_admin", id: STAFF.id }, now: NOW })).toMatchObject({ withdrawals: 2 });
    expect(await answer(id, "granted", null)).toMatchObject({ decision: "granted" });
  });
});

describe("erasure and Sorriso's own consent rows (org_id NULL)", () => {
  it("are unlinked by the practice's erasure, so the platform retention clock starts", async () => {
    const patient = await addPatient();
    const appt = await addAppointment(patient.id, new Date(NOW.getTime() - 10 * DAY), { status: "completed", processingContext: "marketplace" });
    await db.transaction((tx) =>
      recordConsent(tx, { orgId: p.orgId, patientId: patient.id, appointmentId: appt.id, purpose: "platform_booking_art9", granted: true, locale: "it", method: "web_checkbox", source: "booking", now: NOW }),
    );
    const res = await erasePatient(p.orgId, patient.id, { mode: "anonymise", reason: "Richiesta", actor: STAFF, now: NOW });
    expect(res.counts.platformConsentsUnlinked).toBe(1);
    const rows = await db.select().from(consents).where(eq(consents.appointmentId, appt.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ orgId: null, patientId: null });
    expect(rows[0].unlinkedAt?.getTime()).toBe(NOW.getTime());
  });
});

describe("restriction stops profiling (Art. 18(2))", () => {
  it("clears the stored no-show risk when the record is restricted", async () => {
    const patient = await addPatient();
    const appt = await addAppointment(patient.id, new Date(NOW.getTime() + 5 * DAY), { riskLevel: "high", riskReasons: ["no_show_history"], riskComputedAt: NOW });
    await restrictPatient(p.orgId, patient.id, { reason: "Contesta l'esattezza", actor: STAFF, now: NOW });
    const [row] = await db.select().from(appointments).where(eq(appointments.id, appt.id));
    expect(row).toMatchObject({ riskLevel: null, riskReasons: [], riskComputedAt: null });
  });
});
