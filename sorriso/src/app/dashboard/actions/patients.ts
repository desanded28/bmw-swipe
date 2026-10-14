"use server";

import { and, asc, count, eq, isNull, like, or, sql, type SQL } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/db";
import { CONSENT_PURPOSES, type ConsentPurpose } from "@/db/enums";
import { patients } from "@/db/schema";
import { DEFAULT_LOCALE, isLocale } from "@/i18n/config";
import { fmtDay, zonedDate } from "@/i18n/datefmt";
import { getStaffLocale, getT } from "@/i18n/server";
import { auditStaff } from "@/lib/audit";
import { requireStepUp, type StaffSession } from "@/lib/auth";
import { isRestricted } from "@/lib/contact";
import { can } from "@/lib/permissions";
import { ConsentError, currentConsents, recordConsent, withdrawConsent } from "@/lib/privacy/consent";
import { ErasureError, erasePatient, grantRestrictedAccess, hasRestrictedAccess, restrictPatient, unrestrictPatient } from "@/lib/privacy/erasure";
import { isStepUpRequired } from "@/lib/privacy/gates";
import { isPlatformConsentPurpose } from "@/lib/privacy/roles";
import { formatPhone, normalizePhone } from "@/lib/phone";
import { fail, guard, ok, optional, staff, str, type ActionResult } from "./_shared";

/**
 * Patient records (WP5): the list and its search, the record's details and notes, and the data
 * protection actions on it (restriction, erasure, consents recorded on the patient's behalf).
 *
 * Messages are in the staff member's language. Domain errors come back as fail(text, code) with
 * the code of the privacyAdmin.patient.errors key.
 */

type T = ReturnType<typeof getT<"privacyAdmin">>;
/** The staff member's language (outside a request, e.g. in tests: the default). */
const staffLocale = () => getStaffLocale().catch(() => DEFAULT_LOCALE);
const tr = async (): Promise<T> => getT(await staffLocale(), "privacyAdmin");

/** A domain error as an ActionResult; anything else is rethrown for guard(). */
function domainFail(err: unknown, t: T): ActionResult {
  if (err instanceof ErasureError) return fail(t(`patient.errors.${err.code}`), err.code);
  if (err instanceof ConsentError) {
    return err.code === "guardian_required" ? fail(t("patient.errors.guardian_required"), err.code) : fail(t("patient.errors.not_found"), "not_found");
  }
  throw err;
}

/** null when the second factor is fresh; a failed result asking for it otherwise. */
async function stepUp(t: T): Promise<ActionResult | null> {
  try {
    await requireStepUp();
    return null;
  } catch (err) {
    if (isStepUpRequired(err)) return fail(t("errors.stepUp"), "step_up_required");
    throw err;
  }
}

/**
 * A restricted record may be acted on only by someone who gave a reason to open it in the last
 * minutes (patient.restricted_access); null when that holds or the record isn't restricted.
 */
async function restrictedGate(s: StaffSession, p: { id: string; restrictedAt: Date | null; erasedAt: Date | null }, t: T): Promise<ActionResult | null> {
  if (!isRestricted(p)) return null;
  if (can(s.role, "patient.restricted.read") && (await hasRestrictedAccess(s, p.id))) return null;
  return fail(t("patient.errors.reason_required"), "restricted_reason_required");
}

async function ownPatient(s: StaffSession, id: string) {
  const [p] = await db
    .select()
    .from(patients)
    .where(and(eq(patients.orgId, s.org.id), eq(patients.id, id)));
  return p ?? null;
}

// ---------------------------------------------------------------- list and search

/** A row of the patients list, formatted for the viewer (names masked for restricted records they can't open). */
export type PatientRow = {
  id: string;
  /** null = restricted record the viewer may not see: show the placeholder. */
  name: string | null;
  restricted: boolean;
  erased: boolean;
  phone: string | null;
  email: string | null;
  next: string | null;
  last: string | null;
  visits: number;
  noShows: number;
};

export type PatientPage = { rows: PatientRow[]; total: number; page: number; pages: number };

const PAGE = 50;
// Qualified: drizzle writes a single-table select's columns unqualified, which a correlated
// subquery would resolve against its own table.
const PATIENT_ID = sql.raw(`"patients"."id"`);

function searchFilter(q: string): SQL | undefined {
  const term = q.trim().toLowerCase();
  if (!term) return undefined;
  const words = term.split(/\s+/).filter(Boolean).slice(0, 5);
  const digits = term.replace(/\D/g, "");
  return or(
    and(...words.map((w) => or(like(sql`lower(${patients.firstName})`, `%${w}%`), like(sql`lower(${patients.lastName})`, `%${w}%`)))),
    digits.length >= 3 ? like(patients.phone, `%${digits}%`) : undefined,
    term.includes("@") || term.length >= 3 ? like(sql`lower(${patients.email})`, `%${term}%`) : undefined,
  );
}

/**
 * The patients list, one page at a time. With a search term it is a POST server action, so names
 * never reach the URL, the browser history or server logs. Every call is audited as
 * patient.search with the number of results only (never the term).
 */
export async function listPatientRows(q: string, page = 1): Promise<PatientPage> {
  const s = await staff("patient.read");
  const term = String(q ?? "").slice(0, 100);
  const where = and(eq(patients.orgId, s.org.id), isNull(patients.mergedIntoId), searchFilter(term));
  const current = Math.max(1, Math.floor(Number(page)) || 1);
  const now = Date.now();
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        p: patients,
        next: sql<number | null>`(select min(a.starts_at) from appointments a where a.patient_id = ${PATIENT_ID} and a.starts_at > ${now} and a.status in ('scheduled','requested'))`,
        last: sql<number | null>`(select max(a.starts_at) from appointments a where a.patient_id = ${PATIENT_ID} and a.status = 'completed')`,
        visits: sql<number>`(select count(*) from appointments a where a.patient_id = ${PATIENT_ID} and a.status = 'completed')`,
      })
      .from(patients)
      .where(where)
      .orderBy(asc(patients.lastName), asc(patients.firstName))
      .limit(PAGE)
      .offset((current - 1) * PAGE),
    db.select({ total: count() }).from(patients).where(where),
  ]);
  // Every look at the list is a read of patient data: audited with counts only, never the term.
  await auditStaff(s, "patient.search", undefined, { metadata: { results: total, page: current, search: Boolean(term.trim()) } });

  const locale = await staffLocale();
  const tz = s.org.timezone;
  const day = (ms: number | null) => (ms ? fmtDay(zonedDate(new Date(ms), tz), "short", locale) : null);
  const seeRestricted = can(s.role, "patient.restricted.read");
  const seeContacts = can(s.role, "patient.contact.read");
  return {
    total,
    page: current,
    pages: Math.max(1, Math.ceil(total / PAGE)),
    rows: rows.map(({ p, next, last, visits }) => {
      const hidden = isRestricted(p) && !seeRestricted;
      return {
        id: p.id,
        name: hidden ? null : `${p.lastName} ${p.firstName}`,
        restricted: Boolean(p.restrictedAt),
        erased: Boolean(p.erasedAt),
        phone: hidden || !seeContacts ? null : p.phone ? formatPhone(p.phone) : null,
        email: hidden || !seeContacts ? null : p.email,
        next: hidden ? null : day(next),
        last: hidden ? null : day(last),
        visits: hidden ? 0 : visits,
        noShows: hidden ? 0 : p.noShowCount,
      };
    }),
  };
}

/**
 * Patient lookup for the new-appointment drawer (8 matches by name, phone digits or email).
 * Erased records are left out; restricted ones are masked for staff without
 * patient.restricted.read (and flagged, so the drawer can ask for a reason). Audited as
 * patient.search without the term.
 */
export async function searchPatients(q: string) {
  const s = await staff("patient.read");
  const term = String(q ?? "").trim().slice(0, 100);
  if (term.length < 2) return [];
  const rows = await db
    .select({
      id: patients.id,
      firstName: patients.firstName,
      lastName: patients.lastName,
      phone: patients.phone,
      email: patients.email,
      noShowCount: patients.noShowCount,
      restrictedAt: patients.restrictedAt,
    })
    .from(patients)
    .where(and(eq(patients.orgId, s.org.id), isNull(patients.erasedAt), isNull(patients.mergedIntoId), searchFilter(term)))
    .orderBy(asc(patients.lastName))
    .limit(8);
  await auditStaff(s, "patient.search", undefined, { metadata: { results: rows.length, lookup: true } });
  const seeRestricted = can(s.role, "patient.restricted.read");
  const placeholder = (await tr())("patients.restrictedName");
  return rows.map(({ restrictedAt, ...r }) =>
    restrictedAt && !seeRestricted
      ? { ...r, firstName: placeholder, lastName: "", phone: null, email: null, noShowCount: 0, restricted: true }
      : { ...r, restricted: Boolean(restrictedAt) },
  );
}

// ---------------------------------------------------------------- details

const TEXT_CHANNELS = { sms: "sms_channel", email: "email_channel" } as const;

/**
 * Save identity and contacts (any member who can read the record). Restricted records are read-only. Turning a channel
 * on for a patient who opted out needs a typed reason and writes a staff-recorded consent row;
 * turning one off writes the withdrawal, so the ledger and the cached flags stay in step.
 * Choosing WhatsApp records the patient's consent to it (otherwise reminders keep going by SMS).
 */
export async function updatePatient(id: string, _prev: unknown, fd: FormData): Promise<ActionResult> {
  return guard(
    async (s) => {
      const t = await tr();
      const p = await ownPatient(s, id);
      if (!p) return fail(t("patient.errors.not_found"), "not_found");
      if (isRestricted(p)) return fail(t("patient.errors.restricted_readonly"), "restricted");

      const firstName = str(fd, "firstName").slice(0, 80);
      const lastName = str(fd, "lastName").slice(0, 80);
      if (!firstName || !lastName) return fail(t("patient.errors.name_required"), "invalid");
      const phoneRaw = str(fd, "phone");
      const phone = phoneRaw ? normalizePhone(phoneRaw) : null;
      if (phoneRaw && !phone) return fail(t("patient.errors.invalid_phone"), "invalid_phone");
      const email = str(fd, "email").toLowerCase() || null;
      if (email && !z.email().safeParse(email).success) return fail(t("patient.errors.invalid_email"), "invalid_email");
      const birthDate = optional(fd, "birthDate");
      if (birthDate && !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return fail(t("errors.invalid"), "invalid");
      const locale = str(fd, "locale");
      const channel = str(fd, "preferredChannel");
      const preferredChannel = channel === "whatsapp" || channel === "email" || channel === "sms" ? channel : p.preferredChannel;
      const ledger = await currentConsents(p.id);
      const optedOut = { sms: !p.smsOptIn || ledger.sms_channel?.granted === false, email: !p.emailOptIn || ledger.email_channel?.granted === false };
      // The channel checkboxes count only when the form had them (unticked boxes send nothing).
      const withChannels = fd.get("channels") === "1";
      const wants = withChannels
        ? { sms: fd.get("smsOptIn") === "on", email: fd.get("emailOptIn") === "on" }
        : { sms: !optedOut.sms, email: !optedOut.email };
      const reason = str(fd, "optInReason").slice(0, 300);

      const reEnabling = (["sms", "email"] as const).filter((c) => wants[c] && optedOut[c]);
      const whatsappBack = preferredChannel === "whatsapp" && ledger.whatsapp_channel?.granted === false;
      if ((reEnabling.length || whatsappBack) && reason.length < 3) return fail(t("patient.errors.optin_reason_required"), "optin_reason_required");

      const recordedLocale = isLocale(locale) ? locale : p.locale;
      const base = {
        orgId: s.org.id,
        patientId: p.id,
        locale: recordedLocale,
        method: "staff_recorded" as const,
        source: "staff" as const,
        actorRelation: "staff" as const,
        actorUserId: s.user.id,
      };
      try {
        await db.transaction(async (tx) => {
          await tx
            .update(patients)
            .set({ firstName, lastName, phone, email, birthDate, ...(isLocale(locale) ? { locale } : {}), preferredChannel })
            .where(and(eq(patients.id, p.id), eq(patients.orgId, s.org.id)));
          for (const c of ["sms", "email"] as const) {
            const current = !optedOut[c];
            if (wants[c] === current) continue;
            if (wants[c]) await recordConsent(tx, { ...base, purpose: TEXT_CHANNELS[c], granted: true });
            else await withdrawConsent(tx, { ...base, purpose: TEXT_CHANNELS[c] });
          }
          if (preferredChannel === "whatsapp" && ledger.whatsapp_channel?.granted !== true) {
            await recordConsent(tx, { ...base, purpose: "whatsapp_channel", granted: true });
          }
          await auditStaff(
            s,
            "patient.update",
            { type: "patient", id: p.id },
            { reason: reEnabling.length || whatsappBack ? reason : null, metadata: { reEnabled: [...reEnabling, ...(whatsappBack ? ["whatsapp"] : [])].join(",") || null } },
            tx,
          );
        });
      } catch (err) {
        return domainFail(err, t);
      }
      return ok(t("patient.saved"));
    },
    // Every member who can see the record may correct its details (accuracy, Art. 5(1)(d));
    // each change is audited with what was re-enabled and why.
    { permission: "patient.read" },
  );
}

/** The practice's notes about the patient (clinicians and managers: patient.notes.read). */
export async function updatePatientNotes(id: string, _prev: unknown, fd: FormData): Promise<ActionResult> {
  return guard(
    async (s) => {
      const t = await tr();
      const p = await ownPatient(s, id);
      if (!p) return fail(t("patient.errors.not_found"), "not_found");
      if (isRestricted(p)) return fail(t("patient.errors.restricted_readonly"), "restricted");
      await db
        .update(patients)
        .set({ notes: optional(fd, "notes")?.slice(0, 4000) ?? null })
        .where(and(eq(patients.id, p.id), eq(patients.orgId, s.org.id)));
      return ok(t("patient.notesSaved"));
    },
    { permission: "patient.notes.read", audit: "patient.update", entity: { type: "patient", id } },
  );
}

// ---------------------------------------------------------------- restricted records

/** Give the reason for opening a restricted record (audited as patient.restricted_access). */
export async function openRestrictedRecord(id: string, _prev: unknown, fd: FormData): Promise<ActionResult> {
  return guard(
    async (s) => {
      const t = await tr();
      try {
        await grantRestrictedAccess(s, id, str(fd, "reason").slice(0, 500), { headers: await headers() });
      } catch (err) {
        return domainFail(err, t);
      }
      return ok();
    },
    { permission: "patient.restricted.read" },
  );
}

export async function restrictPatientAction(id: string, _prev: unknown, fd: FormData): Promise<ActionResult> {
  return guard(
    async (s) => {
      const t = await tr();
      const retainUntil = optional(fd, "retainUntil");
      try {
        await restrictPatient(s.org.id, id, { reason: str(fd, "reason").slice(0, 500), retainUntil, actor: { type: "user", id: s.user.id }, headers: await headers() });
      } catch (err) {
        return domainFail(err, t);
      }
      return ok(t("privacy.restricted"));
    },
    { permission: "patient.restrict" },
  );
}

export async function unrestrictPatientAction(id: string, _prev: unknown, fd: FormData): Promise<ActionResult> {
  return guard(
    async (s) => {
      const t = await tr();
      const p = await ownPatient(s, id);
      if (!p) return fail(t("patient.errors.not_found"), "not_found");
      const gate = await restrictedGate(s, p, t);
      if (gate) return gate;
      try {
        const { notified } = await unrestrictPatient(s.org.id, id, {
          reason: optional(fd, "reason")?.slice(0, 500) ?? null,
          informedOtherwise: fd.get("informedOtherwise") === "on",
          actor: { type: "user", id: s.user.id },
          headers: await headers(),
        });
        return ok(notified ? t("privacy.unrestricted") : t("privacy.unrestrictedNoNotice"));
      } catch (err) {
        return domainFail(err, t);
      }
    },
    { permission: "patient.restrict" },
  );
}

/**
 * Erase a patient: pseudonymise now, or keep on a legal ground and restrict until a date. Needs
 * patient.erase, a recent second factor and the patient's full name typed as confirmation.
 */
export async function erasePatientAction(id: string, _prev: unknown, fd: FormData): Promise<ActionResult> {
  return guard(
    async (s) => {
      const t = await tr();
      const denied = await stepUp(t);
      if (denied) return denied;
      const p = await ownPatient(s, id);
      if (!p) return fail(t("patient.errors.not_found"), "not_found");
      const fold = (v: string) => v.trim().replace(/\s+/g, " ").toLowerCase();
      if (fold(str(fd, "confirm")) !== fold(`${p.firstName} ${p.lastName}`)) return fail(t("patient.errors.confirm_mismatch"), "confirm_mismatch");
      const gate = await restrictedGate(s, p, t);
      if (gate) return gate;
      const mode = str(fd, "mode") === "restrict" ? "restrict" : "anonymise";
      try {
        const res = await erasePatient(s.org.id, id, {
          mode,
          reason: str(fd, "reason").slice(0, 500),
          retainUntil: mode === "restrict" ? optional(fd, "retainUntil") : null,
          actor: { type: "user", id: s.user.id },
          headers: await headers(),
        });
        return ok(res.mode === "anonymise" ? t("privacy.erased") : t("privacy.erasedRestricted"));
      } catch (err) {
        return domainFail(err, t);
      }
    },
    { permission: "patient.erase" },
  );
}

const PRACTICE_PURPOSES = CONSENT_PURPOSES.filter((c) => !isPlatformConsentPurpose(c));

/**
 * Record what the patient (or their parent or guardian) told the practice: a consent, a
 * withdrawal or an objection, as a staff-recorded ledger row with the staff member's id. Sorriso's
 * own purposes (marketplace consent, review publication) are not the practice's to record.
 */
export async function recordConsentAction(id: string, _prev: unknown, fd: FormData): Promise<ActionResult> {
  return guard(
    async (s) => {
      const t = await tr();
      const p = await ownPatient(s, id);
      if (!p) return fail(t("patient.errors.not_found"), "not_found");
      if (p.erasedAt) return fail(t("patient.errors.erased"), "erased");
      const gate = await restrictedGate(s, p, t);
      if (gate) return gate;
      const purpose = str(fd, "purpose") as ConsentPurpose;
      if (!PRACTICE_PURPOSES.includes(purpose)) return fail(t("errors.invalid"), "invalid");
      const relation = str(fd, "givenBy");
      const actorRelation = relation === "parent" || relation === "legal_guardian" ? relation : "self";
      try {
        await db.transaction((tx) =>
          recordConsent(tx, {
            orgId: s.org.id,
            patientId: p.id,
            purpose,
            granted: str(fd, "decision") === "grant",
            locale: p.locale,
            method: "staff_recorded",
            source: "staff",
            actorRelation,
            actorUserId: s.user.id,
          }),
        );
      } catch (err) {
        return domainFail(err, t);
      }
      return ok(t("privacy.consentRecorded"));
    },
    { permission: "patient.write" },
  );
}
