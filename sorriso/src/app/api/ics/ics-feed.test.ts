import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { appointments, organizations, practitioners, users } from "@/db/schema";
import { getT } from "@/i18n/t";
import { createAppointment } from "@/lib/booking";
import { sha256Hex } from "@/lib/crypto";
import { newId, newToken } from "@/lib/ids";
import { manageTokenOf } from "@/lib/links";
import { createPractice } from "@/test/fixtures";
import { GET as appointmentIcs } from "./appointment/[token]/route";
import { GET } from "./practitioner/[token]/route";

// Pass-through spy: which language the feed's texts are read in.
vi.mock("@/i18n/t", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/i18n/t")>();
  return { ...mod, getT: vi.fn(mod.getT) };
});

const DAY = 86_400_000;

let p: Awaited<ReturnType<typeof createPractice>>;
const token = newToken();

beforeAll(async () => {
  p = await createPractice();
  await db
    .update(organizations)
    .set({ settings: { ...p.settings, privacy: { icsFeedsEnabled: true } } })
    .where(eq(organizations.id, p.orgId));
  await db
    .update(practitioners)
    // Feed URLs always expire (a NULL expiry is refused): this one is valid for another month.
    .set({ icsTokenHash: sha256Hex(token), icsEnabled: true, icsTokenExpiresAt: new Date(Date.now() + 30 * DAY) })
    .where(eq(practitioners.id, p.drA));
});

describe("practitioner calendar feed", () => {
  it("never puts the patient's note into the calendar", async () => {
    // The feed covers the past 7 days and the next 30: book three days from now, on the hour
    // (staff booking with force, so the fixture's weekly hours don't matter).
    const startsAt = new Date(Math.ceil((Date.now() + 3 * DAY) / 3_600_000) * 3_600_000);
    await createAppointment({
      orgId: p.orgId,
      serviceId: p.visit,
      practitionerId: p.drA,
      locationId: p.milano,
      startsAt,
      patient: { firstName: "Gino", lastName: "Sala", phone: "+393489990001" },
      patientNote: "abscess, on anticoagulants",
      source: "staff",
      online: false,
      force: true,
    });
    const res = await GET(new Request("https://sorriso.test/api/ics/practitioner/x.ics"), {
      params: Promise.resolve({ token: `${token}.ics` }),
    });
    expect(res.status).toBe(200);
    const ics = await res.text();
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).not.toContain("anticoagulants");
  });
});

describe("practitioner calendar feed language", () => {
  it("follows the practitioner's own dashboard language, not the practice default", async () => {
    const userId = newId();
    await db.insert(users).values({ id: userId, email: `${userId}@sorriso.test`, name: "Dr. Deutsch", passwordHash: "x", locale: "de" });
    await db.update(practitioners).set({ userId }).where(eq(practitioners.id, p.drA));
    vi.mocked(getT).mockClear();
    const res = await GET(new Request("https://sorriso.test/api/ics/practitioner/x.ics", { headers: { "x-forwarded-for": "198.51.100.77" } }), {
      params: Promise.resolve({ token: `${token}.ics` }),
    });
    expect(res.status).toBe(200);
    expect(vi.mocked(getT).mock.calls.map((c) => c[0])).toEqual(["de"]);
  });
});

describe("Add to calendar (.ics of one appointment)", () => {
  it("exports a request or held booking as TENTATIVE, a scheduled one as CONFIRMED", async () => {
    const d = await createAppointment({
      orgId: p.orgId,
      serviceId: p.visit,
      practitionerId: p.drB,
      locationId: p.milano,
      startsAt: new Date(Math.ceil((Date.now() + 5 * DAY) / 3_600_000) * 3_600_000),
      patient: { firstName: "Tina", lastName: "Tentativa", phone: "+393489990002" },
      source: "staff",
      online: false,
      force: true,
    });
    const token = manageTokenOf(d.appointment)!;
    const get = async () =>
      (await appointmentIcs(new Request(`https://sorriso.test/api/ics/appointment/${token}`, { headers: { "x-forwarded-for": "198.51.100.78" } }), {
        params: Promise.resolve({ token }),
      })).text();
    expect(await get()).toContain("STATUS:CONFIRMED");
    await db.update(appointments).set({ status: "requested" }).where(eq(appointments.id, d.appointment.id));
    const ics = await get();
    expect(ics).toContain("STATUS:TENTATIVE");
    expect(ics).not.toContain("STATUS:CONFIRMED");
  });
});
