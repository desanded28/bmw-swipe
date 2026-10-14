import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { organizations, practitioners } from "@/db/schema";
import { createAppointment } from "@/lib/booking";
import { sha256Hex } from "@/lib/crypto";
import { newToken } from "@/lib/ids";
import { createPractice, MONDAY, NOW, TZ } from "@/test/fixtures";
import { zonedToUtc } from "@/lib/time";
import { GET } from "./practitioner/[token]/route";

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
    .set({ icsTokenHash: sha256Hex(token), icsEnabled: true, icsTokenExpiresAt: null })
    .where(eq(practitioners.id, p.drA));
});

describe("practitioner calendar feed", () => {
  it("never puts the patient's note into the calendar", async () => {
    await createAppointment({
      orgId: p.orgId,
      serviceId: p.visit,
      practitionerId: p.drA,
      locationId: p.milano,
      startsAt: zonedToUtc(MONDAY, 10 * 60, TZ),
      patient: { firstName: "Gino", lastName: "Sala", phone: "+393489990001" },
      patientNote: "abscess, on anticoagulants",
      source: "staff",
      online: false,
      now: NOW,
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
