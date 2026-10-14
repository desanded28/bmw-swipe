import { and, eq, isNotNull } from "drizzle-orm";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { CareAppointment } from "@/components/dashboard/slots/contracts";
import { CalendarEventBadges } from "@/components/dashboard/slots/CalendarEventBadges";
import { client, db } from "@/db";
import { auditLog, formSubmissions, organizations, patients } from "@/db/schema";
import { I18nProvider } from "@/i18n/provider";
import { getMessages } from "@/i18n/t";
import { createPractice, MONDAY, NOW, TZ } from "@/test/fixtures";
import { createAppointment } from "./booking";
import {
  anamnesisStatuses,
  clinicalAnamnesis,
  DEFAULT_ANAMNESIS_V1,
  markFormExported,
  parseAnswers,
  redFlagsOf,
  sendFormInvites,
  startFormSignature,
  submitAnamnesis,
} from "./forms";
import { manageTokenOf } from "./links";
import { sendOtp } from "./otp";
import { permissionsFor } from "./permissions";
import { grantRestrictedAccess } from "./privacy/erasure";
import { loadCareFlags } from "./risk";
import { zonedToUtc } from "./time";

// Capture what would reach the provider (the one-time codes).
const sent: { to: string; text: string }[] = [];
vi.mock("./messaging/providers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./messaging/providers")>();
  const capture = async (i: { to: string; text: string }) => {
    sent.push(i);
    return { status: "captured" as const, provider: "dev", providerId: null, from: null };
  };
  return { ...actual, sendSms: capture, sendEmail: capture };
});

let p: Awaited<ReturnType<typeof createPractice>>;
let seq = 3500000000;
let ipSeq = 0;
const visitor = () => new Headers({ "x-real-ip": `198.51.${Math.floor(ipSeq / 250)}.${(ipSeq++ % 250) + 1}` });
const codeIn = (text: string) => text.match(/\b\d{6}\b/)![0];

const ANSWERS = {
  anticoagulants: "yes",
  bisphosphonates: "no",
  otherMedication: "Warfarin 5 mg",
  allergies: "no",
  cardiac: "no",
  diabetes: "no",
  pregnancy: "not_applicable",
  smoking: "never",
  dentalAnxiety: "some",
};

async function upcoming(firstName: string, hh = 9) {
  const d = await createAppointment({
    orgId: p.orgId,
    serviceId: p.visit,
    practitionerId: p.drA,
    locationId: p.milano,
    startsAt: zonedToUtc(MONDAY, hh * 60, TZ),
    patient: { firstName, lastName: "Form", phone: `+39${seq++}`, locale: "it" },
    source: "staff",
    online: false,
    force: true,
    now: NOW,
  });
  return { d, token: manageTokenOf(d.appointment)! };
}

/** Send the signature code and return it with its challenge. */
async function code(token: string) {
  const res = await startFormSignature({ token, locale: "it", headers: visitor(), now: NOW });
  if (!res.ok) throw new Error(res.reason);
  return { challengeId: res.challengeId, code: codeIn(sent.at(-1)!.text), to: sent.at(-1)!.to };
}

beforeAll(async () => {
  p = await createPractice();
  await db
    .update(organizations)
    .set({ settings: { ...p.settings, care: { ...p.settings.care, anamnesisEnabled: true } } })
    .where(eq(organizations.id, p.orgId));
});
beforeEach(() => {
  sent.length = 0;
});

describe("the form schema", () => {
  it("checks answers and finds the red flags", () => {
    expect(parseAnswers(DEFAULT_ANAMNESIS_V1, ANSWERS)).toEqual({ ok: true, answers: ANSWERS });
    expect(redFlagsOf(DEFAULT_ANAMNESIS_V1, ANSWERS)).toEqual(["anticoagulants"]);
    expect(redFlagsOf(DEFAULT_ANAMNESIS_V1, { ...ANSWERS, allergies: "yes", pregnancy: "yes" })).toEqual(["anticoagulants", "allergies", "pregnancy"]);
    const bad = parseAnswers(DEFAULT_ANAMNESIS_V1, { ...ANSWERS, anticoagulants: "maybe", smoking: undefined, extra: "dropped" });
    expect(bad).toEqual({ ok: false, errors: { anticoagulants: "invalid", smoking: "required" } });
    expect(parseAnswers(DEFAULT_ANAMNESIS_V1, { ...ANSWERS, notes: "x".repeat(1001) })).toMatchObject({ ok: false, errors: { notes: "invalid" } });
    // Labels are care-namespace keys.
    const care = getMessages("en", ["care"]).care as unknown as { anamnesis: { fields: Record<string, string> } };
    for (const f of DEFAULT_ANAMNESIS_V1.sections.flatMap((s) => s.fields)) {
      expect(f.labelKey).toBe(`anamnesis.fields.${f.id}`);
      expect(care.anamnesis.fields[f.id]).toBeTruthy();
    }
  });
});

describe("signing the medical history", () => {
  it("a submission without a valid OTP is rejected", async () => {
    const { token, d } = await upcoming("Nocode");
    const base = { token, answers: ANSWERS, signerName: "Nocode Form", locale: "it" as const, headers: visitor(), now: NOW };
    const { challengeId, code: right } = await code(token);

    // A wrong code, an unknown challenge.
    expect(await submitAnamnesis({ ...base, challengeId, code: right === "000000" ? "111111" : "000000" })).toEqual({ ok: false, reason: "code_invalid" });
    expect(await submitAnamnesis({ ...base, challengeId: "nope", code: right })).toEqual({ ok: false, reason: "code_invalid" });
    // A code for another purpose (privacy center) to the same phone.
    const other = await sendOtp({ purpose: "privacy_center", channel: "sms", to: d.patient.phone!, locale: "it", headers: visitor(), now: NOW });
    expect(other.ok).toBe(true);
    const otherCode = codeIn(sent.at(-1)!.text);
    expect(await submitAnamnesis({ ...base, challengeId: other.ok ? other.challengeId : "", code: otherCode })).toEqual({ ok: false, reason: "code_invalid" });
    // A form-signature code sent to someone else's phone.
    const stranger = await sendOtp({ purpose: "form_signature", channel: "sms", to: "+393400000999", locale: "it", headers: visitor(), now: NOW });
    const strangerCode = codeIn(sent.at(-1)!.text);
    expect(await submitAnamnesis({ ...base, challengeId: stranger.ok ? stranger.challengeId : "", code: strangerCode })).toEqual({
      ok: false,
      reason: "code_invalid",
    });

    const stored = await db
      .select()
      .from(formSubmissions)
      .where(and(eq(formSubmissions.appointmentId, d.appointment.id), isNotNull(formSubmissions.signedAt)));
    expect(stored).toHaveLength(0);
  });

  it("checks the answers before the code, so a mistake doesn't burn it", async () => {
    const { token } = await upcoming("Mistake");
    const c = await code(token);
    const base = { token, signerName: "Mistake Form", locale: "it" as const, headers: visitor(), now: NOW, challengeId: c.challengeId, code: c.code };
    const res = await submitAnamnesis({ ...base, answers: { ...ANSWERS, cardiac: undefined } });
    expect(res).toEqual({ ok: false, reason: "answers", errors: { cardiac: "required" } });
    expect(await submitAnamnesis({ ...base, answers: ANSWERS, signerName: "X" })).toEqual({ ok: false, reason: "signer_required" });
    expect((await submitAnamnesis({ ...base, answers: ANSWERS })).ok).toBe(true);
  });

  it("stores the answers encrypted ('v1:'), with the red flags, the signature and an audit row", async () => {
    const { token, d } = await upcoming("Signed", 10);
    const c = await code(token);
    expect(c.to).toBe(d.patient.phone);
    const res = await submitAnamnesis({ token, answers: ANSWERS, challengeId: c.challengeId, code: c.code, signerName: "Signed Form", locale: "it", headers: visitor(), now: NOW });
    expect(res.ok).toBe(true);
    const id = res.ok ? res.submissionId : "";

    const raw = await client.execute({ sql: "select answers, red_flags from form_submissions where id = ?", args: [id] });
    const answers = String(raw.rows[0].answers);
    expect(answers.startsWith("v1:")).toBe(true);
    expect(answers).not.toContain("Warfarin");
    expect(JSON.parse(String(raw.rows[0].red_flags))).toEqual(["anticoagulants"]);

    const [row] = await db.select().from(formSubmissions).where(eq(formSubmissions.id, id));
    expect(JSON.parse(row.answers)).toEqual(ANSWERS);
    expect(row).toMatchObject({ signerName: "Signed Form", signedVia: "otp_sms", otpChallengeId: c.challengeId, locale: "it", version: "v1", signedAt: NOW });
    const audits = await db.select().from(auditLog).where(and(eq(auditLog.entityType, "form_submission"), eq(auditLog.entityId, id)));
    expect(audits.map((a) => a.action)).toEqual(["form.submit"]);
    // The patient is named for the access log; the answers never are.
    expect(audits[0].metadata).toMatchObject({ patientId: d.patient.id, appointmentId: d.appointment.id, redFlags: 1 });
    expect(JSON.stringify(audits[0].metadata)).not.toContain("Warfarin");

    const status = await anamnesisStatuses(p.orgId, [d.appointment], { ...p.settings.care, anamnesisEnabled: true });
    expect(status.get(d.appointment.id)).toMatchObject({ status: "complete", submissionId: id, redFlags: ["anticoagulants"] });
  });

  it("a reception session sees only the status; an 'anticoagulants: yes' answer shows a red-flag badge on the calendar for clinicians", async () => {
    const { token, d } = await upcoming("Flagged", 11);
    const missing = await upcoming("Missing", 12);
    const c = await code(token);
    const res = await submitAnamnesis({ token, answers: ANSWERS, challengeId: c.challengeId, code: c.code, signerName: "Flagged Form", locale: "it", headers: visitor(), now: NOW });
    expect(res.ok).toBe(true);
    const ids = [d.appointment.id, missing.d.appointment.id];

    const reception = await loadCareFlags(p.orgId, ids, permissionsFor("reception"));
    expect(reception.get(d.appointment.id)).toMatchObject({ anamnesis: "complete", redFlag: null });
    expect(reception.get(missing.d.appointment.id)).toMatchObject({ anamnesis: "missing", redFlag: null });
    const clinician = await loadCareFlags(p.orgId, ids, permissionsFor("practitioner"));
    expect(clinician.get(d.appointment.id)).toMatchObject({ anamnesis: "complete", redFlag: true });
    expect(clinician.get(missing.d.appointment.id)).toMatchObject({ anamnesis: "missing", redFlag: null });

    // The answers: refused to reception (nothing read, nothing logged), audited for the clinician.
    const viewsBefore = await db.select().from(auditLog).where(eq(auditLog.action, "patient.clinical.view"));
    const denied = await clinicalAnamnesis({ orgId: p.orgId, appointmentId: d.appointment.id, permissions: permissionsFor("reception"), actor: { type: "user", id: null } });
    expect(denied).toEqual({ ok: false, reason: "forbidden" });
    expect(await db.select().from(auditLog).where(eq(auditLog.action, "patient.clinical.view"))).toHaveLength(viewsBefore.length);
    const read = await clinicalAnamnesis({ orgId: p.orgId, appointmentId: d.appointment.id, permissions: permissionsFor("practitioner"), actor: { type: "user", id: null } });
    expect(read.ok && read.form.answers.anticoagulants).toBe("yes");
    expect(await db.select().from(auditLog).where(eq(auditLog.action, "patient.clinical.view"))).toHaveLength(viewsBefore.length + 1);
    // Another practice can't read it.
    const other = await createPractice();
    expect(await clinicalAnamnesis({ orgId: other.orgId, submissionId: res.ok ? res.submissionId : "", permissions: permissionsFor("owner"), actor: { type: "user", id: null } })).toEqual({
      ok: false,
      reason: "none",
    });

    // The calendar event.
    const render = (flags: (typeof clinician extends Map<string, infer F> ? F : never)) => {
      const appt: CareAppointment = {
        ...flags,
        id: d.appointment.id,
        status: "scheduled",
        start: d.appointment.startsAt.toISOString(),
        end: d.appointment.endsAt.toISOString(),
        patientId: d.patient.id,
        serviceId: p.visit,
        practitionerId: p.drA,
        isNewPatient: true,
        minorFlag: false,
      };
      return renderToStaticMarkup(h(I18nProvider, { locale: "en", messages: getMessages("en", ["care"]), children: h(CalendarEventBadges, { appt }) }));
    };
    const forClinician = render(clinician.get(d.appointment.id)!);
    expect(forClinician).toContain('data-badge="flag"');
    expect(forClinician).toContain("Medical alert");
    const forReception = render(reception.get(d.appointment.id)!);
    expect(forReception).not.toContain('data-badge="flag"');
    expect(forReception).not.toContain("Medical alert");
    expect(forReception).toContain("Medical history received");
  });
});

describe("the clinical team's side", () => {
  it("every opening is on the patient's access log; a restricted patient's answers need a recent reason", async () => {
    const { token, d } = await upcoming("Riservata", 13);
    const c = await code(token);
    const res = await submitAnamnesis({ token, answers: ANSWERS, challengeId: c.challengeId, code: c.code, signerName: "Riservata Form", locale: "it", headers: visitor(), now: NOW });
    if (!res.ok) throw new Error(res.reason);
    const owner = permissionsFor("owner");
    const actor = { type: "user" as const, id: "user-owner-forms" };
    const views = () =>
      db
        .select()
        .from(auditLog)
        .where(and(eq(auditLog.action, "patient.clinical.view"), eq(auditLog.entityType, "patient"), eq(auditLog.entityId, d.patient.id)));

    expect((await clinicalAnamnesis({ orgId: p.orgId, submissionId: res.submissionId, permissions: owner, actor })).ok).toBe(true);
    const logged = await views();
    expect(logged).toHaveLength(1);
    expect(logged[0].metadata).toMatchObject({ view: "answers", kind: "anamnesis", submissionId: res.submissionId, appointmentId: d.appointment.id });
    expect(JSON.stringify(logged[0].metadata)).not.toContain("Warfarin");

    await db.update(patients).set({ restrictedAt: NOW, restrictionReason: "Art. 18 request" }).where(eq(patients.id, d.patient.id));
    const restricted = { ok: false, reason: "restricted" };
    expect(await clinicalAnamnesis({ orgId: p.orgId, submissionId: res.submissionId, permissions: owner, actor })).toEqual(restricted);
    expect(await clinicalAnamnesis({ orgId: p.orgId, appointmentId: d.appointment.id, permissions: permissionsFor("practitioner"), actor })).toEqual(restricted);
    expect(await markFormExported({ orgId: p.orgId, submissionId: res.submissionId, permissions: owner, actor })).toBe(false);
    // Nothing read, nothing logged.
    expect(await views()).toHaveLength(1);

    await grantRestrictedAccess({ user: { id: actor.id }, org: { id: p.orgId } }, d.patient.id, "Patient in the chair now");
    expect((await clinicalAnamnesis({ orgId: p.orgId, submissionId: res.submissionId, permissions: owner, actor })).ok).toBe(true);
    expect(await views()).toHaveLength(2);
    // The reason is personal: another staff member, or a role without patient.restricted.read, still can't.
    expect(await clinicalAnamnesis({ orgId: p.orgId, submissionId: res.submissionId, permissions: owner, actor: { type: "user", id: "someone-else" } })).toEqual(
      restricted,
    );
    expect(await clinicalAnamnesis({ orgId: p.orgId, submissionId: res.submissionId, permissions: permissionsFor("practitioner"), actor })).toEqual(restricted);
    expect(await markFormExported({ orgId: p.orgId, submissionId: res.submissionId, permissions: owner, actor })).toBe(true);
    const exported = await db.select().from(auditLog).where(and(eq(auditLog.action, "form.export"), eq(auditLog.entityId, res.submissionId)));
    expect(exported.map((r) => [r.actorId, r.metadata?.patientId])).toEqual([[actor.id, d.patient.id]]);
  });
});

describe("invitations", () => {
  it("invite each upcoming visit once, never one with a current form, and only where enabled", async () => {
    const q = await createPractice();
    await db
      .update(organizations)
      .set({ settings: { ...q.settings, care: { ...q.settings.care, anamnesisEnabled: true } } })
      .where(eq(organizations.id, q.orgId));
    const disabled = await createPractice();
    const make = async (practice: typeof q, firstName: string) =>
      createAppointment({
        orgId: practice.orgId,
        serviceId: practice.visit,
        practitionerId: practice.drA,
        locationId: practice.milano,
        startsAt: zonedToUtc(MONDAY, 9 * 60, TZ),
        patient: { firstName, lastName: "Invite", phone: `+39${seq++}`, locale: "it" },
        source: "staff",
        online: false,
        force: true,
        now: NOW,
      });
    const a = await make(q, "Inv");
    await make(disabled, "Off");
    const run = (practice: typeof q) => sendFormInvites(NOW, { orgId: practice.orgId });
    const [x, y] = await Promise.all([run(q), run(q)]);
    expect(x + y).toBe(1);
    expect(await run(q)).toBe(0);
    expect(await run(disabled)).toBe(0);
    const invite = sent.find((m) => m.to === a.patient.phone)!;
    expect(invite.text).toContain(`/a/${manageTokenOf(a.appointment)}/forms/anamnesis`);
    // The invitation row holds no health data and doesn't count as a form.
    const rows = await db.select().from(formSubmissions).where(eq(formSubmissions.appointmentId, a.appointment.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].signedAt).toBeNull();
    expect(rows[0].answers).toBe("{}");
    expect((await anamnesisStatuses(q.orgId, [a.appointment], { ...q.settings.care, anamnesisEnabled: true })).get(a.appointment.id)!.status).toBe("missing");
  });
});
