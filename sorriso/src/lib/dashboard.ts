import "server-only";
import { and, asc, desc, eq, gte, inArray, lt, ne, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { fail, guard, staff, type ActionResult, type GuardOptions } from "@/app/dashboard/actions/_shared";
import type {
  ApptDetailDTO,
  ApptListDTO,
  RestrictedAccess,
  Resources,
  ThreadMessage,
} from "@/components/dashboard/types";
import { db } from "@/db";
import {
  appointments,
  locations,
  messages,
  organizations,
  patients,
  practitionerServices,
  practitioners,
  rooms,
  services,
  type AppointmentStatus,
} from "@/db/schema";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/i18n/config";
import { getStaffLocale, getT } from "@/i18n/server";
import type { Translator } from "@/i18n/types";
import { auditStaff, type AuditAction } from "./audit";
import type { StaffSession } from "./auth";
import { awaitsAdultConsent, BookingError } from "./booking";
import { fullName, practitionerName } from "./format";
import { logError } from "./log";
import { can, PermissionError, permissionsFor, type Permission } from "./permissions";
import { hasRestrictedAccess } from "./privacy/erasure";
import { getPrivacy } from "./privacy/settings";
import { rebookStatus } from "./rebooking";
import { loadCareFlags } from "./risk";
import { isStepUpRequired } from "./security/errors";

/**
 * Server-side data for the dashboard's scheduling screens (WP2): the resources the calendar is
 * drawn with, the appointment list (data-minimised for every viewer), the drawer's detail
 * (permission-filtered and audited), and the helpers that give the dashboard's actions their
 * messages in the staff member's language.
 */

// ---------------------------------------------------------------- resources

export async function loadResources(orgId: string, timezone: string): Promise<Resources> {
  const [pracs, locs, svcs] = await Promise.all([
    db.select().from(practitioners).where(and(eq(practitioners.orgId, orgId), eq(practitioners.active, true))).orderBy(asc(practitioners.name)),
    db.select().from(locations).where(and(eq(locations.orgId, orgId), eq(locations.active, true))).orderBy(asc(locations.name)),
    db.select().from(services).where(and(eq(services.orgId, orgId), eq(services.active, true))).orderBy(asc(services.sortOrder)),
  ]);
  const [links, roomRows] = await Promise.all([
    pracs.length ? db.select().from(practitionerServices).where(inArray(practitionerServices.practitionerId, pracs.map((p) => p.id))) : [],
    locs.length ? db.select().from(rooms).where(and(inArray(rooms.locationId, locs.map((l) => l.id)), eq(rooms.active, true))).orderBy(asc(rooms.name)) : [],
  ]);
  return {
    timezone,
    practitioners: pracs.map((p) => ({
      id: p.id,
      name: practitionerName(p),
      color: p.color,
      serviceIds: links.filter((l) => l.practitionerId === p.id).map((l) => l.serviceId),
    })),
    locations: locs.map((l) => ({ id: l.id, name: l.name, timezone: l.timezone })),
    // Grouped by office (offices are already sorted by name), then chair name.
    rooms: locs.flatMap((l) => roomRows.filter((r) => r.locationId === l.id).map((r) => ({ id: r.id, name: r.name, locationId: r.locationId }))),
    services: svcs.map((s) => ({ id: s.id, name: s.name, durationMinutes: s.durationMinutes })),
  };
}

// ---------------------------------------------------------------- the staff member's language

/**
 * The dashboard language for a staff member: their own choice (users.locale), else
 * getStaffLocale() (cookie, Accept-Language, practice default), else, outside a request (tests,
 * jobs), the practice default.
 */
export async function staffLocaleOf(s: { user: { locale?: string | null }; org: { defaultLocale?: string | null } }): Promise<Locale> {
  if (isLocale(s.user.locale)) return s.user.locale;
  try {
    return await getStaffLocale();
  } catch {
    return isLocale(s.org.defaultLocale) ? s.org.defaultLocale : DEFAULT_LOCALE;
  }
}

/** Who is looking at a list: decides which names, flags and notes markers it may carry. */
export type ListViewer = { permissions: readonly Permission[]; locale: Locale };

export function listViewer(s: Pick<StaffSession, "role">, locale: Locale): ListViewer {
  return { permissions: permissionsFor(s.role), locale };
}

// ---------------------------------------------------------------- appointment list

export type ListOptions = {
  from?: Date;
  to?: Date;
  locationId?: string;
  practitionerIds?: string[];
  statuses?: AppointmentStatus[];
  includeCancelled?: boolean;
  patientId?: string;
  /** Only these appointments (the drawer's detail). */
  ids?: string[];
  needsAttention?: boolean;
  order?: "asc" | "desc";
  limit?: number;
  /**
   * The viewer. Without one the list is built for a viewer with no extra permissions: restricted
   * names are masked (in the practice's default language), no notes markers, no clinical flags.
   */
  viewer?: ListViewer;
};

/**
 * Appointments for the calendar and the lists, scoped to the org. Data minimisation: the rows
 * carry no free text (notes, cancellation reason), no contact details and no link token; the
 * encrypted columns are not even selected, only whether the notes are empty. A restricted or
 * erased patient's name is replaced by a placeholder unless the viewer has
 * patient.restricted.read, and nothing else about that patient (no-show count, risk, minor flag)
 * is passed on.
 */
export async function listAppointments(orgId: string, opts: ListOptions = {}): Promise<ApptListDTO[]> {
  const conditions: SQL[] = [eq(appointments.orgId, orgId)];
  if (opts.from) conditions.push(gte(appointments.startsAt, opts.from));
  if (opts.to) conditions.push(lt(appointments.startsAt, opts.to));
  if (opts.locationId) conditions.push(eq(appointments.locationId, opts.locationId));
  if (opts.practitionerIds?.length) conditions.push(inArray(appointments.practitionerId, opts.practitionerIds));
  if (opts.statuses?.length) conditions.push(inArray(appointments.status, opts.statuses));
  else if (!opts.includeCancelled) conditions.push(ne(appointments.status, "cancelled"));
  if (opts.patientId) conditions.push(eq(appointments.patientId, opts.patientId));
  if (opts.ids) conditions.push(opts.ids.length ? inArray(appointments.id, opts.ids) : sql`0`);
  if (opts.needsAttention) conditions.push(eq(appointments.needsAttention, true));

  const query = db
    .select({
      id: appointments.id,
      startsAt: appointments.startsAt,
      endsAt: appointments.endsAt,
      blockedUntil: appointments.blockedUntil,
      status: appointments.status,
      confirmation: appointments.confirmation,
      confirmedVia: appointments.confirmedVia,
      needsAttention: appointments.needsAttention,
      source: appointments.source,
      isNewPatient: appointments.isNewPatient,
      processingContext: appointments.processingContext,
      minorFlag: appointments.minorFlag,
      // Whether there is a note, without selecting (and decrypting) it.
      hasNotes: sql<number>`(${appointments.patientNote} is not null or ${appointments.internalNote} is not null)`,
      patient: {
        id: patients.id,
        firstName: patients.firstName,
        lastName: patients.lastName,
        noShowCount: patients.noShowCount,
        preferredChannel: patients.preferredChannel,
        restrictedAt: patients.restrictedAt,
        erasedAt: patients.erasedAt,
      },
      service: { id: services.id, name: services.name, durationMinutes: services.durationMinutes },
      practitioner: { id: practitioners.id, title: practitioners.title, name: practitioners.name, color: practitioners.color },
      location: { id: locations.id, name: locations.name, timezone: locations.timezone },
      room: { id: rooms.id, name: rooms.name },
    })
    .from(appointments)
    .innerJoin(patients, eq(patients.id, appointments.patientId))
    .innerJoin(services, eq(services.id, appointments.serviceId))
    .innerJoin(practitioners, eq(practitioners.id, appointments.practitionerId))
    .innerJoin(locations, eq(locations.id, appointments.locationId))
    .leftJoin(rooms, eq(rooms.id, appointments.roomId))
    .where(and(...conditions))
    .orderBy(opts.order === "desc" ? desc(appointments.startsAt) : asc(appointments.startsAt));
  const rows = opts.limit ? await query.limit(opts.limit) : await query;
  if (!rows.length) return [];

  const perms = opts.viewer?.permissions ?? [];
  const seeRestricted = perms.includes("patient.restricted.read");
  const seeNotes = perms.includes("appointment.notes.read");
  const flags = await loadCareFlags(
    orgId,
    rows.map((r) => r.id),
    perms,
  );

  // The placeholder's language: the viewer's, else the practice's (looked up only when needed).
  let placeholderT: CalendarT | null = null;
  const placeholder = async (erased: boolean) => {
    placeholderT ??= getT(opts.viewer?.locale ?? (await orgLocale(orgId)), "calendar");
    return erased ? placeholderT("erasedPatient") : placeholderT("restrictedPatient");
  };

  const out: ApptListDTO[] = [];
  for (const r of rows) {
    const restricted = Boolean(r.patient.restrictedAt || r.patient.erasedAt);
    const masked = restricted && !seeRestricted;
    const f = flags.get(r.id);
    out.push({
      id: r.id,
      start: r.startsAt.toISOString(),
      end: r.endsAt.toISOString(),
      blockedUntil: r.blockedUntil.toISOString(),
      status: r.status,
      confirmation: r.confirmation,
      confirmedVia: r.confirmedVia,
      needsAttention: r.needsAttention,
      source: r.source,
      isNewPatient: r.isNewPatient,
      processingContext: r.processingContext,
      hasNotes: !masked && seeNotes && Boolean(r.hasNotes),
      minorFlag: !masked && r.minorFlag,
      riskLevel: masked ? null : (f?.riskLevel ?? null),
      riskReasons: masked ? [] : (f?.riskReasons ?? []),
      anamnesis: masked ? null : (f?.anamnesis ?? null),
      redFlag: masked ? null : (f?.redFlag ?? null),
      restricted,
      patient: {
        id: r.patient.id,
        name: masked ? await placeholder(Boolean(r.patient.erasedAt)) : fullName(r.patient),
        masked,
        noShowCount: masked ? 0 : r.patient.noShowCount,
        preferredChannel: r.patient.preferredChannel,
      },
      service: r.service,
      practitioner: { id: r.practitioner.id, name: practitionerName(r.practitioner), color: r.practitioner.color },
      location: r.location,
      room: r.room?.id ? { id: r.room.id, name: r.room.name } : null,
    });
  }
  return out;
}

async function orgLocale(orgId: string): Promise<Locale> {
  const [org] = await db.select({ defaultLocale: organizations.defaultLocale }).from(organizations).where(eq(organizations.id, orgId));
  return isLocale(org?.defaultLocale) ? org.defaultLocale : DEFAULT_LOCALE;
}

// ---------------------------------------------------------------- the drawer's detail

const MESSAGE_LIMIT = 50;

/**
 * One appointment as the drawer shows it, filtered by the viewer's permissions: contacts with
 * patient.contact.read, notes with appointment.notes.read, the message thread with messages.read.
 * A restricted patient's record opens only after the viewer gave a reason (patient.restricted.read
 * plus a recent patient.restricted_access row). Null for another org's appointment.
 *
 * Every call writes exactly one audit row, appointment.view, with what was disclosed (as
 * booleans and counts, never the values).
 */
export async function loadAppointmentDetail(s: StaffSession, id: string, locale: Locale): Promise<ApptDetailDTO | null> {
  const viewer = listViewer(s, locale);
  const [row] = await listAppointments(s.org.id, { ids: [id], includeCancelled: true, viewer });
  if (!row) return null;

  let restricted: RestrictedAccess = "open";
  if (row.restricted) {
    if (!can(s.role, "patient.restricted.read")) restricted = "placeholder";
    else if (!(await hasRestrictedAccess(s, row.patient.id))) restricted = "needs_reason";
  }
  const open = restricted === "open";
  const access: ApptDetailDTO["access"] = {
    restricted,
    contacts: open && can(s.role, "patient.contact.read"),
    notes: open && can(s.role, "appointment.notes.read"),
    writeNotes: open && can(s.role, "appointment.notes.write"),
    messages: open && can(s.role, "messages.read"),
    write: can(s.role, "appointment.write"),
    manageCare: open && can(s.role, "recalls.manage"),
  };

  const [full] = await db
    .select({
      patientNote: appointments.patientNote,
      internalNote: appointments.internalNote,
      cancelReason: appointments.cancelReason,
      bookedFor: appointments.bookedFor,
      phone: patients.phone,
      email: patients.email,
      guardianName: patients.guardianName,
      guardianRelation: patients.guardianRelation,
      guardianPhone: patients.guardianPhone,
      guardianEmail: patients.guardianEmail,
    })
    .from(appointments)
    .innerJoin(patients, eq(patients.id, appointments.patientId))
    .where(and(eq(appointments.id, id), eq(appointments.orgId, s.org.id)));

  let contacts: ApptDetailDTO["contacts"] = null;
  if (access.contacts && full) {
    const waLinks = getPrivacy(s.org).staffWaLinks;
    const hasGuardian = full.guardianName || full.guardianPhone || full.guardianEmail;
    contacts = {
      phone: full.phone,
      email: full.email,
      whatsappUrl: waLinks && full.phone ? `https://wa.me/${full.phone.replace(/\D/g, "")}` : null,
      guardian: hasGuardian
        ? { name: full.guardianName, relation: full.guardianRelation, phone: full.guardianPhone, email: full.guardianEmail }
        : null,
    };
  }

  let thread: ThreadMessage[] | null = null;
  if (access.messages) {
    const rows = await db
      .select({
        id: messages.id,
        channel: messages.channel,
        direction: messages.direction,
        status: messages.status,
        intent: messages.intent,
        createdAt: messages.createdAt,
        subject: messages.subject,
        body: messages.body,
      })
      .from(messages)
      .where(and(eq(messages.appointmentId, id), eq(messages.orgId, s.org.id)))
      .orderBy(desc(messages.createdAt))
      .limit(MESSAGE_LIMIT);
    // Sent texts carry the patient's personal links (manage page, review, calendar file): staff
    // get those only through issuePatientLink(), which is audited, never off the thread.
    const linkLabel = getT(locale, "calendar")("drawer.linkRedacted");
    thread = rows.reverse().map((m) => ({
      ...m,
      subject: m.subject === null ? null : redactPatientLinks(m.subject, linkLabel),
      body: redactPatientLinks(m.body, linkLabel),
      createdAt: m.createdAt.toISOString(),
    }));
  }

  // Clearing the flag ("Mark handled") withdraws a rebooking offer (WP8): the drawer warns first.
  const rebookOfferSent = row.needsAttention && access.write ? (await rebookStatus(s.org.id, id)).offerSent : false;
  // A Sorriso booking for another adult is held until that adult confirms it (approveRequest refuses it).
  const awaitingAdultConfirmation =
    row.status === "requested" && full ? await awaitsAdultConsent(db, { id, processingContext: row.processingContext, bookedFor: full.bookedFor }) : false;

  const detail: ApptDetailDTO = {
    ...row,
    access,
    contacts,
    patientNote: access.notes ? (full?.patientNote ?? null) : null,
    internalNote: access.notes ? (full?.internalNote ?? null) : null,
    cancelReason: access.notes ? (full?.cancelReason ?? null) : null,
    messages: thread,
    rebookOfferSent,
    awaitingAdultConfirmation,
  };
  await auditStaff(
    s,
    "appointment.view",
    { type: "appointment", id },
    {
      metadata: {
        view: "drawer",
        restricted,
        contacts: access.contacts,
        notes: access.notes,
        messages: thread?.length ?? null,
      },
    },
  );
  return detail;
}

/**
 * A URL path that works as a patient's key: the manage page and everything under it (/a/<token>,
 * review, privacy, rebook, forms; with or without a locale prefix) and the visit's calendar file.
 */
const TOKEN_PATH = /^\/(?:[a-z]{2}\/)?(?:a|api\/ics\/appointment)\/[^/?#]+/;
const URL_IN_TEXT = /\bhttps?:\/\/[^\s<>"']+/gi;

/** Replace every personal patient link in a message text with `placeholder`; other links stay. */
export function redactPatientLinks(text: string, placeholder: string): string {
  return text.replace(URL_IN_TEXT, (raw) => {
    // Punctuation that ends the sentence is not part of the link.
    const trail = /[.,;:!?)\]]+$/.exec(raw)?.[0] ?? "";
    const url = trail ? raw.slice(0, -trail.length) : raw;
    let path: string;
    try {
      path = new URL(url).pathname;
    } catch {
      return raw;
    }
    return TOKEN_PATH.test(path) ? `${placeholder}${trail}` : raw;
  });
}

// ---------------------------------------------------------------- the list's "Call" button

export type PhoneLookup = { ok: true; phone: string | null } | { ok: false; code: "forbidden" | "not_found" | "restricted" };

/**
 * Only the patient's mobile number, for a list row's "Call" button: needs patient.contact.read;
 * a restricted (or erased) patient's number only after the viewer gave a reason (as in the
 * drawer). Audited as appointment.view (view "call"); another org's id is not_found, unaudited.
 */
export async function loadAppointmentPhone(s: StaffSession, id: string): Promise<PhoneLookup> {
  if (!can(s.role, "patient.contact.read")) return { ok: false, code: "forbidden" };
  const [row] = await db
    .select({ patientId: patients.id, phone: patients.phone, restrictedAt: patients.restrictedAt, erasedAt: patients.erasedAt })
    .from(appointments)
    .innerJoin(patients, and(eq(patients.id, appointments.patientId), eq(patients.orgId, s.org.id)))
    .where(and(eq(appointments.id, id), eq(appointments.orgId, s.org.id)));
  if (!row) return { ok: false, code: "not_found" };
  if (row.restrictedAt || row.erasedAt) {
    const unlocked = can(s.role, "patient.restricted.read") && (await hasRestrictedAccess(s, row.patientId));
    if (!unlocked) return { ok: false, code: "restricted" };
  }
  await auditStaff(s, "appointment.view", { type: "appointment", id }, { metadata: { view: "call", contacts: true } });
  return { ok: true, phone: row.phone };
}

// ---------------------------------------------------------------- list views in the access log

/**
 * Record that a list of patients' appointments was shown (calendar, overview, confirmations:
 * appointment.list; the waitlist: waitlist.view): one row per view, no entity, with the count,
 * never the names. The drawer audits each record it opens (appointment.view).
 */
export async function auditListView(s: StaffSession, view: string, count: number, action: Extract<AuditAction, "appointment.list" | "waitlist.view"> = "appointment.list") {
  if (count > 0) await auditStaff(s, action, undefined, { metadata: { view, count } });
}

// ---------------------------------------------------------------- actions in the staff's language

export type CalendarT = Translator<"calendar">;

/** The calendar namespace in the staff member's language, plus that language. */
export async function calendarTexts(s: Parameters<typeof staffLocaleOf>[0]): Promise<{ t: CalendarT; locale: Locale }> {
  const locale = await staffLocaleOf(s);
  return { t: getT(locale, "calendar"), locale };
}

/**
 * A domain error as a localised ActionResult: BookingError codes map to calendar.errors.<code>
 * (or calendar.errors.reasons.<reason> for a privacy, relation or restriction rule), Zod issues
 * carry the zodErrorMap message prefixed with the field's label. Null for anything else.
 */
export function localiseError(err: unknown, t: CalendarT): ActionResult | null {
  // A BookingError too, but guard() answers it: requireStepUp()'s own (localised) message with
  // the code the UI acts on (useSecureAction sends the user to the verification page).
  if (isStepUpRequired(err)) return null;
  if (err instanceof BookingError) {
    const reasonKey = `errors.reasons.${err.reason ?? ""}` as const;
    if (err.reason && t.has(reasonKey)) return fail(t(reasonKey), err.reason === "restriction_reason_required" ? "restricted" : err.code);
    const key = `errors.${err.code}` as const;
    return fail(t.has(key) ? t(key) : t("errors.unexpected"), err.code);
  }
  if (err instanceof z.ZodError) {
    const issue = err.issues[0];
    if (!issue) return fail(t("errors.invalid"), "invalid");
    const field = `fields.${String(issue.path[0] ?? "")}` as const;
    return fail(t.has(field) ? t("validation.field", { field: t(field), message: issue.message }) : issue.message, "invalid");
  }
  return null;
}

/**
 * guard() with every message in the staff member's language: `fn` receives the calendar
 * translator and the locale (for zodErrorMap), domain errors are localised, a missing permission
 * reads calendar.errors.forbidden and an unexpected error calendar.errors.unexpected.
 */
export async function dashboardAction(
  fn: (s: StaffSession, t: CalendarT, locale: Locale) => Promise<ActionResult>,
  opts: GuardOptions = {},
): Promise<ActionResult> {
  const res = await guard(async (s) => {
    const { t, locale } = await calendarTexts(s);
    try {
      return await fn(s, t, locale);
    } catch (err) {
      const failure = localiseError(err, t);
      if (failure) return failure;
      // Next.js redirects and notFound() propagate; guard() answers permission and step-up errors.
      if (err instanceof PermissionError || isStepUpRequired(err) || (err && typeof err === "object" && "digest" in err)) throw err;
      logError("dashboard action", err);
      return fail(t("errors.unexpected"), "unexpected");
    }
  }, opts);
  if (!res.ok && res.code === "forbidden") {
    const { t } = await calendarTexts(await staff());
    return fail(t("errors.forbidden"), "forbidden");
  }
  return res;
}
