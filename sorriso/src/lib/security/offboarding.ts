import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import type { MembershipRole } from "@/db/enums";
import { apiKeys, practitioners } from "@/db/schema";
import { can } from "../permissions";

/**
 * Secrets that read this practice's data outside the dashboard are shown once, to whoever creates
 * them: calendar-feed URLs (actions/ics.ts rotateIcsToken) and partner API keys
 * (actions/apikeys.ts newApiKey). Ending someone's membership or lowering their role must also
 * end what they took away with them, or a removed admin keeps receiving a colleague's agenda for
 * up to 12 months and reading patients through the API for up to 24.
 *
 * withdrawIssuedAccess() runs on removal (role null) and on every role change:
 * - Calendar feeds whose current URL they generated (practitioners.icsIssuedByUserId, set by
 *   rotateIcsToken; migration 0003 filled it for older feeds from their newest ics.feed.rotate
 *   audit row) are turned off once they can no longer manage the team. While they're still a
 *   member, the feed of their own practitioner profile stays: they may generate that one anyway.
 * - On removal, the feed of the practitioner profile linked to them is turned off too, whoever
 *   generated it: it delivers to their calendar.
 * - API keys they created are revoked once they can no longer manage API keys.
 * Turned-off feeds and revoked keys have to be issued again by someone who still may; the caller
 * audits each one and tells the manager how many there were.
 */

export type WithdrawnAccess = { feeds: string[]; keys: string[] };

/**
 * Turn off the feeds and revoke the API keys `userId` should no longer hold in `orgId`, now that
 * their role there is `role` (null: removed). Returns what was withdrawn.
 */
export async function withdrawIssuedAccess(orgId: string, userId: string, role: MembershipRole | null, now: Date = new Date()): Promise<WithdrawnAccess> {
  const removed = role === null;
  const feeds = new Set<string>();

  const live = await db
    .select({ id: practitioners.id, userId: practitioners.userId, issuedBy: practitioners.icsIssuedByUserId })
    .from(practitioners)
    .where(and(eq(practitioners.orgId, orgId), isNotNull(practitioners.icsTokenHash)));
  if (removed) for (const p of live) if (p.userId === userId) feeds.add(p.id);
  if (removed || !can(role, "team.manage")) {
    // Their own profile's feed is theirs to keep while they're a member (handled above on removal).
    for (const p of live) if (p.issuedBy === userId && p.userId !== userId) feeds.add(p.id);
  }
  if (feeds.size) {
    await db
      .update(practitioners)
      // Like disableIcsFeed: the hash is forgotten, and the placeholder replaces any legacy plaintext token.
      .set({ icsEnabled: false, icsTokenHash: null, icsTokenExpiresAt: null, icsToken: sql`'h:' || ${practitioners.id}`, icsIssuedByUserId: null })
      .where(and(eq(practitioners.orgId, orgId), inArray(practitioners.id, [...feeds])));
  }

  let keys: string[] = [];
  if (removed || !can(role, "apikeys.manage")) {
    const revoked = await db
      .update(apiKeys)
      .set({ revokedAt: now })
      .where(and(eq(apiKeys.orgId, orgId), eq(apiKeys.createdByUserId, userId), isNull(apiKeys.revokedAt)))
      .returning({ id: apiKeys.id });
    keys = revoked.map((k) => k.id);
  }
  return { feeds: [...feeds], keys };
}
