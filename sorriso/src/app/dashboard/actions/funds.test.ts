/**
 * Public practice texts outside the catalogue and the profile go through the health-advertising
 * check too (Law 145/2018): health-fund notes (saveOrgFunds) and directions to an office
 * (saveLocation). Promotional wording blocks the save and stores nothing; suggestive wording is
 * saved with a warning. Another practice's office or chair answers not_found.
 */
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { locations, organizations, orgFunds, rooms } from "@/db/schema";
import type { StaffSession } from "@/lib/auth";
import { createPractice } from "@/test/fixtures";

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

const { saveOrgFunds } = await import("./funds");
const { addRoom, saveLocation, updateRoom } = await import("./locations");

let p: Awaited<ReturnType<typeof createPractice>>;

function fd(fields: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  return f;
}

beforeAll(async () => {
  p = await createPractice();
  const [org] = await db.select().from(organizations).where(eq(organizations.id, p.orgId));
  state.session = { sessionId: "s", user: { id: "user-owner", name: "T", email: "t@example.com", isPlatformAdmin: false, locale: "en" }, org, role: "owner", orgs: [{ org, role: "owner" }] } as unknown as StaffSession;
});

const fundRows = async () => db.select().from(orgFunds).where(eq(orgFunds.orgId, p.orgId));

describe("saveOrgFunds", () => {
  it("blocks a promotional fund note and stores nothing", async () => {
    const res = await saveOrgFunds(null, fd({ "fund.fund_fasi": "on", "mode.fund_fasi": "direct", "note.fund_fasi": "Sconto 50% per iscritti FASI, prima visita gratis" }));
    expect(res).toMatchObject({ ok: false, code: "advertising" });
    expect(res.ok ? "" : res.error).toContain('"Sconto"');
    expect(await fundRows()).toEqual([]);
  });

  it("saves an informative note", async () => {
    expect(await saveOrgFunds(null, fd({ "fund.fund_fasi": "on", "mode.fund_fasi": "direct", "note.fund_fasi": "Portare l'autorizzazione del fondo." }))).toMatchObject({ ok: true });
    expect(await fundRows()).toMatchObject([{ fundId: "fund_fasi", mode: "direct", note: "Portare l'autorizzazione del fondo." }]);
  });
});

describe("saveLocation", () => {
  const office = { name: "Milano", address: "Via Roma 1", city: "Milano" };
  const transit = async () => (await db.select().from(locations).where(eq(locations.id, p.milano)))[0].accessibility.transit;

  it("blocks promotional wording in the directions and keeps the old text", async () => {
    const before = await transit();
    const res = await saveLocation(p.milano, null, fd({ ...office, transit: "Metro M1 Cairoli. Prima visita gratis!" }));
    expect(res).toMatchObject({ ok: false, code: "advertising" });
    expect(await transit()).toBe(before);
  });

  it("saves plain directions", async () => {
    expect(await saveLocation(p.milano, null, fd({ ...office, transit: "Metro M1 Cairoli, 3 minuti a piedi" }))).toMatchObject({ ok: true });
    expect(await transit()).toBe("Metro M1 Cairoli, 3 minuti a piedi");
  });

  it("answers not_found for another practice's office or chair and changes nothing", async () => {
    const other = await createPractice();
    expect(await saveLocation(other.milano, null, fd({ name: "Hijacked", address: "Via X 1", city: "X" }))).toMatchObject({ ok: false, code: "not_found" });
    expect(await addRoom(other.milano, "Hijacked")).toMatchObject({ ok: false, code: "not_found" });
    expect(await updateRoom(other.chair1, { name: "Hijacked", active: false })).toMatchObject({ ok: false, code: "not_found" });
    expect((await db.select().from(locations).where(eq(locations.id, other.milano)))[0].name).toBe("Milano");
    const chairs = await db.select().from(rooms).where(eq(rooms.locationId, other.milano));
    expect(chairs.map((r) => r.name).sort()).toEqual(["Chair 1", "Chair 2"]);
    expect(chairs.every((r) => r.active)).toBe(true);
  });
});
