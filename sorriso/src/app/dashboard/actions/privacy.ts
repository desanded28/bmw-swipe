"use server";

import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/db";
import { LEGAL_DOCS, PRIVACY_REQUEST_CHANNELS, PRIVACY_REQUEST_DECISIONS, PRIVACY_REQUEST_TYPES, type LegalDoc } from "@/db/enums";
import { organizations, patients, type OrgSettings, type PrivacySettings, type RetentionSettings } from "@/db/schema";
import { DEFAULT_LOCALE, isLocale } from "@/i18n/config";
import { fmtDay, zonedDate } from "@/i18n/datefmt";
import { shownLocale } from "@/i18n/registry";
import { getStaffLocale, getT } from "@/i18n/server";
import { auditStaff } from "@/lib/audit";
import { requirePlatformAdmin, requireStepUp, type StaffSession } from "@/lib/auth";
import { newId } from "@/lib/ids";
import { logError } from "@/lib/log";
import { can } from "@/lib/permissions";
import { normalizePhone } from "@/lib/phone";
import { isStepUpRequired } from "@/lib/privacy/gates";
import { recordLegalAcceptance } from "@/lib/privacy/legal";
import { recordPracticeNotices } from "@/lib/privacy/notices";
import { cancelClosure, ClosureError, requestClosure } from "@/lib/privacy/org-closure";
import { customRegisterEntries, MAX_CUSTOM_ENTRIES, MAX_CUSTOM_FIELD, REGISTER_COLUMNS, type CustomRegisterEntry } from "@/lib/privacy/register";
import {
  completePrivacyRequest,
  createPrivacyRequest,
  DECISION_KIND,
  extendPrivacyRequest,
  getPrivacyRequest,
  notifyRequester,
  PrivacyRequestError,
  requestTextAndContact,
  startPrivacyRequest,
} from "@/lib/privacy/requests";
import { RETENTION_LIMITS, resolvePrivacySettings } from "@/lib/privacy/settings";
import { resolveSettings } from "@/lib/settings";
import { isDateString, todayIn, zonedParts, zonedToUtc } from "@/lib/time";
import { fail, guard, ok, str, type ActionResult } from "./_shared";

/**
 * Practice compliance actions (WP5): the privacy requests inbox (and Sorriso's own platform
 * inbox), privacy settings, the register's free rows, legal acceptance and account closure.
 * Messages are in the staff member's language.
 */

type T = ReturnType<typeof getT<"privacyAdmin">>;
/** The staff member's language (outside a request, e.g. in tests: the default). */
const staffLocale = () => getStaffLocale().catch(() => DEFAULT_LOCALE);
const tr = async (): Promise<T> => getT(await staffLocale(), "privacyAdmin");

async function stepUp(t: T): Promise<ActionResult | null> {
  try {
    await requireStepUp();
    return null;
  } catch (err) {
    if (isStepUpRequired(err)) return fail(t("errors.stepUp"), "step_up_required");
    throw err;
  }
}

function requestFail(err: unknown, t: T): ActionResult {
  if (err instanceof PrivacyRequestError) return fail(t(`requests.errors.${err.code}`), err.code);
  throw err;
}

const day = (d: Date, locale: Parameters<typeof fmtDay>[2], tz: string) => fmtDay(zonedDate(d, tz), "long", locale);

// ---------------------------------------------------------------- privacy requests

type Scope = { orgId: string | null; tz: string; actor: { type: "user" | "platform_admin"; id: string } };

const orgScope = (s: StaffSession): Scope => ({ orgId: s.org.id, tz: s.org.timezone, actor: { type: "user", id: s.user.id } });

async function platformScope(): Promise<Scope> {
  const s = await requirePlatformAdmin();
  return { orgId: null, tz: "Europe/Rome", actor: { type: "platform_admin", id: s.user.id } };
}

/** A reply contact typed by staff: an email (lower-cased) or a mobile number (E.164), else null. */
function replyContact(raw: string): string | null {
  const v = raw.trim();
  if (v.includes("@")) return z.email().safeParse(v.toLowerCase()).success ? v.toLowerCase() : null;
  return normalizePhone(v);
}

/**
 * Log a request that arrived by phone, email, letter or at the desk. The deadline runs from the
 * day it was received. Linking the patient record lets the answer be sent automatically; without
 * one, the reply contact staff enter (stored encrypted in answerContact) is used instead.
 */
export async function logPrivacyRequest(_prev: unknown, fd: FormData): Promise<ActionResult> {
  return guard(
    async (s) => {
      const t = await tr();
      const type = str(fd, "type");
      const channel = str(fd, "channel");
      if (!(PRIVACY_REQUEST_TYPES as readonly string[]).includes(type) || !(PRIVACY_REQUEST_CHANNELS as readonly string[]).includes(channel)) {
        return fail(t("errors.invalid"), "invalid");
      }
      const received = str(fd, "receivedAt");
      const tz = s.org.timezone;
      const now = new Date();
      if (!isDateString(received) || received > todayIn(tz, now)) return fail(t("requests.errors.invalid_date"), "invalid_date");
      // A past day counts from noon; today from now.
      const receivedAt = received === todayIn(tz, now) ? now : zonedToUtc(received, 12 * 60, tz);
      let patientId: string | null = str(fd, "patientId") || null;
      if (patientId) {
        const [p] = await db
          .select({ id: patients.id })
          .from(patients)
          .where(and(eq(patients.orgId, s.org.id), eq(patients.id, patientId)));
        if (!p) patientId = null;
      }
      // Only for a request linked to no record: a linked one is answered at the record's contact.
      const replyRaw = patientId ? "" : str(fd, "answerContact").trim();
      const answerContact = replyRaw ? replyContact(replyRaw) : null;
      if (replyRaw && !answerContact) return fail(t("requests.errors.invalid_contact"), "invalid_contact");
      const language = str(fd, "language");
      const { dueAt } = await db.transaction(async (tx) =>
        createPrivacyRequest(tx, {
          orgId: s.org.id,
          patientId,
          type: type as (typeof PRIVACY_REQUEST_TYPES)[number],
          channel: channel as (typeof PRIVACY_REQUEST_CHANNELS)[number],
          details: str(fd, "details").slice(0, 4000) || null,
          answerContact,
          requesterLocale: isLocale(language) ? language : "it",
          actor: { type: "user", id: s.user.id },
          headers: await headers(),
          receivedAt,
          now,
        }),
      );
      return ok(t("requests.log.logged", { date: day(dueAt, await staffLocale(), tz) }));
    },
    { permission: "privacy.requests" },
  );
}

async function start(scope: Scope, id: string, t: T): Promise<ActionResult> {
  try {
    await db.transaction((tx) => startPrivacyRequest(tx, { orgId: scope.orgId, id, actor: scope.actor }));
  } catch (err) {
    return requestFail(err, t);
  }
  return ok(t("requests.detail.started"));
}

async function extend(scope: Scope, id: string, fd: FormData, t: T): Promise<ActionResult> {
  const until = str(fd, "until");
  if (!isDateString(until)) return fail(t("requests.errors.invalid_date"), "invalid_date");
  try {
    const row = await db.transaction(async (tx) => {
      const current = await getPrivacyRequest(scope.orgId, id, tx);
      // Same wall-clock time as the original deadline, so "two months" is measured like the law does.
      const minutes = current ? zonedParts(current.dueAt, scope.tz).minutes : 12 * 60;
      return extendPrivacyRequest(tx, { orgId: scope.orgId, id, until: zonedToUtc(until, minutes, scope.tz), reason: str(fd, "reason"), actor: scope.actor });
    });
    const told = await notifyRequester(row, "requestExtended");
    if (told) return ok(t("requests.detail.extend.done"));
    // An unlinked request's reply contact was tried and failed; an erased record's is for staff.
    return ok(requestTextAndContact(row).contact ? t("requests.detail.extend.doneNotSent") : t("requests.detail.extend.doneNoNotice"));
  } catch (err) {
    return requestFail(err, t);
  }
}

async function complete(scope: Scope, id: string, fd: FormData, t: T): Promise<ActionResult> {
  const decision = str(fd, "decision");
  if (!(PRIVACY_REQUEST_DECISIONS as readonly string[]).includes(decision)) return fail(t("errors.invalid"), "invalid");
  const d = decision as (typeof PRIVACY_REQUEST_DECISIONS)[number];
  try {
    const row = await db.transaction((tx) => completePrivacyRequest(tx, { orgId: scope.orgId, id, decision: d, reason: str(fd, "reason"), actor: scope.actor }));
    const told = await notifyRequester(row, DECISION_KIND[d]);
    if (told) return ok(t("requests.detail.complete.done"));
    if (!requestTextAndContact(row).contact) return ok(t("requests.detail.complete.doneNoNotice"));
    // The patient was erased meanwhile (the request kept the contact the record had, for staff to
    // answer by hand), or sending to an unlinked request's reply contact failed.
    return ok(row.patientId ? t("requests.detail.complete.doneKeptContact") : t("requests.detail.complete.doneNotSent"));
  } catch (err) {
    return requestFail(err, t);
  }
}

export async function startPrivacyRequestAction(id: string): Promise<ActionResult> {
  return guard(async (s) => start(orgScope(s), id, await tr()), { permission: "privacy.requests" });
}

export async function extendPrivacyRequestAction(id: string, _prev: unknown, fd: FormData): Promise<ActionResult> {
  return guard(async (s) => extend(orgScope(s), id, fd, await tr()), { permission: "privacy.requests" });
}

export async function completePrivacyRequestAction(id: string, _prev: unknown, fd: FormData): Promise<ActionResult> {
  return guard(async (s) => complete(orgScope(s), id, fd, await tr()), { permission: "privacy.requests" });
}

/** Sorriso's own inbox (requests to Sorriso as controller): platform admins only. */
export async function startPlatformRequestAction(id: string): Promise<ActionResult> {
  return guard(async () => start(await platformScope(), id, await tr()));
}

export async function extendPlatformRequestAction(id: string, _prev: unknown, fd: FormData): Promise<ActionResult> {
  return guard(async () => extend(await platformScope(), id, fd, await tr()));
}

export async function completePlatformRequestAction(id: string, _prev: unknown, fd: FormData): Promise<ActionResult> {
  return guard(async () => complete(await platformScope(), id, fd, await tr()));
}

// ---------------------------------------------------------------- privacy settings

/**
 * Read-modify-write of organizations.settings in one write transaction, keeping keys other
 * packages' resolvers don't know (the register's rows): `patch` sees the resolved and the stored
 * settings as they are inside the transaction.
 */
async function writeSettings(orgId: string, patch: (resolved: OrgSettings, stored: Record<string, unknown>) => Record<string, unknown>) {
  await db.transaction(async (tx) => {
    const [org] = await tx.select({ settings: organizations.settings }).from(organizations).where(eq(organizations.id, orgId));
    const stored = (org?.settings ?? {}) as Record<string, unknown>;
    await tx
      .update(organizations)
      .set({ settings: patch(resolveSettings(org?.settings), stored) as OrgSettings })
      .where(eq(organizations.id, orgId));
  });
}

/**
 * Put the practice's privacy notices, as they now read, on record in every language (WP4's
 * recordPracticeNotices), right after a change they are built from. Never fails the save.
 */
async function recordNotices(orgId: string) {
  try {
    const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
    if (org) await recordPracticeNotices(org);
  } catch (err) {
    logError("privacy-settings", err, { step: "record-notices", orgId });
  }
}

const checked = (fd: FormData, k: string) => fd.get(k) === "on";

/**
 * Save the privacy settings (privacy.settings and a fresh second factor). Values are clamped to
 * RETENTION_LIMITS and the session limits; embed origins that aren't https are dropped and listed.
 * Audited as settings.privacy.update with the names of the changed settings.
 */
export async function savePrivacySettings(_prev: unknown, fd: FormData): Promise<ActionResult> {
  return guard(
    async (s) => {
      const t = await tr();
      const denied = await stepUp(t);
      if (denied) return denied;
      const before = resolveSettings(s.org.settings).privacy;
      const retention = {} as RetentionSettings;
      for (const key of Object.keys(RETENTION_LIMITS) as (keyof RetentionSettings)[]) {
        const n = Number(str(fd, `retention.${key}`));
        retention[key] = Number.isFinite(n) && str(fd, `retention.${key}`) !== "" ? n : before.retention[key];
      }
      const origins = str(fd, "embedOrigins")
        .split(/[\s,]+/)
        .map((o) => o.trim())
        .filter(Boolean);
      const next: PrivacySettings = resolvePrivacySettings({
        messageContentLevel: str(fd, "messageContentLevel") === "detailed" ? "detailed" : "discreet",
        whatsappEnabled: checked(fd, "whatsappEnabled"),
        marketingEnabled: checked(fd, "marketingEnabled"),
        icsFeedsEnabled: checked(fd, "icsFeedsEnabled"),
        icsDetail: str(fd, "icsDetail") === "initials" ? "initials" : "none",
        embedOrigins: origins,
        requireMfa: checked(fd, "requireMfa"),
        sessionHours: Number(str(fd, "sessionHours")) || before.sessionHours,
        riskBasedReminders: checked(fd, "riskBasedReminders"),
        staffWaLinks: checked(fd, "staffWaLinks"),
        erasureDefault: str(fd, "erasureDefault") === "anonymise" ? "anonymise" : "restrict",
        retention,
      });
      const ignored = origins.filter((o) => {
        try {
          return !next.embedOrigins.includes(new URL(o).origin);
        } catch {
          return true;
        }
      });
      const changed = (Object.keys(next) as (keyof PrivacySettings)[]).filter((k) => JSON.stringify(next[k]) !== JSON.stringify(before[k]));
      await writeSettings(s.org.id, (resolved, stored) => ({ ...stored, ...resolved, privacy: next }));
      await auditStaff(s, "settings.privacy.update", { type: "org", id: s.org.id }, { metadata: { changed: changed.join(",") || null } });
      if (changed.length) await recordNotices(s.org.id);
      const saved = t("settingsPrivacy.saved");
      return ok(ignored.length ? `${saved} ${t("settingsPrivacy.embed.invalid", { origins: ignored.join(", ") })}` : saved);
    },
    { permission: "privacy.settings" },
  );
}

// ---------------------------------------------------------------- register

/** Add an activity the practice carries out outside Sorriso to its Art. 30 register. */
export async function addRegisterEntry(_prev: unknown, fd: FormData): Promise<ActionResult> {
  return guard(
    async (s) => {
      const t = await tr();
      const [org] = await db.select({ settings: organizations.settings }).from(organizations).where(eq(organizations.id, s.org.id));
      if (customRegisterEntries(org ?? { settings: {} }).length >= MAX_CUSTOM_ENTRIES) return fail(t("register.add.limit", { max: MAX_CUSTOM_ENTRIES }), "limit");
      const entry = { id: newId() } as CustomRegisterEntry;
      for (const c of REGISTER_COLUMNS) entry[c] = str(fd, c).slice(0, MAX_CUSTOM_FIELD);
      if (!entry.activity) return fail(t("errors.invalid"), "invalid");
      await writeSettings(s.org.id, (resolved, stored) => ({
        ...stored,
        ...resolved,
        register: [...customRegisterEntries({ settings: stored }), entry].slice(0, MAX_CUSTOM_ENTRIES),
      }));
      await auditStaff(s, "settings.privacy.update", { type: "org", id: s.org.id }, { metadata: { register: "add", entryId: entry.id } });
      return ok(t("register.add.added"));
    },
    { permission: "privacy.settings" },
  );
}

export async function removeRegisterEntry(entryId: string): Promise<ActionResult> {
  return guard(
    async (s) => {
      const t = await tr();
      await writeSettings(s.org.id, (resolved, stored) => ({
        ...stored,
        ...resolved,
        register: customRegisterEntries({ settings: stored }).filter((e) => e.id !== entryId),
      }));
      await auditStaff(s, "settings.privacy.update", { type: "org", id: s.org.id }, { metadata: { register: "remove", entryId } });
      return ok(t("register.add.removed"));
    },
    { permission: "privacy.settings" },
  );
}

// ---------------------------------------------------------------- legal documents

/**
 * Accept the current version of a document. The DPA, terms and sub-processor list are accepted
 * for the practice (legal.accept: owners and admins); staff instructions by each member for
 * themselves. Recorded with version, the language actually shown and HMACs of IP and user agent.
 */
export async function acceptLegalDocument(doc: LegalDoc): Promise<ActionResult> {
  return guard(async (s) => {
    const t = await tr();
    if (!(LEGAL_DOCS as readonly string[]).includes(doc)) return fail(t("errors.invalid"), "invalid");
    if (doc !== "staff_instructions" && !can(s.role, "legal.accept")) return fail(t("legal.ownerOnly"), "forbidden");
    const locale = await staffLocale();
    const titleKey = doc === "staff_instructions" ? "staffInstructions.title" : `${doc}.title`;
    const h = await headers();
    await db.transaction((tx) =>
      recordLegalAcceptance(tx, { orgId: s.org.id, userId: s.user.id, doc, locale: shownLocale(locale, "legalPractice", titleKey), headers: h }),
    );
    return ok(t("legal.done"));
  });
}

// ---------------------------------------------------------------- closure

/** Request the account's closure (the owner, with a fresh second factor and the practice name typed). */
export async function requestClosureAction(_prev: unknown, fd: FormData): Promise<ActionResult> {
  return guard(
    async (s) => {
      const t = await tr();
      const denied = await stepUp(t);
      if (denied) return denied;
      if (str(fd, "confirm").trim().toLowerCase() !== s.org.name.trim().toLowerCase()) return fail(t("closure.confirmMismatch"), "confirm_mismatch");
      try {
        const { purgeAfter } = await requestClosure(s.org.id, { actor: { type: "user", id: s.user.id }, headers: await headers() });
        return ok(t("closure.requested", { date: day(purgeAfter, await staffLocale(), s.org.timezone) }));
      } catch (err) {
        if (err instanceof ClosureError) return fail(t(`closure.errors.${err.code}`), err.code);
        throw err;
      }
    },
    { permission: "org.close" },
  );
}

export async function cancelClosureAction(): Promise<ActionResult> {
  return guard(
    async (s) => {
      const t = await tr();
      try {
        await cancelClosure(s.org.id, { actor: { type: "user", id: s.user.id }, headers: await headers() });
        return ok(t("closure.cancelled"));
      } catch (err) {
        if (err instanceof ClosureError) return fail(t(`closure.errors.${err.code}`), err.code);
        throw err;
      }
    },
    { permission: "org.close" },
  );
}
