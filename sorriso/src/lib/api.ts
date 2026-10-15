import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { db } from "@/db";
import { API_SCOPES, apiKeys, organizations, type ApiKey, type ApiScope, type Organization } from "@/db/schema";
import { audit } from "./audit";
import { BookingError, bookingRuleMessage } from "./booking";
import { newId, newToken, sha256 } from "./ids";
import { logError } from "./log";
import { clientIp, rateLimit, rateLimitByIp } from "./rate-limit";
import { ipAllowed } from "./security/ip";

/**
 * Public API (booking, availability, the patient's own appointment): CORS-open, so third-party
 * sites and the widget can call it. Partner API (/api/v1/partner/**): API keys only, never CORS
 * (a browser page must not be able to call it with a key), scoped, IP-restricted and audited;
 * routes go through partnerRoute().
 */

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Idempotency-Key",
  "Access-Control-Max-Age": "86400",
};

export function json(data: unknown, init: ResponseInit = {}) {
  return NextResponse.json(data, { ...init, headers: { ...CORS_HEADERS, ...(init.headers ?? {}) } });
}

export function apiError(status: number, code: string, message: string, extra: Record<string, unknown> = {}) {
  return json({ error: { code, message, ...extra } }, { status });
}

export function preflight() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/** 429 with Retry-After. */
export function rateLimited(retryAfterSec: number, message = "Too many requests. Please try again in a few minutes.") {
  const res = apiError(429, "rate_limited", message);
  res.headers.set("Retry-After", String(Math.max(1, retryAfterSec)));
  return res;
}

/**
 * Per-IP rate limit for a public endpoint: null when the call may proceed, else a 429.
 *   const limited = await limitByIp(req, "book", 10, 10 * 60_000); if (limited) return limited;
 */
export async function limitByIp(req: Request, bucket: string, limit: number, windowMs: number): Promise<NextResponse | null> {
  const res = await rateLimitByIp(req.headers, bucket, limit, windowMs);
  return res.ok ? null : rateLimited(res.retryAfterSec);
}

/** Map thrown errors to consistent JSON responses. */
/** A request body that isn't JSON (readJson): the client's mistake, never a server error. */
class InvalidJsonError extends Error {}

/** The request body parsed as JSON; a malformed body answers 422 validation_error through handleApiError. */
export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new InvalidJsonError("invalid JSON body");
  }
}

export function handleApiError(err: unknown) {
  if (err instanceof InvalidJsonError) return apiError(422, "validation_error", "The request body isn't valid JSON.");
  if (err instanceof ZodError) {
    return apiError(422, "validation_error", "Some fields are invalid.", {
      issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  }
  if (err instanceof BookingError) {
    // A failed privacy or relation rule: 422 with the rule's own code (e.g. guardian_required),
    // an English fallback text and the form field it is about.
    if (err.code === "invalid" && err.reason) {
      return apiError(422, err.reason, bookingRuleMessage(err.reason), err.field ? { field: err.field } : {});
    }
    const status = err.code === "not_found" ? 404 : err.code === "invalid" ? 422 : 409;
    return apiError(status, err.code, err.message);
  }
  logError("api", err);
  return apiError(500, "internal_error", "Something went wrong.");
}

// ---- API keys (partner integrations) ----

export const DEFAULT_SCOPES: ApiScope[] = ["appointments:read", "appointments:write", "patients:read"];
export const API_KEY_DEFAULT_MONTHS = 12;
export const API_KEY_MAX_MONTHS = 24;

export type CreateApiKeyInput = {
  name: string;
  scopes?: readonly ApiScope[];
  /** Months until expiry (1-24, default 12). Keys always expire. */
  expiresInMonths?: number;
  /** Exact IPs or CIDR ranges; empty or null = any address. */
  allowedIps?: string[] | null;
  createdByUserId?: string | null;
  now?: Date;
};

export function addMonths(d: Date, months: number): Date {
  const out = new Date(d);
  out.setUTCMonth(out.getUTCMonth() + months);
  return out;
}

/**
 * When a key stops working. Keys always expire: one issued before expiries existed (expires_at
 * NULL) expires 12 months after it was created.
 */
export function apiKeyExpiry(key: Pick<ApiKey, "expiresAt" | "createdAt">): Date {
  return key.expiresAt ?? addMonths(key.createdAt, API_KEY_DEFAULT_MONTHS);
}

/**
 * Secrets that were published (the old hard-coded demo key, printed on the developers page):
 * refused whatever the database says.
 */
const PUBLISHED_KEY_HASHES = new Set(["sk_demo_studio_bianchi_local_only"].map((k) => sha256(k)));

/** Create a key; the secret is returned once (only its sha256 is stored). */
export async function createApiKey(orgId: string, input: string | CreateApiKeyInput) {
  const i: CreateApiKeyInput = typeof input === "string" ? { name: input } : input;
  const secret = `sk_${newToken()}`;
  const prefix = secret.slice(0, 10);
  const scopes = [...new Set((i.scopes?.length ? i.scopes : DEFAULT_SCOPES).filter((s) => API_SCOPES.includes(s)))];
  const months = Math.min(API_KEY_MAX_MONTHS, Math.max(1, Math.round(i.expiresInMonths ?? API_KEY_DEFAULT_MONTHS)));
  const expiresAt = addMonths(i.now ?? new Date(), months);
  const id = newId();
  await db.insert(apiKeys).values({
    id,
    orgId,
    name: i.name.trim().slice(0, 80) || "API key",
    prefix,
    keyHash: sha256(secret),
    scopes,
    expiresAt,
    allowedIps: i.allowedIps?.length ? i.allowedIps : null,
    createdByUserId: i.createdByUserId ?? null,
  });
  return { id, prefix, secret, scopes, expiresAt };
}

export type ApiAuth = { org: Organization; key: ApiKey };

export type ApiKeyCheck =
  | { ok: true; auth: ApiAuth }
  /** none: no Authorization header at all (a public call). */
  | { ok: false; status: 401 | 403; code: "none" | "unauthorized" | "ip_not_allowed" };

/**
 * Check `Authorization: Bearer sk_…`: unknown, revoked, expired (apiKeyExpiry) and published
 * keys are 401; a key with an IP allow-list called from another address is 403. Updates
 * lastUsedAt on success.
 */
export async function checkApiKey(req: Request, now: Date = new Date()): Promise<ApiKeyCheck> {
  const header = req.headers.get("authorization");
  if (!header) return { ok: false, status: 401, code: "none" };
  const m = header.match(/^Bearer\s+(sk_[A-Za-z0-9_-]{10,100})$/);
  if (!m) return { ok: false, status: 401, code: "unauthorized" };
  const hash = sha256(m[1]);
  if (PUBLISHED_KEY_HASHES.has(hash)) return { ok: false, status: 401, code: "unauthorized" };
  const [row] = await db
    .select({ key: apiKeys, org: organizations })
    .from(apiKeys)
    .innerJoin(organizations, eq(organizations.id, apiKeys.orgId))
    .where(and(eq(apiKeys.keyHash, hash), isNull(apiKeys.revokedAt)));
  if (!row) return { ok: false, status: 401, code: "unauthorized" };
  if (apiKeyExpiry(row.key).getTime() <= now.getTime()) return { ok: false, status: 401, code: "unauthorized" };
  if (!ipAllowed(clientIp(req.headers), row.key.allowedIps)) return { ok: false, status: 403, code: "ip_not_allowed" };
  // At most once a minute: a busy integration shouldn't turn every call into a write.
  if (!row.key.lastUsedAt || now.getTime() - row.key.lastUsedAt.getTime() > 60_000) {
    await db.update(apiKeys).set({ lastUsedAt: now }).where(eq(apiKeys.id, row.key.id));
  }
  return { ok: true, auth: row };
}

/** Resolve the key and its practice; null if missing, unknown, revoked, expired or called from a disallowed IP. */
export async function authenticateApiKey(req: Request): Promise<ApiAuth | null> {
  const res = await checkApiKey(req);
  return res.ok ? res.auth : null;
}

/** The JSON error for a failed checkApiKey() (none counts as unauthorized). */
export function apiKeyError(res: Extract<ApiKeyCheck, { ok: false }>) {
  return res.code === "ip_not_allowed"
    ? apiError(403, "ip_not_allowed", "This API key can't be used from this IP address.")
    : apiError(401, "unauthorized", "Missing or invalid API key.");
}

export function hasScope(auth: ApiAuth, scope: ApiScope): boolean {
  return auth.key.scopes.includes(scope);
}

/**
 * 403 unless the key was granted `scope`; null when the call may proceed.
 *   const denied = requireScope(auth, "patients:erase"); if (denied) return denied;
 */
export function requireScope(auth: ApiAuth, scope: ApiScope): NextResponse | null {
  if (hasScope(auth, scope)) return null;
  return apiError(403, "insufficient_scope", `This API key lacks the ${scope} scope.`, { scope });
}

/** Calls per key per minute. */
const PARTNER_RATE = { limit: 600, windowMs: 60_000 };

/**
 * The per-key rate limit every key-authenticated call shares (partner routes, and the public
 * booking and waitlist routes called with a key): null when the call may proceed, else a 429.
 */
export async function limitByKey(auth: ApiAuth): Promise<NextResponse | null> {
  const res = await rateLimit(`partner:${auth.key.id}`, PARTNER_RATE.limit, PARTNER_RATE.windowMs);
  return res.ok ? null : rateLimited(res.retryAfterSec);
}

/** Audit one key-authenticated call (api.request, actor = the key). */
export async function auditApiRequest(req: Request, auth: ApiAuth, route: string, status: number, extra: Record<string, string> = {}): Promise<void> {
  await audit({
    orgId: auth.org.id,
    actor: { type: "api_key", id: auth.key.id },
    action: "api.request",
    entity: { type: "api_key", id: auth.key.id },
    metadata: { method: req.method, route, status, ...extra },
    headers: req.headers,
  });
}

/**
 * A partner call that returned patient data: one patient.view row per patient in the practice's
 * chain (actor the key, metadata { via, route }), so the read shows in each patient's access log
 * (privacy center, Art. 15 export) and not only as an api.request row.
 */
export async function auditPartnerRead(req: Request, auth: ApiAuth, route: string, patientIds: readonly string[]): Promise<void> {
  const ids = [...new Set(patientIds)];
  if (!ids.length) return;
  await db.transaction(async (tx) => {
    for (const id of ids) {
      await audit(
        {
          orgId: auth.org.id,
          actor: { type: "api_key", id: auth.key.id },
          action: "patient.view",
          entity: { type: "patient", id },
          metadata: { via: "partner_api", route },
          headers: req.headers,
        },
        tx,
      );
    }
  });
}

function withoutCors(res: Response): Response {
  for (const name of [...res.headers.keys()]) if (name.toLowerCase().startsWith("access-control-")) res.headers.delete(name);
  res.headers.set("Cache-Control", "no-store");
  return res;
}

/**
 * Run a partner API handler: authenticates the key (401/403), checks `scope` (403), rate-limits
 * per key (429), turns thrown errors into JSON, strips every CORS header, and audits api.request
 * (method, route, status; actor = the key).
 *
 *   export const GET = (req: Request) => partnerRoute(req, "appointments:read", "appointments.list", async (auth) => json(...));
 */
export async function partnerRoute(
  req: Request,
  scope: ApiScope,
  route: string,
  handler: (auth: ApiAuth) => Promise<Response>,
): Promise<Response> {
  const check = await checkApiKey(req);
  if (!check.ok) return withoutCors(apiKeyError(check));
  const { auth } = check;
  let res: Response;
  const limited = await limitByKey(auth);
  if (limited) res = limited;
  else if (!hasScope(auth, scope)) res = requireScope(auth, scope)!;
  else {
    try {
      res = await handler(auth);
    } catch (err) {
      res = handleApiError(err);
    }
  }
  await auditApiRequest(req, auth, route, res.status);
  return withoutCors(res);
}
