/**
 * Public profiles: approval by the practitioner or the owner only, re-approval after someone else
 * edits what patients see, the practitioner's own opt-out (the owner can't undo it), the Albo
 * check reset on changes, and the health-advertising rules on bios.
 */
import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import type { MembershipRole } from "@/db/enums";
import { organizations, practitioners, services, users } from "@/db/schema";
import type { StaffSession } from "@/lib/auth";
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

const { approvePublicProfile, savePractitioner, setMarketplaceOptOut } = await import("./practitioners");
const { saveService } = await import("./services");

let p: Awaited<ReturnType<typeof createPractice>>;
const DOCTOR = "user-doctor";

async function signIn(userId: string, role: MembershipRole) {
  const [org] = await db.select().from(organizations).where(eq(organizations.id, p.orgId));
  state.session = { sessionId: "s", user: { id: userId, name: "T", email: "t@example.com", isPlatformAdmin: false, locale: "en" }, org, role, orgs: [{ org, role }] } as unknown as StaffSession;
}

const row = async () => (await db.select().from(practitioners).where(eq(practitioners.id, p.drA)))[0];

function form(fields: Record<string, string | string[]>) {
  const fd = new FormData();
  const base = { name: "Anna A", title: "Dr.", specialty: "Conservative dentistry", active: "on", publicProfile: "on", spokenLanguages: ["it", "en"], alboProvince: "Milano", alboNumber: "123" };
  for (const [k, v] of Object.entries({ ...base, ...fields })) for (const x of [v].flat()) fd.append(k, x);
  return fd;
}

beforeAll(async () => {
  p = await createPractice();
  for (const id of ["user-owner", "user-admin", DOCTOR]) await db.insert(users).values({ id, email: `${id}@example.com`, name: id, passwordHash: "x" });
  await db.update(practitioners).set({ userId: DOCTOR, publicProfile: true }).where(eq(practitioners.id, p.drA));
});

beforeEach(async () => {
  await db
    .update(practitioners)
    .set({ profileApprovedAt: null, marketplaceOptOutAt: null, bio: null, alboProvince: "Milano", alboNumber: "123", alboVerifiedAt: NOW })
    .where(eq(practitioners.id, p.drA));
});

describe("profile fields", () => {
  it("stores an empty 'areas of interest' as empty (pages show a translated default), never an English word", async () => {
    await signIn("user-owner", "owner");
    expect(await savePractitioner(p.drA, null, form({ specialty: "" }))).toMatchObject({ ok: true });
    expect((await row()).specialty).toBe("");
    await savePractitioner(p.drA, null, form({}));
    expect((await row()).specialty).toBe("Conservative dentistry");
  });
});

describe("public profile approval", () => {
  it("only the practitioner or the owner can approve", async () => {
    await signIn("user-admin", "admin");
    expect(await approvePublicProfile(p.drA)).toMatchObject({ ok: false, code: "forbidden" });
    expect((await row()).profileApprovedAt).toBeNull();
    await signIn(DOCTOR, "practitioner");
    expect(await approvePublicProfile(p.drA)).toMatchObject({ ok: true });
    expect(await row()).toMatchObject({ publicProfile: true, profileApprovedByUserId: DOCTOR });
    await signIn("user-owner", "owner");
    expect(await approvePublicProfile(p.drB)).toMatchObject({ ok: true });
  });

  it("an admin's edit of what patients see needs approval again; the Albo check is redone when the number changes", async () => {
    await signIn(DOCTOR, "practitioner");
    await approvePublicProfile(p.drA);
    await signIn("user-admin", "admin");
    expect(await savePractitioner(p.drA, null, form({ bio: "Conservative dentistry and prevention for families." }))).toMatchObject({ ok: true });
    expect((await row()).profileApprovedAt).toBeNull();
    expect((await row()).alboVerifiedAt).toBeInstanceOf(Date);
    await savePractitioner(p.drA, null, form({ bio: "Conservative dentistry and prevention for families.", alboNumber: "999" }));
    expect((await row()).alboVerifiedAt).toBeNull();
  });

  it("blocks promotional wording in the bio (L. 145/2018) and saves a neutral one", async () => {
    await signIn("user-owner", "owner");
    const res = await savePractitioner(p.drA, null, form({ bio: "Il miglior dentista di Milano, sconto 50% sulla prima visita" }));
    expect(res).toMatchObject({ ok: false, code: "advertising" });
    expect((await row()).bio).toBeNull();
    expect(await savePractitioner(p.drA, null, form({ bio: "Laureata a Milano, si occupa di conservativa e protesi." }))).toMatchObject({ ok: true });
  });
});

describe("marketplace opt-out", () => {
  it("only the practitioner can remove themselves, and the owner can't undo it", async () => {
    await signIn("user-owner", "owner");
    expect(await setMarketplaceOptOut(p.drA, true)).toMatchObject({ ok: false, code: "forbidden" });
    await signIn(DOCTOR, "practitioner");
    expect(await setMarketplaceOptOut(p.drA, true)).toMatchObject({ ok: true });
    expect((await row()).marketplaceOptOutAt).toBeInstanceOf(Date);
    await signIn("user-owner", "owner");
    expect(await setMarketplaceOptOut(p.drA, false)).toMatchObject({ ok: false, code: "forbidden" });
    await approvePublicProfile(p.drA);
    expect((await row()).marketplaceOptOutAt).toBeInstanceOf(Date); // approval doesn't override the opt-out
    await signIn(DOCTOR, "practitioner");
    expect(await setMarketplaceOptOut(p.drA, false)).toMatchObject({ ok: true });
    expect((await row()).marketplaceOptOutAt).toBeNull();
  });
});

describe("treatments", () => {
  it("blocks promotional names and descriptions, and stores price type, range, recall and the sensitive flag", async () => {
    await signIn("user-owner", "owner");
    const fd = (fields: Record<string, string>) => {
      const f = new FormData();
      for (const [k, v] of Object.entries({ name: "Igiene", category: "hygiene", durationMinutes: "45", active: "on", ...fields })) f.append(k, v);
      return f;
    };
    expect(await saveService(p.cleaning, null, fd({ description: "Igiene gratis per i nuovi pazienti" }))).toMatchObject({ ok: false, code: "advertising" });
    expect(await saveService(p.cleaning, null, fd({ priceType: "from", price: "60", priceMax: "40" }))).toMatchObject({ ok: false });
    expect(await saveService(p.cleaning, null, fd({ priceType: "from", price: "60", priceMax: "120", recallMonths: "6", sensitive: "on", priceIncludes: "Controllo" }))).toMatchObject({ ok: true });
    const [svc] = await db.select().from(services).where(eq(services.id, p.cleaning));
    expect(svc).toMatchObject({ priceType: "from", priceCents: 6000, priceMaxCents: 12000, recallMonths: 6, sensitive: true, priceIncludes: "Controllo" });
    expect(await saveService(p.cleaning, null, fd({ priceType: "quote", price: "60" }))).toMatchObject({ ok: true });
    expect((await db.select().from(services).where(eq(services.id, p.cleaning)))[0]).toMatchObject({ priceType: "quote", priceCents: null });
  });
});
