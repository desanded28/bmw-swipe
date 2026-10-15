import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { appointments, messages, patients, timeOff } from "@/db/schema";
import { audit } from "@/lib/audit";
import { createAppointment } from "@/lib/booking";
import { contactHash } from "@/lib/contact";
import { newId } from "@/lib/ids";
import { manageTokenOf } from "@/lib/links";
import { patientRebook, sendRebookOffers } from "@/lib/rebooking";
import { addDays, todayIn, zonedToUtc } from "@/lib/time";
import { createPractice, TZ } from "@/test/fixtures";
import { POST } from "./[token]/[action]/route";

/**
 * The patient's explicit POSTs from a manage link (confirm, cancel, reschedule) prove the contact
 * the link was delivered to, but only when nobody else can be holding the link.
 */

let p: Awaited<ReturnType<typeof createPractice>>;
let ipSeq = 1;
let phoneSeq = 3471000000;
let slot = 0;

beforeAll(async () => {
  p = await createPractice();
});

async function book(source: "staff" | "online") {
  const day = addDays(todayIn(TZ), 10 + Math.floor(slot / 8));
  const startsAt = zonedToUtc(day, 9 * 60 + (slot++ % 8) * 30, TZ);
  const phone = `+39${phoneSeq++}`;
  const d = await createAppointment({
    orgId: p.orgId,
    serviceId: p.visit,
    practitionerId: p.drA,
    locationId: p.milano,
    startsAt,
    patient: { firstName: "Lina", lastName: "Prova", phone, locale: "it" },
    // The source decides; the slot checks of a real online booking are beside the point here.
    source,
    online: false,
    notifyPatient: true,
    force: true,
  });
  return { d, phone, token: manageTokenOf(d.appointment)! };
}

const confirm = (token: string) =>
  POST(new Request(`https://sorriso.test/api/v1/appointments/${token}/confirm`, { method: "POST", headers: { "x-forwarded-for": `198.51.100.${ipSeq++}` } }), {
    params: Promise.resolve({ token, action: "confirm" }),
  });

const verified = async (patientId: string) => (await db.select().from(patients).where(eq(patients.id, patientId)))[0].verifiedContacts;

describe("POST /api/v1/appointments/:token/:action and the contact it proves", () => {
  it("records the one contact a staff booking's link was sent to", async () => {
    const { d, phone, token } = await book("staff");
    const sent = await db.select().from(messages).where(eq(messages.appointmentId, d.appointment.id));
    expect(sent.some((m) => m.body.includes(`/a/${token}`))).toBe(true);
    expect((await confirm(token)).status).toBe(200);
    expect(await verified(d.patient.id)).toEqual([contactHash("phone", phone)]);
  });

  it("records nothing for an online booking: the booking browser got the link too", async () => {
    const { d, token } = await book("online");
    expect((await confirm(token)).status).toBe(200);
    expect(await verified(d.patient.id)).toEqual([]);
  });

  it("records nothing once staff copied the link, or when it went to two contacts", async () => {
    const copied = await book("staff");
    await audit({
      orgId: p.orgId,
      actor: { type: "user", id: null },
      action: "appointment.link.issue",
      entity: { type: "appointment", id: copied.d.appointment.id },
    });
    expect((await confirm(copied.token)).status).toBe(200);
    expect(await verified(copied.d.patient.id)).toEqual([]);

    const twice = await book("staff");
    const [first] = await db.select().from(messages).where(eq(messages.appointmentId, twice.d.appointment.id));
    await db.insert(messages).values({ ...first, id: `${first.id}x`, channel: "email", to: "someone-else@example.com" });
    expect((await confirm(twice.token)).status).toBe(200);
    expect(await verified(twice.d.patient.id)).toEqual([]);
  });
});

describe("POST /api/v1/appointments/:token/confirm while the practice is moving the visit", () => {
  it("refuses with rebook_needed and keeps the rebooking offer open", async () => {
    const { d, token } = await book("staff");
    const a = d.appointment;
    await db.insert(timeOff).values({ id: newId(), orgId: p.orgId, practitionerId: p.drA, startsAt: a.startsAt, endsAt: a.endsAt });
    expect((await sendRebookOffers(p.orgId, [a.id], { type: "user", id: null })).sent).toEqual([a.id]);
    const res = await confirm(token);
    expect(res.status).toBe(409);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("rebook_needed");
    const [after] = await db.select().from(appointments).where(eq(appointments.id, a.id));
    expect(after).toMatchObject({ confirmation: "pending", needsAttention: true });
    expect((await patientRebook(after)).open).toBe(true);
  });
});
