import { and, eq, gt, isNull } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { authTokens, type AuthToken, type AuthTokenKind, type MembershipRole } from "@/db/schema";
import { sha256Hex } from "../crypto";
import { newToken } from "../ids";

/**
 * One-time tokens sent by email: password reset (30 minutes), email confirmation (24 hours) and
 * team invitations (7 days). Only the sha256 is stored (auth_tokens.id); the raw token travels in
 * the link and nowhere else (the message log keeps a redacted body).
 */

export const TOKEN_TTL_MS: Record<AuthTokenKind, number> = {
  password_reset: 30 * 60_000,
  email_verify: 24 * 3_600_000,
  invite: 7 * 86_400_000,
};

export type IssueTokenInput = {
  kind: AuthTokenKind;
  userId?: string | null;
  email?: string | null;
  orgId?: string | null;
  role?: MembershipRole | null;
  createdByUserId?: string | null;
  now?: Date;
};

export async function issueAuthToken(i: IssueTokenInput, t: Tx = db): Promise<{ token: string; id: string; expiresAt: Date }> {
  const now = i.now ?? new Date();
  const token = newToken();
  const id = sha256Hex(token);
  const expiresAt = new Date(now.getTime() + TOKEN_TTL_MS[i.kind]);
  await t.insert(authTokens).values({
    id,
    kind: i.kind,
    userId: i.userId ?? null,
    email: i.email ?? null,
    orgId: i.orgId ?? null,
    role: i.role ?? null,
    createdByUserId: i.createdByUserId ?? null,
    expiresAt,
    createdAt: now,
  });
  return { token, id, expiresAt };
}

/** A token's row if it exists, has this kind, is unused and unexpired; null otherwise. */
export async function findAuthToken(token: string, kind: AuthTokenKind, now: Date = new Date(), t: Tx = db): Promise<AuthToken | null> {
  if (typeof token !== "string" || token.length < 20 || token.length > 100) return null;
  const [row] = await t
    .select()
    .from(authTokens)
    .where(and(eq(authTokens.id, sha256Hex(token)), eq(authTokens.kind, kind), isNull(authTokens.usedAt), gt(authTokens.expiresAt, now)));
  return row ?? null;
}

/**
 * Mark a token used. Conditional on it still being unused, so two concurrent submissions can't
 * both consume it: returns false for the loser.
 */
export async function consumeAuthToken(id: string, now: Date = new Date(), t: Tx = db): Promise<boolean> {
  const res = await t
    .update(authTokens)
    .set({ usedAt: now })
    .where(and(eq(authTokens.id, id), isNull(authTokens.usedAt)));
  return res.rowsAffected === 1;
}

/** Invalidate every open token of a kind for a user (e.g. older reset links after a reset). */
export async function invalidateUserTokens(userId: string, kind: AuthTokenKind, now: Date = new Date(), t: Tx = db): Promise<void> {
  await t
    .update(authTokens)
    .set({ usedAt: now })
    .where(and(eq(authTokens.userId, userId), eq(authTokens.kind, kind), isNull(authTokens.usedAt)));
}
