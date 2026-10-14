import { and, desc, eq, gte, lt, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { auditLog, users } from "@/db/schema";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/lib/audit";
import { addDays, isDateString, zonedToUtc } from "@/lib/time";

/**
 * Filters of the audit viewer and its CSV export (/dashboard/audit). They live in the URL: ids,
 * action codes and dates only, never names or free text.
 */
export type AuditFilter = {
  actor: string | null;
  action: string | null;
  entityType: string | null;
  entityId: string | null;
  /** YYYY-MM-DD, in the practice's time zone, inclusive. */
  from: string | null;
  to: string | null;
  /** Show rows older than this position (pagination by seq). */
  before: number | null;
};

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || null;

export function parseAuditFilter(sp: Params): AuditFilter {
  const action = one(sp.action);
  const entityType = one(sp.entity);
  const before = Number(one(sp.before));
  return {
    actor: one(sp.actor)?.slice(0, 40) ?? null,
    action: action && (AUDIT_ACTIONS as readonly string[]).includes(action) ? action : null,
    entityType: entityType && (AUDIT_ENTITY_TYPES as readonly string[]).includes(entityType) ? entityType : null,
    entityId: one(sp.entityId)?.slice(0, 40) ?? null,
    from: isDateString(one(sp.from)) ? one(sp.from) : null,
    to: isDateString(one(sp.to)) ? one(sp.to) : null,
    before: Number.isInteger(before) && before > 0 ? before : null,
  };
}

/** The filter as a query string (without the cursor). */
export function filterQuery(f: AuditFilter): URLSearchParams {
  const q = new URLSearchParams();
  if (f.actor) q.set("actor", f.actor);
  if (f.action) q.set("action", f.action);
  if (f.entityType) q.set("entity", f.entityType);
  if (f.entityId) q.set("entityId", f.entityId);
  if (f.from) q.set("from", f.from);
  if (f.to) q.set("to", f.to);
  return q;
}

export function auditWhere(orgId: string, f: AuditFilter, tz: string): SQL {
  return and(
    eq(auditLog.orgId, orgId),
    f.actor ? eq(auditLog.actorId, f.actor) : undefined,
    f.action ? eq(auditLog.action, f.action) : undefined,
    f.entityType ? eq(auditLog.entityType, f.entityType) : undefined,
    f.entityId ? eq(auditLog.entityId, f.entityId) : undefined,
    f.from ? gte(auditLog.at, zonedToUtc(f.from, 0, tz)) : undefined,
    f.to ? lt(auditLog.at, zonedToUtc(addDays(f.to, 1), 0, tz)) : undefined,
    f.before ? lt(auditLog.seq, f.before) : undefined,
  )!;
}

/** Newest first, with the staff member's name when a person acted. */
export async function loadAuditRows(orgId: string, f: AuditFilter, tz: string, limit: number) {
  return db
    .select({ row: auditLog, name: users.name })
    .from(auditLog)
    .leftJoin(users, and(eq(users.id, auditLog.actorId), eq(auditLog.actorType, "user")))
    .where(auditWhere(orgId, f, tz))
    .orderBy(desc(auditLog.seq))
    .limit(limit);
}
