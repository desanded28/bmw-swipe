"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { practitioners } from "@/db/schema";
import { absoluteUrl } from "@/lib/config";
import { sha256Hex } from "@/lib/crypto";
import { newToken } from "@/lib/ids";
import { fail, guard, ok, type ActionResult } from "./_shared";

/** Practitioners' personal calendar feeds (WP6: feed detail level, rate limits, audit). */

/** Issue a new personal calendar-feed URL. Only its hash is stored, so it is shown once. */
export async function rotateIcsToken(practitionerId: string): Promise<ActionResult> {
  return guard(
    async (s) => {
      const token = newToken();
      const res = await db
        .update(practitioners)
        .set({
          // The placeholder also replaces a legacy plaintext token, which the backfill would otherwise
          // still treat as a feed secret.
          icsToken: `h:${practitionerId}`,
          icsTokenHash: sha256Hex(token),
          icsEnabled: true,
          icsTokenExpiresAt: new Date(Date.now() + 365 * 86_400_000),
        })
        .where(and(eq(practitioners.id, practitionerId), eq(practitioners.orgId, s.org.id)))
        .returning({ id: practitioners.id });
      if (!res.length) return fail("Practitioner not found.");
      return ok("New calendar link generated. Copy it now: it won't be shown again. The old link stops working.", {
        url: absoluteUrl(`/api/ics/practitioner/${token}.ics`),
      });
    },
    { permission: "team.manage" },
  );
}
