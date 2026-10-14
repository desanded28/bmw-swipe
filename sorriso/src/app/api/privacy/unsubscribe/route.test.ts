import { and, asc, desc, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { auditLog, consents, messages, organizations, patients, reminders, type OrgSettings } from "@/db/schema";
import { createAppointment } from "@/lib/booking";
import { newId } from "@/lib/ids";
import { unsubscribeToken } from "@/lib/links";
import { patientEmailHeaders, unsubscribeUrl } from "@/lib/messaging";
import { processDueReminders } from "@/lib/reminders";
import { addDays, zonedToUtc } from "@/lib/time";
import { createPractice, MONDAY, NOW, TZ } from "@/test/fixtures";
import { GET, POST } from "./route";

type Practice = Awaited<ReturnType<typeof createPractice>>;

let p: Practice;
let ip = 0;
const call = (method: "GET" | "POST", query: string, body?: string, from?: string) =>
  new Request(`https://sorriso.test/api/privacy/unsubscribe?${query}`, {
    method,
    headers: {
      "x-real-ip": from ?? `192.0.2.${(ip++ % 250) + 1}`,
      "accept-language": "en",
      ...(body ? { "content-type": "application/x-www-form-urlencoded" } : {}),
    },
    body,
  });

let n = 0;
async function emailPatientBooking() {
  const start = zonedToUtc(addDays(MONDAY, 7), 9 * 60 + n * 30, TZ);
  const d = await createAppointment({
    orgId: p.orgId,
    serviceId: p.visit,
    practitionerId: p.drA,
    locationId: p.milano,
    startsAt: start,
    patient: { firstName: "Elena", lastName: "Conti", email: `elena${n++}@example.com`, locale: "de", preferredChannel: "email" },
    source: "staff",
    online: false,
    notifyPatient: false,
    now: NOW,
  });
  return { d, start };
}

beforeAll(async () => {
  p = await createPractice();
  // One email reminder 24 hours before.
  const settings: OrgSettings = {
    ...p.settings,
    reminders: {
      ...p.settings.reminders,
      rules: [{ id: "r24", channel: "email", offsetMinutes: 24 * 60, askConfirmation: false, fallbackToEmail: true }],
    },
  };
  await db.update(organizations).set({ settings }).where(eq(organizations.id, p.orgId));
});

describe("/api/privacy/unsubscribe", () => {
  it("is the List-Unsubscribe target of every patient email, one click (RFC 8058)", () => {
    const h = patientEmailHeaders({ patientId: "pat1", locale: "it" });
    expect(h["List-Unsubscribe"]).toBe(`<${unsubscribeUrl("pat1", "email")}>`);
    expect(h["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    expect(unsubscribeUrl("pat1", "email")).toMatch(/^https:\/\/sorriso\.test\/api\/privacy\/unsubscribe\?t=/);
  });

  it("GET only asks: it changes nothing (mail scanners open links on their own)", async () => {
    const { d } = await emailPatientBooking();
    const t = unsubscribeToken(d.patient.id, "email");
    const res = await GET(call("GET", `t=${encodeURIComponent(t)}&c=email`));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("no-store");
    const html = await res.text();
    expect(html).toContain('<html lang="de">');
    expect(html).toContain('method="post"');
    expect(html).not.toMatch(/<script|https?:\/\/(?!sorriso\.test)/);
    const rows = await db.select().from(consents).where(eq(consents.patientId, d.patient.id));
    expect(rows).toHaveLength(0);
  });

  it("a one-click POST writes an email_channel withdrawal, and the next email reminder is skipped", async () => {
    const { d, start } = await emailPatientBooking();
    const pending = await db.select().from(reminders).where(and(eq(reminders.appointmentId, d.appointment.id), eq(reminders.kind, "reminder")));
    expect(pending).toHaveLength(1);

    const t = unsubscribeToken(d.patient.id, "email");
    const res = await POST(call("POST", `t=${encodeURIComponent(t)}&c=email`, "List-Unsubscribe=One-Click"));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('<html lang="de">');

    const [row] = await db.select().from(consents).where(eq(consents.patientId, d.patient.id)).orderBy(desc(consents.createdAt));
    expect(row).toMatchObject({
      orgId: p.orgId,
      purpose: "email_channel",
      granted: false,
      method: "email_link",
      source: "manage_link",
      locale: expect.any(String),
    });
    expect(row.ipHash).toMatch(/^[0-9a-f]{64}$/);
    const [patient] = await db.select().from(patients).where(eq(patients.id, d.patient.id));
    expect(patient.emailOptIn).toBe(false);
    const [log] = await db.select().from(auditLog).where(and(eq(auditLog.action, "consent.record"), eq(auditLog.entityId, d.patient.id)));
    expect(log).toMatchObject({ actorType: "patient_link" });

    // WP3's reminder engine, at the time the 24-hour reminder is due.
    await processDueReminders({ appointmentId: d.appointment.id, now: new Date(start.getTime() - 23 * 3_600_000) });
    const [reminder] = await db
      .select()
      .from(reminders)
      .where(and(eq(reminders.appointmentId, d.appointment.id), eq(reminders.kind, "reminder")))
      .orderBy(asc(reminders.sendAt));
    expect(reminder.status).toBe("skipped");
    const sent = await db.select().from(messages).where(and(eq(messages.appointmentId, d.appointment.id), eq(messages.channel, "email")));
    expect(sent).toHaveLength(0);
  });

  it("is idempotent: a second click records nothing new", async () => {
    const { d } = await emailPatientBooking();
    const t = encodeURIComponent(unsubscribeToken(d.patient.id, "email"));
    await POST(call("POST", `t=${t}&c=email`, "List-Unsubscribe=One-Click"));
    await POST(call("POST", `t=${t}&c=email`, "List-Unsubscribe=One-Click"));
    const rows = await db.select().from(consents).where(and(eq(consents.patientId, d.patient.id), eq(consents.purpose, "email_channel")));
    expect(rows).toHaveLength(1);
  });

  it("the page's own form posts the token in the body too", async () => {
    const { d } = await emailPatientBooking();
    const t = unsubscribeToken(d.patient.id, "email");
    const res = await POST(call("POST", "", `t=${encodeURIComponent(t)}`));
    expect(res.status).toBe(200);
    const [patient] = await db.select().from(patients).where(eq(patients.id, d.patient.id));
    expect(patient.emailOptIn).toBe(false);
  });

  it("never drops a valid one-click POST because of its network: the mailbox provider sends everyone's", async () => {
    // One provider address posting for 40 patients in a few minutes (beyond the 30 a network may
    // send with bad tokens): every withdrawal is recorded.
    const provider = "198.51.100.77";
    const ids: string[] = [];
    for (let i = 0; i < 40; i++) {
      const id = newId();
      await db.insert(patients).values({ id, orgId: p.orgId, firstName: "Bulk", lastName: `P${i}`, email: `bulk${i}-${id}@example.com`, locale: "it", emailOptIn: true });
      ids.push(id);
    }
    for (const id of ids) {
      const res = await POST(call("POST", `t=${encodeURIComponent(unsubscribeToken(id, "email"))}&c=email`, "List-Unsubscribe=One-Click", provider));
      expect(res.status).toBe(200);
    }
    const off = await db.select({ id: patients.id, emailOptIn: patients.emailOptIn }).from(patients).where(eq(patients.orgId, p.orgId));
    expect(off.filter((r) => ids.includes(r.id)).every((r) => r.emailOptIn === false)).toBe(true);
  });

  it("limits bad tokens per network, without slowing down valid ones from it", async () => {
    const prober = "198.51.100.88";
    const statuses: number[] = [];
    for (let i = 0; i < 32; i++) statuses.push((await POST(call("POST", `t=nope${i}&c=email`, "List-Unsubscribe=One-Click", prober))).status);
    expect(statuses.slice(0, 30).every((st) => st === 400)).toBe(true);
    expect(statuses.slice(30)).toEqual([429, 429]);
    const { d } = await emailPatientBooking();
    const ok = await POST(call("POST", `t=${encodeURIComponent(unsubscribeToken(d.patient.id, "email"))}&c=email`, "List-Unsubscribe=One-Click", prober));
    expect(ok.status).toBe(200);
  });

  it("refuses a forged or tampered token, in the visitor's language, without touching anyone", async () => {
    const { d } = await emailPatientBooking();
    const good = unsubscribeToken(d.patient.id, "email");
    for (const bad of [`${good.slice(0, -2)}xx`, unsubscribeToken(d.patient.id, "email").replace(".email.", ".sms."), "nope"]) {
      const res = await POST(call("POST", `t=${encodeURIComponent(bad)}&c=email`, "List-Unsubscribe=One-Click"));
      expect(res.status).toBe(400);
      expect(await res.text()).toContain('<html lang="en">');
    }
    const [patient] = await db.select().from(patients).where(eq(patients.id, d.patient.id));
    expect(patient.emailOptIn).toBe(true);
  });
});
