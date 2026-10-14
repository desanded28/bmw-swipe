import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { getT } from "@/i18n/t";
import { appointments, auditLog, organizations, practitioners } from "@/db/schema";
import { createAppointment } from "@/lib/booking";
import { sha256Hex } from "@/lib/crypto";
import { newToken } from "@/lib/ids";
import { patientInitials } from "@/lib/security/ics-feed";
import { zonedToUtc } from "@/lib/time";
import { createPractice, MONDAY, NOW, TZ } from "@/test/fixtures";
import { GET } from "./route";

const DAY = 86_400_000;
let p: Awaited<ReturnType<typeof createPractice>>;
let token: string;
let ipSeq = 1;

const fetchFeed = (t = token) =>
  GET(new Request("https://sorriso.test/api/ics/practitioner/x.ics", { headers: { "x-forwarded-for": `192.0.2.${ipSeq++}` } }), {
    params: Promise.resolve({ token: `${t}.ics` }),
  });

async function setPrivacy(privacy: Record<string, unknown>) {
  const [org] = await db.select().from(organizations).where(eq(organizations.id, p.orgId));
  await db
    .update(organizations)
    .set({ settings: { ...org.settings, privacy: { ...org.settings.privacy, ...privacy } } })
    .where(eq(organizations.id, p.orgId));
}

/** An appointment for Dr. A moved to `offsetDays` from now. */
async function appointmentAt(offsetDays: number, patient: { firstName: string; lastName: string }, note?: string) {
  const d = await createAppointment({
    orgId: p.orgId,
    serviceId: p.cleaning,
    practitionerId: p.drA,
    locationId: p.milano,
    startsAt: zonedToUtc(MONDAY, 9 * 60 + (ipSeq++ % 8) * 30, TZ),
    patient: { ...patient, phone: `+39348${String(1000000 + ipSeq).slice(-7)}` },
    patientNote: note,
    source: "staff",
    online: false,
    force: true,
    now: NOW,
  });
  const startsAt = new Date(Date.now() + offsetDays * DAY);
  await db
    .update(appointments)
    .set({ startsAt, endsAt: new Date(startsAt.getTime() + 45 * 60_000), blockedUntil: new Date(startsAt.getTime() + 60 * 60_000) })
    .where(eq(appointments.id, d.appointment.id));
  return d.appointment.id;
}

beforeAll(async () => {
  p = await createPractice();
  token = newToken();
  await db
    .update(practitioners)
    .set({ icsTokenHash: sha256Hex(token), icsEnabled: true, icsTokenExpiresAt: new Date(Date.now() + 300 * DAY) })
    .where(eq(practitioners.id, p.drA));
});

describe("practitioner calendar feed", () => {
  it("returns 404 when the practice has calendar feeds turned off", async () => {
    await setPrivacy({ icsFeedsEnabled: false });
    const res = await fetchFeed();
    expect(res.status).toBe(404);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("contains no service names, patient names or notes: just 'Appointment'", async () => {
    await setPrivacy({ icsFeedsEnabled: true, icsDetail: "none" });
    await appointmentAt(2, { firstName: "Gino", lastName: "Sala" }, "abscess, on anticoagulants");
    const res = await fetchFeed();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const ics = await res.text();
    expect(ics).toContain("BEGIN:VEVENT");
    // The practice's language (Italian by default), whatever the translation says.
    expect(ics).toContain(`SUMMARY:${getT("it", "security")("ics.summary")}`);
    for (const leak of ["Cleaning", "Visit", "Gino", "Sala", "anticoagulants", "abscess"]) expect(ics).not.toContain(leak);
  });

  it("shows initials only when the practice chose that detail", async () => {
    await setPrivacy({ icsFeedsEnabled: true, icsDetail: "initials" });
    await appointmentAt(3, { firstName: "Maria", lastName: "Esposito" });
    const ics = await (await fetchFeed()).text();
    expect(ics).toContain(`SUMMARY:${getT("it", "security")("ics.summaryInitials", { initials: "M. E." })}`);
    expect(ics).not.toContain("Maria");
    expect(ics).not.toContain("Esposito");
    expect(patientInitials(" élodie ", "de Luca")).toBe("É. D.");
  });

  it("covers only the past 7 days and the next 30", async () => {
    await setPrivacy({ icsFeedsEnabled: true });
    const inside = [await appointmentAt(-6, { firstName: "In", lastName: "Past" }), await appointmentAt(29, { firstName: "In", lastName: "Future" })];
    const outside = [await appointmentAt(-8, { firstName: "Old", lastName: "One" }), await appointmentAt(31, { firstName: "Far", lastName: "Away" })];
    const ics = await (await fetchFeed()).text();
    for (const id of inside) expect(ics).toContain(`UID:${id}@sorriso`);
    for (const id of outside) expect(ics).not.toContain(`UID:${id}@sorriso`);
  });

  it("logs ics.feed.fetch with the HMAC of the caller's IP", async () => {
    await setPrivacy({ icsFeedsEnabled: true });
    await fetchFeed();
    const rows = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.orgId, p.orgId), eq(auditLog.action, "ics.feed.fetch")));
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.at(-1)).toMatchObject({ entityType: "practitioner", entityId: p.drA });
    expect(rows.at(-1)!.ipHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("refuses unknown, disabled and expired feeds with the same 404", async () => {
    await setPrivacy({ icsFeedsEnabled: true });
    expect((await fetchFeed(newToken())).status).toBe(404);
    expect((await fetchFeed("short")).status).toBe(404);
    await db.update(practitioners).set({ icsTokenExpiresAt: new Date(Date.now() - 1000) }).where(eq(practitioners.id, p.drA));
    expect((await fetchFeed()).status).toBe(404);
    await db.update(practitioners).set({ icsTokenExpiresAt: new Date(Date.now() + DAY), icsEnabled: false }).where(eq(practitioners.id, p.drA));
    expect((await fetchFeed()).status).toBe(404);
    await db.update(practitioners).set({ icsEnabled: true }).where(eq(practitioners.id, p.drA));
    expect((await fetchFeed()).status).toBe(200);
  });

  it("rate-limits a network that keeps trying unknown feed URLs", async () => {
    const h = { "x-forwarded-for": "198.51.100.250" };
    let last = 0;
    for (let i = 0; i < 31; i++) {
      last = (await GET(new Request("https://sorriso.test/x", { headers: h }), { params: Promise.resolve({ token: `${newToken()}.ics` }) })).status;
    }
    expect(last).toBe(429);
  });
});
