import { and, asc, eq, gt, inArray, notInArray } from "drizzle-orm";
import { appointments, legalAcceptances, locations, memberships, organizations, patients, type ConsentPurpose } from "../../src/db/schema";
import { newId } from "../../src/lib/ids";
import { LEGAL_VERSIONS } from "../../src/lib/privacy/versions";
import { recordConsent } from "../../src/lib/privacy/consent";
import { restrictPatient } from "../../src/lib/privacy/erasure";
import { recordLegalAcceptance } from "../../src/lib/privacy/legal";
import {
  addMonthsClamped,
  completePrivacyRequest,
  createPrivacyRequest,
  extendPrivacyRequest,
  privacyRequestDueAt,
  startPrivacyRequest,
} from "../../src/lib/privacy/requests";
import { LEGAL_DOCS } from "../../src/db/enums";
import type { SeedContext } from "../seed";

/**
 * Privacy demo data (WP5), run by scripts/seed.ts after the core seed:
 *  - controller identity for every practice (legal name, VAT, registered office, privacy contact,
 *    DPO for the flagship, medical director): what the notices, the register and exports show;
 *  - acceptance of the current DPA, terms and sub-processor list by each practice's owner (or
 *    admin), and of the staff instructions by every member, so the dashboard gates and
 *    canAcceptOnlineBookings() let the demo work (critique 23: no lockout after the rollout);
 *  - a few consent-ledger rows (channel choices, feedback consents, a withdrawal, objections);
 *  - privacy requests in each state for the flagship practice: new, in progress close to its
 *    deadline, extended, completed, rejected; plus one to Sorriso as controller;
 *  - a restricted record (Art. 18) with an upcoming visit, and its in-progress restriction request:
 *    the calendar, the lists and the drawer show the "Restricted patient" placeholder.
 * Deterministic in content (dates relative to ctx.now; no randomness).
 */

const DAY = 86_400_000;

const vat = (i: number) => `IT${String(10293847561 + i * 7_919_013).padStart(11, "0").slice(0, 11)}`;

export async function seedPrivacy(ctx: SeedContext): Promise<void> {
  const { db, now } = ctx;
  const ago = (days: number) => new Date(now.getTime() - days * DAY);

  for (const [i, orgId] of ctx.orgIds.entries()) {
    const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
    const [office] = await db.select().from(locations).where(eq(locations.orgId, orgId)).orderBy(asc(locations.name)).limit(1);
    const domain = org.website?.replace(/^https?:\/\//, "") ?? `${org.slug}.example`;
    await db
      .update(organizations)
      .set({
        legalName: `${org.name} S.r.l.`,
        vatNumber: vat(i),
        registeredAddress: office ? `${office.address}, ${office.postalCode ?? ""} ${office.city}`.replace(/\s+/g, " ").trim() : null,
        privacyEmail: `privacy@${domain}`,
        dpoName: i === 0 ? "Avv. Marta Colombo" : null,
        dpoEmail: i === 0 ? `dpo@${domain}` : null,
        medicalDirector: i === 0 ? "Dr. Luca Bianchi" : null,
        emailVerifiedAt: org.emailVerifiedAt ?? now,
      })
      .where(eq(organizations.id, orgId));

    // Legal acceptances: the practice's documents by its owner (an admin where the demo user is admin).
    const members = await db.select().from(memberships).where(eq(memberships.orgId, orgId));
    const acceptor = members.find((m) => m.role === "owner") ?? members.find((m) => m.role === "admin");
    await db.transaction(async (tx) => {
      for (const doc of LEGAL_DOCS.filter((d) => d !== "staff_instructions")) {
        if (acceptor) await recordLegalAcceptance(tx, { orgId, userId: acceptor.userId, doc, locale: "it", now: ago(30) });
        // Demo practices without a member: accepted at onboarding, so their bookings work too.
        else await tx.insert(legalAcceptances).values({ id: newId(), orgId, userId: null, documentType: doc, version: LEGAL_VERSIONS[doc], locale: "it", acceptedAt: ago(30) });
      }
      for (const m of members) {
        await recordLegalAcceptance(tx, { orgId, userId: m.userId, doc: "staff_instructions", locale: "it", now: ago(30) });
      }
    });
  }

  // ---- consents and requests for the flagship practice
  const flagship = ctx.orgIds[0];
  const ids = ctx.patientIds[flagship] ?? [];
  if (!flagship || ids.length < 8) return;
  const rows = await db
    .select({ id: patients.id, locale: patients.locale, birthDate: patients.birthDate })
    .from(patients)
    .where(and(eq(patients.orgId, flagship), inArray(patients.id, ids.slice(0, 12))));
  const owner = (await db.select().from(memberships).where(and(eq(memberships.orgId, flagship), eq(memberships.role, "owner"))))[0];
  const staffActor = owner ? { type: "user" as const, id: owner.userId } : { type: "system" as const, id: null };

  await db.transaction(async (tx) => {
    const consent = (patientId: string, purpose: ConsentPurpose, granted: boolean, days: number, source: "booking" | "staff" | "sms_reply" | "privacy_center" = "booking") =>
      recordConsent(tx, {
        orgId: flagship,
        patientId,
        purpose,
        granted,
        locale: rows.find((r) => r.id === patientId)?.locale ?? "it",
        method: source === "staff" ? "staff_recorded" : source === "sms_reply" ? "sms_reply" : "web_checkbox",
        source,
        actorRelation: "self",
        actorUserId: source === "staff" ? (owner?.userId ?? null) : null,
        now: ago(days),
      });
    for (const [n, p] of rows.entries()) {
      // Skip children: their consents need a guardian (recordConsent enforces it).
      if (p.birthDate && now.getTime() - Date.parse(p.birthDate) < 14 * 365 * DAY) continue;
      if (n % 2 === 0) await consent(p.id, "feedback_request", true, 60 - n);
      if (n === 1) await consent(p.id, "whatsapp_channel", true, 45);
      if (n === 3) await consent(p.id, "sms_channel", false, 20, "sms_reply");
      if (n === 7) await consent(p.id, "adaptive_reminders", false, 9, "staff");
      if (n === 5) await consent(p.id, "no_show_tracking", false, 12, "privacy_center");
      if (n === 6) {
        await consent(p.id, "feedback_request", true, 90);
        await consent(p.id, "feedback_request", false, 15, "staff");
      }
    }

    const req = (
      patientId: string | null,
      type: "access" | "erasure" | "rectification" | "objection",
      channel: "privacy_center" | "phone" | "email" | "in_person",
      days: number,
      details: string,
    ) =>
      createPrivacyRequest(tx, {
        orgId: flagship,
        patientId,
        type,
        channel,
        details,
        requesterLocale: "it",
        actor: channel === "privacy_center" ? undefined : staffActor,
        receivedAt: ago(days),
        now: ago(days),
      });

    // New, from the privacy center.
    await req(rows[0]?.id ?? null, "access", "privacy_center", 3, "Vorrei una copia di tutti i miei dati e dei miei appuntamenti.");
    // In progress, close to its deadline (the 7-day reminder applies).
    const close = await req(rows[1]?.id ?? null, "objection", "phone", 26, "Telefonata: non vuole più promemoria aggiuntivi.");
    await startPrivacyRequest(tx, { orgId: flagship, id: close.id, actor: staffActor, now: ago(24) });
    // Extended, with reasons.
    const ext = await req(rows[2]?.id ?? null, "erasure", "email", 20, "Richiesta di cancellazione inviata via email.");
    await extendPrivacyRequest(tx, {
      orgId: flagship,
      id: ext.id,
      until: addMonthsClamped(privacyRequestDueAt(ago(20)), 1),
      reason: "Verifica degli obblighi di conservazione della cartella clinica.",
      actor: staffActor,
      now: ago(10),
    });
    // Completed.
    const done = await req(rows[4]?.id ?? null, "rectification", "in_person", 40, "Numero di telefono errato.");
    await completePrivacyRequest(tx, { orgId: flagship, id: done.id, decision: "granted", reason: "Numero aggiornato nella scheda.", actor: staffActor, now: ago(38) });
    // Rejected (refused, with the reasons sent to the patient).
    const refused = await req(rows[8]?.id ?? null, "erasure", "email", 16, "Cancellate la mia cartella clinica, non sono più vostro paziente.");
    await completePrivacyRequest(tx, {
      orgId: flagship,
      id: refused.id,
      decision: "refused",
      reason: "La cartella clinica va conservata per 10 anni (obbligo di legge, art. 17(3)(b) GDPR). I promemoria e i dati non necessari sono stati cancellati.",
      actor: staffActor,
      now: ago(6),
    });

    // A request to Sorriso as controller (marketplace booking), for the platform inbox.
    await createPrivacyRequest(tx, {
      orgId: null,
      patientId: null,
      type: "access",
      channel: "privacy_center",
      details: "Quali dati ha Sorriso sulle mie prenotazioni dal sito?",
      // Linked to no record: the answer goes to the contact the privacy center verified.
      answerContact: "lucia.marchetti@example.org",
      requesterLocale: "it",
      receivedAt: ago(5),
      now: ago(5),
    });
  });

  // ---- a restricted record (Art. 18): a patient contesting their data, with an upcoming visit.
  const [upcoming] = await db
    .select({ patientId: appointments.patientId })
    .from(appointments)
    .where(
      and(
        eq(appointments.orgId, flagship),
        eq(appointments.status, "scheduled"),
        eq(appointments.minorFlag, false),
        gt(appointments.startsAt, new Date(now.getTime() + 2 * DAY)),
        notInArray(appointments.patientId, rows.map((r) => r.id)),
      ),
    )
    .orderBy(asc(appointments.startsAt))
    .limit(1);
  if (upcoming) {
    await db.transaction(async (tx) => {
      const r = await createPrivacyRequest(tx, {
        orgId: flagship,
        patientId: upcoming.patientId,
        type: "restriction",
        channel: "phone",
        details: "Telefonata: contesta l'anamnesi registrata e chiede di limitare il trattamento finché non è verificata.",
        requesterLocale: "it",
        actor: staffActor,
        receivedAt: ago(4),
        now: ago(4),
      });
      await startPrivacyRequest(tx, { orgId: flagship, id: r.id, actor: staffActor, now: ago(3) });
    });
    await restrictPatient(flagship, upcoming.patientId, {
      reason: "Art. 18(1)(a): the patient contests the accuracy of their data; restricted while we check it.",
      actor: staffActor,
      now: ago(3),
    });
  }
}
