import { and, asc, eq, inArray, isNotNull, or, sql, type SQL } from "drizzle-orm";
import { getTableColumns } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import { strToU8, Zip, ZipDeflate, zipSync } from "fflate";
import { z } from "zod";
import { db } from "@/db";
import {
  apiKeys,
  appointments,
  auditLog,
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
  recalls,
  reminders,
  reviewReports,
  reviews,
  rooms,
  schedules,
  services,
  timeOff,
  users,
  waitlist,
  LOCALES,
  type Locale,
  type Organization,
} from "@/db/schema";
import { fmtDay, fmtWhen, zonedDate } from "@/i18n/datefmt";
import { getT } from "@/i18n/t";
import type { AuditEvent } from "../audit";
import { absoluteUrl, APP_NAME } from "../config";
import { isEncrypted } from "../crypto";
import { esc } from "../messaging/layout";
import { readComment, readDecisionReason, readRemovedReason, readReportDetails } from "../reviews";
import { resolveSettings } from "../settings";
import { fhirBundle, appointmentResource, patientResource, practitionerResource, locationResource, organizationResource } from "./fhir";
import { activePurposes, categoriesText, legalBasisText, retentionText, toCsv, transferToolText } from "./register";
import { PURPOSES } from "./roles";
import { activeSubprocessors } from "./subprocessors";

/**
 * Exports for the right of access (Art. 15) and portability (Art. 20), and the practice-wide
 * export for switching providers (EU Data Act ch. VI).
 *
 * A patient export is a ZIP with:
 *   patient.json   everything Sorriso holds about the record, in the schema documented at
 *                  /{locale}/developers/export-schema (patientExportSchema below; versioned)
 *   csv/*.csv      one CSV per table (RFC 4180, UTF-8, header row), same content
 *   summary.html   a readable summary in the patient's language, with the Art. 15(1)(a)-(h)
 *                  information: purposes, categories, recipients, retention, rights, the right to
 *                  complain, the source and automated decisions, plus Art. 15(2) transfers
 *   fhir.json      a FHIR R4 Bundle (Patient, Practitioner, Location, Organization, Appointment)
 * Free text is decrypted. Callers audit the export (patient.export, privacy_center.export).
 */

export const EXPORT_SCHEMA_VERSION = "1.0";
export const EXPORT_SCHEMA_PATH = "/developers/export-schema";

// The .describe() texts are for the machine-readable JSON Schema (English); the documentation page
// shows them translated: privacyAdmin.exportSchema.descriptions, keyed by exportSchemaFields().
const ISO_DESCRIPTION = "Instant, ISO 8601 in UTC";
const DAY_DESCRIPTION = "Calendar date, YYYY-MM-DD";
const iso = z.iso.datetime().describe(ISO_DESCRIPTION);
const day = z.iso.date().describe(DAY_DESCRIPTION);
const text = z.string().nullable();

export const patientExportSchema = z
  .object({
    schema: z.url().describe("Documentation of this format"),
    schemaVersion: z.literal(EXPORT_SCHEMA_VERSION),
    generatedAt: iso,
    locale: z.enum(LOCALES).describe("Language of summary.html"),
    controller: z
      .object({
        id: z.string(),
        name: z.string(),
        legalName: text,
        vatNumber: text,
        registeredAddress: text,
        privacyEmail: text,
        dpoName: text,
        dpoEmail: text,
        email: text,
        phone: text,
      })
      .describe("The practice: data controller for this record"),
    patient: z
      .object({
        id: z.string(),
        firstName: z.string(),
        lastName: z.string(),
        email: text,
        phone: text.describe("Mobile number in international format (E.164)"),
        birthDate: day.nullable(),
        locale: z.enum(LOCALES),
        preferredChannel: z.enum(["sms", "whatsapp", "email"]),
        smsOptIn: z.boolean(),
        emailOptIn: z.boolean(),
        notes: text.describe("The practice's notes about the patient"),
        noShowCount: z.number().int(),
        guardian: z
          .object({ name: text, relation: text, phone: text, email: text })
          .nullable()
          .describe("Parent or legal guardian who books for a minor"),
        restrictedAt: iso.nullable(),
        restrictionReason: text,
        retainUntil: day.nullable(),
        erasedAt: iso.nullable(),
        createdAt: iso,
      })
      .describe("The patient record"),
    appointments: z.array(
      z.object({
        id: z.string(),
        start: iso,
        end: iso,
        status: z.enum(["requested", "scheduled", "completed", "no_show", "cancelled"]),
        confirmation: z.enum(["pending", "confirmed", "declined"]),
        source: z.enum(["online", "widget", "api", "staff", "waitlist"]),
        processingContext: z.enum(["practice", "marketplace"]),
        bookedFor: z.enum(["self", "minor", "other_adult"]),
        service: z.object({ id: z.string(), name: z.string() }),
        practitioner: z.object({ id: z.string(), name: z.string() }),
        location: z.object({ id: z.string(), name: z.string(), address: z.string(), city: z.string() }),
        patientNote: text,
        internalNote: text,
        cancelledAt: iso.nullable(),
        cancelledBy: z.enum(["patient", "staff"]).nullable(),
        cancelReason: text,
        noticeVersion: text,
        createdAt: iso,
      }),
    ),
    consents: z.array(
      z.object({
        id: z.string(),
        purpose: z.string(),
        granted: z.boolean(),
        textKey: z.string(),
        textVersion: z.string(),
        locale: z.enum(LOCALES),
        method: z.string(),
        source: z.string(),
        actorRelation: z.string(),
        appointmentId: text,
        createdAt: iso,
      }),
    ).describe("The consent ledger: every grant, withdrawal and objection"),
    messages: z.array(
      z.object({
        id: z.string(),
        channel: z.enum(["email", "sms", "whatsapp"]),
        direction: z.enum(["outbound", "inbound"]),
        to: z.string(),
        from: text,
        subject: text,
        body: z.string(),
        status: z.string(),
        appointmentId: text,
        redactedAt: iso.nullable(),
        createdAt: iso,
      }),
    ),
    waitlist: z.array(
      z.object({
        id: z.string(),
        serviceId: z.string(),
        earliestDate: day,
        latestDate: day,
        partOfDay: z.string(),
        status: z.string(),
        note: text,
        createdAt: iso,
      }),
    ),
    reviews: z.array(
      z.object({
        id: z.string(),
        appointmentId: z.string(),
        rating: z.number().int(),
        comment: text,
        status: z.string(),
        reply: text,
        removedReason: text.describe("Why the review was taken down: the statement of reasons sent to its author (only in the patient's own download)"),
        createdAt: iso,
      }),
    ),
    recalls: z.array(z.object({ id: z.string(), serviceId: z.string(), dueDate: day, intervalMonths: z.number().int(), status: z.string(), createdAt: iso })),
    forms: z.array(
      z.object({
        id: z.string(),
        version: z.string(),
        locale: z.enum(LOCALES),
        answers: z.unknown().describe("The answers as given (JSON)"),
        signerName: text,
        signedAt: iso.nullable(),
        signedVia: text,
        createdAt: iso,
      }),
    ),
    privacyRequests: z.array(
      z.object({
        id: z.string(),
        type: z.string(),
        channel: z.string(),
        status: z.string(),
        receivedAt: iso,
        dueAt: iso,
        extendedUntil: iso.nullable(),
        decision: text,
        closedAt: iso.nullable(),
      }),
    ),
    accessLog: z
      .array(
        z.object({
          at: iso,
          action: z.string(),
          actorType: z.string(),
          actorRole: text.describe("Role of the staff member, when a person acted"),
          entityType: text,
          entityId: text,
        }),
      )
      .describe("Who accessed or changed the record (the practice's audit log)"),
  })
  .describe(`${APP_NAME} patient export`);

export type PatientExportData = z.infer<typeof patientExportSchema>;

/** The schema as JSON Schema (draft 2020-12), for the documentation page. */
export function patientExportJsonSchema() {
  return z.toJSONSchema(patientExportSchema, { target: "draft-2020-12", io: "output" });
}

type JsonSchema = {
  type?: string | string[];
  description?: string;
  format?: string;
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  anyOf?: JsonSchema[];
  enum?: unknown[];
  const?: unknown;
};

/** "string (date-time) | null", "object[]", "\"a\" | \"b\"". */
function typeOf(s: JsonSchema): string {
  if (s.anyOf) return s.anyOf.map(typeOf).join(" | ");
  if (s.const !== undefined) return JSON.stringify(s.const);
  if (s.enum) return s.enum.map((v) => JSON.stringify(v)).join(" | ");
  if (s.type === "array") return `${s.items ? typeOf(s.items) : "any"}[]`;
  const t = Array.isArray(s.type) ? s.type.join(" | ") : (s.type ?? "any");
  return s.format ? `${t} (${s.format})` : t;
}

/** Descriptions shared by many fields, by their key in privacyAdmin.exportSchema.descriptions. */
const SHARED_DESCRIPTIONS: Record<string, string> = { [ISO_DESCRIPTION]: "instant", [DAY_DESCRIPTION]: "date" };

/** "accessLog[].actorRole" -> "accessLogActorRole": a field's description key. */
const descriptionKeyOf = (path: string) => path.replace(/\[\]/g, "").replace(/\.(\w)/g, (_, c: string) => c.toUpperCase());

export type ExportSchemaField = {
  /** Dotted path, arrays as path[]. */
  path: string;
  type: string;
  /** The English description in the JSON Schema ("" when none). */
  description: string;
  /** Its key in privacyAdmin.exportSchema.descriptions, or null when the field has none. */
  descriptionKey: string | null;
};

/** The fields of patient.json, flattened, one row each, for the documentation page. */
export function exportSchemaFields(): ExportSchemaField[] {
  const out: ExportSchemaField[] = [];
  const walk = (s: JsonSchema, prefix: string) => {
    for (const [name, child] of Object.entries(s.properties ?? {})) {
      const path = prefix ? `${prefix}.${name}` : name;
      const target = child.anyOf?.find((a) => a.type !== "null") ?? child;
      const description = child.description ?? target.description ?? "";
      out.push({ path, type: typeOf(child), description, descriptionKey: description ? (SHARED_DESCRIPTIONS[description] ?? descriptionKeyOf(path)) : null });
      if (target.properties) walk(target, path);
      if (target.type === "array" && target.items?.properties) walk(target.items, `${path}[]`);
    }
  };
  walk(patientExportJsonSchema() as JsonSchema, "");
  return out;
}

export type PatientExport = { filename: string; contentType: string; body: Uint8Array };

const isoOrNull = (d: Date | null | undefined) => (d ? d.toISOString() : null);

/**
 * A review's comment as the practice may read it (as reviews.ts practiceVisibleComment): only
 * while it is the public text — a published review, or one the practice's report hides while it is
 * checked. Never a text the automatic check held, nor a removed one (stored encrypted), and never
 * the statement of reasons for a removal: those belong to Sorriso's moderation (Sorriso is the
 * controller) and go to the author only.
 */
function practiceComment(r: { comment: string | null; status: string; publishedAt: unknown }): string | null {
  if (!r.comment) return null;
  if (r.status === "published") return readComment(r.comment);
  if (r.status === "under_review" && r.publishedAt != null && !isEncrypted(r.comment)) return r.comment;
  return null;
}

/**
 * The audit rows about one patient, for an access log (the export's and the patient page's): rows
 * filed on the record or on one of its appointments, and rows filed on something else that names
 * the patient in metadata.patientId (privacy requests, messages, waiting-list entries, recalls,
 * forms, adult confirmations). Combine with the org scope.
 */
export function patientAccessFilter(patientId: string, appointmentIds: readonly string[]): SQL {
  return or(
    and(eq(auditLog.entityType, "patient"), eq(auditLog.entityId, patientId)),
    appointmentIds.length ? and(eq(auditLog.entityType, "appointment"), inArray(auditLog.entityId, [...appointmentIds])) : undefined,
    sql`json_extract(${auditLog.metadata}, '$.patientId') = ${patientId}`,
  )!;
}

function parseAnswers(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

type Collected = {
  data: PatientExportData;
  org: Organization;
  practitioners: (typeof practitioners.$inferSelect)[];
  locations: (typeof locations.$inferSelect)[];
  patientRow: typeof patients.$inferSelect;
  appointmentRows: (typeof appointments.$inferSelect & { service: typeof services.$inferSelect })[];
};

/**
 * Everything about one patient of `orgId` (org-scoped; throws when the patient isn't the org's).
 * `forPatient`: the patient downloads it themselves (privacy center), so their reviews carry
 * their own text even while held or after removal, and the statement of reasons; staff exports
 * show reviews as the practice sees them.
 */
export async function collectPatientData(orgId: string, patientId: string, opts: { locale: Locale; now?: Date; forPatient?: boolean }): Promise<Collected> {
  const now = opts.now ?? new Date();
  const [row] = await db
    .select({ p: patients, org: organizations })
    .from(patients)
    .innerJoin(organizations, eq(organizations.id, patients.orgId))
    .where(and(eq(patients.orgId, orgId), eq(patients.id, patientId)));
  if (!row) throw new Error("Patient not found");
  const { p, org } = row;

  const apptRows = await db
    .select({ a: appointments, service: services, practitioner: practitioners, location: locations })
    .from(appointments)
    .innerJoin(services, eq(services.id, appointments.serviceId))
    .innerJoin(practitioners, eq(practitioners.id, appointments.practitionerId))
    .innerJoin(locations, eq(locations.id, appointments.locationId))
    .where(and(eq(appointments.orgId, orgId), eq(appointments.patientId, patientId)))
    .orderBy(asc(appointments.startsAt));
  const apptIds = apptRows.map((r) => r.a.id);
  const byAppt = (col: Parameters<typeof inArray>[0]) => (apptIds.length ? inArray(col, apptIds) : undefined);

  const [consentRows, msgRows, waitRows, reviewRows, recallRows, formRows, requestRows, logRows] = await Promise.all([
    db.select().from(consents).where(and(eq(consents.orgId, orgId), eq(consents.patientId, patientId))).orderBy(asc(consents.createdAt)),
    db
      .select()
      .from(messages)
      .where(and(eq(messages.orgId, orgId), or(eq(messages.patientId, patientId), byAppt(messages.appointmentId))))
      .orderBy(asc(messages.createdAt)),
    db.select().from(waitlist).where(and(eq(waitlist.orgId, orgId), eq(waitlist.patientId, patientId))).orderBy(asc(waitlist.createdAt)),
    apptIds.length ? db.select().from(reviews).where(and(eq(reviews.orgId, orgId), inArray(reviews.appointmentId, apptIds))) : [],
    db.select().from(recalls).where(and(eq(recalls.orgId, orgId), eq(recalls.patientId, patientId))).orderBy(asc(recalls.dueDate)),
    db.select().from(formSubmissions).where(and(eq(formSubmissions.orgId, orgId), eq(formSubmissions.patientId, patientId))),
    db
      .select()
      .from(privacyRequests)
      .where(and(eq(privacyRequests.orgId, orgId), eq(privacyRequests.patientId, patientId)))
      .orderBy(asc(privacyRequests.receivedAt)),
    db
      .select({ log: auditLog, role: memberships.role })
      .from(auditLog)
      .leftJoin(memberships, and(eq(memberships.userId, auditLog.actorId), eq(memberships.orgId, orgId), eq(auditLog.actorType, "user")))
      .where(and(eq(auditLog.orgId, orgId), patientAccessFilter(patientId, apptIds)))
      .orderBy(asc(auditLog.seq)),
  ]);

  const data: PatientExportData = {
    schema: absoluteUrl(`/${opts.locale}${EXPORT_SCHEMA_PATH}`),
    schemaVersion: EXPORT_SCHEMA_VERSION,
    generatedAt: now.toISOString(),
    locale: opts.locale,
    controller: {
      id: org.id,
      name: org.name,
      legalName: org.legalName,
      vatNumber: org.vatNumber,
      registeredAddress: org.registeredAddress,
      privacyEmail: org.privacyEmail,
      dpoName: org.dpoName,
      dpoEmail: org.dpoEmail,
      email: org.email,
      phone: org.phone,
    },
    patient: {
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      email: p.email,
      phone: p.phone,
      birthDate: p.birthDate,
      locale: p.locale,
      preferredChannel: p.preferredChannel,
      smsOptIn: p.smsOptIn,
      emailOptIn: p.emailOptIn,
      notes: p.notes,
      noShowCount: p.noShowCount,
      guardian:
        p.guardianName || p.guardianPhone || p.guardianEmail
          ? { name: p.guardianName, relation: p.guardianRelation, phone: p.guardianPhone, email: p.guardianEmail }
          : null,
      restrictedAt: isoOrNull(p.restrictedAt),
      restrictionReason: p.restrictionReason,
      retainUntil: p.retainUntil,
      erasedAt: isoOrNull(p.erasedAt),
      createdAt: p.createdAt.toISOString(),
    },
    appointments: apptRows.map(({ a, service, practitioner, location }) => ({
      id: a.id,
      start: a.startsAt.toISOString(),
      end: a.endsAt.toISOString(),
      status: a.status,
      confirmation: a.confirmation,
      source: a.source,
      processingContext: a.processingContext,
      bookedFor: a.bookedFor,
      service: { id: service.id, name: service.name },
      practitioner: { id: practitioner.id, name: `${practitioner.title} ${practitioner.name}`.trim() },
      location: { id: location.id, name: location.name, address: location.address, city: location.city },
      patientNote: a.patientNote,
      internalNote: a.internalNote,
      cancelledAt: isoOrNull(a.cancelledAt),
      cancelledBy: a.cancelledBy,
      cancelReason: a.cancelReason,
      noticeVersion: a.noticeVersion,
      createdAt: a.createdAt.toISOString(),
    })),
    consents: consentRows.map((c) => ({
      id: c.id,
      purpose: c.purpose,
      granted: c.granted,
      textKey: c.textKey,
      textVersion: c.textVersion,
      locale: c.locale,
      method: c.method,
      source: c.source,
      actorRelation: c.actorRelation,
      appointmentId: c.appointmentId,
      createdAt: c.createdAt.toISOString(),
    })),
    messages: msgRows.map((m) => ({
      id: m.id,
      channel: m.channel,
      direction: m.direction,
      to: m.to,
      from: m.from,
      subject: m.subject,
      body: m.body,
      status: m.status,
      appointmentId: m.appointmentId,
      redactedAt: isoOrNull(m.redactedAt),
      createdAt: m.createdAt.toISOString(),
    })),
    waitlist: waitRows.map((w) => ({
      id: w.id,
      serviceId: w.serviceId,
      earliestDate: w.earliestDate,
      latestDate: w.latestDate,
      partOfDay: w.partOfDay,
      status: w.status,
      note: w.note,
      createdAt: w.createdAt.toISOString(),
    })),
    reviews: reviewRows.map((r) => ({
      id: r.id,
      appointmentId: r.appointmentId,
      rating: r.rating,
      comment: opts.forPatient ? readComment(r.comment) : practiceComment(r),
      status: r.status,
      reply: r.reply,
      removedReason: opts.forPatient ? readRemovedReason(r.removedReason) : null,
      createdAt: r.createdAt.toISOString(),
    })),
    recalls: recallRows.map((r) => ({
      id: r.id,
      serviceId: r.serviceId,
      dueDate: r.dueDate,
      intervalMonths: r.intervalMonths,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    })),
    forms: formRows.map((f) => ({
      id: f.id,
      version: f.version,
      locale: f.locale,
      answers: parseAnswers(f.answers),
      signerName: f.signerName,
      signedAt: isoOrNull(f.signedAt),
      signedVia: f.signedVia,
      createdAt: f.createdAt.toISOString(),
    })),
    privacyRequests: requestRows.map((r) => ({
      id: r.id,
      type: r.type,
      channel: r.channel,
      status: r.status,
      receivedAt: r.receivedAt.toISOString(),
      dueAt: r.dueAt.toISOString(),
      extendedUntil: isoOrNull(r.extendedUntil),
      decision: r.decision,
      closedAt: isoOrNull(r.closedAt),
    })),
    accessLog: logRows.map(({ log, role }) => ({
      at: log.at.toISOString(),
      action: log.action,
      actorType: log.actorType,
      actorRole: role ?? null,
      entityType: log.entityType,
      entityId: log.entityId,
    })),
  };

  const practitionerMap = new Map(apptRows.map((r) => [r.practitioner.id, r.practitioner]));
  const locationMap = new Map(apptRows.map((r) => [r.location.id, r.location]));
  return {
    data,
    org,
    practitioners: [...practitionerMap.values()],
    locations: [...locationMap.values()],
    patientRow: p,
    appointmentRows: apptRows.map((r) => ({ ...r.a, service: r.service })),
  };
}

/** The CSV files of a patient export: one per table, header row even when empty. */
export function patientCsvFiles(d: PatientExportData): Record<string, string> {
  const flat = <T extends Record<string, unknown>>(rows: T[]) =>
    rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v !== null && typeof v === "object" && !(v instanceof Date) ? JSON.stringify(v) : v])));
  const cols = (schema: z.ZodObject) => Object.keys(schema.shape);
  const shape = patientExportSchema.shape;
  const table = (name: keyof typeof shape, rows: Record<string, unknown>[]) => {
    const s = shape[name];
    const obj = s instanceof z.ZodArray ? (s.element as z.ZodObject) : (s as unknown as z.ZodObject);
    return toCsv(cols(obj), flat(rows));
  };
  return {
    "csv/patient.csv": table("patient", [d.patient]),
    "csv/appointments.csv": toCsv(
      ["id", "start", "end", "status", "confirmation", "source", "processingContext", "bookedFor", "serviceId", "serviceName", "practitionerId", "practitionerName", "locationId", "locationName", "patientNote", "internalNote", "cancelledAt", "cancelledBy", "cancelReason", "noticeVersion", "createdAt"],
      d.appointments.map((a) => ({
        ...a,
        serviceId: a.service.id,
        serviceName: a.service.name,
        practitionerId: a.practitioner.id,
        practitionerName: a.practitioner.name,
        locationId: a.location.id,
        locationName: a.location.name,
      })),
    ),
    "csv/consents.csv": table("consents", d.consents),
    "csv/messages.csv": table("messages", d.messages),
    "csv/waitlist.csv": table("waitlist", d.waitlist),
    "csv/reviews.csv": table("reviews", d.reviews),
    "csv/recalls.csv": table("recalls", d.recalls),
    "csv/forms.csv": table("forms", d.forms),
    "csv/privacy_requests.csv": table("privacyRequests", d.privacyRequests),
    "csv/access_log.csv": table("accessLog", d.accessLog),
  };
}

/** Escape for HTML text and attributes. */
const h = esc;

/**
 * summary.html: the export explained in the patient's language, with the information Art. 15(1)
 * and (2) require besides the data itself. Self-contained (inline CSS, no remote resources).
 */
export function renderSummaryHtml(c: Collected, locale: Locale): string {
  const t = getT(locale, "privacyAdmin");
  const lt = getT(locale, "legalPractice");
  const d = c.data;
  const settings = resolveSettings(c.org.settings);
  const tz = c.org.timezone;
  const controller = c.org.legalName ?? c.org.name;
  const purposes = activePurposes(settings);
  const subs = activeSubprocessors(settings.privacy);
  const sources = [...new Set(d.appointments.map((a) => a.source))];
  const cats = [...new Set(purposes.flatMap((p) => PURPOSES[p].dataCategories))];
  const when = (iso: string) => fmtWhen(iso, tz, locale, "medium");
  const dayOf = (iso: string) => fmtDay(zonedDate(iso, tz), "medium", locale);
  const name = `${d.patient.firstName} ${d.patient.lastName}`;
  const rows = (items: [string, string][]) => items.map(([k, v]) => `<tr><th>${h(k)}</th><td>${h(v)}</td></tr>`).join("");

  const counts: [string, number][] = [
    [t("export.files.appointments"), d.appointments.length],
    [t("export.files.consents"), d.consents.length],
    [t("export.files.messages"), d.messages.length],
    [t("export.files.waitlist"), d.waitlist.length],
    [t("export.files.reviews"), d.reviews.length],
    [t("export.files.recalls"), d.recalls.length],
    [t("export.files.forms"), d.forms.length],
    [t("export.files.privacyRequests"), d.privacyRequests.length],
    [t("export.files.accessLog"), d.accessLog.length],
  ];

  const section = (title: string, body: string) => `<section><h2>${h(title)}</h2>${body}</section>`;
  const list = (items: string[]) => `<ul>${items.map((i) => `<li>${h(i)}</li>`).join("")}</ul>`;
  const profiling = purposes.includes("adaptive_reminders");

  return `<!doctype html>
<html lang="${h(locale)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${h(t("export.summary.title", { practice: c.org.name }))}</title>
<style>
body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;max-width:860px;margin:0 auto;padding:24px 16px;line-height:1.5}
h1{font-size:24px;margin:0 0 4px}h2{font-size:18px;margin:28px 0 8px;color:#0c675d}
p.muted{color:#64748b;margin:0}table{border-collapse:collapse;width:100%;font-size:14px}
th,td{border-bottom:1px solid #e2e8f0;padding:6px 8px;text-align:left;vertical-align:top}th{width:38%;color:#334155}
ul{padding-left:20px}code{background:#f1f5f9;padding:1px 4px;border-radius:4px}
@media print{body{padding:0}h2{break-after:avoid}}
</style></head><body>
<h1>${h(t("export.summary.title", { practice: c.org.name }))}</h1>
<p class="muted">${h(t("export.summary.generated", { name, date: when(d.generatedAt) }))}</p>
${section(t("export.summary.controller"), `<table>${rows([
    [t("export.summary.controllerName"), controller],
    ...(c.org.vatNumber ? ([[t("export.summary.vat"), c.org.vatNumber]] as [string, string][]) : []),
    ...(c.org.registeredAddress ? ([[t("export.summary.address"), c.org.registeredAddress]] as [string, string][]) : []),
    [t("export.summary.contact"), c.org.privacyEmail ?? c.org.email ?? c.org.phone ?? "—"],
    ...(c.org.dpoName || c.org.dpoEmail ? ([[t("export.summary.dpo"), [c.org.dpoName, c.org.dpoEmail].filter(Boolean).join(" — ")]] as [string, string][]) : []),
  ])}</table>`)}
${section(t("export.summary.yourData"), `<table>${rows([
    [t("export.summary.name"), name],
    [t("export.summary.phone"), d.patient.phone ?? "—"],
    [t("export.summary.email"), d.patient.email ?? "—"],
    [t("export.summary.birthDate"), d.patient.birthDate ? fmtDay(d.patient.birthDate, "long", locale) : "—"],
    ...counts.map(([k, n]) => [k, String(n)] as [string, string]),
  ])}</table>`)}
${d.appointments.length ? section(t("export.summary.appointments"), `<table>${d.appointments
    .map((a) => `<tr><th>${h(dayOf(a.start))}</th><td>${h(t("export.summary.appointmentLine", { service: a.service.name, practitioner: a.practitioner.name, status: t(`export.status.${a.status}`) }))}</td></tr>`)
    .join("")}</table>`) : ""}
${section(t("export.summary.purposes"), `<table>${purposes
    .map((p) => `<tr><th>${h(lt(`purposes.${p}.activity`))}</th><td>${h(lt(`purposes.${p}.purpose`))}<br><small>${h(legalBasisText(lt, PURPOSES[p].legalBases))}</small></td></tr>`)
    .join("")}</table>`)}
${section(t("export.summary.categories"), `<p>${h(categoriesText(lt, cats))}</p>`)}
${section(t("export.summary.recipients"), `<p>${h(t("export.summary.recipientsIntro"))}</p>${list(
    subs.map((s) => t("export.summary.recipientLine", { name: s.name, entity: s.legalEntity, region: s.region ?? "—", tool: transferToolText(lt, s.transfer) })),
  )}`)}
${section(t("export.summary.retention"), `<table>${purposes
    .map((p) => `<tr><th>${h(lt(`purposes.${p}.activity`))}</th><td>${h(retentionText(lt, p, settings.privacy.retention))}</td></tr>`)
    .join("")}</table>`)}
${section(t("export.summary.rights"), list([
    t("export.summary.rightAccess"),
    t("export.summary.rightRectification"),
    t("export.summary.rightErasure"),
    t("export.summary.rightRestriction"),
    t("export.summary.rightObjection"),
    t("export.summary.rightPortability"),
    t("export.summary.rightWithdraw"),
  ]) + `<p>${h(t("export.summary.howToExercise", { contact: c.org.privacyEmail ?? c.org.email ?? c.org.phone ?? controller }))}</p>`)}
${section(t("export.summary.complaint"), `<p>${h(t("export.summary.complaintBody"))}</p>`)}
${section(t("export.summary.source"), `<p>${h(sources.length ? t("export.summary.sourceBody", { sources: sources.map((s) => t(`export.sources.${s}`)).join(", ") }) : t("export.summary.sourceNone"))}</p>`)}
${section(t("export.summary.automated"), `<p>${h(profiling ? t("export.summary.automatedProfiling") : t("export.summary.automatedNone"))}</p>`)}
${section(t("export.summary.transfers"), `<p>${h(t("export.summary.transfersBody"))}</p>`)}
${section(t("export.summary.files"), list([t("export.summary.filePatientJson"), t("export.summary.fileCsv"), t("export.summary.fileFhir"), t("export.summary.fileSummary")]))}
</body></html>`;
}

/**
 * Build a patient's export. 'zip' gives the full archive, 'json' only patient.json. The caller
 * checks permissions and audits (patient.export / privacy_center.export).
 */
export async function buildPatientExport(
  orgId: string,
  patientId: string,
  opts: { locale: Locale; format: "json" | "zip"; actor: AuditEvent["actor"]; now?: Date },
): Promise<PatientExport> {
  const now = opts.now ?? new Date();
  // Downloaded by the patient (privacy center, appointment link) or by staff for them.
  const forPatient = opts.actor.type === "patient_session" || opts.actor.type === "patient_link";
  const c = await collectPatientData(orgId, patientId, { locale: opts.locale, now, forPatient });
  const stamp = now.toISOString().slice(0, 10);
  const json = JSON.stringify(c.data, null, 2);
  if (opts.format === "json") {
    return { filename: `patient-${patientId}-${stamp}.json`, contentType: "application/json; charset=utf-8", body: strToU8(json) };
  }
  const bundle = fhirBundle(
    {
      organization: c.org,
      locations: c.locations,
      practitioners: c.practitioners,
      patients: [c.patientRow],
      appointments: c.appointmentRows,
    },
    now,
  );
  const files: Record<string, Uint8Array> = {
    "patient.json": strToU8(json),
    "summary.html": strToU8(renderSummaryHtml(c, opts.locale)),
    "fhir.json": strToU8(JSON.stringify(bundle, null, 2)),
  };
  for (const [name, csv] of Object.entries(patientCsvFiles(c.data))) files[name] = strToU8(`﻿${csv}`);
  const body = zipSync(files, { level: 6, mtime: now });
  return { filename: `patient-${patientId}-${stamp}.zip`, contentType: "application/zip", body };
}

// ---------------------------------------------------------------- practice-wide export

type Row = Record<string, unknown>;
type OrgTable = {
  name: string;
  columns: string[];
  /** One page of rows, already free of secrets. */
  page: (orgId: string, offset: number, limit: number) => Promise<Row[]>;
};

const PAGE = 500;

/** Columns of a drizzle table minus `omit` (token hashes, password hashes and the like). */
function columnsOf(table: SQLiteTable, omit: string[] = []): string[] {
  return Object.keys(getTableColumns(table)).filter((c) => !omit.includes(c));
}

function plainTable(
  name: string,
  table: SQLiteTable,
  where: (orgId: string) => SQL | undefined,
  omit: string[] = [],
  /** Rewrites a row before export (e.g. decrypts the columns encrypted by hand). */
  map: (row: Row) => Row = (row) => row,
): OrgTable {
  const columns = columnsOf(table, omit);
  const cols = getTableColumns(table);
  const order = (cols as Record<string, Parameters<typeof asc>[0]>).id ?? Object.values(cols)[0];
  return {
    name,
    columns,
    page: async (orgId, offset, limit) => {
      const rows = (await db.select().from(table).where(where(orgId)).orderBy(asc(order)).limit(limit).offset(offset)) as Row[];
      return rows.map((r) => map(Object.fromEntries(columns.map((c) => [c, r[c]]))));
    },
  };
}

/** A review row as the practice may read it (comment and removal reason: see practiceComment). */
function practiceReviewRow(r: Row): Row {
  return { ...r, comment: practiceComment({ comment: typeof r.comment === "string" ? r.comment : null, status: String(r.status), publishedAt: r.publishedAt }), removedReason: null };
}

/**
 * The practice's own reports about its reviews (DSA notices from the public and the automatic
 * check are Sorriso's, as controller): what the practice wrote and the statement of reasons for
 * the decision, decrypted. The author's response is part of the moderation Sorriso runs, and is
 * left out.
 */
function practiceReportRow(r: Row): Row {
  const str = (v: unknown) => (typeof v === "string" ? v : null);
  return { ...r, details: readReportDetails(str(r.details)).text ?? null, patientResponse: null, decisionReason: readDecisionReason(str(r.decisionReason)) };
}

const orgLocations = (orgId: string) => db.select({ id: locations.id }).from(locations).where(eq(locations.orgId, orgId));
const orgPractitioners = (orgId: string) => db.select({ id: practitioners.id }).from(practitioners).where(eq(practitioners.orgId, orgId));
const orgAppointments = (orgId: string) => db.select({ id: appointments.id }).from(appointments).where(eq(appointments.orgId, orgId));
const orgReviews = (orgId: string) => db.select({ id: reviews.id }).from(reviews).where(eq(reviews.orgId, orgId));

/** Every table holding the practice's data, in a stable order. Secrets (token and key hashes) are left out. */
export const ORG_EXPORT_TABLES: OrgTable[] = [
  plainTable("organization", organizations, (o) => eq(organizations.id, o)),
  plainTable("locations", locations, (o) => eq(locations.orgId, o)),
  plainTable("rooms", rooms, (o) => inArray(rooms.locationId, orgLocations(o))),
  plainTable("practitioners", practitioners, (o) => eq(practitioners.orgId, o), ["icsToken", "icsTokenHash"]),
  plainTable("services", services, (o) => eq(services.orgId, o)),
  {
    name: "practitioner_services",
    columns: ["practitionerId", "serviceId"],
    page: (o, offset, limit) =>
      db
        .select()
        .from(practitionerServices)
        .where(inArray(practitionerServices.practitionerId, orgPractitioners(o)))
        .orderBy(asc(practitionerServices.practitionerId), asc(practitionerServices.serviceId))
        .limit(limit)
        .offset(offset),
  },
  plainTable("schedules", schedules, (o) => inArray(schedules.practitionerId, orgPractitioners(o))),
  plainTable("time_off", timeOff, (o) => eq(timeOff.orgId, o)),
  {
    name: "org_funds",
    columns: columnsOf(orgFunds),
    page: (o, offset, limit) => db.select().from(orgFunds).where(eq(orgFunds.orgId, o)).orderBy(asc(orgFunds.fundId)).limit(limit).offset(offset),
  },
  plainTable("patients", patients, (o) => eq(patients.orgId, o)),
  plainTable("appointments", appointments, (o) => eq(appointments.orgId, o), ["manageToken", "manageTokenHash", "manageTokenEnc"]),
  plainTable("reminders", reminders, (o) => inArray(reminders.appointmentId, orgAppointments(o))),
  plainTable("messages", messages, (o) => eq(messages.orgId, o)),
  plainTable("waitlist", waitlist, (o) => eq(waitlist.orgId, o)),
  plainTable("reviews", reviews, (o) => eq(reviews.orgId, o), [], practiceReviewRow),
  plainTable(
    "review_reports",
    reviewReports,
    (o) => and(inArray(reviewReports.reviewId, orgReviews(o)), isNotNull(reviewReports.reporterUserId)),
    ["reporterContactHash"],
    practiceReportRow,
  ),
  plainTable("recalls", recalls, (o) => eq(recalls.orgId, o)),
  plainTable("form_templates", formTemplates, (o) => eq(formTemplates.orgId, o)),
  plainTable("form_submissions", formSubmissions, (o) => eq(formSubmissions.orgId, o)),
  plainTable("consents", consents, (o) => eq(consents.orgId, o)),
  plainTable("privacy_requests", privacyRequests, (o) => eq(privacyRequests.orgId, o)),
  plainTable("legal_acceptances", legalAcceptances, (o) => eq(legalAcceptances.orgId, o)),
  plainTable("notice_versions", noticeVersions, (o) => eq(noticeVersions.orgId, o)),
  plainTable("api_keys", apiKeys, (o) => eq(apiKeys.orgId, o), ["keyHash"]),
  {
    name: "staff",
    columns: ["userId", "name", "email", "role", "locale", "instructionsVersion", "instructionsAcceptedAt", "createdAt"],
    page: (o, offset, limit) =>
      db
        .select({
          userId: users.id,
          name: users.name,
          email: users.email,
          role: memberships.role,
          locale: users.locale,
          instructionsVersion: memberships.instructionsVersion,
          instructionsAcceptedAt: memberships.instructionsAcceptedAt,
          createdAt: memberships.createdAt,
        })
        .from(memberships)
        .innerJoin(users, eq(users.id, memberships.userId))
        .where(eq(memberships.orgId, o))
        .orderBy(asc(users.id))
        .limit(limit)
        .offset(offset),
  },
  {
    name: "audit_log",
    columns: columnsOf(auditLog),
    page: (o, offset, limit) => db.select().from(auditLog).where(eq(auditLog.orgId, o)).orderBy(asc(auditLog.seq)).limit(limit).offset(offset) as Promise<Row[]>,
  },
];

const jsonValue = (v: unknown) => (v instanceof Date ? v.toISOString() : v);

async function* pages(t: OrgTable, orgId: string): AsyncGenerator<Row[]> {
  for (let offset = 0; ; offset += PAGE) {
    const rows = await t.page(orgId, offset, PAGE);
    if (rows.length) yield rows;
    if (rows.length < PAGE) return;
  }
}

/**
 * The whole practice as a streamed ZIP: csv/<table>.csv and json/<table>.json for every table in
 * ORG_EXPORT_TABLES, fhir/bundle.json (Organization, Locations, Practitioners, Patients,
 * Appointments) and a manifest. Pull-based: each read of the stream advances the export by about
 * one page of rows, so memory stays flat however large the practice. The caller checks
 * org.export and step-up, and audits export.org.
 */
export function orgExportStream(orgId: string, opts: { now?: Date; locale?: Locale } = {}): ReadableStream<Uint8Array> {
  const now = opts.now ?? new Date();
  const locale = opts.locale ?? "it";
  const ready: Uint8Array[] = [];
  let finished = false;
  let failure: unknown = null;
  const zip = new Zip((err, chunk, final) => {
    if (err) failure = err;
    else ready.push(chunk);
    if (final) finished = true;
  });
  const steps = writeOrgExport(zip, orgId, now, locale);
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        let exhausted = false;
        while (!ready.length && !finished && !failure && !exhausted) exhausted = Boolean((await steps.next()).done);
        if (failure) throw failure;
        while (ready.length) controller.enqueue(ready.shift()!);
        if (finished || exhausted) controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
    async cancel() {
      await steps.return(undefined);
    },
  });
}

/** Writes the archive into `zip`, yielding after each page so the stream can pace it. */
async function* writeOrgExport(zip: Zip, orgId: string, now: Date, locale: Locale): AsyncGenerator<void> {
  const file = (name: string) => {
    const f = new ZipDeflate(name, { level: 6 });
    f.mtime = now;
    zip.add(f);
    return { write: (s: string) => f.push(strToU8(s)), end: (s = "") => f.push(strToU8(s), true) };
  };
  const counts: Record<string, number> = {};
  for (const table of ORG_EXPORT_TABLES) {
    const csv = file(`csv/${table.name}.csv`);
    csv.write(`\uFEFF${toCsv(table.columns, [])}`);
    let n = 0;
    for await (const rows of pages(table, orgId)) {
      csv.write(toCsv(table.columns, rows).split("\r\n").slice(1).join("\r\n"));
      n += rows.length;
      yield;
    }
    csv.end();
    counts[table.name] = n;

    const json = file(`json/${table.name}.json`);
    json.write("[");
    let first = true;
    for await (const rows of pages(table, orgId)) {
      for (const r of rows) {
        json.write(`${first ? "\n" : ",\n"}${JSON.stringify(Object.fromEntries(Object.entries(r).map(([k, v]) => [k, jsonValue(v)])))}`);
        first = false;
      }
      yield;
    }
    json.end("\n]\n");
  }

  // FHIR: one Bundle with the practice and its booking data.
  const fhir = file("fhir/bundle.json");
  const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
  const head = fhirBundle({ organization: org ?? null }, now);
  fhir.write(JSON.stringify({ ...head, entry: undefined }).replace(/}$/, ',"entry":['));
  let first = true;
  const emit = (resource: { resourceType: string; id: string }) => {
    fhir.write(`${first ? "\n" : ",\n"}${JSON.stringify({ fullUrl: `urn:uuid:${resource.id}`, resource })}`);
    first = false;
  };
  if (org) emit(organizationResource(org));
  for (const l of await db.select().from(locations).where(eq(locations.orgId, orgId))) emit(locationResource(l));
  for (const p of await db.select().from(practitioners).where(eq(practitioners.orgId, orgId))) emit(practitionerResource(p));
  for (let offset = 0; ; offset += PAGE) {
    const rows = await db.select().from(patients).where(eq(patients.orgId, orgId)).orderBy(asc(patients.id)).limit(PAGE).offset(offset);
    rows.forEach((p) => emit(patientResource(p)));
    yield;
    if (rows.length < PAGE) break;
  }
  for (let offset = 0; ; offset += PAGE) {
    const rows = await db
      .select({ a: appointments, service: services })
      .from(appointments)
      .leftJoin(services, eq(services.id, appointments.serviceId))
      .where(eq(appointments.orgId, orgId))
      .orderBy(asc(appointments.id))
      .limit(PAGE)
      .offset(offset);
    rows.forEach((r) => emit(appointmentResource({ ...r.a, service: r.service })));
    yield;
    if (rows.length < PAGE) break;
  }
  fhir.end("\n]}\n");

  const manifest = file("manifest.json");
  manifest.end(
    JSON.stringify(
      {
        generatedAt: now.toISOString(),
        orgId,
        formats: { csv: "RFC 4180, UTF-8 with BOM, header row", json: "one array per table", fhir: "FHIR R4 Bundle (collection)" },
        patientExportSchema: absoluteUrl(`/${locale}${EXPORT_SCHEMA_PATH}`),
        tables: counts,
      },
      null,
      2,
    ),
  );
  zip.end();
}
