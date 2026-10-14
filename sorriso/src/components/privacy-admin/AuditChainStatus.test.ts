/* eslint-disable @typescript-eslint/no-restricted-imports -- a server-side test: it writes and tampers with audit rows. */
import { eq, sql } from "drizzle-orm";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { db } from "@/db";
import { auditLog } from "@/db/schema";
import { getT } from "@/i18n/t";
import { audit, AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, verifyAuditChain } from "@/lib/audit";
import { createPractice } from "@/test/fixtures";
import { AuditChainStatus } from "./AuditChainStatus";
import { auditActionLabel } from "./PrivacyPanel";

const t = getT("en", "privacyAdmin");
const render = (result: Awaited<ReturnType<typeof verifyAuditChain>>) => renderToStaticMarkup(createElement(AuditChainStatus, { t, result }));

describe("audit viewer: chain status", () => {
  it("shows an intact chain as verified, and an edited row as broken at that row", async () => {
    const { orgId } = await createPractice();
    for (const action of ["patient.view", "patient.update", "patient.export"] as const) {
      await audit({ orgId, actor: { type: "user", id: "u1" }, action, entity: { type: "patient", id: "p1" } });
    }
    const ok = await verifyAuditChain(orgId);
    expect(ok).toEqual({ ok: true });
    expect(render(ok)).toContain("Integrity verified");

    const rows = await db.select().from(auditLog).where(eq(auditLog.orgId, orgId)).orderBy(auditLog.seq);
    // Someone with database access rewrites history: the export becomes a mere view.
    await db.run(sql`update audit_log set action = 'patient.view' where id = ${rows[2].id}`);
    const broken = await verifyAuditChain(orgId);
    expect(broken).toEqual({ ok: false, brokenAtId: rows[2].id, reason: "hash" });
    const html = render(broken);
    expect(html).toContain('role="alert"');
    expect(html).toContain(`Integrity check failed at entry ${rows[2].id}`);
    expect(html).toContain("an entry was edited");
  });

  it("reports deleted rows", async () => {
    const { orgId } = await createPractice();
    for (let i = 0; i < 3; i++) await audit({ orgId, actor: { type: "system", id: null }, action: "settings.update" });
    const rows = await db.select().from(auditLog).where(eq(auditLog.orgId, orgId)).orderBy(auditLog.seq);
    await db.delete(auditLog).where(eq(auditLog.id, rows[1].id));
    const broken = await verifyAuditChain(orgId);
    expect(broken).toMatchObject({ ok: false, brokenAtId: rows[2].id, reason: "link" });
    expect(render(broken)).toContain("entries were deleted, inserted or reordered");
  });
});

describe("audit viewer: labels", () => {
  it("has an English label for every audit action and record type (none falls back to the raw name)", () => {
    const unlabelled = AUDIT_ACTIONS.filter((a) => !t.has(`audit.actions.${a}`) || typeof auditActionLabel(t, a) !== "string" || auditActionLabel(t, a) === a);
    expect(unlabelled).toEqual([]);
    expect(AUDIT_ENTITY_TYPES.filter((e) => !t.has(`audit.entities.${e}`))).toEqual([]);
    expect(auditActionLabel(t, "legal.notify")).toBe("Notified of a legal document change");
    expect(auditActionLabel(t, "practitioner.marketplace.opt_out")).toBe("Changed the marketplace listing");
    expect(t("audit.entities.waitlist")).toBe("Waiting-list entry");
  });
});
