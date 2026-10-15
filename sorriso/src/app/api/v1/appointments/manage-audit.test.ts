import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { auditLog } from "@/db/schema";
import { createAppointment } from "@/lib/booking";
import { manageTokenOf } from "@/lib/links";
import { addDays, todayIn, zonedToUtc } from "@/lib/time";
import { createPractice, TZ } from "@/test/fixtures";
import { POST } from "./[token]/[action]/route";

/** The patient's changes through their link are in the access log (F9.4), with the link as actor. */

let p: Awaited<ReturnType<typeof createPractice>>;
let ipSeq = 1;

beforeAll(async () => {
  p = await createPractice();
});

const post = (token: string, action: string, body: unknown = {}) =>
  POST(
    new Request(`https://sorriso.test/api/v1/appointments/${token}/${action}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": `198.51.100.${ipSeq++}` },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ token, action }) },
  );

describe("POST /api/v1/appointments/:token/:action is audited", () => {
  it("confirm and cancel through the link each leave a row on the appointment, by patient_link", async () => {
    const day = addDays(todayIn(TZ), 12);
    const d = await createAppointment({
      orgId: p.orgId,
      serviceId: p.visit,
      practitionerId: p.drA,
      locationId: p.milano,
      startsAt: zonedToUtc(day, 11 * 60, TZ),
      patient: { firstName: "Giada", lastName: "Fontana", phone: "+393472220001", locale: "it" },
      source: "online",
      online: false,
      force: true,
    });
    const token = manageTokenOf(d.appointment)!;
    expect((await post(token, "confirm")).status).toBe(200);
    expect((await post(token, "cancel", { reason: "imprevisto" })).status).toBe(200);
    const rows = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.entityType, "appointment"), eq(auditLog.entityId, d.appointment.id)));
    const link = rows.filter((r) => r.actorType === "patient_link" && r.action !== "appointment.create");
    expect(link.map((r) => [r.action, r.actorId, r.metadata])).toEqual([
      ["appointment.update", d.appointment.id, { change: "confirm", via: "manage_link" }],
      ["appointment.cancel", d.appointment.id, { change: "cancel", via: "manage_link" }],
    ]);
    expect(link.every((r) => r.ipHash !== null)).toBe(true);
  });
});
