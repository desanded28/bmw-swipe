import { createHash, timingSafeEqual } from "node:crypto";

/**
 * May this request run a cron job (/api/cron/*)? It must carry `Authorization: Bearer $CRON_SECRET`
 * (Vercel Cron sends it). Without CRON_SECRET the jobs are open only outside production.
 *
 * Compared in constant time over SHA-256 digests (equal lengths whatever was sent), so response
 * timing reveals nothing about the secret.
 */
export function isCronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const digest = (v: string) => createHash("sha256").update(v).digest();
  return timingSafeEqual(digest(req.headers.get("authorization") ?? ""), digest(`Bearer ${secret}`));
}
