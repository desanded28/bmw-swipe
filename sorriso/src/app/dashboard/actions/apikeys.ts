"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { apiKeys } from "@/db/schema";
import { createApiKey } from "@/lib/api";
import { guard, ok, type ActionResult } from "./_shared";

/** Partner API keys (WP6: scopes, expiry, audit). */

/** Create a key; the secret is returned once in data.secret (only its hash is stored). */
export async function newApiKey(name: string): Promise<ActionResult> {
  return guard(
    async (s) => {
      const { secret } = await createApiKey(s.org.id, name.trim() || "API key");
      return ok("Copy this key now — it won't be shown again.", { secret });
    },
    { permission: "apikeys.manage" },
  );
}

export async function revokeApiKey(id: string): Promise<ActionResult> {
  return guard(
    async (s) => {
      await db
        .update(apiKeys)
        .set({ revokedAt: new Date() })
        .where(and(eq(apiKeys.id, id), eq(apiKeys.orgId, s.org.id)));
      return ok("Key revoked.");
    },
    { permission: "apikeys.manage" },
  );
}
