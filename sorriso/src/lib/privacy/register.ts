import type { Locale } from "@/db/enums";
import type { OrgSettings, Organization, RetentionSettings } from "@/db/schema";
import { fmtDay } from "@/i18n/datefmt";
import { getT } from "@/i18n/t";
import { RETENTION_LIMITS } from "./settings";
import { PURPOSES, type DataCategory, type DataSubject, type LegalBasis, type ProcessingPurpose } from "./roles";
import { activeSubprocessors, type Subprocessor, type TransferTool } from "./subprocessors";

/**
 * The practice's record of processing activities (Art. 30(1)), generated from what Sorriso
 * actually does for it: one row per active processing purpose (roles.ts PURPOSES with controller
 * 'practice', filtered by the practice's settings), its retention settings and the
 * sub-processors that receive the data (subprocessors.ts). Practices add free rows for what they
 * do outside Sorriso (paper records, invoicing, X-rays…).
 *
 * The columns follow the Garante's simplified template for the controller's register (finalità,
 * categorie di interessati e di dati, destinatari, trasferimenti, termini di cancellazione,
 * misure di sicurezza), with the activity and its legal basis in front as the Garante recommends.
 *
 * Sorriso's own register (purposes it controls) is docs/privacy/ropa-sorriso.md.
 *
 * Also the source of the technical and organisational measures listed in the DPA annex
 * (SECURITY_CONTROLS): only controls that exist in the code are listed.
 */

export const REGISTER_COLUMNS = [
  "activity",
  "purpose",
  "legalBasis",
  "subjects",
  "dataCategories",
  "recipients",
  "transfers",
  "retention",
  "security",
] as const;
export type RegisterColumn = (typeof REGISTER_COLUMNS)[number];

export type RegisterRow = { id: string; custom: boolean } & Record<RegisterColumn, string>;

/** A free row written by the practice (an activity outside Sorriso). Stored in organizations.settings.register. */
export type CustomRegisterEntry = { id: string } & Record<RegisterColumn, string>;

export const MAX_CUSTOM_ENTRIES = 30;
export const MAX_CUSTOM_FIELD = 600;

/**
 * Technical and organisational measures (Art. 32) that are implemented in the code, with where.
 * The DPA annex and the register's security column are generated from this list; a control is
 * added here only once it exists. Labels: legalPractice.controls.<id>.
 */
export const SECURITY_CONTROLS = [
  { id: "encryption", evidence: "src/lib/crypto.ts, src/db/encrypted.ts" },
  { id: "transport", evidence: "Vercel TLS, src/lib/security/headers.ts" },
  { id: "access_control", evidence: "src/lib/permissions.ts" },
  { id: "mfa", evidence: "src/lib/auth.ts (requireStepUp), organizations.settings.privacy.requireMfa" },
  { id: "sessions", evidence: "src/lib/auth.ts, organizations.settings.privacy.sessionHours" },
  { id: "audit_log", evidence: "src/lib/audit.ts (HMAC chain, verifyAuditChain, daily head logging)" },
  { id: "pseudonymous_logs", evidence: "src/lib/log.ts (redact), src/lib/rate-limit.ts (HMAC of IP)" },
  { id: "rate_limiting", evidence: "src/lib/rate-limit.ts" },
  { id: "links", evidence: "src/lib/links.ts (hashed, expiring manage links)" },
  { id: "otp", evidence: "src/lib/otp.ts (hashed one-time codes, attempt limits)" },
  { id: "discreet_messages", evidence: "organizations.settings.privacy.messageContentLevel" },
  { id: "retention", evidence: "src/lib/privacy/retention.ts (daily)" },
  { id: "erasure", evidence: "src/lib/privacy/erasure.ts" },
  { id: "backups", evidence: "Turso point-in-time backups (EU)" },
  { id: "key_rotation", evidence: "src/lib/crypto.ts (DATA_ENCRYPTION_KEYS, needsReencrypt)" },
  { id: "no_trackers", evidence: "scripts/check-third-party.ts" },
  { id: "staff_instructions", evidence: "legal_acceptances (staff_instructions), src/lib/privacy/gates.ts" },
  { id: "breach_procedure", evidence: "docs/privacy/breach-runbook.md" },
] as const;
export type SecurityControlId = (typeof SECURITY_CONTROLS)[number]["id"];

/** Which of the practice's processing purposes are switched on by its settings. */
export function activePurposes(settings: OrgSettings, opts: { hasApiKeys?: boolean } = {}): ProcessingPurpose[] {
  const on: Partial<Record<ProcessingPurpose, boolean>> = {
    recalls: settings.care.recallsEnabled,
    feedback_requests: settings.reminders.requestReviews,
    marketing: settings.privacy.marketingEnabled,
    adaptive_reminders: settings.privacy.riskBasedReminders,
    anamnesis: settings.care.anamnesisEnabled,
    partner_api: Boolean(opts.hasApiKeys),
  };
  return (Object.keys(PURPOSES) as ProcessingPurpose[]).filter((p) => PURPOSES[p].controller === "practice" && (on[p] ?? true));
}

type T = ReturnType<typeof getT<"legalPractice">>;

/** "120 months" / "90 days" for one retention setting, in `locale`. */
export function retentionValue(t: T, key: keyof RetentionSettings, value: number): string {
  const unit = RETENTION_LIMITS[key].unit;
  return unit === "days" ? t("units.days", { count: value }) : unit === "hours" ? t("units.hours", { count: value }) : t("units.months", { count: value });
}

/** The retention rule(s) that apply to a purpose, as text: the purpose's own key plus related ones. */
export function retentionText(t: T, purpose: ProcessingPurpose, r: RetentionSettings): string {
  const parts: string[] = [];
  const add = (key: keyof RetentionSettings) => parts.push(t(`retention.${key}`, { period: retentionValue(t, key, r[key]) }));
  switch (purpose) {
    case "booking_practice":
    case "appointment_management":
      add("patientInactiveMonths");
      add("neverSeenPatientMonths");
      add("patientNoteDays");
      break;
    case "reminders":
    case "feedback_requests":
    case "adaptive_reminders":
      add("messageBodyMonths");
      add("messageMetaMonths");
      add("reminderDays");
      break;
    case "waitlist":
      add("waitlistDays");
      break;
    case "recalls":
    case "no_show_tracking":
      add("patientInactiveMonths");
      break;
    case "marketing":
      parts.push(t("retention.marketingLapse"));
      add("consentMonths");
      break;
    case "anamnesis":
      add("formSubmissionMonths");
      break;
    case "security_logs":
      add("auditMonths");
      break;
    case "privacy_requests":
      add("privacyRequestMonths");
      break;
    default: {
      const key = PURPOSES[purpose].retentionKey;
      if (key) add(key);
      else parts.push(t("retention.contract"));
    }
  }
  return parts.join(" ");
}

export function legalBasisText(t: T, bases: LegalBasis[]): string {
  return bases.map((b) => t(`legalBases.${b}`)).join("; ");
}

export function categoriesText(t: T, cats: DataCategory[]): string {
  return cats.map((c) => t(`dataCategories.${c}`)).join(", ");
}

export function subjectsText(t: T, subjects: DataSubject[]): string {
  return subjects.map((s) => t(`subjects.${s}`)).join(", ");
}

export function transferToolText(t: T, tool: TransferTool): string {
  return t(`transferTools.${tool === "dpf+scc" ? "dpf_scc" : tool}`);
}

/** "Twilio (Twilio Ireland Limited): SMS" for each sub-processor receiving data for the purpose. */
/** The sub-processor's service, translated ("SMS messages"). */
export function serviceText(t: T, s: Pick<Subprocessor, "service">): string {
  const key = `subprocessors.service.${s.service}` as const;
  return t.has(key) ? t(key) : s.service;
}

function recipientsText(t: T, subs: Subprocessor[]): string {
  const recipients = subs.map((s) => t("register.recipient", { name: s.name, service: serviceText(t, s) }));
  return [t("register.processor"), ...recipients].join("; ");
}

function transfersText(t: T, subs: Subprocessor[]): string {
  const out = subs
    .filter((s) => s.transfer !== "eu")
    .map((s) => t("register.transfer", { name: s.name, tool: transferToolText(t, s.transfer) }));
  return out.length ? out.join("; ") : t("register.noTransfers");
}

/** The security column: the implemented controls, with the practice's own choices (MFA, sessions, message detail). */
export function securityText(t: T, settings: OrgSettings): string {
  const p = settings.privacy;
  const own = [
    p.requireMfa ? t("register.security.mfaRequired") : t("register.security.mfaOptional"),
    t("register.security.sessions", { count: p.sessionHours }),
    p.messageContentLevel === "discreet" ? t("register.security.discreet") : t("register.security.detailed"),
  ];
  return [t("register.security.platform"), ...own].join(" ");
}

export type RegisterOrg = Pick<
  Organization,
  "id" | "name" | "legalName" | "vatNumber" | "registeredAddress" | "privacyEmail" | "dpoName" | "dpoEmail" | "email" | "phone"
>;

export type Register = {
  controller: { name: string; vatNumber: string | null; address: string | null; contact: string | null; dpo: string | null };
  rows: RegisterRow[];
  generatedAt: Date;
  locale: Locale;
};

/** The practice's register in `locale` (Italian is the language the Garante expects). */
export function buildRegister(
  org: RegisterOrg,
  settings: OrgSettings,
  opts: { locale: Locale; hasApiKeys?: boolean; custom?: CustomRegisterEntry[]; now?: Date },
): Register {
  const t = getT(opts.locale, "legalPractice");
  const rows: RegisterRow[] = activePurposes(settings, opts).map((id) => {
    const info = PURPOSES[id];
    const subs = activeSubprocessors(settings.privacy).filter((s) => info.recipients.includes(s.id));
    return {
      id,
      custom: false,
      activity: t(`purposes.${id}.activity`),
      purpose: t(`purposes.${id}.purpose`),
      legalBasis: legalBasisText(t, info.legalBases),
      subjects: subjectsText(t, info.subjects),
      dataCategories: categoriesText(t, info.dataCategories),
      recipients: recipientsText(t, subs),
      transfers: transfersText(t, subs),
      retention: retentionText(t, id, settings.privacy.retention),
      security: securityText(t, settings),
    };
  });
  for (const c of opts.custom ?? []) rows.push({ ...c, custom: true });
  const dpo = org.dpoName || org.dpoEmail ? [org.dpoName, org.dpoEmail].filter(Boolean).join(" — ") : null;
  return {
    controller: {
      name: org.legalName ?? org.name,
      vatNumber: org.vatNumber,
      address: org.registeredAddress,
      contact: org.privacyEmail ?? org.email ?? org.phone,
      dpo,
    },
    rows,
    generatedAt: opts.now ?? new Date(),
    locale: opts.locale,
  };
}

/**
 * Values that start like a formula but can't run as one, kept as they are so exports stay
 * machine-readable: plain numbers, E.164 phone numbers ("+393331234567") and the masked numbers
 * left by an erasure ("+39•••4567"). A spreadsheet reads them as a number or an error at worst.
 */
const INERT = /^(-?\d+(\.\d+)?|\+\d{6,15}|\+\d{2}•+\d{4})$/;

/** One CSV cell: quoted when needed; formula-looking text is defused for spreadsheet apps. */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s = value instanceof Date ? value.toISOString() : typeof value === "object" ? JSON.stringify(value) : String(value);
  if (/^[=+\-@\t\r]/.test(s) && !INERT.test(s)) s = `'${s}`;
  return /[",\r\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** RFC 4180 CSV (CRLF line ends) with a header row. */
export function toCsv(columns: readonly string[], rows: readonly Record<string, unknown>[], header: readonly string[] = columns): string {
  const lines = [header.map(csvCell).join(",")];
  for (const r of rows) lines.push(columns.map((c) => csvCell(r[c])).join(","));
  return `${lines.join("\r\n")}\r\n`;
}

/** The register as CSV, headers in the register's language, with a byte-order mark for spreadsheet apps. */
export function registerCsv(register: Register): string {
  const t = getT(register.locale, "legalPractice");
  const header = REGISTER_COLUMNS.map((c) => t(`register.columns.${c}`));
  return `﻿${toCsv(REGISTER_COLUMNS, register.rows, header)}`;
}

/** The practice's free rows, from organizations.settings.register (anything malformed is skipped). */
export function customRegisterEntries(org: { settings: unknown }): CustomRegisterEntry[] {
  const raw = (org.settings as { register?: unknown } | null)?.register;
  if (!Array.isArray(raw)) return [];
  const out: CustomRegisterEntry[] = [];
  for (const item of raw.slice(0, MAX_CUSTOM_ENTRIES)) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    if (typeof r.id !== "string" || typeof r.activity !== "string" || !r.activity.trim()) continue;
    const entry = { id: r.id } as CustomRegisterEntry;
    for (const c of REGISTER_COLUMNS) entry[c] = typeof r[c] === "string" ? (r[c] as string).slice(0, MAX_CUSTOM_FIELD) : "";
    out.push(entry);
  }
  return out;
}

// ---------------------------------------------------------------- legal documents (DPA annexes, sub-processor page)

export type SubprocessorRow = {
  id: string;
  name: string;
  legalEntity: string;
  parent: string | null;
  service: string;
  data: string;
  region: string;
  transfer: string;
  dpaUrl: string | null;
  onlyWhatsapp: boolean;
};

export type LegalDocumentData = {
  /** "Sorriso S.r.l., Via …. Privacy contact: …" */
  platform: string;
  annex1: { id: string; activity: string; purpose: string; legalBasis: string; subjects: string; dataCategories: string }[];
  controls: { id: string; title: string; body: string }[];
  subprocessors: SubprocessorRow[];
  changes: { version: string; announced: string; effective: string; items: string[] }[];
};

/**
 * What the DPA annexes and the sub-processor page show, in `locale`: Sorriso's processor
 * activities (Annex I), the implemented security controls (Annex II) and the sub-processors with
 * their transfer tools (Annex III), plus the list's change log.
 */
export function legalDocumentData(locale: Locale, changes: readonly { version: string; announced: string; effective: string; items: { type: string; id?: string }[] }[]): LegalDocumentData {
  const t = getT(locale, "legalPractice");
  const name = process.env.PLATFORM_LEGAL_NAME || "Sorriso";
  const email = process.env.PLATFORM_PRIVACY_EMAIL || process.env.PLATFORM_DPO_EMAIL || "privacy@sorriso.example";
  const address = process.env.PLATFORM_ADDRESS;
  const subs = activeSubprocessors({ whatsappEnabled: true });
  const day = (d: string) => fmtDay(d, "long", locale);
  return {
    platform: address ? t("common.platformParty", { name, address, email }) : t("common.platformPartyShort", { name, email }),
    annex1: (Object.keys(PURPOSES) as ProcessingPurpose[])
      .filter((id) => PURPOSES[id].sorrisoRole === "processor")
      .map((id) => ({
        id,
        activity: t(`purposes.${id}.activity`),
        purpose: t(`purposes.${id}.purpose`),
        legalBasis: legalBasisText(t, PURPOSES[id].legalBases),
        subjects: subjectsText(t, PURPOSES[id].subjects),
        dataCategories: categoriesText(t, PURPOSES[id].dataCategories),
      })),
    controls: SECURITY_CONTROLS.map((c) => ({ id: c.id, title: t(`controls.${c.id}.title`), body: t(`controls.${c.id}.body`) })),
    subprocessors: subs.map((s) => ({
      id: s.id,
      name: s.name,
      legalEntity: s.legalEntity,
      parent: s.parent,
      service: serviceText(t, s),
      data: s.dataCategories
        .map((c) => {
          const key = `subprocessors.data.${c}` as const;
          return t.has(key) ? t(key) : c;
        })
        .join(", "),
      region: s.region ?? t("common.notConfigured"),
      transfer: transferToolText(t, s.transfer),
      dpaUrl: s.dpaUrl,
      onlyWhatsapp: s.onlyWhen === "whatsapp_enabled",
    })),
    changes: changes.map((c) => ({
      version: c.version,
      announced: day(c.announced),
      effective: day(c.effective),
      items: c.items.map((i) => {
        const sub = i.id ? subs.find((s) => s.id === i.id)?.name ?? i.id : "";
        const key = `subprocessors.change.${i.type}` as const;
        return t.has(key) ? t(key, { name: sub } as never) : i.type;
      }),
    })),
  };
}
