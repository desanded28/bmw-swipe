import { asc, eq } from "drizzle-orm";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { db, type Tx } from "@/db";
import { auditAnchors, auditLog } from "@/db/schema";
import { migrateOnce } from "@/test/fixtures";
import {
  audit,
  auditChainHead,
  auditRowHash,
  auditStaff,
  getAuditFailureCount,
  pruneAuditLog,
  verifyAuditChain,
  type AuditEvent,
} from "./audit";
import { hmac, sha256Hex } from "./crypto";
import { newId } from "./ids";

beforeAll(migrateOnce);
afterEach(() => vi.restoreAllMocks());

const view = (orgId: string | null, extra: Partial<AuditEvent> = {}): AuditEvent => ({
  orgId,
  actor: { type: "user", id: "user-1" },
  action: "patient.view",
  entity: { type: "patient", id: "patient-1" },
  ...extra,
});

const chain = (orgId: string) => db.select().from(auditLog).where(eq(auditLog.orgId, orgId)).orderBy(asc(auditLog.seq));

describe("audit chain", () => {
  it("chains rows per org with consecutive seq", async () => {
    const a = newId();
    const b = newId();
    await audit(view(a));
    await audit(view(b));
    await audit(view(a, { action: "patient.update", metadata: { fields: 2, z: "x", a: true } }));
    await audit(view(a, { reason: "  phone call  " }));

    const rows = await chain(a);
    expect(rows.map((r) => r.seq)).toEqual([1, 2, 3]);
    expect(rows[0].prevHash).toBeNull();
    expect(rows[1].prevHash).toBe(rows[0].hash);
    expect(rows[2].prevHash).toBe(rows[1].hash);
    expect(rows[2].reason).toBe("phone call");
    for (const r of rows) expect(r.hash).toBe(auditRowHash(r.prevHash, r));
    expect((await chain(b)).map((r) => r.seq)).toEqual([1]);

    expect(await verifyAuditChain(a)).toEqual({ ok: true });
    expect(await verifyAuditChain(b)).toEqual({ ok: true });
    expect(await verifyAuditChain(newId())).toEqual({ ok: true });
  });

  it("keeps a separate platform chain for orgId null", async () => {
    const before = await db.select().from(auditLog).where(eq(auditLog.actorId, "admin-1"));
    await audit({ orgId: null, actor: { type: "platform_admin", id: "admin-1" }, action: "platform.access" });
    await audit({ orgId: null, actor: { type: "platform_admin", id: "admin-1" }, action: "platform.access" });
    const rows = await db.select().from(auditLog).where(eq(auditLog.actorId, "admin-1")).orderBy(asc(auditLog.seq));
    expect(rows).toHaveLength(before.length + 2);
    expect(rows.at(-1)!.seq).toBe(rows.at(-2)!.seq + 1);
    expect(await verifyAuditChain(null)).toEqual({ ok: true });
  });

  it("stores only HMACs of the client IP and user agent", async () => {
    const org = newId();
    const headers = new Headers({ "x-real-ip": "203.0.113.5", "user-agent": "Mozilla/5.0 Test" });
    await audit(view(org, { headers, metadata: { count: 1 } }));
    const [row] = await chain(org);
    expect(row.ipHash).toBe(hmac("203.0.113.5", "ip"));
    expect(row.uaHash).toBe(hmac("Mozilla/5.0 Test", "ua"));
    expect(JSON.stringify(row)).not.toMatch(/203\.0\.113|Mozilla/);
    await audit(view(org));
    expect((await chain(org))[1]).toMatchObject({ ipHash: null, uaHash: null });
  });

  it("auditStaff records the staff member in their active practice", async () => {
    const org = newId();
    await auditStaff({ user: { id: "u-9" }, org: { id: org } }, "patient.view", {
      type: "patient",
      id: "p-9",
    });
    const [row] = await chain(org);
    expect(row).toMatchObject({ actorType: "user", actorId: "u-9", action: "patient.view", entityType: "patient", entityId: "p-9", seq: 1 });
  });
});

describe("tamper detection", () => {
  async function seeded(n = 4) {
    const org = newId();
    for (let i = 0; i < n; i++) await audit(view(org, { metadata: { i } }));
    return { org, rows: await chain(org) };
  }

  it("reports an edited row", async () => {
    const { org, rows } = await seeded();
    await db.update(auditLog).set({ entityId: "someone-else" }).where(eq(auditLog.id, rows[1].id));
    expect(await verifyAuditChain(org)).toEqual({ ok: false, brokenAtId: rows[1].id, reason: "hash" });
  });

  it("reports the next row when an edited row's hash was recomputed", async () => {
    const { org, rows } = await seeded();
    const edited = { ...rows[1], action: "patient.search" };
    await db.update(auditLog).set({ action: edited.action, hash: auditRowHash(edited.prevHash, edited) }).where(eq(auditLog.id, rows[1].id));
    expect(await verifyAuditChain(org)).toEqual({ ok: false, brokenAtId: rows[2].id, reason: "link" });
  });

  it("reports a deleted row", async () => {
    const { org, rows } = await seeded();
    await db.delete(auditLog).where(eq(auditLog.id, rows[1].id));
    expect(await verifyAuditChain(org)).toEqual({ ok: false, brokenAtId: rows[2].id, reason: "link" });
  });

  it("reports a deleted first row", async () => {
    const { org, rows } = await seeded();
    await db.delete(auditLog).where(eq(auditLog.id, rows[0].id));
    expect(await verifyAuditChain(org)).toEqual({ ok: false, brokenAtId: rows[1].id, reason: "link" });
  });

  it("is keyed: without HMAC_SECRET an edited chain can't be made to verify again", async () => {
    const { org, rows } = await seeded();
    // The attacker edits row 2 and rehashes it and every later row, as an unkeyed chain would allow.
    let prev = rows[0].hash;
    for (const r of rows.slice(1)) {
      const edited = { ...r, actorId: r.id === rows[1].id ? "someone-else" : r.actorId, prevHash: prev };
      const { id, orgId, seq, at, actorType, actorId, action, entityType, entityId, reason, ipHash, uaHash, metadata } = edited;
      const canonical = JSON.stringify(["v1", id, orgId, seq, at.getTime(), actorType, actorId, action, entityType, entityId, reason, ipHash, uaHash,
        metadata ? Object.keys(metadata).sort().map((k) => [k, metadata[k]]) : null]);
      const hash = sha256Hex(prev + canonical);
      await db.update(auditLog).set({ actorId: edited.actorId, prevHash: prev, hash }).where(eq(auditLog.id, r.id));
      prev = hash;
    }
    expect(await verifyAuditChain(org)).toEqual({ ok: false, brokenAtId: rows[1].id, reason: "hash" });
  });

  it("detects deleted newest rows against a recorded head", async () => {
    const { org, rows } = await seeded();
    const head = await auditChainHead(org);
    expect(head).toEqual({ seq: 4, hash: rows[3].hash });
    await db.delete(auditLog).where(eq(auditLog.id, rows[3].id));
    // The chain alone can't tell (nothing after the gap)...
    expect(await verifyAuditChain(org)).toEqual({ ok: true });
    // ...the head recorded outside the database can.
    expect(await verifyAuditChain(org, { head })).toEqual({ ok: false, brokenAtId: null, reason: "head" });
    expect(await verifyAuditChain(org, { head: { seq: 3, hash: rows[2].hash } })).toEqual({ ok: true });
    expect(await verifyAuditChain(org, { head: { seq: 3, hash: "f".repeat(64) } })).toEqual({ ok: false, brokenAtId: rows[2].id, reason: "head" });
  });

  it("verifies from a date, trusting the first row's link", async () => {
    const { org, rows } = await seeded();
    await db.update(auditLog).set({ entityId: "x" }).where(eq(auditLog.id, rows[0].id));
    expect(await verifyAuditChain(org)).toEqual({ ok: false, brokenAtId: rows[0].id, reason: "hash" });
    expect(await verifyAuditChain(org, { from: rows[1].at })).toEqual({ ok: true });
    expect(await verifyAuditChain(org, { from: new Date(Date.now() + 3_600_000) })).toEqual({ ok: true });
  });

  it("refuses a second row at the same position", async () => {
    const { rows } = await seeded(2);
    await expect(db.insert(auditLog).values({ ...rows[1], id: newId() })).rejects.toMatchObject({
      cause: expect.objectContaining({ message: expect.stringContaining("UNIQUE constraint failed: audit_log.org_id, audit_log.seq") }),
    });
  });
});

describe("concurrency", () => {
  it("concurrent audit() calls, with and without a transaction, don't fork the chain", async () => {
    const org = newId();
    const calls: Promise<unknown>[] = [];
    for (let i = 0; i < 20; i++) {
      calls.push(audit(view(org, { metadata: { i } })));
      if (i % 5 === 0) {
        calls.push(
          db.transaction(async (tx) => {
            await audit(view(org, { action: "appointment.create", metadata: { i } }), tx);
            await audit(view(org, { action: "appointment.update", metadata: { i } }), tx);
          }),
        );
      }
    }
    await Promise.all(calls);
    const rows = await chain(org);
    expect(rows.map((r) => r.seq)).toEqual(Array.from({ length: 28 }, (_, i) => i + 1));
    expect(await verifyAuditChain(org)).toEqual({ ok: true });
  });

  it("retries when another writer took the chain head", async () => {
    const org = newId();
    const lost = new Error("Failed query: insert into audit_log", {
      cause: Object.assign(new Error("SQLITE_CONSTRAINT_UNIQUE: UNIQUE constraint failed: audit_log.org_id, audit_log.seq"), {
        code: "SQLITE_CONSTRAINT_UNIQUE",
      }),
    });
    const spy = vi.spyOn(db, "transaction").mockRejectedValueOnce(lost);
    const before = getAuditFailureCount();
    await audit(view(org));
    expect(spy).toHaveBeenCalledTimes(2);
    expect(getAuditFailureCount()).toBe(before);
    expect((await chain(org)).map((r) => r.seq)).toEqual([1]);
  });

  it("an audited transaction that rolls back leaves no row and no gap", async () => {
    const org = newId();
    await audit(view(org));
    await expect(
      db.transaction(async (tx) => {
        await audit(view(org), tx);
        throw new Error("rollback");
      }),
    ).rejects.toThrow("rollback");
    await audit(view(org));
    expect((await chain(org)).map((r) => r.seq)).toEqual([1, 2]);
    expect(await verifyAuditChain(org)).toEqual({ ok: true });
  });
});

describe("failures", () => {
  it("never throws: counts and logs the failure without personal data", async () => {
    const writes: string[] = [];
    vi.spyOn(process.stderr, "write").mockImplementation((chunk: string | Uint8Array) => {
      writes.push(String(chunk));
      return true;
    });
    const broken = {
      select: () => {
        throw new Error("connection lost");
      },
    } as unknown as Tx;
    const before = getAuditFailureCount();
    await expect(audit(view("org-x", { reason: "+393331234567" }), broken)).resolves.toBeUndefined();
    expect(getAuditFailureCount()).toBe(before + 1);
    expect(writes.join("")).toContain("[audit] Error: connection lost action=patient.view orgId=org-x");
    expect(writes.join("")).not.toContain("3331234567");
  });
});

describe("retention", () => {
  it("prunes old rows behind an anchor and the chain stays verifiable", async () => {
    const org = newId();
    const day = (d: number) => new Date(Date.UTC(2030, 0, d));
    for (let d = 1; d <= 5; d++) await audit(view(org, { at: day(d) }));
    const rows = await chain(org);

    expect(await pruneAuditLog(org, day(4))).toEqual({ deleted: 3 });
    expect((await chain(org)).map((r) => r.seq)).toEqual([4, 5]);
    const [anchor] = await db.select().from(auditAnchors).where(eq(auditAnchors.orgKey, org));
    expect(anchor).toMatchObject({ seq: 3, hash: rows[2].hash });
    expect(await verifyAuditChain(org)).toEqual({ ok: true });

    // Nothing older left: a second run is a no-op.
    expect(await pruneAuditLog(org, day(4))).toEqual({ deleted: 0 });

    // Everything purged: the next row continues from the anchor.
    expect(await pruneAuditLog(org, day(10))).toEqual({ deleted: 2 });
    await audit(view(org, { at: day(11) }));
    const [next] = await chain(org);
    expect(next).toMatchObject({ seq: 6, prevHash: rows[4].hash });
    expect(await verifyAuditChain(org)).toEqual({ ok: true });

    // A head recorded before pruning still verifies once its row has gone behind the anchor.
    expect(await verifyAuditChain(org, { head: { seq: 5, hash: rows[4].hash } })).toEqual({ ok: true });
    expect(await verifyAuditChain(org, { head: { seq: 5, hash: "0".repeat(64) } })).toEqual({ ok: false, brokenAtId: null, reason: "head" });

    // Tampering with the anchor shows up on the first remaining row.
    await db.update(auditAnchors).set({ hash: "0".repeat(64) }).where(eq(auditAnchors.orgKey, org));
    expect(await verifyAuditChain(org)).toEqual({ ok: false, brokenAtId: next.id, reason: "link" });
  });

  it("reports an anchor newer than retention allows (a deleted prefix passed off as retention)", async () => {
    const org = newId();
    const day = (d: number) => new Date(Date.UTC(2030, 0, d));
    for (let d = 1; d <= 5; d++) await audit(view(org, { at: day(d) }));
    expect(await pruneAuditLog(org, day(3))).toEqual({ deleted: 2 });
    // Retention keeps rows from day 3 on: the anchor (day 2) is older, as it should be.
    expect(await verifyAuditChain(org, { keptSince: day(3) })).toEqual({ ok: true });
    // Someone deletes days 3-4 too and moves the anchor: the chain itself still links up...
    expect(await pruneAuditLog(org, day(5))).toEqual({ deleted: 2 });
    expect(await verifyAuditChain(org)).toEqual({ ok: true });
    // ...but rows that retention had to keep are gone.
    expect(await verifyAuditChain(org, { keptSince: day(3) })).toEqual({ ok: false, brokenAtId: null, reason: "anchor" });
  });

  it("stops at the first row newer than the cutoff", async () => {
    const org = newId();
    const day = (d: number) => new Date(Date.UTC(2030, 0, d));
    // A clock step back: row 3 is older than row 2.
    for (const d of [1, 5, 2, 6]) await audit(view(org, { at: day(d) }));
    expect(await pruneAuditLog(org, day(4))).toEqual({ deleted: 1 });
    expect((await chain(org)).map((r) => r.seq)).toEqual([2, 3, 4]);
    expect(await verifyAuditChain(org)).toEqual({ ok: true });
  });
});
