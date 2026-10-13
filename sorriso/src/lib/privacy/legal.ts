import { and, desc, eq, isNull, sql, type SQL } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { legalAcceptances, memberships, type LegalDoc, type Locale } from "@/db/schema";
import { audit } from "../audit";
import { newId } from "../ids";
import { clientIpHash, userAgentHash } from "../rate-limit";
import { LEGAL_VERSIONS } from "./versions";

/**
 * Acceptance of the practice-facing legal documents: the Art. 28 DPA, the terms, the
 * sub-processor list and the staff data-protection instructions (Art. 29 / 2-quaterdecies).
 * Each acceptance is a row with the version, the language shown and HMACs of IP and user
 * agent, so the practice's agreement to a given wording can be proven later.
 */

export async function recordLegalAcceptance(
  tx: Tx,
  i: { orgId: string | null; userId: string; doc: LegalDoc; locale: Locale; version?: string; headers?: Headers; now?: Date },
): Promise<void> {
  const now = i.now ?? new Date();
  const version = i.version ?? LEGAL_VERSIONS[i.doc];
  await tx.insert(legalAcceptances).values({
    id: newId(),
    orgId: i.orgId,
    userId: i.userId,
    documentType: i.doc,
    version,
    locale: i.locale,
    acceptedAt: now,
    ipHash: clientIpHash(i.headers),
    uaHash: userAgentHash(i.headers),
  });
  // The membership keeps the accepted instructions version for the dashboard gate.
  if (i.doc === "staff_instructions" && i.orgId) {
    await tx
      .update(memberships)
      .set({ instructionsVersion: version, instructionsAcceptedAt: now })
      .where(and(eq(memberships.orgId, i.orgId), eq(memberships.userId, i.userId)));
  }
  await audit(
    {
      orgId: i.orgId,
      actor: { type: "user", id: i.userId },
      action: "legal.accept",
      entity: i.orgId ? { type: "org", id: i.orgId } : undefined,
      metadata: { doc: i.doc, version, locale: i.locale },
      headers: i.headers,
      at: now,
    },
    tx,
  );
}

function scope(orgId: string | null, doc: LegalDoc, userId?: string): SQL {
  return and(
    orgId === null ? isNull(legalAcceptances.orgId) : eq(legalAcceptances.orgId, orgId),
    eq(legalAcceptances.documentType, doc),
    userId ? eq(legalAcceptances.userId, userId) : undefined,
  )!;
}

export async function latestAcceptance(
  orgId: string | null,
  doc: LegalDoc,
  userId?: string,
  tx: Tx = db,
): Promise<{ version: string; acceptedAt: Date; userId: string | null } | null> {
  const [row] = await tx
    .select({ version: legalAcceptances.version, acceptedAt: legalAcceptances.acceptedAt, userId: legalAcceptances.userId })
    .from(legalAcceptances)
    .where(scope(orgId, doc, userId))
    .orderBy(desc(legalAcceptances.acceptedAt), desc(sql`${legalAcceptances}.rowid`))
    .limit(1);
  return row ?? null;
}

/** Has anyone (or this user) in the org accepted the version currently in force? */
export async function hasAcceptedCurrent(orgId: string | null, doc: LegalDoc, userId?: string, tx: Tx = db): Promise<boolean> {
  const [row] = await tx
    .select({ id: legalAcceptances.id })
    .from(legalAcceptances)
    .where(and(scope(orgId, doc, userId), eq(legalAcceptances.version, LEGAL_VERSIONS[doc])))
    .limit(1);
  return Boolean(row);
}
