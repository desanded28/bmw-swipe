import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { organizations, practitioners } from "@/db/schema";
import { createAppointment } from "@/lib/booking";
import { sha256Hex } from "@/lib/crypto";
import { newToken } from "@/lib/ids";
import { createPractice } from "@/test/fixtures";
import { GET } from "./practitioner/[token]/route";

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
