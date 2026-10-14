import { and, asc, desc, eq, gt, gte, isNull, lte, min, type SQL } from "drizzle-orm";
import { headers as requestHeaders } from "next/headers";
import { db, type Tx } from "@/db";
import type { AuditActorType } from "@/db/enums";
import { auditAnchors, auditLog, type AuditLogRow } from "@/db/schema";
import type { StaffSession } from "./auth";
import { hmac } from "./crypto";
import { newId } from "./ids";
import { logError, logInfo } from "./log";
import { clientIpHash, userAgentHash } from "./rate-limit";

/**
 * Access and activity log for personal data (GDPR Art. 5(2), 30 and 32; Garante guidance on
 * health records). Tamper-evident: each row stores the hash of the previous row of the same
 * chain, one chain per org plus one platform chain (orgId null), and a position `seq` that is
 * unique per org, so the next row is always seq + 1.
 *
 * The hash is an HMAC keyed by HMAC_SECRET, which lives in the environment, not the database:
 * someone who can write to the database can't edit a row and recompute the chain after it.
 * (Rotating HMAC_SECRET therefore invalidates every older row: verify and record the heads
 * first.) What a chain can't show by itself is its newest rows being deleted, so a scheduled
 * job records auditChainHead() outside the database and verifyAuditChain compares against it.
 *
 * Reading the chain head and inserting happen in one write transaction (libsql opens
 * BEGIN IMMEDIATE), so two writers can't fork the chain. UNIQUE(org_id, seq) is the backstop
 * for org chains (SQLite treats NULL org_ids as distinct, so not for the platform chain), and a
 * conflict is retried.
 *
 * Can run outside Next (retention and seed scripts), so no "server-only": it reads the request
 * headers only when a request is there.
 *
 * RULE: inside a db.transaction() callback pass its `tx`. Calling audit() without it there
 * deadlocks on the local write mutex (src/db/serialize.ts).
 */

export const AUDIT_ACTIONS = [
  // patients
  "patient.view",
  "patient.search",
  "patient.create",
  "patient.update",
  "patient.export",
  "patient.erase",
  "patient.restrict",
  "patient.unrestrict",
  "patient.restricted_access",
  "patient.clinical.view",
  "patient.merge",
  // appointments
  "appointment.view",
  "appointment.create",
  "appointment.update",
  "appointment.cancel",
  "appointment.note.update",
  "appointment.link.issue",
  // privacy
  "consent.record",
  "privacy_request.create",
  "privacy_request.update",
  "privacy_center.view",
  "privacy_center.export",
  // auth
  "auth.login.success",
  "auth.login.fail",
  "auth.logout",
  "auth.mfa.enable",
  "auth.mfa.fail",
  "auth.password.change",
  "auth.password.reset",
  "session.revoke",
  // team and keys
  "member.invite",
  "member.role_change",
  "member.remove",
  "apikey.create",
  "apikey.revoke",
  "api.request",
  // calendar feeds
  "ics.feed.fetch",
  "ics.feed.rotate",
  // settings and legal
  "settings.update",
  "settings.privacy.update",
  "legal.accept",
  // reviews and profiles
  "review.reply",
  "review.report",
  "review.moderate",
  "review.withdraw",
  "practitioner.profile.approve",
  // organisation and platform
  "export.org",
  "org.close",
  "retention.run",
  "platform.access",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_ENTITY_TYPES = [
  "patient",
  "appointment",
  "message",
  "review",
  "privacy_request",
  "user",
  "membership",
  "api_key",
  "practitioner",
  "org",
  "consent",
  "form_submission",
  "recall",
] as const;
export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number];

/** Ids, counts and codes only — never names, contacts or free text. */
export type AuditMetadata = Record<string, string | number | boolean | null>;

export type AuditEvent = {
  /** null = the platform chain (Sorriso as controller, platform admins, cross-org jobs). */
  orgId: string | null;
  actor: { type: AuditActorType; id: string | null };
  action: AuditAction;
  entity?: { type: AuditEntityType; id: string };
  reason?: string | null;
  metadata?: AuditMetadata;
  /** Request headers: only HMACs of the client IP and user agent are stored. */
  headers?: Headers;
  /** Defaults to now (tests and jobs with a fixed clock pass their own). */
  at?: Date;
};

/**
 * Why a chain failed verification:
 * - hash:   a row's content doesn't match its hash (edited);
 * - link:   a row doesn't follow the one before (deleted, inserted or reordered rows);
 * - anchor: retention's anchor is newer than retention allows (a prefix deleted to look like retention);
 * - head:   the chain no longer reaches, or no longer matches, a head recorded earlier (newest rows deleted).
 */
export type AuditChainBreak = "hash" | "link" | "anchor" | "head";

/** brokenAtId names the first offending row; null when no row can be named (anchor, missing rows). */
export type AuditChainResult = { ok: true } | { ok: false; brokenAtId: string | null; reason: AuditChainBreak };

/** A chain's last position and hash, recorded outside the database to detect truncation later. */
export type AuditHead = { seq: number; hash: string };

const PLATFORM_KEY = "platform";
const MAX_ATTEMPTS = 4;
const MAX_REASON = 500;
const MAX_META_STRING = 200;

type ChainFields = Pick<
  AuditLogRow,
  "id" | "orgId" | "seq" | "at" | "actorType" | "actorId" | "action" | "entityType" | "entityId" | "reason" | "ipHash" | "uaHash" | "metadata"
>;
type Draft = Omit<ChainFields, "seq">;

let failures = 0;

/** audit() never throws; this counts the rows it could not write since the process started (for health checks and alerts). */
export function getAuditFailureCount(): number {
  return failures;
}

const anchorKey = (orgId: string | null) => orgId ?? PLATFORM_KEY;
const chainOf = (orgId: string | null): SQL => (orgId === null ? isNull(auditLog.orgId) : eq(auditLog.orgId, orgId));

/**
 * The row's stable fields as JSON with a fixed field order (metadata as sorted pairs), so the
 * same row always hashes the same after a round trip through the database.
 */
function canonical(r: ChainFields): string {
  const meta = r.metadata ? Object.keys(r.metadata).sort().map((k) => [k, r.metadata![k]]) : null;
  return JSON.stringify([
    "v1",
    r.id,
    r.orgId,
    r.seq,
    r.at.getTime(),
    r.actorType,
    r.actorId,
    r.action,
    r.entityType,
    r.entityId,
    r.reason,
    r.ipHash,
    r.uaHash,
    meta,
  ]);
}

export function auditRowHash(prevHash: string | null, r: ChainFields): string {
  return hmac((prevHash ?? "") + canonical(r), "audit");
}

function cleanMetadata(m: AuditMetadata | undefined): AuditMetadata | null {
  if (!m) return null;
  const out: AuditMetadata = {};
  for (const [k, v] of Object.entries(m)) {
    if (k === "__proto__") continue;
    if (typeof v === "string") out[k] = v.slice(0, MAX_META_STRING);
    else if (typeof v === "number") out[k] = Number.isFinite(v) ? v : null;
    else if (typeof v === "boolean" || v === null) out[k] = v;
  }
  return Object.keys(out).length ? out : null;
}

function draft(evt: AuditEvent): Draft {
  return {
    id: newId(),
    orgId: evt.orgId,
    at: evt.at ?? new Date(),
    actorType: evt.actor.type,
    actorId: evt.actor.id,
    action: evt.action,
    entityType: evt.entity?.type ?? null,
    entityId: evt.entity?.id ?? null,
    reason: evt.reason?.trim().slice(0, MAX_REASON) || null,
    metadata: cleanMetadata(evt.metadata),
    ipHash: clientIpHash(evt.headers),
    uaHash: userAgentHash(evt.headers),
  };
}

/** The last row of the chain, or the anchor left by retention when every row was purged. */
async function chainHead(t: Tx, orgId: string | null): Promise<AuditHead | null> {
  const [last] = await t
    .select({ seq: auditLog.seq, hash: auditLog.hash })
    .from(auditLog)
    .where(chainOf(orgId))
    .orderBy(desc(auditLog.seq))
    .limit(1);
  if (last) return last;
  const [anchor] = await t
    .select({ seq: auditAnchors.seq, hash: auditAnchors.hash })
    .from(auditAnchors)
    .where(eq(auditAnchors.orgKey, anchorKey(orgId)));
  return anchor ?? null;
}

async function append(t: Tx, d: Draft): Promise<void> {
  const head = await chainHead(t, d.orgId);
  const row = { ...d, seq: (head?.seq ?? 0) + 1 };
  const prevHash = head?.hash ?? null;
  await t.insert(auditLog).values({ ...row, prevHash, hash: auditRowHash(prevHash, row) });
}

/** A lost race for the chain head (UNIQUE(org_id, seq)) or a busy database: worth retrying. */
function isRetryable(err: unknown): boolean {
  for (let e = err, i = 0; e && i < 4; e = (e as { cause?: unknown }).cause, i++) {
    const text = `${(e as { code?: unknown }).code ?? ""} ${(e as { message?: unknown }).message ?? ""}`;
    if (/UNIQUE constraint failed: audit_log|SQLITE_BUSY|database is locked/i.test(text)) return true;
  }
  return false;
}

/**
 * Append an event to its chain. Never throws: a failure is logged and counted
 * (getAuditFailureCount), so auditing can't break the action being audited.
 *
 * With `tx` the row commits or rolls back with the caller's transaction; without it,
 * audit() opens its own.
 */
export async function audit(evt: AuditEvent, tx?: Tx): Promise<void> {
  try {
    const d = draft(evt);
    if (tx && tx !== db) return await append(tx, d);
    for (let attempt = 1; ; attempt++) {
      try {
        return await db.transaction((t) => append(t, d));
      } catch (err) {
        if (attempt >= MAX_ATTEMPTS || !isRetryable(err)) throw err;
        await new Promise((r) => setTimeout(r, attempt * 10 + Math.random() * 20));
      }
    }
  } catch (err) {
    failures++;
    logError("audit", err, { action: evt.action, orgId: evt.orgId, failures });
  }
}

async function currentRequestHeaders(): Promise<Headers | undefined> {
  try {
    return await requestHeaders();
  } catch {
    return undefined; // outside a request (jobs, scripts, tests)
  }
}

/**
 * Audit an action by the signed-in staff member in their active practice. Request headers
 * default to the current request's.
 */
export async function auditStaff(
  s: { user: Pick<StaffSession["user"], "id">; org: Pick<StaffSession["org"], "id"> },
  action: AuditAction,
  entity?: AuditEvent["entity"],
  extra: { reason?: string | null; metadata?: AuditMetadata; headers?: Headers } = {},
  tx?: Tx,
): Promise<void> {
  const headers = extra.headers ?? (await currentRequestHeaders());
  await audit({ orgId: s.org.id, actor: { type: "user", id: s.user.id }, action, entity, ...extra, headers }, tx);
}

const PAGE = 500;

/**
 * The chain's current head. Record it somewhere the database can't reach (the daily retention
 * job logs it with logInfo, so it ends up with the hosting provider) and pass the latest one to
 * verifyAuditChain: rows deleted after it then show up. Rows written after the last recorded
 * head can still disappear unnoticed, so record it often.
 */
export async function auditChainHead(orgId: string | null): Promise<AuditHead | null> {
  return chainHead(db, orgId);
}

/**
 * Logs the head (seq and hash) of every audit chain, the platform's included. Logs live with the
 * hosting provider, out of reach of someone who can write to the database. Run daily: by the
 * in-process job (src/instrumentation.ts) and by /api/cron/retention on serverless hosts.
 * Returns how many heads were logged.
 */
export async function logAuditHeads(): Promise<number> {
  // Chains come from the log itself, not from organizations: a closed org's chain is still kept.
  const chains = await db.selectDistinct({ orgId: auditLog.orgId }).from(auditLog);
  let logged = 0;
  for (const { orgId } of chains) {
    const head = await auditChainHead(orgId);
    if (!head) continue;
    logInfo("audit", "chain head", { org: orgId ?? "platform", seq: head.seq, hash: head.hash });
    logged++;
  }
  return logged;
}

/**
 * Recompute the chain. Reports the first row whose hash doesn't match its content, whose
 * prevHash doesn't match the row before, or that follows a gap in seq (a deleted row).
 * Without `from` the chain is checked from its start (or from the retention anchor); with it,
 * from the first row at or after `from`, trusting that row's prevHash.
 *
 * - head: a head recorded earlier (auditChainHead). The chain must still reach it with the same
 *   hash, or its newest rows were deleted.
 * - keptSince: rows from this instant on must all still exist (now minus the shortest audit
 *   retention the chain has had). An anchor newer than that means a prefix was deleted and the
 *   anchor written to pass it off as retention.
 */
export async function verifyAuditChain(
  orgId: string | null,
  opts: { from?: Date; head?: AuditHead | null; keptSince?: Date } = {},
): Promise<AuditChainResult> {
  const [anchor] = await db.select().from(auditAnchors).where(eq(auditAnchors.orgKey, anchorKey(orgId)));
  if (anchor && opts.keptSince && anchor.at.getTime() >= opts.keptSince.getTime()) return { ok: false, brokenAtId: null, reason: "anchor" };

  // `cursor` is the seq after which to read; null = nothing to read (no row at or after `from`).
  let expected: { seq: number; prevHash: string | null } | null = null;
  let cursor: number | null = Number.MIN_SAFE_INTEGER;
  if (opts.from) {
    const [first] = await db
      .select({ seq: min(auditLog.seq) })
      .from(auditLog)
      .where(and(chainOf(orgId), gte(auditLog.at, opts.from)));
    cursor = first?.seq == null ? null : first.seq - 1;
  } else {
    expected = anchor ? { seq: anchor.seq + 1, prevHash: anchor.hash } : { seq: 1, prevHash: null };
  }

  const head = opts.head;
  while (cursor !== null) {
    const rows = await db
      .select()
      .from(auditLog)
      .where(and(chainOf(orgId), gt(auditLog.seq, cursor)))
      .orderBy(asc(auditLog.seq))
      .limit(PAGE);
    for (const row of rows) {
      if (expected && (row.seq !== expected.seq || row.prevHash !== expected.prevHash)) return { ok: false, brokenAtId: row.id, reason: "link" };
      if (auditRowHash(row.prevHash, row) !== row.hash) return { ok: false, brokenAtId: row.id, reason: "hash" };
      if (head && row.seq === head.seq && row.hash !== head.hash) return { ok: false, brokenAtId: row.id, reason: "head" };
      expected = { seq: row.seq + 1, prevHash: row.hash };
      cursor = row.seq;
    }
    if (rows.length < PAGE) break;
  }

  if (head) {
    const end = await chainHead(db, orgId);
    if (!end || end.seq < head.seq) return { ok: false, brokenAtId: null, reason: "head" };
    if (anchor && anchor.seq === head.seq && anchor.hash !== head.hash) return { ok: false, brokenAtId: null, reason: "head" };
  }
  return { ok: true };
}

/**
 * Delete a chain's rows older than `before` (retention), keeping it verifiable: the hash and
 * seq of the last deleted row move to audit_anchors and the next row still chains onto it.
 * Only a contiguous prefix is deleted — pruning stops at the first row newer than `before`.
 */
export async function pruneAuditLog(orgId: string | null, before: Date, tx?: Tx): Promise<{ deleted: number }> {
  if (!tx || tx === db) return db.transaction((t) => pruneAuditLog(orgId, before, t));
  const [keep] = await tx
    .select({ seq: min(auditLog.seq) })
    .from(auditLog)
    .where(and(chainOf(orgId), gte(auditLog.at, before)));
  const limit = keep?.seq == null ? [] : [lte(auditLog.seq, keep.seq - 1)];
  const [last] = await tx
    .select({ seq: auditLog.seq, hash: auditLog.hash, at: auditLog.at })
    .from(auditLog)
    .where(and(chainOf(orgId), ...limit))
    .orderBy(desc(auditLog.seq))
    .limit(1);
  if (!last) return { deleted: 0 };
  const deleted = await tx.delete(auditLog).where(and(chainOf(orgId), lte(auditLog.seq, last.seq)));
  const anchor = { seq: last.seq, hash: last.hash, at: last.at };
  await tx
    .insert(auditAnchors)
    .values({ orgKey: anchorKey(orgId), ...anchor })
    .onConflictDoUpdate({ target: auditAnchors.orgKey, set: anchor });
  return { deleted: deleted.rowsAffected };
}
