"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { practitioners } from "@/db/schema";
import { auditStaff } from "@/lib/audit";
import type { StaffSession } from "@/lib/auth";
import { absoluteUrl } from "@/lib/config";
import { sha256Hex } from "@/lib/crypto";
import { newToken } from "@/lib/ids";
import { can } from "@/lib/permissions";
import { FEED_TOKEN_TTL_MS } from "@/lib/security/ics-feed";
import { securityTexts } from "@/lib/security/staff-locale";
import { fail, guard, ok, type ActionResult } from "./_shared";

/**
 * Practitioners' personal calendar feeds. Only the linked practitioner (practitioners.userId) or a
 * manager (team.manage) may issue or turn off a feed; the URL is returned once (only its hash is
 * stored, and who generated it: icsIssuedByUserId, read by security/offboarding.ts) and expires
 * after 12 months. The feed itself serves nothing while the practice's privacy.icsFeedsEnabled is
 * off (src/app/api/ics/practitioner/[token]/route.ts).
 */

/** The practitioner, if this staff member may manage its feed; "forbidden" or "not_found" otherwise. */
async function feedOwner(s: StaffSession, practitionerId: string) {
  const [p] = await db
    .select({ id: practitioners.id, userId: practitioners.userId })
    .from(practitioners)
    .where(and(eq(practitioners.id, String(practitionerId)), eq(practitioners.orgId, s.org.id)));
  const manager = can(s.role, "team.manage");
  // Non-managers learn nothing about practitioners that aren't theirs: the same "forbidden" either way.
  if (!manager && (!p || p.userId !== s.user.id)) return "forbidden" as const;
  if (!p) return "not_found" as const;
  return p;
}

/** Issue a new personal calendar-feed URL (the old one stops working). Shown once. */
export async function rotateIcsToken(practitionerId: string): Promise<ActionResult> {
  return guard(async (s) => {
    const t = await securityTexts(s);
    const p = await feedOwner(s, practitionerId);
    if (p === "forbidden") return fail(t("ics.notAllowed"), "forbidden");
    if (p === "not_found") return fail(t("errors.notFound"), "not_found");
    const token = newToken();
    await db
      .update(practitioners)
      .set({
        // The placeholder also replaces a legacy plaintext token, which the backfill would otherwise
        // still treat as a feed secret.
        icsToken: `h:${p.id}`,
        icsTokenHash: sha256Hex(token),
        icsEnabled: true,
        icsTokenExpiresAt: new Date(Date.now() + FEED_TOKEN_TTL_MS),
        // Who saw the URL: offboarding turns the feed off once they lose access.
        icsIssuedByUserId: s.user.id,
      })
      .where(and(eq(practitioners.id, p.id), eq(practitioners.orgId, s.org.id)));
    await auditStaff(s, "ics.feed.rotate", { type: "practitioner", id: p.id }, { metadata: { enabled: true } });
    return ok(t("ics.generated"), { url: absoluteUrl(`/api/ics/practitioner/${token}.ics`) });
  });
}

/** Turn a feed off: subscribed calendars stop getting updates (the hash is forgotten too). */
export async function disableIcsFeed(practitionerId: string): Promise<ActionResult> {
  return guard(async (s) => {
    const t = await securityTexts(s);
    const p = await feedOwner(s, practitionerId);
    if (p === "forbidden") return fail(t("ics.notAllowed"), "forbidden");
    if (p === "not_found") return fail(t("errors.notFound"), "not_found");
    await db
      .update(practitioners)
      .set({ icsEnabled: false, icsTokenHash: null, icsTokenExpiresAt: null, icsToken: `h:${p.id}`, icsIssuedByUserId: null })
      .where(and(eq(practitioners.id, p.id), eq(practitioners.orgId, s.org.id)));
    await auditStaff(s, "ics.feed.rotate", { type: "practitioner", id: p.id }, { metadata: { enabled: false } });
    return ok(t("ics.disabled"));
  });
}
