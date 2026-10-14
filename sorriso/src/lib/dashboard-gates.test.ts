import { and, eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { memberships, organizations, users, type MembershipRole } from "@/db/schema";
import { newId } from "@/lib/ids";
import { createPractice } from "@/test/fixtures";

/**
 * The compliance gates (src/lib/privacy/gates.ts) run on every dashboard page and route handler
 * through requireStaff(), and so requirePermission() and requirePlatformAdmin(): Next keeps the
 * shared layout across client-side navigations, so the layout's own check is not enough.
 * Exempt pages stay reachable, and server actions are never redirected.
 */

const req = vi.hoisted(() => {
  const store = new Map<string, string>();
  return {
    store,
    headers: new Headers(),
    jar: {
      get: (name: string) => (store.has(name) ? { name, value: store.get(name)! } : undefined),
      set: (name: string, value: string) => void store.set(name, value),
      delete: (name: string) => void store.delete(name),
    },
  };
});
vi.mock("next/headers", () => ({ cookies: async () => req.jar, headers: async () => req.headers }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const auth = await import("./auth");
const { requirePermission } = await import("./permissions");
const { recordLegalAcceptance } = await import("./privacy/legal");
const { LEGAL_VERSIONS } = await import("./privacy/versions");

let orgId: string;

/** The target of a Next.js redirect(), or null when the call went through. */
async function redirectOf(p: Promise<unknown>): Promise<string | null> {
  try {
    await p;
    return null;
  } catch (err) {
    const digest = String((err as { digest?: string }).digest ?? "");
    if (digest.startsWith("NEXT_REDIRECT")) return digest.split(";")[2];
    throw err;
  }
}

async function signIn(role: MembershipRole) {
  const id = newId();
  // Two-step sign-in set up and passed, so the MFA rule stays out of the way.
  await db.insert(users).values({ id, email: `gate-${id.toLowerCase()}@example.com`, name: "Gate Test", passwordHash: "x", totpEnabledAt: new Date() });
  await db.insert(memberships).values({ userId: id, orgId, role });
  req.store.clear();
  await auth.createSession(id, orgId, { mfaVerifiedAt: new Date() });
  return id;
}

const at = (path: string, extra: Record<string, string> = {}) => {
  req.headers = new Headers({ "x-pathname": path, ...extra });
};

async function acceptInstructions(userId: string) {
  await db
    .update(memberships)
    .set({ instructionsVersion: LEGAL_VERSIONS.staff_instructions, instructionsAcceptedAt: new Date() })
    .where(and(eq(memberships.userId, userId), eq(memberships.orgId, orgId)));
}

beforeAll(async () => {
  ({ orgId } = await createPractice());
  const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
  await db
    .update(organizations)
    .set({ settings: { ...org.settings, privacy: { ...org.settings.privacy, requireMfa: false } } })
    .where(eq(organizations.id, orgId));
});

beforeEach(() => {
  req.headers = new Headers();
});

describe("dashboard gates on every page, not only the layout", () => {
  it("sends a member without the staff instructions to them from any page, through requireStaff and requirePermission", async () => {
    await signIn("reception");
    for (const path of ["/dashboard", "/dashboard/calendar", "/dashboard/patients/abc"]) {
      at(path);
      expect(await redirectOf(auth.requireStaff()), path).toBe("/dashboard/legal?doc=staff_instructions");
      expect(await redirectOf(requirePermission("calendar.read")), path).toBe("/dashboard/legal?doc=staff_instructions");
    }
  });

  it("keeps the exempt pages reachable", async () => {
    await signIn("reception");
    for (const path of ["/dashboard/legal", "/dashboard/account/security", "/dashboard/settings/closure", "/dashboard/settings/export"]) {
      at(path);
      expect(await redirectOf(auth.requireStaff()), path).toBeNull();
    }
  });

  it("never redirects a server action (sign-out and accepting must keep working)", async () => {
    await signIn("reception");
    at("/dashboard/calendar", { "next-action": "abc123" });
    await expect(auth.requireStaff()).resolves.toMatchObject({ role: "reception" });
  });

  it("does nothing outside the dashboard or without the proxy's path", async () => {
    await signIn("reception");
    at("/it/privacy");
    expect(await redirectOf(auth.requireStaff())).toBeNull();
    req.headers = new Headers();
    expect(await redirectOf(auth.requireStaff())).toBeNull();
  });

  it("lets the member through once the instructions are accepted", async () => {
    const id = await signIn("practitioner");
    at("/dashboard/calendar");
    expect(await redirectOf(requirePermission("calendar.read"))).toBe("/dashboard/legal?doc=staff_instructions");
    await acceptInstructions(id);
    await expect(requirePermission("calendar.read")).resolves.toMatchObject({ role: "practitioner" });
  });

  it("sends owners and admins to the DPA and terms until the practice accepts them", async () => {
    const id = await signIn("admin");
    await acceptInstructions(id);
    at("/dashboard/analytics");
    expect(await redirectOf(requirePermission("analytics.read"))).toBe("/dashboard/legal");
    for (const doc of ["dpa", "terms"] as const) {
      await db.transaction((tx) => recordLegalAcceptance(tx, { orgId, userId: id, doc, locale: "en" }));
    }
    await expect(requirePermission("analytics.read")).resolves.toMatchObject({ role: "admin" });
  });
});
