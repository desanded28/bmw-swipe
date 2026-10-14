import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { rateLimits } from "@/db/schema";
import { hmac } from "./crypto";

/**
 * Fixed-window rate limits stored in the rate_limits table, so they hold across serverless
 * instances (an in-memory map resets on every cold start). Expired rows are purged by
 * retention; a row whose window has passed is simply restarted.
 */

export type RateLimitResult = { ok: boolean; retryAfterSec: number };

const IP_SHAPE = /^[0-9a-fA-F:.[\]]{2,64}$/;

function firstValid(...candidates: (string | null | undefined)[]): string | null {
  for (const c of candidates) {
    const v = c?.trim();
    if (v && IP_SHAPE.test(v)) return v;
  }
  return null;
}

/**
 * The caller's IP as seen by our edge. Only a header the deployment's own edge writes is believed;
 * any other a client can send with any value (and so pick its rate-limit bucket, or pass an API
 * key's IP allow-list):
 * - TRUSTED_IP_HEADER set (e.g. "x-real-ip" behind an nginx that overwrites it, "cf-connecting-ip"
 *   behind Cloudflare): that header only ("x-forwarded-for" means its last hop).
 * - On Vercel (VERCEL is set by the platform): x-vercel-forwarded-for, which its edge overwrites.
 * - Otherwise (self-hosted behind a proxy such as Caddy or nginx): the last x-forwarded-for hop,
 *   the one our proxy appended; everything before it is client-controlled. x-real-ip and
 *   x-vercel-forwarded-for are ignored, since a proxy that doesn't know them passes them through.
 *   (Next itself fills in x-forwarded-for with the socket address when it's missing, so x-real-ip
 *   is read only by code running without Next, such as tests and scripts.)
 * Without a usable address: "local".
 */
export function clientIp(h: Headers): string {
  const xff = h.get("x-forwarded-for")?.split(",");
  const lastHop = xff?.[xff.length - 1];
  const trusted = process.env.TRUSTED_IP_HEADER?.trim().toLowerCase();
  if (trusted) return firstValid(trusted === "x-forwarded-for" ? lastHop : h.get(trusted)?.split(",")[0]) ?? "local";
  if (process.env.VERCEL) return firstValid(h.get("x-vercel-forwarded-for")?.split(",")[0], lastHop) ?? "local";
  return firstValid(xff ? lastHop : h.get("x-real-ip")) ?? "local";
}

/**
 * What we store about the client, everywhere (audit log, consents, legal acceptances, one-time
 * codes): HMACs only, never the IP or user agent. One definition so the same client hashes the
 * same in every table. null without headers or a real client address.
 */
export function clientIpHash(h: Headers | undefined): string | null {
  if (!h) return null;
  const ip = clientIp(h);
  return ip === "local" ? null : hmac(ip, "ip");
}

export function userAgentHash(h: Headers | undefined): string | null {
  const ua = h?.get("user-agent");
  return ua ? hmac(ua.slice(0, 512), "ua") : null;
}

/** The 8 groups of an IPv6 address ("::" expanded, an embedded IPv4 tail as two groups), or null. */
function ipv6Groups(v: string): string[] | null {
  const halves = v.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const end = tail.length ? tail : head;
  const v4 = end.at(-1)?.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b, c, d] = v4.slice(1).map(Number);
    end.splice(-1, 1, ((a << 8) | b).toString(16), ((c << 8) | d).toString(16));
  }
  const gap = 8 - head.length - tail.length;
  if (halves.length === 2 ? gap < 1 : gap !== 0) return null;
  const groups = [...head, ...Array<string>(gap).fill("0"), ...tail];
  return groups.every((g) => /^[0-9a-f]{1,4}$/.test(g)) ? groups : null;
}

/**
 * The network a rate limit counts: an IPv4 address as it is, an IPv6 address by its /64. One
 * subscriber gets a whole /64 and can rotate through it freely, so a per-address limit would
 * reset at will. IPv4-mapped IPv6 counts as its IPv4 address; anything unparsable as itself.
 */
export function ipNetwork(ip: string): string {
  const v = ip.trim().replace(/^\[(.*)\]$/, "$1").toLowerCase();
  if (!v.includes(":")) return v;
  const g = ipv6Groups(v);
  if (!g) return v;
  const n = g.map((x) => parseInt(x, 16));
  if (n.slice(0, 5).every((x) => x === 0) && n[5] === 0xffff) return [n[6] >> 8, n[6] & 255, n[7] >> 8, n[7] & 255].join(".");
  return `${n.slice(0, 4).map((x) => x.toString(16)).join(":")}::/64`;
}

/**
 * HMAC of the caller's network (ipNetwork) for rate limits. A request without a usable address
 * counts as "local": one bucket shared by all of them, so a missing header fails closed.
 */
export function clientNetworkHash(h: Headers): string {
  return hmac(ipNetwork(clientIp(h)), "ip");
}

/**
 * Count one hit for `key` and say whether it is within `limit` per `windowMs`.
 * A single upsert, so concurrent hits can't both read the same count.
 * Not for use inside db.transaction() (it writes through the root db).
 */
export async function rateLimit(key: string, limit: number, windowMs: number, now = new Date()): Promise<RateLimitResult> {
  const nowMs = now.getTime();
  const fresh = nowMs + windowMs;
  const expired = sql`${rateLimits.resetAt} <= ${nowMs}`;
  const [row] = await db
    .insert(rateLimits)
    .values({ key, count: 1, resetAt: new Date(fresh) })
    .onConflictDoUpdate({
      target: rateLimits.key,
      // SQLite evaluates every SET expression against the old row, so both CASEs see the same reset_at.
      set: {
        count: sql`CASE WHEN ${expired} THEN 1 ELSE ${rateLimits.count} + 1 END`,
        resetAt: sql`CASE WHEN ${expired} THEN ${fresh} ELSE ${rateLimits.resetAt} END`,
      },
    })
    .returning({ count: rateLimits.count, resetAt: rateLimits.resetAt });
  if (row.count <= limit) return { ok: true, retryAfterSec: 0 };
  return { ok: false, retryAfterSec: Math.max(1, Math.ceil((row.resetAt.getTime() - nowMs) / 1000)) };
}

/** The key holds an HMAC of the caller's network (an IPv6 /64), never the address itself. */
export function ipKey(h: Headers, bucket: string): string {
  return `${bucket}:ip:${clientNetworkHash(h).slice(0, 32)}`;
}

export function rateLimitByIp(h: Headers, bucket: string, limit: number, windowMs: number, now?: Date): Promise<RateLimitResult> {
  return rateLimit(ipKey(h, bucket), limit, windowMs, now);
}

/**
 * The current state of a bucket without counting a hit (for limits that count only failures:
 * peek first, count with rateLimit() when the attempt fails).
 */
export async function peekRateLimit(key: string, limit: number, now = new Date()): Promise<RateLimitResult> {
  const [row] = await db.select().from(rateLimits).where(eq(rateLimits.key, key));
  if (!row || row.resetAt.getTime() <= now.getTime() || row.count < limit) return { ok: true, retryAfterSec: 0 };
  return { ok: false, retryAfterSec: Math.max(1, Math.ceil((row.resetAt.getTime() - now.getTime()) / 1000)) };
}
