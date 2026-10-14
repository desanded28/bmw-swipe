import { and, eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { auditLog, legalAcceptances, memberships, messages, organizations, users } from "@/db/schema";
import { addDays, todayIn, zonedToUtc } from "@/lib/time";
import { createPractice, TZ } from "@/test/fixtures";
import { newId } from "../ids";
import {
  bookingBlocks,
  canAcceptOnlineBookings,
  complianceBannerState,
  enforceDashboardGates,
  gatePage,
  gateRedirect,
  notifySubprocessorChanges,
  pendingLegal,
  type PendingLegal,
} from "./gates";
import { recordLegalAcceptance } from "./legal";
import { requestClosure } from "./org-closure";
import { LEGAL_VERSIONS } from "./versions";

// enforceDashboardGates reads the proxy's x-pathname and redirects like Next does.
const nav = vi.hoisted(() => ({ path: "/dashboard" }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-pathname": nav.path }), cookies: async () => new Map() }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw Object.assign(new Error(`NEXT_REDIRECT ${to}`), { digest: `NEXT_REDIRECT;${to}`, to });
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

const { POST: postAppointment } = await import("@/app/api/v1/clinics/[slug]/appointments/route");

const ACCEPTED: PendingLegal = { org: [], staffInstructions: false, subprocessors: false };

describe("gateRedirect", () => {
  it("sends owners and admins to the legal page until the DPA and terms are accepted", () => {
    const pending = { ...ACCEPTED, org: ["dpa" as const] };
    expect(gateRedirect("/dashboard", "owner", pending)).toBe("/dashboard/legal");
    expect(gateRedirect("/dashboard/calendar", "admin", pending)).toBe("/dashboard/legal");
    // Other staff see a banner instead.
    expect(gateRedirect("/dashboard", "reception", pending)).toBeNull();
    expect(gateRedirect("/dashboard", "practitioner", pending)).toBeNull();
  });

  it("never redirects from the legal page itself (no loop) or the closure and account pages", () => {
    const pending = { ...ACCEPTED, org: ["dpa" as const, "terms" as const], staffInstructions: true };
    expect(gateRedirect("/dashboard/legal", "owner", pending)).toBeNull();
    expect(gateRedirect("/dashboard/legal?doc=staff_instructions", "reception", pending)).toBeNull();
    expect(gateRedirect("/dashboard/settings/closure", "owner", pending)).toBeNull();
    expect(gateRedirect("/dashboard/account/security", "owner", pending)).toBeNull();
    expect(gateRedirect("/dashboard/legalese", "owner", pending)).toBe("/dashboard/legal");
  });

  it("sends members without the current staff instructions to accept them", () => {
    expect(gateRedirect("/dashboard", "reception", { ...ACCEPTED, staffInstructions: true })).toBe("/dashboard/legal?doc=staff_instructions");
    expect(gateRedirect("/dashboard", "owner", ACCEPTED)).toBeNull();
  });
});

let phoneSeq = 3489000000;
function upcomingMonday(): string {
  const today = todayIn(TZ);
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  return addDays(today, 7 + ((8 - weekday) % 7));
}
let slot = 0;

async function book(orgSlug: string, p: Awaited<ReturnType<typeof createPractice>>) {
  const start = zonedToUtc(upcomingMonday(), 9 * 60 + 30 * slot++, TZ).toISOString();
  const req = new Request(`https://sorriso.test/api/v1/clinics/${orgSlug}/appointments`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": `198.51.100.${slot}` },
    body: JSON.stringify({
      serviceId: p.visit,
      practitionerId: p.drA,
      locationId: p.milano,
      start,
      patient: { firstName: "Sara", lastName: "Conti", phone: `+39${phoneSeq++}`, locale: "it" },
      privacy: { noticeVersion: "2026-10", noticeAck: true, locale: "it", platformConsent: true },
    }),
  });
  const res = await postAppointment(req, { params: Promise.resolve({ slug: orgSlug }) });
  return { status: res.status, json: await res.json() };
}

describe("a new practice", () => {
  let p: Awaited<ReturnType<typeof createPractice>>;
  let slug: string;
  let ownerId: string;
  let receptionId: string;

  beforeAll(async () => {
    p = await createPractice();
    [{ slug }] = await db.select({ slug: organizations.slug }).from(organizations).where(eq(organizations.id, p.orgId));
    ownerId = newId();
    receptionId = newId();
    await db.insert(users).values([
      { id: ownerId, email: `owner-${ownerId}@example.org`, name: "Owner", passwordHash: "x" },
      { id: receptionId, email: `rec-${receptionId}@example.org`, name: "Reception", passwordHash: "x" },
    ]);
    await db.insert(memberships).values([
      { userId: ownerId, orgId: p.orgId, role: "owner" },
      { userId: receptionId, orgId: p.orgId, role: "reception" },
    ]);
    await db.update(organizations).set({ emailVerifiedAt: new Date() }).where(eq(organizations.id, p.orgId));
  });
  beforeEach(() => {
    nav.path = "/dashboard";
  });

  it("can't take online bookings (403 not_accepting) and its owner is sent to /dashboard/legal", async () => {
    expect(await canAcceptOnlineBookings({ id: p.orgId })).toBe(false);
    expect(await bookingBlocks(p.orgId)).toEqual(["dpa"]);
    const res = await book(slug, p);
    expect(res.status).toBe(403);
    expect(res.json.error.code).toBe("not_accepting");

    const owner = { user: { id: ownerId }, org: { id: p.orgId }, role: "owner" as const };
    await expect(enforceDashboardGates(owner)).rejects.toMatchObject({ to: "/dashboard/legal" });
    nav.path = "/dashboard/legal";
    await expect(enforceDashboardGates(owner)).resolves.toBeUndefined();

    const reception = { user: { id: receptionId }, org: { id: p.orgId, name: "Studio" }, role: "reception" as const };
    nav.path = "/dashboard/calendar";
    await expect(enforceDashboardGates(reception)).rejects.toMatchObject({ to: "/dashboard/legal?doc=staff_instructions" });
    expect(await complianceBannerState(reception)).toEqual({ kind: "awaiting_owner" });

    // Page loaders gate too: a client-side navigation from the legal page to another page
    // re-renders only the page, not the dashboard layout.
    nav.path = "/dashboard/patients";
    await expect(gatePage({ ...owner, org: { id: p.orgId, name: "Studio" } })).rejects.toMatchObject({ to: "/dashboard/legal" });
    await expect(gatePage(reception)).rejects.toMatchObject({ to: "/dashboard/legal?doc=staff_instructions" });
  });

  it("takes bookings once the owner accepted, with the version, locale and ipHash recorded", async () => {
    const headers = new Headers({ "x-real-ip": "203.0.113.7", "user-agent": "vitest" });
    for (const doc of ["dpa", "terms", "subprocessors", "staff_instructions"] as const) {
      await db.transaction((tx) => recordLegalAcceptance(tx, { orgId: p.orgId, userId: ownerId, doc, locale: "it", headers }));
    }
    const [row] = await db
      .select()
      .from(legalAcceptances)
      .where(and(eq(legalAcceptances.orgId, p.orgId), eq(legalAcceptances.documentType, "dpa")));
    expect(row).toMatchObject({ version: LEGAL_VERSIONS.dpa, locale: "it", userId: ownerId });
    expect(row.ipHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.ipHash).not.toContain("203.0.113.7");

    expect(await canAcceptOnlineBookings({ id: p.orgId })).toBe(true);
    const res = await book(slug, p);
    expect(res.status).toBe(201);

    const owner = { user: { id: ownerId }, org: { id: p.orgId }, role: "owner" as const };
    await expect(enforceDashboardGates(owner)).resolves.toBeUndefined();
    // The receptionist still has their own instructions to accept.
    const reception = { user: { id: receptionId }, org: { id: p.orgId }, role: "reception" as const };
    expect(await pendingLegal(reception)).toMatchObject({ org: [], staffInstructions: true });
    await db.transaction((tx) => recordLegalAcceptance(tx, { orgId: p.orgId, userId: receptionId, doc: "staff_instructions", locale: "it" }));
    await expect(enforceDashboardGates(reception)).resolves.toBeUndefined();
    // Gated pages then render, with the banner (if any) to show.
    nav.path = "/dashboard/patients";
    await expect(gatePage({ ...reception, org: { id: p.orgId, name: "Studio" } })).resolves.toBeNull();
  });

  it("stops online bookings once closure is requested", async () => {
    await requestClosure(p.orgId, { actor: { type: "user", id: ownerId } });
    expect(await bookingBlocks(p.orgId)).toEqual(["closing"]);
    expect(await canAcceptOnlineBookings({ id: p.orgId })).toBe(false);
    const [org] = await db.select().from(organizations).where(eq(organizations.id, p.orgId));
    expect(org.listed).toBe(false);
    expect(org.purgeAfter!.getTime() - org.closureRequestedAt!.getTime()).toBe(60 * 86_400_000);
  });
});

describe("email verification", () => {
  it("is required for practices created after the rollout; older ones get a grace period", async () => {
    const p = await createPractice();
    const [u] = await db.insert(users).values({ id: newId(), email: `x-${newId()}@example.org`, name: "O", passwordHash: "x" }).returning();
    await db.transaction((tx) => recordLegalAcceptance(tx, { orgId: p.orgId, userId: u.id, doc: "dpa", locale: "it" }));
    await db.update(organizations).set({ createdAt: new Date("2026-11-01T00:00:00Z") }).where(eq(organizations.id, p.orgId));
    expect(await bookingBlocks(p.orgId, new Date("2026-11-02T00:00:00Z"))).toEqual(["email"]);
    await db.update(organizations).set({ createdAt: new Date("2026-09-01T00:00:00Z") }).where(eq(organizations.id, p.orgId));
    expect(await bookingBlocks(p.orgId, new Date("2026-12-01T00:00:00Z"))).toEqual([]);
    expect(await bookingBlocks(p.orgId, new Date("2027-02-15T00:00:00Z"))).toEqual(["email"]);
  });
});

describe("sub-processor changes", () => {
  it("emails the owners of practices that accepted an older list, once per version", async () => {
    const p = await createPractice();
    const ownerId = newId();
    await db.insert(users).values({ id: ownerId, email: `sp-${ownerId}@example.org`, name: "Owner", passwordHash: "x" });
    await db.insert(memberships).values({ userId: ownerId, orgId: p.orgId, role: "owner" });
    await db.transaction((tx) => recordLegalAcceptance(tx, { orgId: p.orgId, userId: ownerId, doc: "subprocessors", locale: "it", version: "2025-01" }));
    const mails = async () => (await db.select().from(messages).where(eq(messages.to, `sp-${ownerId}@example.org`))).length;

    await notifySubprocessorChanges();
    expect(await mails()).toBe(1);
    await notifySubprocessorChanges();
    expect(await mails()).toBe(1);
    const [notice] = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.orgId, p.orgId), eq(auditLog.action, "settings.update")));
    expect(notice.metadata).toMatchObject({ event: "subprocessors.notified", version: LEGAL_VERSIONS.subprocessors });

    for (const doc of ["dpa", "terms"] as const) {
      await db.transaction((tx) => recordLegalAcceptance(tx, { orgId: p.orgId, userId: ownerId, doc, locale: "it" }));
    }
    const banner = await complianceBannerState({ user: { id: ownerId }, org: { id: p.orgId, name: "Studio Test" }, role: "owner" });
    expect(banner).toMatchObject({ kind: "subprocessors", version: LEGAL_VERSIONS.subprocessors });
    expect(banner && "objectMailto" in banner && banner.objectMailto).toMatch(/^mailto:/);
  });
});
