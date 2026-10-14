"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { sessions } from "@/db/schema";
import { staff } from "./_shared";

/** Staff session actions (WP2): switching practice; the staff language picker goes here too. */

/** Make another of the user's practices the active one. */
export async function switchOrg(orgId: string) {
  const s = await staff();
  if (!s.orgs.some((o) => o.org.id === orgId)) return;
  await db.update(sessions).set({ orgId }).where(eq(sessions.id, s.sessionId));
  redirect("/dashboard");
}
