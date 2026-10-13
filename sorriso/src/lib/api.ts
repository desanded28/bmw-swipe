import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { db } from "@/db";
import { apiKeys, organizations } from "@/db/schema";
import { BookingError } from "./booking";
import { newId, newToken, sha256 } from "./ids";

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

/** Map thrown errors to consistent JSON responses. */
export function handleApiError(err: unknown) {
  if (err instanceof ZodError) {
    return apiError(422, "validation_error", "Some fields are invalid.", {
      issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  }
  if (err instanceof BookingError) {
    const status = err.code === "not_found" ? 404 : err.code === "invalid" ? 422 : 409;
    return apiError(status, err.code, err.message);
  }
  console.error("[api]", err);
  return apiError(500, "internal_error", "Something went wrong.");
}

// ---- API keys (partner integrations) ----

export async function createApiKey(orgId: string, name: string) {
  const secret = `sk_${newToken()}`;
  const prefix = secret.slice(0, 10);
  await db.insert(apiKeys).values({ id: newId(), orgId, name, prefix, keyHash: sha256(secret) });
  return { prefix, secret };
}

/** Resolve `Authorization: Bearer sk_…` to the owning practice. */
export async function authenticateApiKey(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  const m = header.match(/^Bearer\s+(sk_[A-Za-z0-9_-]+)$/);
  if (!m) return null;
  const [row] = await db
    .select({ key: apiKeys, org: organizations })
    .from(apiKeys)
    .innerJoin(organizations, eq(organizations.id, apiKeys.orgId))
    .where(and(eq(apiKeys.keyHash, sha256(m[1])), isNull(apiKeys.revokedAt)));
  if (!row) return null;
  await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, row.key.id));
  return row.org;
}

// ---- naive in-memory rate limit for public endpoints (per instance) ----

const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(req: Request, key: string, limit: number, windowMs: number): boolean {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? "local";
  const id = `${key}:${ip}`;
  const now = Date.now();
  const bucket = buckets.get(id);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(id, { count: 1, resetAt: now + windowMs });
    return true;
  }
  bucket.count++;
  return bucket.count <= limit;
}
