/**
 * The practice's review actions: exactly two (reply and report), neither of which can publish,
 * remove or otherwise set a review's status; foreign ids answer not_found.
 */
import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import type { MembershipRole } from "@/db/enums";
import { appointments, auditLog, organizations, patients, reviews, users } from "@/db/schema";
import type { StaffSession } from "@/lib/auth";
import { newId } from "@/lib/ids";
import { createPractice, NOW } from "@/test/fixtures";

const state = vi.hoisted(() => ({ session: null as StaffSession | null }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers(), cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth")>()),
  requireStaff: async () => {
    if (!state.session) throw new Error("no session in test");
    return state.session;
  },
}));

const actions = await import("./reviews");

let p: Awaited<ReturnType<typeof createPractice>>;

async function signIn(role: MembershipRole, orgId = p.orgId) {
  const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
  state.session = { sessionId: "s1", user: { id: `user-${role}`, name: "Test", email: "t@example.com", isPlatformAdmin: false, locale: "en" }, org, role, orgs: [{ org, role }] } as unknown as StaffSession;
}

async function review(status: "published" | "under_review" = "published") {
  const patientId = newId();
  const appointmentId = newId();
  await db.insert(patients).values({ id: patientId, orgId: p.orgId, firstName: "Ada", lastName: "Neri" });
  await db.insert(appointments).values({
    id: appointmentId,
    orgId: p.orgId,
    locationId: p.milano,
    practitionerId: p.drA,
    serviceId: p.visit,
    patientId,
    startsAt: NOW,
    endsAt: NOW,
    blockedUntil: NOW,
    status: "completed",
    source: "online",
    manageToken: `h:${appointmentId}`,
  });
  const id = newId();
  await db.insert(reviews).values({ id, orgId: p.orgId, practitionerId: p.drA, appointmentId, rating: 2, comment: "Slow.", authorName: "Verified patient", status, publishedAt: NOW });
  return id;
}

const statusOf = async (id: string) => (await db.select({ s: reviews.status }).from(reviews).where(eq(reviews.id, id)))[0].s;

beforeAll(async () => {
  p = await createPractice();
  for (const role of ["owner", "reception"]) {
    await db.insert(users).values({ id: `user-${role}`, email: `${role}@example.com`, name: role, passwordHash: "x" }).onConflictDoNothing();
  }
});

describe("dashboard review actions", () => {
  it("export only replyToReview and reportReview", () => {
    expect(Object.keys(actions).sort()).toEqual(["replyToReview", "reportReview"]);
  });

  it("replying never changes a review's status", async () => {
    await signIn("owner");
    const id = await review();
    expect(await actions.replyToReview(id, "Thank you for the feedback.", true)).toMatchObject({ ok: true });
    expect(await statusOf(id)).toBe("published");
    expect(await actions.replyToReview(id, "Without confirming")).toMatchObject({ ok: false, code: "confirm_required" });
  });

  it("a report hides the review for moderation, and nothing a practice does can publish or remove it", async () => {
    await signIn("owner");
    const held = await review("under_review");
    expect(await actions.replyToReview(held, "Publish this", true)).toMatchObject({ ok: false });
    expect(await actions.reportReview(held, "defamation", "It's false and we want it gone.")).toMatchObject({ ok: false });
    expect(await statusOf(held)).toBe("under_review");

    const id = await review();
    expect(await actions.reportReview(id, "defamation", "The facts described never happened.")).toMatchObject({ ok: true });
    expect(await statusOf(id)).toBe("under_review");
    const [audited] = await db.select().from(auditLog).where(and(eq(auditLog.entityId, id), eq(auditLog.action, "review.report")));
    expect(audited).toMatchObject({ orgId: p.orgId, actorType: "user" });
    expect(await actions.reportReview(id, "made-up-ground", "x")).toMatchObject({ ok: false });
  });

  it("is reserved to managers and answers not_found on another practice's review", async () => {
    const id = await review();
    await signIn("reception");
    expect(await actions.replyToReview(id, "Hi", true)).toMatchObject({ ok: false, code: "forbidden" });
    expect(await actions.reportReview(id, "other", "Wrong practice")).toMatchObject({ ok: false, code: "forbidden" });
    const other = await createPractice();
    await signIn("owner", other.orgId);
    expect(await actions.replyToReview(id, "Hijack", true)).toMatchObject({ ok: false, code: "not_found" });
    expect(await actions.reportReview(id, "other", "Hijack attempt")).toMatchObject({ ok: false, code: "not_found" });
    expect(await statusOf(id)).toBe("published");
  });
});
