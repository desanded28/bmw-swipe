import { and, asc, eq, isNull } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { LOCALES, type Locale, type NoticeKind } from "@/db/enums";
import { noticeVersions, organizations, type Organization, type RetentionSettings } from "@/db/schema";
import { LOCALE_COOKIE } from "@/i18n/config";
import { fmtDay, zonedDate } from "@/i18n/datefmt";
import { lhref, swapLocale } from "@/i18n/href";
import { getT } from "@/i18n/t";
import type { Translator } from "@/i18n/types";
import { absoluteUrl, APP_NAME, DEFAULT_TIMEZONE } from "../config";
import { sha256Hex } from "../crypto";
import { newId } from "../ids";
import { resolveSettings } from "../settings";
import { PATIENT_SESSION_COOKIE_NAMES } from "./patient-session";
import { PLATFORM_RETENTION } from "./retention";
import { PURPOSES, type DataSubject, type LegalBasis, type ProcessingPurpose } from "./roles";
import { DEFAULT_RETENTION, RETENTION_LIMITS } from "./settings";
import { activeSubprocessors, SUBPROCESSORS, type Subprocessor, type TransferTool } from "./subprocessors";
import { NOTICE_VERSIONS } from "./versions";

/**
 * Privacy notices (Art. 13 and 14 GDPR), generated rather than hand-written so they always match
 * the processing register: roles.ts PURPOSES (purposes, legal bases, profiling, objection),
 * SUBPROCESSORS (recipients, transfers and their safeguards), the practice's controller fields
 * and its settings (active purposes, getPrivacy(org).retention).
 *
 * Kinds:
 * - practice_patient  the practice's notice to its patients (needs `org`);
 * - minor             the same for children and teenagers, in simple words (needs `org`);
 * - platform_patient  Sorriso's own notice: marketplace controller, processor for practices;
 * - cookies           the cookie notice;
 * - staff             Sorriso's notice to practice staff (accounts, access log, Art. 4 L. 300/1970);
 * - practitioner      Sorriso's notice to listed practitioners (profiles, Albo checks, reviews, ranking).
 *
 * buildNotice is pure and synchronous, so previews of unsaved settings (WP5) record nothing.
 * publishNotice / recordNoticeVersion record a notice_versions row whenever the rendered content
 * changes, which is what proves the wording a patient was shown: an appointment stores the
 * notice version and language, and notice_versions maps them to the content hash in force.
 *
 * Section bodies are plain text: paragraphs separated by a blank line; a paragraph whose lines
 * all start with "- " is a list. NoticeView (src/components/privacy) renders that and links
 * URLs and email addresses.
 */

/** The practice fields a notice reads: controller identity, DPO, contacts and settings. */
export type NoticeOrg = Pick<
  Organization,
  | "id"
  | "slug"
  | "name"
  | "legalName"
  | "vatNumber"
  | "registeredAddress"
  | "privacyEmail"
  | "dpoName"
  | "dpoEmail"
  | "email"
  | "phone"
  | "settings"
>;

/** One block of the notice; `id` is a stable anchor (#controller, #purposes, #rights...). */
export type NoticeSection = { id: string; title: string; body: string };

export type Notice = {
  /** NOTICE_VERSIONS[kind]: what appointments store as noticeVersion. */
  version: string;
  sections: NoticeSection[];
  /** sha256 of the rendered content; a notice_versions row is recorded whenever it changes. */
  contentHash: string;
};

export const PRACTICE_NOTICE_KINDS: readonly NoticeKind[] = ["practice_patient", "minor"];

export function isPracticeNotice(kind: NoticeKind): boolean {
  return PRACTICE_NOTICE_KINDS.includes(kind);
}

/** Where each notice is published (before the locale prefix). */
export function noticePath(kind: NoticeKind, orgSlug?: string): string {
  switch (kind) {
    case "practice_patient":
      return `/c/${orgSlug}/privacy`;
    case "minor":
      return `/c/${orgSlug}/privacy/minors`;
    case "cookies":
      return "/legal/cookies";
    case "staff":
      return "/legal/privacy?for=staff";
    case "practitioner":
      return "/legal/privacy?for=practitioners";
    default:
      return "/legal/privacy";
  }
}

// ---------------------------------------------------------------- browser storage (cookie notice)

/** Cookies set by Sorriso, by purpose; names as they appear in the browser. */
export const COOKIES = {
  /** src/lib/auth.ts SESSION_COOKIE_NAMES (checked by notices.test.ts). */
  staffSession: ["__Host-sorriso_session", "sorriso_session"],
  locale: [LOCALE_COOKIE],
  privacyCenter: [...PATIENT_SESSION_COOKIE_NAMES],
} as const;

/**
 * Keys Sorriso's pages keep in the browser's localStorage or sessionStorage (per-viewer
 * conveniences only). A package that adds one adds it here, with its purpose under
 * legalPatient.cookies.storageItems, so the cookie notice lists it. None today.
 */
export const BROWSER_STORAGE: readonly { key: string; purpose: string }[] = [];

// ---------------------------------------------------------------- building

type T = Translator<"legalPatient">;
type TC = Translator<"common">;

const list = (items: string[]) => items.map((i) => `- ${i}`).join("\n");
const paragraphs = (...blocks: (string | null | false | undefined)[]) => blocks.filter(Boolean).join("\n\n");
const env = (name: string) => process.env[name]?.trim() || null;

/** Sorriso as controller, from the deployment's environment (.env.example PLATFORM_*). */
function platformIdentity() {
  return {
    name: env("PLATFORM_LEGAL_NAME") ?? APP_NAME,
    address: env("PLATFORM_ADDRESS"),
    email: env("PLATFORM_PRIVACY_EMAIL") ?? env("PLATFORM_DPO_EMAIL"),
    dpoEmail: env("PLATFORM_DPO_EMAIL"),
  };
}

/** How people reach the practice about privacy: its privacy address, else its general email or phone. */
function practiceContact(org: NoticeOrg): string | null {
  return org.privacyEmail ?? org.email ?? org.phone ?? null;
}

function basesText(t: T, bases: LegalBasis[]): string {
  return bases.map((b) => t(`bases.${b}`)).join("; ");
}

function purposeItems(t: T, purposes: ProcessingPurpose[]): string {
  return list(
    purposes.map((p) =>
      t("purposes.item", { title: t(`purposes.${p}.title`), body: t(`purposes.${p}.body`), bases: basesText(t, PURPOSES[p].legalBases) }),
    ),
  );
}

function period(tc: TC, key: keyof RetentionSettings, value: number): string {
  const unit = RETENTION_LIMITS[key].unit;
  return unit === "days" ? tc("units.days", { count: value }) : unit === "hours" ? tc("units.hours", { count: value }) : tc("units.months", { count: value });
}

function transferTool(t: T, tool: TransferTool): string {
  return t(`transferTools.${tool === "dpf+scc" ? "dpf_scc" : tool}`);
}

function providerLines(t: T, subs: readonly Subprocessor[]): string[] {
  return subs.map((s) => {
    const key = `services.${s.service}` as const;
    const service = t.has(key) ? t(key) : s.service;
    return s.region
      ? t("recipients.provider", { name: s.name, entity: s.legalEntity, service, region: s.region })
      : t("recipients.providerNoRegion", { name: s.name, entity: s.legalEntity, service });
  });
}

function transfersBody(t: T, subs: readonly Subprocessor[], contact: string | null): string {
  const out = subs.filter((s) => s.transfer !== "eu");
  if (!out.length) return t("transfers.none");
  return paragraphs(
    t("transfers.intro"),
    list(out.map((s) => t("transfers.item", { name: s.name, tool: transferTool(t, s.transfer) }))),
    contact ? t("transfers.assessment", { email: contact }) : null,
  );
}

function rightsBody(t: T, locale: Locale, contact: string | null): string {
  return paragraphs(
    t("rights.intro"),
    list([
      t("rights.access"),
      t("rights.rectification"),
      t("rights.erasure"),
      t("rights.restriction"),
      t("rights.portability"),
      t("rights.objection"),
      t("rights.withdraw"),
      t("rights.automated"),
    ]),
    contact
      ? t("rights.how", { url: absoluteUrl(lhref(locale, "/privacy")), email: contact })
      : t("rights.howNoContact", { url: absoluteUrl(lhref(locale, "/privacy")) }),
    t("rights.deadline"),
    t("rights.recipientsInformed"),
  );
}

/** The practice's purposes switched on by its settings (what this practice actually does). */
export function practicePurposes(settings: ReturnType<typeof resolveSettings>): ProcessingPurpose[] {
  const on: Partial<Record<ProcessingPurpose, boolean>> = {
    recalls: settings.care.recallsEnabled,
    feedback_requests: settings.reminders.requestReviews,
    marketing: settings.privacy.marketingEnabled,
    adaptive_reminders: settings.privacy.riskBasedReminders,
    anamnesis: settings.care.anamnesisEnabled,
  };
  return (Object.keys(PURPOSES) as ProcessingPurpose[]).filter((p) => PURPOSES[p].controller === "practice" && (on[p] ?? true));
}

/** Sorriso's own purposes that concern these people. */
function sorrisoPurposesFor(subjects: DataSubject[]): ProcessingPurpose[] {
  return (Object.keys(PURPOSES) as ProcessingPurpose[]).filter(
    (p) => PURPOSES[p].controller === "sorriso" && PURPOSES[p].subjects.some((s) => subjects.includes(s)),
  );
}

function practiceController(t: T, org: NoticeOrg): string {
  const lines = [
    t("controller.name", { name: org.legalName ?? org.name }),
    org.vatNumber ? t("controller.vat", { vat: org.vatNumber }) : null,
    org.registeredAddress ? t("controller.address", { address: org.registeredAddress }) : null,
    org.privacyEmail ?? org.email ? t("controller.contact", { email: (org.privacyEmail ?? org.email)! }) : null,
    org.phone ? t("controller.phone", { phone: org.phone }) : null,
  ].filter(Boolean);
  const dpo = org.dpoEmail
    ? org.dpoName
      ? t("controller.dpo", { name: org.dpoName, email: org.dpoEmail })
      : t("controller.dpoEmail", { email: org.dpoEmail })
    : t("controller.noDpo");
  return paragraphs(lines.join("\n"), dpo, t("controller.processor"));
}

function platformController(t: T): string {
  const p = platformIdentity();
  const lines = [
    t("controller.name", { name: p.name }),
    p.address ? t("controller.address", { address: p.address }) : null,
    p.email ? t("controller.contact", { email: p.email }) : null,
  ].filter(Boolean);
  return paragraphs(lines.join("\n"), p.dpoEmail ? t("controller.platformDpo", { email: p.dpoEmail }) : null);
}

function practicePatient(t: T, tc: TC, org: NoticeOrg, locale: Locale): NoticeSection[] {
  const settings = resolveSettings(org.settings);
  const retention = settings.privacy.retention;
  const contact = practiceContact(org);
  const purposes = practicePurposes(settings);
  const subs = activeSubprocessors(settings.privacy);
  const url = (path: string) => absoluteUrl(lhref(locale, path));
  const r = (key: keyof RetentionSettings) => t(`retention.${key}`, { period: period(tc, key, retention[key]) });
  const s = (id: string, title: string, body: string): NoticeSection => ({ id, title, body });
  return [
    s(
      "summary",
      t("sections.summary"),
      paragraphs(
        t("summary.practice", { practice: org.name }),
        contact ? t("summary.rights", { email: contact }) : t("summary.rightsNoContact"),
      ),
    ),
    s("controller", t("sections.controller"), practiceController(t, org)),
    s(
      "data",
      t("sections.data"),
      paragraphs(
        t("data.intro"),
        list([t("data.identity"), t("data.appointments"), t("data.yourWords"), t("data.guardian"), t("data.records"), t("data.technical")]),
        t("data.source"),
      ),
    ),
    s("purposes", t("sections.purposes"), purposeItems(t, purposes)),
    s(
      "marketplace",
      t("sections.marketplace"),
      paragraphs(t("marketplace.body", { url: url("/legal/privacy") }), t("marketplace.withdraw")),
    ),
    s(
      "recipients",
      t("sections.recipients"),
      paragraphs(
        t("recipients.intro"),
        list([t("recipients.staff"), t("recipients.sorriso"), t("recipients.providers"), t("recipients.authorities")]),
        list(providerLines(t, subs)),
        t("recipients.fullList", { url: url("/legal/subprocessors") }),
        t("recipients.notSold"),
      ),
    ),
    s("transfers", t("sections.transfers"), transfersBody(t, subs, platformIdentity().email ?? contact)),
    s(
      "retention",
      t("sections.retention"),
      paragraphs(
        t("retention.intro"),
        list(
          [
            r("patientInactiveMonths"),
            r("neverSeenPatientMonths"),
            r("patientNoteDays"),
            r("messageBodyMonths"),
            r("messageMetaMonths"),
            r("reminderDays"),
            r("providerMessageDays"),
            r("waitlistDays"),
            r("auditMonths"),
            settings.care.anamnesisEnabled ? r("formSubmissionMonths") : null,
            r("consentMonths"),
            r("privacyRequestMonths"),
            settings.privacy.marketingEnabled ? t("retention.marketingLapse") : null,
          ].filter((x): x is string => Boolean(x)),
        ),
        t("retention.after"),
      ),
    ),
    s("rights", t("sections.rights"), rightsBody(t, locale, contact)),
    s("complaint", t("sections.complaint"), t("complaint.body")),
    s("mandatory", t("sections.mandatory"), t("mandatory.practice")),
    s(
      "automated",
      t("sections.automated"),
      paragraphs(t("automated.none"), purposes.includes("adaptive_reminders") ? t("automated.profiling") : null),
    ),
    s(
      "minors",
      t("sections.minors"),
      paragraphs(t("minors.body"), t("minors.link", { url: url(noticePath("minor", org.slug)) })),
    ),
    s("cookies", t("sections.cookies"), t("cookiesLink.body", { url: url("/legal/cookies") })),
    s("changes", t("sections.changes"), t("changes.body", { version: NOTICE_VERSIONS.practice_patient })),
  ];
}

function minorNotice(t: T, org: NoticeOrg, locale: Locale): NoticeSection[] {
  const contact = practiceContact(org);
  const url = (path: string) => absoluteUrl(lhref(locale, path));
  return [
    { id: "summary", title: t("sections.summary"), body: t("minor.summary", { practice: org.name }) },
    {
      id: "who",
      title: t("sections.who"),
      body: contact
        ? t("minor.who", { controller: org.legalName ?? org.name, email: contact })
        : t("minor.whoNoContact", { controller: org.legalName ?? org.name }),
    },
    {
      id: "what",
      title: t("sections.what"),
      body: paragraphs(t("minor.whatIntro"), list([t("minor.whatName"), t("minor.whatAppointments"), t("minor.whatContact"), t("minor.whatMessages")])),
    },
    { id: "why", title: t("sections.why"), body: t("minor.why") },
    { id: "parents", title: t("sections.parents"), body: t("minor.parents") },
    { id: "keep", title: t("sections.keep"), body: t("minor.keep") },
    { id: "rights", title: t("sections.youCan"), body: t("minor.youCan", { url: url("/privacy") }) },
    { id: "complaint", title: t("sections.help"), body: t("minor.help") },
    { id: "full", title: t("sections.full"), body: t("minor.full", { url: url(noticePath("practice_patient", org.slug)) }) },
  ];
}

function platformPatient(t: T, tc: TC, locale: Locale): NoticeSection[] {
  const p = platformIdentity();
  const url = (path: string) => absoluteUrl(lhref(locale, path));
  const r = (key: keyof RetentionSettings) => t(`retention.${key}`, { period: period(tc, key, DEFAULT_RETENTION[key]) });
  const purposes = sorrisoPurposesFor(["patients", "guardians", "bookers", "reviewers"]);
  return [
    {
      id: "summary",
      title: t("sections.summary"),
      body: paragraphs(t("summary.platform"), p.email ? t("summary.rights", { email: p.email }) : t("summary.rightsNoContact")),
    },
    { id: "controller", title: t("sections.controller"), body: platformController(t) },
    {
      id: "roles",
      title: t("sections.roles"),
      body: paragraphs(t("roles.intro"), list([t("roles.controller"), t("roles.processor")])),
    },
    {
      id: "data",
      title: t("sections.data"),
      body: paragraphs(
        t("platformData.intro"),
        list([t("platformData.booking"), t("platformData.reviews"), t("platformData.privacyCenter"), t("platformData.technical")]),
      ),
    },
    { id: "purposes", title: t("sections.purposes"), body: purposeItems(t, purposes) },
    { id: "withdrawal", title: t("sections.withdrawal"), body: t("withdrawal.platform") },
    {
      id: "recipients",
      title: t("sections.recipients"),
      body: paragraphs(
        t("recipients.intro"),
        list([t("recipients.practices"), t("recipients.providers"), t("recipients.authorities")]),
        list(providerLines(t, SUBPROCESSORS)),
        t("recipients.fullList", { url: url("/legal/subprocessors") }),
        t("recipients.notSold"),
      ),
    },
    { id: "transfers", title: t("sections.transfers"), body: transfersBody(t, SUBPROCESSORS, p.email) },
    {
      id: "retention",
      title: t("sections.retention"),
      body: paragraphs(
        t("retention.intro"),
        list([
          t("retention.platformBookings"),
          t("retention.platformReviews"),
          r("consentMonths"),
          r("privacyRequestMonths"),
          r("auditMonths"),
          t("retention.platformCodes", { period: tc("units.days", { count: PLATFORM_RETENTION.verificationCodeDays }) }),
        ]),
        t("retention.after"),
      ),
    },
    { id: "rights", title: t("sections.rights"), body: rightsBody(t, locale, p.email) },
    { id: "complaint", title: t("sections.complaint"), body: t("complaint.body") },
    { id: "mandatory", title: t("sections.mandatory"), body: t("mandatory.platform") },
    { id: "automated", title: t("sections.automated"), body: t("automated.platform") },
    { id: "minors", title: t("sections.minors"), body: t("minors.body") },
    { id: "cookies", title: t("sections.cookies"), body: t("cookiesLink.body", { url: url("/legal/cookies") }) },
    { id: "changes", title: t("sections.changes"), body: t("changes.body", { version: NOTICE_VERSIONS.platform_patient }) },
  ];
}

function cookieNotice(t: T): NoticeSection[] {
  const item = (k: "staffSession" | "locale" | "privacyCenter") =>
    t("cookies.item", {
      name: t(`cookies.${k}.name`, { names: COOKIES[k].join(", ") }),
      purpose: t(`cookies.${k}.purpose`),
      duration: t(`cookies.${k}.duration`),
    });
  return [
    { id: "summary", title: t("sections.summary"), body: t("cookies.summary") },
    { id: "cookies", title: t("sections.cookieList"), body: list([item("staffSession"), item("locale"), item("privacyCenter")]) },
    {
      id: "storage",
      title: t("sections.storage"),
      body: BROWSER_STORAGE.length
        ? list(BROWSER_STORAGE.map((s) => t("cookies.storageItem", { key: s.key, purpose: s.purpose })))
        : t("cookies.storageNone"),
    },
    {
      id: "third-parties",
      title: t("sections.thirdParties"),
      body: paragraphs(t("cookies.thirdPartiesIntro"), list([t("cookies.map"), t("cookies.links")])),
    },
    { id: "legal-basis", title: t("sections.legalBasis"), body: t("cookies.legalBasis") },
    { id: "control", title: t("sections.control"), body: t("cookies.control") },
    { id: "widget", title: t("sections.widget"), body: t("cookies.widget") },
    { id: "changes", title: t("sections.changes"), body: t("changes.body", { version: NOTICE_VERSIONS.cookies }) },
  ];
}

function staffNotice(t: T, tc: TC): NoticeSection[] {
  const p = platformIdentity();
  const subs = SUBPROCESSORS.filter((s) => s.onlyWhen !== "whatsapp_enabled");
  return [
    { id: "summary", title: t("sections.summary"), body: t("staff.summary") },
    { id: "controller", title: t("sections.controller"), body: paragraphs(t("staff.controllers"), platformController(t)) },
    {
      id: "data",
      title: t("sections.data"),
      body: paragraphs(
        t("staff.dataIntro"),
        list([t("staff.dataAccount"), t("staff.dataSecurity"), t("staff.dataSessions"), t("staff.dataLog"), t("staff.dataLegal")]),
      ),
    },
    { id: "purposes", title: t("sections.purposes"), body: purposeItems(t, ["staff_accounts", "security_logs"]) },
    { id: "monitoring", title: t("sections.monitoring"), body: t("staff.monitoring") },
    { id: "recipients", title: t("sections.recipients"), body: paragraphs(list(providerLines(t, subs)), t("recipients.notSold")) },
    { id: "transfers", title: t("sections.transfers"), body: transfersBody(t, subs, p.email) },
    {
      id: "retention",
      title: t("sections.retention"),
      body: list([
        t("staff.retentionSessions", { period: tc("units.days", { count: PLATFORM_RETENTION.loginAttemptDays }) }),
        t("staff.retentionLog", { period: tc("units.months", { count: RETENTION_LIMITS.auditMonths.min }) }),
        t("staff.retentionLegal"),
        t("staff.retentionAccount"),
      ]),
    },
    { id: "rights", title: t("sections.rights"), body: p.email ? t("staff.rights", { email: p.email }) : t("staff.rightsNoContact") },
    { id: "complaint", title: t("sections.complaint"), body: t("complaint.body") },
    { id: "changes", title: t("sections.changes"), body: t("changes.body", { version: NOTICE_VERSIONS.staff }) },
  ];
}

function practitionerNotice(t: T): NoticeSection[] {
  const p = platformIdentity();
  const subs = SUBPROCESSORS.filter((s) => s.onlyWhen !== "whatsapp_enabled");
  return [
    { id: "summary", title: t("sections.summary"), body: t("practitioner.summary") },
    { id: "controller", title: t("sections.controller"), body: paragraphs(t("practitioner.controllers"), platformController(t)) },
    {
      id: "data",
      title: t("sections.data"),
      body: paragraphs(
        t("practitioner.dataIntro"),
        list([t("practitioner.dataProfile"), t("practitioner.dataAlbo"), t("practitioner.dataReviews"), t("practitioner.dataMetrics")]),
      ),
    },
    { id: "purposes", title: t("sections.purposes"), body: purposeItems(t, sorrisoPurposesFor(["practitioners"])) },
    { id: "profile", title: t("sections.profile"), body: paragraphs(t("practitioner.profile"), t("practitioner.reviews")) },
    { id: "recipients", title: t("sections.recipients"), body: paragraphs(list(providerLines(t, subs)), t("recipients.notSold")) },
    { id: "transfers", title: t("sections.transfers"), body: transfersBody(t, subs, p.email) },
    {
      id: "retention",
      title: t("sections.retention"),
      body: list([t("practitioner.retentionProfile"), t("practitioner.retentionReviews"), t("practitioner.retentionMetrics")]),
    },
    {
      id: "rights",
      title: t("sections.rights"),
      body: p.email ? t("practitioner.rights", { email: p.email }) : t("practitioner.rightsNoContact"),
    },
    { id: "complaint", title: t("sections.complaint"), body: t("complaint.body") },
    { id: "changes", title: t("sections.changes"), body: t("changes.body", { version: NOTICE_VERSIONS.practitioner }) },
  ];
}

/**
 * Build a notice in `locale` (Italian is authoritative; other locales are translations).
 * Pure and synchronous: it records nothing (see publishNotice).
 */
export function buildNotice(kind: NoticeKind, opts: { org?: NoticeOrg | null; locale: Locale }): Notice {
  const { org, locale } = opts;
  if (isPracticeNotice(kind) && !org) throw new Error(`buildNotice: the ${kind} notice needs the practice`);
  const t = getT(locale, "legalPatient");
  const tc = getT(locale, "common");
  const version = NOTICE_VERSIONS[kind];
  const sections =
    kind === "practice_patient"
      ? practicePatient(t, tc, org!, locale)
      : kind === "minor"
        ? minorNotice(t, org!, locale)
        : kind === "cookies"
          ? cookieNotice(t)
          : kind === "staff"
            ? staffNotice(t, tc)
            : kind === "practitioner"
              ? practitionerNotice(t)
              : platformPatient(t, tc, locale);
  const contentHash = sha256Hex(JSON.stringify({ kind, locale, version, sections }));
  return { version, sections, contentHash };
}

// ---------------------------------------------------------------- recording

/** Rows already known to exist, so a page view doesn't hit the database each time. */
const recorded = new Map<string, Date>();

/**
 * Record that this exact content is published (one notice_versions row per org, kind, locale and
 * content hash) and return when it was first published: the "in force since" date. Idempotent.
 */
export async function recordNoticeVersion(
  notice: Pick<Notice, "version" | "contentHash">,
  where: { kind: NoticeKind; orgId: string | null; locale: Locale },
  opts: { now?: Date; tx?: Tx } = {},
): Promise<Date> {
  const key = `${where.orgId ?? ""}|${where.kind}|${where.locale}|${notice.contentHash}`;
  // Inside a transaction the row may still roll back: only committed writes are cached.
  const known = opts.tx ? undefined : recorded.get(key);
  if (known) return known;
  const t = opts.tx ?? db;
  const match = and(
    where.orgId ? eq(noticeVersions.orgId, where.orgId) : isNull(noticeVersions.orgId),
    eq(noticeVersions.kind, where.kind),
    eq(noticeVersions.locale, where.locale),
    eq(noticeVersions.contentHash, notice.contentHash),
  );
  const first = async () =>
    (await t.select({ at: noticeVersions.publishedAt }).from(noticeVersions).where(match).orderBy(asc(noticeVersions.publishedAt)).limit(1))[0]?.at;
  let at = await first();
  if (!at) {
    // The unique index covers org rows; platform rows (org NULL) rely on the lookup above.
    await t
      .insert(noticeVersions)
      .values({
        id: newId(),
        orgId: where.orgId,
        kind: where.kind,
        locale: where.locale,
        version: notice.version,
        contentHash: notice.contentHash,
        publishedAt: opts.now ?? new Date(),
      })
      .onConflictDoNothing();
    at = (await first()) ?? opts.now ?? new Date();
  }
  if (!opts.tx) recorded.set(key, at);
  return at;
}

/** The practice behind /c/<slug>/privacy (listed or not: every practice owes its patients a notice). */
export async function loadNoticeOrg(slug: string): Promise<(NoticeOrg & { listed: boolean }) | null> {
  const [org] = await db
    .select({
      id: organizations.id,
      slug: organizations.slug,
      name: organizations.name,
      legalName: organizations.legalName,
      vatNumber: organizations.vatNumber,
      registeredAddress: organizations.registeredAddress,
      privacyEmail: organizations.privacyEmail,
      dpoName: organizations.dpoName,
      dpoEmail: organizations.dpoEmail,
      email: organizations.email,
      phone: organizations.phone,
      settings: organizations.settings,
      listed: organizations.listed,
    })
    .from(organizations)
    .where(eq(organizations.slug, slug));
  return org ?? null;
}

/** Build a notice and record its version: what the notice pages render. */
export async function publishNotice(
  kind: NoticeKind,
  opts: { org?: NoticeOrg | null; locale: Locale; now?: Date },
): Promise<{ notice: Notice; publishedAt: Date }> {
  const notice = buildNotice(kind, opts);
  const publishedAt = await recordNoticeVersion(notice, { kind, orgId: isPracticeNotice(kind) ? opts.org!.id : null, locale: opts.locale }, { now: opts.now });
  return { notice, publishedAt };
}

/**
 * Record the practice's notices in every language, e.g. right after its legal fields or privacy
 * settings change (WP5's settings actions), so the new wording is on record from that moment even
 * before anyone opens the notice page.
 */
export async function recordPracticeNotices(org: NoticeOrg, opts: { now?: Date; tx?: Tx } = {}): Promise<void> {
  for (const kind of PRACTICE_NOTICE_KINDS) {
    for (const locale of LOCALES) {
      await recordNoticeVersion(buildNotice(kind, { org, locale }), { kind, orgId: org.id, locale }, opts);
    }
  }
}

/** Forget the in-process cache (tests). */
export function clearNoticeCache(): void {
  recorded.clear();
}

// ---------------------------------------------------------------- page chrome

/**
 * What every notice page shows around the notice: its version, the date this wording is in force
 * from (the first time its content hash was published), and on translations the banner saying the
 * Italian version prevails, with a link to it.
 */
export function noticePageChrome(i: { kind: NoticeKind; locale: Locale; publishedAt: Date; path: string }) {
  const t = getT(i.locale, "legalPatient");
  return {
    version: t("page.version", { version: NOTICE_VERSIONS[i.kind] }),
    updated: t("page.updated", { date: fmtDay(zonedDate(i.publishedAt, DEFAULT_TIMEZONE), "long", i.locale) }),
    labels: { contents: t("page.contents"), backToTop: t("page.backToTop"), otherNotices: t("page.otherNotices") },
    italian: i.locale === "it" ? null : { text: t("page.italianPrevails"), linkLabel: t("page.italianLink"), href: swapLocale(lhref(i.locale, i.path), "it") },
  };
}
