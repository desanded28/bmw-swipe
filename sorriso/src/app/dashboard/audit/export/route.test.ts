import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { auditLog, organizations, users } from "@/db/schema";
import type { StaffSession } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { newId } from "@/lib/ids";
import { createPractice } from "@/test/fixtures";

const state = vi.hoisted(() => ({ session: null as StaffSession | null }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-real-ip": "203.0.113.9" }), cookies: async () => new Map() }));
vi.mock("@/lib/auth", async (orig) => ({
  ...(await orig<typeof import("@/lib/auth")>()),
  requireStaff: async () => {
    if (!state.session) throw new Error("no session in test");
    return state.session;
  },
}));

const { GET } = await import("./route");
const { default: PrivacyRequestsPage } = await import("@/app/dashboard/privacy/page");

let orgId: string;

beforeAll(async () => {
  ({ orgId } = await createPractice());
  const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
  const userId = newId();
  await db.insert(users).values({ id: userId, email: `owner-${userId}@example.org`, name: "Owner", passwordHash: "x" });
  state.session = { sessionId: "s1", user: { id: userId, name: "Owner", email: "x@example.org", isPlatformAdmin: false, locale: "en" }, org, role: "owner", orgs: [{ org, role: "owner" }] };
});

describe("reading the access log and the requests inbox is itself audited (F9.4)", () => {
  it("logs the CSV export of the access log, with the row count", async () => {
    await audit({ orgId, actor: { type: "user", id: state.session!.user.id }, action: "patient.restricted_access", reason: "Il paziente ha chiesto una copia" });
    const res = await GET(new Request("https://sorriso.test/dashboard/audit/export"));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("Il paziente ha chiesto una copia");
    const [row] = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.orgId, orgId), eq(auditLog.action, "export.org")));
    expect(row).toMatchObject({ actorId: state.session!.user.id, entityType: "org" });
    expect(row.metadata).toMatchObject({ scope: "audit_log", rows: 1 });
  });

  it("logs each look at the privacy requests inbox, with counts only", async () => {
    await PrivacyRequestsPage({ searchParams: Promise.resolve({ status: "all" }) });
    const [row] = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.orgId, orgId), eq(auditLog.action, "patient.search")));
    expect(row.metadata).toMatchObject({ inbox: true, results: 0 });
  });
});
