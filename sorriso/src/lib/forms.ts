import { and, desc, eq, gt, inArray, isNotNull, isNull, lte } from "drizzle-orm";
import { db, type Tx } from "@/db";
import type { AnamnesisStatus } from "@/components/dashboard/slots/contracts";
import {
  appointments,
  formSubmissions,
  formTemplates,
  organizations,
  patients,
  type CareSettings,
  type FormField,
  type FormSchema,
  type FormSubmission,
  type FormTemplate,
  type Locale,
  type SignedVia,
} from "@/db/schema";
import { fmtWhen } from "@/i18n/datefmt";
import { getAppointmentDetails, type AppointmentDetails } from "./appointments";
import { audit, type AuditEvent } from "./audit";
import { absoluteUrl } from "./config";
import { contactHash, isRestricted, markContactVerified, recipientFor, type ContactPatient } from "./contact";
import { newId } from "./ids";
import { manageTokenOf } from "./links";
import { logError, maskEmail, maskPhone } from "./log";
import { sendPatientMessage } from "./messaging";
import { sendOtp, verifyOtp } from "./otp";
import type { Permission } from "./permissions";
import { getCare } from "./privacy/settings";
import { isDateString } from "./time";

/**
 * Digital anamnesis (medical history before the visit), WP8. See docs/care.md for the data flow.
 *
 * - The form is defined by a FormSchema (form_templates). Sorriso's default, DEFAULT_ANAMNESIS_V1,
 *   is created at runtime with org_id NULL; a practice may later add its own. Labels are keys in
 *   the "care" namespace, so the patient reads the form in their own language and the stored
 *   answers are language-neutral codes (plus free text where the form asks for it).
 * - The patient opens it from their appointment link (/{locale}/a/<token>/forms/anamnesis) and
 *   signs it with a simple electronic signature: a one-time code sent to the contact on file
 *   (the guardian's for a child under 14) plus the signer's name.
 * - Answers are stored encrypted (form_submissions.answers, AES-256-GCM: "v1:…"); red flags are
 *   stored beside them as field ids so the calendar can show "medical alert" without decrypting.
 * - Everyone on the team sees whether the form is complete or missing. The red flags and the
 *   answers need patient.clinical.read, and reading the answers is audited (patient.clinical.view).
 * - An unsigned row (signedAt NULL, empty answers) records that an invitation was sent for that
 *   visit, so the scheduled job never invites twice; it holds no health data.
 */

export const DEFAULT_ANAMNESIS_ID = "tpl-anamnesis-default-v1";

/** Sorriso's default medical-history form (dentistry). Field labels: care.anamnesis.fields.<id>. */
export const DEFAULT_ANAMNESIS_V1: FormSchema = {
  version: "v1",
  sections: [
    {
      id: "medications",
      titleKey: "anamnesis.sections.medications",
      fields: [
        { id: "anticoagulants", type: "yesno", labelKey: "anamnesis.fields.anticoagulants", required: true, redFlagIf: "yes" },
        { id: "bisphosphonates", type: "yesno", labelKey: "anamnesis.fields.bisphosphonates", required: true, redFlagIf: "yes" },
        { id: "otherMedication", type: "text", labelKey: "anamnesis.fields.otherMedication" },
      ],
    },
    {
      id: "allergies",
      titleKey: "anamnesis.sections.allergies",
      fields: [
        { id: "allergies", type: "yesno", labelKey: "anamnesis.fields.allergies", required: true, redFlagIf: "yes" },
        { id: "allergiesDetail", type: "text", labelKey: "anamnesis.fields.allergiesDetail" },
      ],
    },
    {
      id: "conditions",
      titleKey: "anamnesis.sections.conditions",
      fields: [
        { id: "cardiac", type: "yesno", labelKey: "anamnesis.fields.cardiac", required: true, redFlagIf: "yes" },
        { id: "diabetes", type: "yesno", labelKey: "anamnesis.fields.diabetes", required: true, redFlagIf: "yes" },
        {
          id: "pregnancy",
          type: "select",
          labelKey: "anamnesis.fields.pregnancy",
          options: ["no", "yes", "not_applicable"],
          required: true,
          redFlagIf: "yes",
        },
      ],
    },
    {
      id: "habits",
      titleKey: "anamnesis.sections.habits",
      fields: [
        { id: "smoking", type: "select", labelKey: "anamnesis.fields.smoking", options: ["never", "former", "current"], required: true },
        { id: "dentalAnxiety", type: "select", labelKey: "anamnesis.fields.dentalAnxiety", options: ["none", "some", "severe"], required: true },
        { id: "notes", type: "text", labelKey: "anamnesis.fields.notes" },
      ],
    },
  ],
};

/** Longest free-text answer kept. */
export const TEXT_ANSWER_MAX = 1000;
/** A signer's name: at least this long (first and last name). */
const SIGNER_MIN = 3;
const SIGNER_MAX = 120;

export type Answers = Record<string, string | string[]>;
export type AnswerError = "required" | "invalid";

export function formFields(schema: FormSchema): FormField[] {
  return schema.sections.flatMap((s) => s.fields);
}

/**
 * Check answers against the schema. yesno: "yes" | "no"; select: one of its options; multiselect:
 * a list of its options; date: YYYY-MM-DD; text: trimmed, at most TEXT_ANSWER_MAX characters.
 * Unknown keys are dropped and empty answers omitted; a required field must be answered.
 */
export function parseAnswers(schema: FormSchema, raw: unknown): { ok: true; answers: Answers } | { ok: false; errors: Record<string, AnswerError> } {
  const input = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const answers: Answers = {};
  const errors: Record<string, AnswerError> = {};
  for (const f of formFields(schema)) {
    const v = input[f.id];
    const empty = v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
    if (empty) {
      if (f.required) errors[f.id] = "required";
      continue;
    }
    switch (f.type) {
      case "yesno":
        if (v === "yes" || v === "no") answers[f.id] = v;
        else errors[f.id] = "invalid";
        break;
      case "select":
        if (typeof v === "string" && f.options?.includes(v)) answers[f.id] = v;
        else errors[f.id] = "invalid";
        break;
      case "multiselect":
        if (Array.isArray(v) && v.every((x) => typeof x === "string" && f.options?.includes(x))) answers[f.id] = [...new Set(v as string[])];
        else errors[f.id] = "invalid";
        break;
      case "date":
        if (isDateString(v)) answers[f.id] = v;
        else errors[f.id] = "invalid";
        break;
      case "text": {
        const text = typeof v === "string" ? v.trim() : "";
        if (text.length > TEXT_ANSWER_MAX) errors[f.id] = "invalid";
        else if (text) answers[f.id] = text;
        else if (f.required) errors[f.id] = "required";
        break;
      }
    }
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, answers };
}

/** The ids of the fields whose answer raises a clinical red flag (e.g. "yes" to anticoagulants). */
export function redFlagsOf(schema: FormSchema, answers: Answers): string[] {
  return formFields(schema)
    .filter((f) => {
      if (f.redFlagIf === undefined) return false;
      const flag = f.redFlagIf === true ? "yes" : f.redFlagIf === false ? "no" : f.redFlagIf;
      const a = answers[f.id];
      return Array.isArray(a) ? a.includes(flag) : a === flag;
    })
    .map((f) => f.id);
}

// ---------------------------------------------------------------- templates

/** Sorriso's default template, created on first use (org_id NULL: shared by every practice). */
export async function ensureDefaultTemplate(tx: Tx = db): Promise<FormTemplate> {
  const [existing] = await tx.select().from(formTemplates).where(eq(formTemplates.id, DEFAULT_ANAMNESIS_ID));
  if (existing) return existing;
  await tx
    .insert(formTemplates)
    .values({ id: DEFAULT_ANAMNESIS_ID, orgId: null, kind: "anamnesis", version: DEFAULT_ANAMNESIS_V1.version, schema: DEFAULT_ANAMNESIS_V1 })
    .onConflictDoNothing();
  const [row] = await tx.select().from(formTemplates).where(eq(formTemplates.id, DEFAULT_ANAMNESIS_ID));
  return row;
}

/** The practice's own active anamnesis template (newest), else Sorriso's default. */
export async function anamnesisTemplate(orgId: string, tx: Tx = db): Promise<FormTemplate> {
  const [own] = await tx
    .select()
    .from(formTemplates)
    .where(and(eq(formTemplates.orgId, orgId), eq(formTemplates.kind, "anamnesis"), eq(formTemplates.active, true)))
    .orderBy(desc(formTemplates.createdAt))
    .limit(1);
  return own ?? ensureDefaultTemplate(tx);
}

// ---------------------------------------------------------------- status

export type AnamnesisInfo = {
  status: AnamnesisStatus | null;
  /** The signed submission that counts for this visit. */
  submissionId: string | null;
  signedAt: Date | null;
  /** Health data: callers show it only to roles with patient.clinical.read. */
  redFlags: string[];
};

/** Months before `date` (calendar months, clamped to the month's length). */
function monthsBefore(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d;
}

/**
 * The anamnesis status of some appointments of one practice:
 *   complete  a signed form for that visit, or one the patient signed within
 *             care.anamnesisRefreshMonths before it (up to the day of the visit);
 *   missing   the practice collects the form online, the visit is upcoming and there is none;
 *   none      the practice collects it, but the visit is past or cancelled;
 *   null      the practice doesn't collect it online and there is no form.
 */
export async function anamnesisStatuses(
  orgId: string,
  appts: readonly { id: string; patientId: string; status: string; startsAt: Date }[],
  care: CareSettings,
  tx: Tx = db,
): Promise<Map<string, AnamnesisInfo>> {
  const out = new Map<string, AnamnesisInfo>();
  if (!appts.length) return out;
  const patientIds = [...new Set(appts.map((a) => a.patientId))];
  const subs: Pick<FormSubmission, "id" | "patientId" | "appointmentId" | "signedAt" | "redFlags">[] = [];
  for (let i = 0; i < patientIds.length; i += 400) {
    subs.push(
      ...(await tx
        .select({
          id: formSubmissions.id,
          patientId: formSubmissions.patientId,
          appointmentId: formSubmissions.appointmentId,
          signedAt: formSubmissions.signedAt,
          redFlags: formSubmissions.redFlags,
        })
        .from(formSubmissions)
        .where(
          and(
            eq(formSubmissions.orgId, orgId),
            inArray(formSubmissions.patientId, patientIds.slice(i, i + 400)),
            isNotNull(formSubmissions.signedAt),
          ),
        )
        .orderBy(desc(formSubmissions.signedAt))),
    );
  }
  for (const a of appts) {
    const from = monthsBefore(a.startsAt, care.anamnesisRefreshMonths).getTime();
    const until = a.startsAt.getTime() + 86_400_000;
    const sub =
      subs.find((s) => s.appointmentId === a.id) ??
      subs.find((s) => s.patientId === a.patientId && s.signedAt!.getTime() >= from && s.signedAt!.getTime() <= until);
    if (sub) {
      out.set(a.id, { status: "complete", submissionId: sub.id, signedAt: sub.signedAt, redFlags: sub.redFlags });
      continue;
    }
    const upcoming = a.status === "scheduled" || a.status === "requested";
    out.set(a.id, {
      status: care.anamnesisEnabled ? (upcoming ? "missing" : "none") : null,
      submissionId: null,
      signedAt: null,
      redFlags: [],
    });
  }
  return out;
}

// ---------------------------------------------------------------- the patient's side

/** Where the signature code goes: the phone on file, else the email (the guardian's for a child under 14). */
export function signatureContact(p: ContactPatient, now: Date = new Date()): { channel: "sms" | "email"; to: string } | null {
  const r = recipientFor(p, now);
  if (r.phone) return { channel: "sms", to: r.phone };
  if (r.email) return { channel: "email", to: r.email };
  return null;
}

export type FormAccess =
  | {
      ok: true;
      d: AppointmentDetails;
      template: FormTemplate;
      /** The form already counting for this visit, if any (the patient may send an update). */
      current: { signedAt: Date } | null;
      /** Masked destination of the signature code, e.g. "+39•••4567"; null when there is no contact. */
      contactHint: { channel: "sms" | "email"; masked: string } | null;
    }
  | { ok: false; reason: "invalid" | "closed" | "disabled" | "restricted" };

/**
 * May the holder of this appointment link fill in the form now? Only for an upcoming visit, at a
 * practice that collects the form online, for a patient whose data is not restricted.
 */
export async function anamnesisAccess(token: string, now: Date = new Date()): Promise<FormAccess> {
  const d = await getAppointmentDetails({ token });
  if (!d) return { ok: false, reason: "invalid" };
  if (isRestricted(d.patient)) return { ok: false, reason: "restricted" };
  if (!["scheduled", "requested"].includes(d.appointment.status)) return { ok: false, reason: "closed" };
  const care = getCare(d.org);
  if (!care.anamnesisEnabled) return { ok: false, reason: "disabled" };
  const template = await anamnesisTemplate(d.org.id);
  const info = (await anamnesisStatuses(d.org.id, [d.appointment], care)).get(d.appointment.id);
  const contact = signatureContact(d.patient, now);
  return {
    ok: true,
    d,
    template,
    current: info?.status === "complete" && info.signedAt ? { signedAt: info.signedAt } : null,
    contactHint: contact ? { channel: contact.channel, masked: contact.channel === "sms" ? maskPhone(contact.to) : maskEmail(contact.to) } : null,
  };
}

export type StartSignatureResult =
  | { ok: true; challengeId: string; channel: "sms" | "email"; masked: string }
  | { ok: false; reason: "invalid" | "closed" | "disabled" | "restricted" | "no_contact" | "rate_limited" };

/** Send the signature code to the contact on file (sendOtp, purpose form_signature). */
export async function startFormSignature(i: { token: string; locale: Locale; headers: Headers; now?: Date }): Promise<StartSignatureResult> {
  const now = i.now ?? new Date();
  const access = await anamnesisAccess(i.token, now);
  if (!access.ok) return access;
  const contact = signatureContact(access.d.patient, now);
  if (!contact) return { ok: false, reason: "no_contact" };
  const sent = await sendOtp({
    purpose: "form_signature",
    channel: contact.channel,
    to: contact.to,
    locale: i.locale,
    orgId: access.d.org.id,
    fromName: access.d.org.name,
    headers: i.headers,
    now,
  });
  if (!sent.ok) return { ok: false, reason: "rate_limited" };
  return {
    ok: true,
    challengeId: sent.challengeId,
    channel: contact.channel,
    masked: contact.channel === "sms" ? maskPhone(contact.to) : maskEmail(contact.to),
  };
}

export type SubmitAnamnesisInput = {
  token: string;
  answers: unknown;
  challengeId: string;
  code: string;
  signerName: string;
  /** The language the form was shown in (proof of what was signed). */
  locale: Locale;
  headers?: Headers;
  now?: Date;
};

export type SubmitAnamnesisResult =
  | { ok: true; submissionId: string; signedAt: Date }
  | { ok: false; reason: "invalid" | "closed" | "disabled" | "restricted" | "no_contact" | "signer_required" | "code_invalid" | "code_expired" | "too_many_attempts" }
  | { ok: false; reason: "answers"; errors: Record<string, AnswerError> };

/**
 * Store a signed medical history. The answers are checked first (so a mistake doesn't burn the
 * code), then the code: it must be a form_signature code sent to the contact on file for this
 * patient. The answers go into the encrypted column, the red flags beside them; an invitation row
 * for the visit is filled in rather than duplicated. Audited as patient.update on the submission.
 */
export async function submitAnamnesis(i: SubmitAnamnesisInput): Promise<SubmitAnamnesisResult> {
  const now = i.now ?? new Date();
  const access = await anamnesisAccess(i.token, now);
  if (!access.ok) return access;
  const { d, template } = access;
  const parsed = parseAnswers(template.schema, i.answers);
  if (!parsed.ok) return { ok: false, reason: "answers", errors: parsed.errors };
  const signerName = i.signerName.replace(/\s+/g, " ").trim();
  if (signerName.length < SIGNER_MIN || signerName.length > SIGNER_MAX) return { ok: false, reason: "signer_required" };
  const contact = signatureContact(d.patient, now);
  if (!contact) return { ok: false, reason: "no_contact" };

  const check = await verifyOtp({ challengeId: i.challengeId, code: i.code, purpose: "form_signature", now });
  if (!check.ok) {
    return { ok: false, reason: check.reason === "expired" ? "code_expired" : check.reason === "too_many_attempts" ? "too_many_attempts" : "code_invalid" };
  }
  const kind = contact.channel === "sms" ? "phone" : "email";
  // The code must have gone to this patient's contact on file, not to any number the requester chose.
  if (check.targetHash !== contactHash(kind, contact.to)) return { ok: false, reason: "code_invalid" };

  const redFlags = redFlagsOf(template.schema, parsed.answers);
  const signedVia: SignedVia = contact.channel === "sms" ? "otp_sms" : "otp_email";
  const values = {
    templateId: template.id,
    version: template.version,
    locale: i.locale,
    answers: JSON.stringify(parsed.answers),
    redFlags,
    signerName,
    signedAt: now,
    signedVia,
    otpChallengeId: i.challengeId,
  };
  const submissionId = await db.transaction(async (tx) => {
    const [invitation] = await tx
      .select({ id: formSubmissions.id })
      .from(formSubmissions)
      .where(
        and(
          eq(formSubmissions.orgId, d.org.id),
          eq(formSubmissions.patientId, d.patient.id),
          eq(formSubmissions.appointmentId, d.appointment.id),
          isNull(formSubmissions.signedAt),
        ),
      )
      .limit(1);
    let id: string;
    if (invitation) {
      id = invitation.id;
      await tx.update(formSubmissions).set(values).where(and(eq(formSubmissions.id, id), eq(formSubmissions.orgId, d.org.id)));
    } else {
      id = newId();
      await tx.insert(formSubmissions).values({ id, orgId: d.org.id, patientId: d.patient.id, appointmentId: d.appointment.id, ...values, createdAt: now });
    }
    await audit(
      {
        orgId: d.org.id,
        actor: { type: "patient_link", id: d.appointment.id },
        action: "patient.update",
        entity: { type: "form_submission", id },
        metadata: { appointmentId: d.appointment.id, kind: "anamnesis", version: template.version, redFlags: redFlags.length, signedVia },
        headers: i.headers,
        at: now,
      },
      tx,
    );
    return id;
  });
  // The code proved this contact reaches the patient (an explicit act through it).
  await markContactVerified(d.patient.id, { kind, value: contact.to }, db, now).catch((err) =>
    logError("care", err, { step: "form-verify-contact", appointmentId: d.appointment.id }),
  );
  return { ok: true, submissionId, signedAt: now };
}

/** For the manage page's card: the form's status for this visit and whether it can be filled in now. */
export async function formStatusForToken(
  token: string,
  now: Date = new Date(),
): Promise<{ status: AnamnesisStatus | null; signedAt: Date | null; canFill: boolean } | null> {
  const d = await getAppointmentDetails({ token });
  if (!d) return null;
  const care = getCare(d.org);
  const info = (await anamnesisStatuses(d.org.id, [d.appointment], care)).get(d.appointment.id);
  const open =
    care.anamnesisEnabled && !isRestricted(d.patient) && ["scheduled", "requested"].includes(d.appointment.status) && d.appointment.startsAt > now;
  return { status: info?.status ?? null, signedAt: info?.signedAt ?? null, canFill: open };
}

// ---------------------------------------------------------------- invitations

/** The link in invitations: short and unprefixed (the /a/<token>/... redirect adds the language). */
export function anamnesisUrl(token: string): string {
  return absoluteUrl(`/a/${token}/forms/anamnesis`);
}

/** Invite for visits starting between these offsets from now. */
const INVITE_FROM_MS = 2 * 3_600_000;
const INVITE_UNTIL_MS = 7 * 86_400_000;

/**
 * Record the invitation (an unsigned row for the visit) unless one exists; inside one write
 * transaction, so two job runners can't both claim it. Returns false when already invited.
 */
async function claimInvitation(orgId: string, patientId: string, appointmentId: string, now: Date, force = false): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: formSubmissions.id })
      .from(formSubmissions)
      .where(and(eq(formSubmissions.orgId, orgId), eq(formSubmissions.appointmentId, appointmentId)))
      .limit(1);
    if (existing) return force;
    const template = await anamnesisTemplate(orgId, tx);
    await tx.insert(formSubmissions).values({
      id: newId(),
      orgId,
      patientId,
      appointmentId,
      templateId: template.id,
      version: template.version,
      locale: "it",
      answers: "{}",
      redFlags: [],
      createdAt: now,
    });
    return true;
  });
}

async function sendInvite(d: AppointmentDetails, now: Date): Promise<boolean> {
  const token = manageTokenOf(d.appointment);
  if (!token) return false;
  const to = recipientFor(d.patient, now);
  const url = anamnesisUrl(token);
  const res = await sendPatientMessage({
    orgId: d.org.id,
    patient: d.patient,
    ns: "careMessages",
    kind: "anamnesisInvite",
    vars: { clinic: d.org.name, when: fmtWhen(d.appointment.startsAt, d.location.timezone, to.locale), url },
    url,
    appointmentId: d.appointment.id,
    now,
  });
  return res.ok && res.message.status !== "failed";
}

/**
 * Invite patients to fill in the form before upcoming visits (runCareJobs): practices with
 * care.anamnesisEnabled, scheduled visits starting in 2 hours to 7 days, patients without a form
 * within care.anamnesisRefreshMonths. Each visit is invited at most once. Returns the invitations sent.
 */
export async function sendFormInvites(now: Date = new Date(), opts: { limit?: number; orgId?: string } = {}): Promise<number> {
  const orgs = (
    await db
      .select({ id: organizations.id, settings: organizations.settings })
      .from(organizations)
      .where(opts.orgId ? eq(organizations.id, opts.orgId) : undefined)
  ).filter((o) => getCare(o).anamnesisEnabled);
  let sent = 0;
  let budget = opts.limit ?? 200;
  for (const org of orgs) {
    if (budget <= 0) break;
    const care = getCare(org);
    const rows = await db
      .select({ id: appointments.id, patientId: appointments.patientId, status: appointments.status, startsAt: appointments.startsAt })
      .from(appointments)
      .innerJoin(patients, eq(patients.id, appointments.patientId))
      .where(
        and(
          eq(appointments.orgId, org.id),
          eq(appointments.status, "scheduled"),
          gt(appointments.startsAt, new Date(now.getTime() + INVITE_FROM_MS)),
          lte(appointments.startsAt, new Date(now.getTime() + INVITE_UNTIL_MS)),
          isNull(patients.restrictedAt),
          isNull(patients.erasedAt),
        ),
      )
      .limit(budget);
    const statuses = await anamnesisStatuses(org.id, rows, care);
    for (const r of rows) {
      if (statuses.get(r.id)?.status !== "missing") continue;
      budget--;
      try {
        if (!(await claimInvitation(org.id, r.patientId, r.id, now))) continue;
        const d = await getAppointmentDetails({ id: r.id });
        if (d && (await sendInvite(d, now))) sent++;
      } catch (err) {
        logError("care", err, { step: "form-invite", appointmentId: r.id });
      }
    }
  }
  return sent;
}

/** Staff "send the form link now" for one visit (it may repeat an earlier invitation). */
export async function inviteNow(orgId: string, appointmentId: string, now: Date = new Date()): Promise<"sent" | "not_sent" | "closed"> {
  const d = await getAppointmentDetails({ id: appointmentId });
  if (!d || d.org.id !== orgId) return "closed";
  if (!getCare(d.org).anamnesisEnabled || !["scheduled", "requested"].includes(d.appointment.status) || d.appointment.startsAt <= now) {
    return "closed";
  }
  await claimInvitation(orgId, d.patient.id, d.appointment.id, now, true);
  return (await sendInvite(d, now)) ? "sent" : "not_sent";
}

// ---------------------------------------------------------------- the clinical team's side

export type ClinicalAnamnesis = {
  id: string;
  version: string;
  locale: Locale;
  signedAt: Date;
  signerName: string | null;
  signedVia: SignedVia | null;
  exportedAt: Date | null;
  redFlags: string[];
  answers: Answers;
  schema: FormSchema;
  patient: { firstName: string; lastName: string; birthDate: string | null };
  appointment: { id: string; startsAt: Date } | null;
};

function decodeAnswers(raw: string): Answers {
  try {
    const v = JSON.parse(raw) as unknown;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Answers) : {};
  } catch {
    return {};
  }
}

/** Clinical content (answers, red flags) is for roles with this permission only. */
export const CLINICAL_PERMISSION: Permission = "patient.clinical.read";

/**
 * The answers of a signed form, for the clinical team. Needs patient.clinical.read ("forbidden"
 * otherwise, nothing read or logged) and is audited as patient.clinical.view. Pass the submission,
 * or an appointment to get the form that counts for that visit. "none" when there is no form.
 * (No PermissionError here: this module also runs in scripts, where src/lib/auth.ts can't load.)
 */
export async function clinicalAnamnesis(i: {
  orgId: string;
  submissionId?: string;
  appointmentId?: string;
  permissions: readonly Permission[];
  actor: AuditEvent["actor"];
  headers?: Headers;
}): Promise<{ ok: true; form: ClinicalAnamnesis } | { ok: false; reason: "forbidden" | "none" }> {
  if (!i.permissions.includes(CLINICAL_PERMISSION)) return { ok: false, reason: "forbidden" };
  let submissionId = i.submissionId ?? null;
  if (!submissionId && i.appointmentId) {
    const [a] = await db
      .select({ id: appointments.id, patientId: appointments.patientId, status: appointments.status, startsAt: appointments.startsAt, settings: organizations.settings })
      .from(appointments)
      .innerJoin(organizations, eq(organizations.id, appointments.orgId))
      .where(and(eq(appointments.id, i.appointmentId), eq(appointments.orgId, i.orgId)));
    if (!a) return { ok: false, reason: "none" };
    submissionId = (await anamnesisStatuses(i.orgId, [a], getCare({ settings: a.settings }))).get(a.id)?.submissionId ?? null;
  }
  if (!submissionId) return { ok: false, reason: "none" };
  const [row] = await db
    .select({ s: formSubmissions, t: formTemplates, p: patients, a: appointments })
    .from(formSubmissions)
    .innerJoin(formTemplates, eq(formTemplates.id, formSubmissions.templateId))
    .innerJoin(patients, eq(patients.id, formSubmissions.patientId))
    .leftJoin(appointments, eq(appointments.id, formSubmissions.appointmentId))
    .where(and(eq(formSubmissions.id, submissionId), eq(formSubmissions.orgId, i.orgId), isNotNull(formSubmissions.signedAt)));
  if (!row) return { ok: false, reason: "none" };
  await audit({
    orgId: i.orgId,
    actor: i.actor,
    action: "patient.clinical.view",
    entity: { type: "form_submission", id: row.s.id },
    metadata: { patientId: row.p.id, kind: "anamnesis" },
    headers: i.headers,
  });
  const form: ClinicalAnamnesis = {
    id: row.s.id,
    version: row.s.version,
    locale: row.s.locale,
    signedAt: row.s.signedAt!,
    signerName: row.s.signerName,
    signedVia: row.s.signedVia,
    exportedAt: row.s.exportedAt,
    redFlags: row.s.redFlags,
    answers: decodeAnswers(row.s.answers),
    schema: row.t.schema,
    patient: { firstName: row.p.firstName, lastName: row.p.lastName, birthDate: row.p.birthDate },
    appointment: row.a ? { id: row.a.id, startsAt: row.a.startsAt } : null,
  };
  return { ok: true, form };
}

/**
 * Record that the form was added to the practice's clinical record (printed or copied into it):
 * retention may delete a form only after that. Needs patient.clinical.read. Returns false when
 * the viewer lacks it or there is no such signed form.
 */
export async function markFormExported(i: {
  orgId: string;
  submissionId: string;
  permissions: readonly Permission[];
  actor: AuditEvent["actor"];
  now?: Date;
}): Promise<boolean> {
  if (!i.permissions.includes(CLINICAL_PERMISSION)) return false;
  const now = i.now ?? new Date();
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(formSubmissions)
      .set({ exportedAt: now })
      .where(and(eq(formSubmissions.id, i.submissionId), eq(formSubmissions.orgId, i.orgId), isNotNull(formSubmissions.signedAt)))
      .returning({ id: formSubmissions.id, patientId: formSubmissions.patientId });
    if (!row) return false;
    await audit(
      {
        orgId: i.orgId,
        actor: i.actor,
        action: "patient.update",
        entity: { type: "form_submission", id: row.id },
        metadata: { patientId: row.patientId, exported: true },
        at: now,
      },
      tx,
    );
    return true;
  });
}

export type SubmissionSummary = {
  id: string;
  version: string;
  locale: Locale;
  signedAt: Date;
  signerName: string | null;
  exportedAt: Date | null;
  appointmentId: string | null;
  /** null unless the viewer has patient.clinical.read. */
  redFlags: string[] | null;
};

/** A patient's signed forms (newest first), for the patient page. No answers. */
export async function listSubmissions(orgId: string, patientId: string, clinical: boolean, tx: Tx = db): Promise<SubmissionSummary[]> {
  const rows = await tx
    .select()
    .from(formSubmissions)
    .where(and(eq(formSubmissions.orgId, orgId), eq(formSubmissions.patientId, patientId), isNotNull(formSubmissions.signedAt)))
    .orderBy(desc(formSubmissions.signedAt))
    .limit(50);
  return rows.map((s) => ({
    id: s.id,
    version: s.version,
    locale: s.locale,
    signedAt: s.signedAt!,
    signerName: s.signerName,
    exportedAt: s.exportedAt,
    appointmentId: s.appointmentId,
    redFlags: clinical ? s.redFlags : null,
  }));
}

// ---------------------------------------------------------------- patient-link pages

/**
 * Link-preview fetchers and crawlers. The care pages under /a/<token> (forms, rebook) show them a
 * page with no appointment data and don't count them against the patient's rate limit, like the
 * manage page.
 */
const PREVIEW_BOT =
  /facebookexternalhit|facebot|whatsapp\/|telegrambot|slackbot|slack-imgproxy|twitterbot|linkedinbot|discordbot|skypeuripreview|microsoftpreview|teamsbot|applebot|googlebot|google-inspectiontool|bingbot|bingpreview|yandexbot|duckduckbot|pinterestbot|redditbot|embedly|iframely|vkshare|mastodon\/|bitlybot|quora link preview/i;

export function isPreviewBot(userAgent: string | null): boolean {
  return PREVIEW_BOT.test(userAgent ?? "");
}

/** The shape of a manage token; anything else is not looked up. */
export const TOKEN_SHAPE = /^[A-Za-z0-9_-]{8,128}$/;
