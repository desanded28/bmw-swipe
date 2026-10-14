/**
 * Platform-admin Albo checks (WP7): verifying and revoking a practitioner's registration sets or
 * clears the verification and is audited as practitioner.albo.verify on the practice's chain, with
 * the platform admin as actor. A registration without province and number can't be verified.
 */
import { and, asc, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { auditLog, practitioners, users } from "@/db/schema";
import type { StaffSession } from "@/lib/auth";
import { createPractice } from "@/test/fixtures";

const ADMIN = "user-platform-admin";
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers(), cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth")>()),
  requirePlatformAdmin: async () => ({ user: { id: "user-platform-admin", isPlatformAdmin: true, locale: "en" } }) as unknown as StaffSession,
}));

const { revokeAlbo, verifyAlbo } = await import("./platform");

let p: Awaited<ReturnType<typeof createPractice>>;
const row = async () => (await db.select().from(practitioners).where(eq(practitioners.id, p.drA)))[0];
const audits = async () =>
  db
    .select({ actorType: auditLog.actorType, actorId: auditLog.actorId, action: auditLog.action, metadata: auditLog.metadata })
    .from(auditLog)
    .where(and(eq(auditLog.orgId, p.orgId), eq(auditLog.entityId, p.drA)))
    .orderBy(asc(auditLog.seq));

beforeAll(async () => {
  p = await createPractice();
  await db.insert(users).values({ id: ADMIN, email: `${ADMIN}@example.com`, name: "Admin", passwordHash: "x", isPlatformAdmin: true });
});

describe("Albo verification", () => {
  it("refuses a registration without province and number, and records nothing", async () => {
    await db.update(practitioners).set({ alboProvince: null, alboNumber: null }).where(eq(practitioners.id, p.drA));
    expect(await verifyAlbo(p.drA)).toMatchObject({ ok: false, code: "invalid" });
    expect((await row()).alboVerifiedAt).toBeNull();
    expect(await audits()).toEqual([]);
  });

  it("verifies and revokes, each audited as practitioner.albo.verify by the platform admin", async () => {
    await db.update(practitioners).set({ alboProvince: "Milano", alboNumber: "1234" }).where(eq(practitioners.id, p.drA));
    expect(await verifyAlbo(p.drA)).toMatchObject({ ok: true });
    expect(await row()).toMatchObject({ alboVerifiedByUserId: ADMIN });
    expect((await row()).alboVerifiedAt).toBeInstanceOf(Date);
    expect(await revokeAlbo(p.drA)).toMatchObject({ ok: true });
    expect(await row()).toMatchObject({ alboVerifiedAt: null, alboVerifiedByUserId: null });
    expect(await audits()).toEqual([
      { actorType: "platform_admin", actorId: ADMIN, action: "practitioner.albo.verify", metadata: { verified: true } },
      { actorType: "platform_admin", actorId: ADMIN, action: "practitioner.albo.verify", metadata: { verified: false } },
    ]);
  });

  it("answers not_found for an unknown practitioner", async () => {
    expect(await verifyAlbo("nope")).toMatchObject({ ok: false, code: "not_found" });
    expect(await revokeAlbo("nope")).toMatchObject({ ok: false, code: "not_found" });
  });
});
