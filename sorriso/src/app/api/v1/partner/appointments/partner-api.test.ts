import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import type { ApiScope } from "@/db/enums";
import { apiKeys, auditLog, patients, practitioners } from "@/db/schema";
import { createApiKey } from "@/lib/api";
import { createAppointment } from "@/lib/booking";
import { zonedToUtc } from "@/lib/time";
import { createPractice, MONDAY, NOW, TZ } from "@/test/fixtures";
import { GET as getOne, PATCH } from "./[id]/route";
import { GET as list, POST } from "./route";
import { GET as resources } from "../resources/route";

let p: Awaited<ReturnType<typeof createPractice>>;
let other: Awaited<ReturnType<typeof createPractice>>;
let appointmentId: string;

function call(path: string, key: string | null, init: { method?: string; ip?: string; body?: unknown } = {}) {
  const headers: Record<string, string> = { "x-forwarded-for": init.ip ?? "198.51.100.10" };
  if (key) headers.authorization = `Bearer ${key}`;
  if (init.body) headers["content-type"] = "application/json";
  return new Request(`https://sorriso.test${path}`, { method: init.method ?? "GET", headers, body: init.body ? JSON.stringify(init.body) : undefined });
}

const key = async (scopes: ApiScope[], extra: { allowedIps?: string[]; orgId?: string } = {}) =>
  (await createApiKey(extra.orgId ?? p.orgId, { name: "Test", scopes, allowedIps: extra.allowedIps })).secret;

const params = (id: string) => ({ params: Promise.resolve({ id }) });

beforeAll(async () => {
  p = await createPractice();
  other = await createPractice();
  const d = await createAppointment({
    orgId: p.orgId,
    serviceId: p.visit,
    practitionerId: p.drA,
    locationId: p.milano,
    startsAt: zonedToUtc(MONDAY, 10 * 60, TZ),
    patient: { firstName: "Gino", lastName: "Sala", phone: "+393489990101", birthDate: "1980-05-05" },
    patientNote: "on anticoagulants",
    internalNote: "check INR",
    source: "staff",
    online: false,
    now: NOW,
  });
  appointmentId = d.appointment.id;
});

describe("partner API scopes (data minimisation)", () => {
  it("a key without notes:read gets responses without patientNote or internalNote", async () => {
    const secret = await key(["appointments:read"]);
    const res = await getOne(call(`/api/v1/partner/appointments/${appointmentId}`, secret), params(appointmentId));
    expect(res.status).toBe(200);
    const { appointment } = await res.json();
    expect(appointment).not.toHaveProperty("patientNote");
    expect(appointment).not.toHaveProperty("internalNote");
    // Without patients:read: no birth date or no-show count either.
    expect(appointment.patient).not.toHaveProperty("birthDate");
    expect(appointment.patient).not.toHaveProperty("noShowCount");
    expect(appointment.patient).toMatchObject({ id: expect.any(String), restricted: false, erased: false });

    const listed = await (await list(call("/api/v1/partner/appointments", secret))).json();
    const row = listed.appointments.find((a: { id: string }) => a.id === appointmentId);
    expect(row).toBeDefined();
    expect(JSON.stringify(listed)).not.toContain("anticoagulants");
  });

  it("notes:read and patients:read add them back", async () => {
    const secret = await key(["appointments:read", "notes:read", "patients:read"]);
    const { appointment } = await (await getOne(call(`/api/v1/partner/appointments/${appointmentId}`, secret), params(appointmentId))).json();
    expect(appointment).toMatchObject({ patientNote: "on anticoagulants", internalNote: "check INR" });
    expect(appointment.patient).toMatchObject({ birthDate: "1980-05-05", noShowCount: 0 });
  });

  it("refuses a route outside the key's scopes with 403 insufficient_scope", async () => {
    const readOnly = await key(["appointments:read"]);
    const res = await PATCH(call(`/api/v1/partner/appointments/${appointmentId}`, readOnly, { method: "PATCH", body: { confirmation: "confirmed" } }), params(appointmentId));
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("insufficient_scope");
    const writeOnly = await key(["appointments:write"]);
    expect((await list(call("/api/v1/partner/appointments", writeOnly))).status).toBe(403);
  });

  it("never shows another practice's appointment", async () => {
    const secret = await key(["appointments:read"], { orgId: other.orgId });
    expect((await getOne(call(`/api/v1/partner/appointments/${appointmentId}`, secret), params(appointmentId))).status).toBe(404);
    const listed = await (await list(call("/api/v1/partner/appointments", secret))).json();
    expect(listed.appointments.map((a: { id: string }) => a.id)).not.toContain(appointmentId);
  });
});

describe("partner API keys", () => {
  it("an expired key gets 401; a revoked or unknown one too", async () => {
    const secret = await key(["appointments:read"]);
    const ok = await list(call("/api/v1/partner/appointments", secret));
    expect(ok.status).toBe(200);
    await db.update(apiKeys).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(apiKeys.keyHash, (await import("@/lib/ids")).sha256(secret)));
    expect((await list(call("/api/v1/partner/appointments", secret))).status).toBe(401);

    const revoked = await key(["appointments:read"]);
    await db.update(apiKeys).set({ revokedAt: new Date() }).where(eq(apiKeys.keyHash, (await import("@/lib/ids")).sha256(revoked)));
    expect((await list(call("/api/v1/partner/appointments", revoked))).status).toBe(401);
    expect((await list(call("/api/v1/partner/appointments", "sk_not_a_real_key_at_all"))).status).toBe(401);
    expect((await list(call("/api/v1/partner/appointments", null))).status).toBe(401);
  });

  it("a key with allowedIps called from another IP gets 403", async () => {
    const secret = await key(["appointments:read"], { allowedIps: ["203.0.113.0/24", "2001:db8::/32"] });
    const denied = await list(call("/api/v1/partner/appointments", secret, { ip: "198.51.100.1" }));
    expect(denied.status).toBe(403);
    expect((await denied.json()).error.code).toBe("ip_not_allowed");
    expect((await list(call("/api/v1/partner/appointments", secret, { ip: "203.0.113.42" }))).status).toBe(200);
    expect((await list(call("/api/v1/partner/appointments", secret, { ip: "2001:db8:1::7" }))).status).toBe(200);
  });

  it("a spoofed x-vercel-forwarded-for or x-real-ip doesn't pass the allow-list off Vercel", async () => {
    const secret = await key(["appointments:read"], { allowedIps: ["203.0.113.5"] });
    for (const spoof of ["x-vercel-forwarded-for", "x-real-ip"]) {
      const req = call("/api/v1/partner/appointments", secret, { ip: "198.51.100.1" });
      req.headers.set(spoof, "203.0.113.5");
      expect((await list(req)).status).toBe(403);
    }
  });

  it("a key without an expiry (issued before expiries existed) stops 12 months after creation", async () => {
    const { sha256, newId } = await import("@/lib/ids");
    const legacy = async (createdAt: Date) => {
      const secret = `sk_legacy_${newId(16)}`;
      await db.insert(apiKeys).values({ id: newId(), orgId: p.orgId, name: "Legacy", prefix: secret.slice(0, 10), keyHash: sha256(secret), createdAt, expiresAt: null });
      return secret;
    };
    const DAY = 86_400_000;
    expect((await list(call("/api/v1/partner/appointments", await legacy(new Date(Date.now() - 30 * DAY))))).status).toBe(200);
    expect((await list(call("/api/v1/partner/appointments", await legacy(new Date(Date.now() - 370 * DAY))))).status).toBe(401);
  });

  it("refuses the formerly published demo key even if a database still holds it", async () => {
    const { sha256, newId } = await import("@/lib/ids");
    const published = "sk_demo_studio_bianchi_local_only";
    await db.insert(apiKeys).values({
      id: newId(),
      orgId: p.orgId,
      name: "Old demo",
      prefix: published.slice(0, 10),
      keyHash: sha256(published),
      expiresAt: new Date(Date.now() + 86_400_000),
    });
    expect((await list(call("/api/v1/partner/appointments", published))).status).toBe(401);
  });

  it("keys always expire: 12 months by default", async () => {
    const created = await createApiKey(p.orgId, "Default");
    const months = (created.expiresAt.getTime() - Date.now()) / (30.44 * 86_400_000);
    expect(months).toBeGreaterThan(11.5);
    expect(months).toBeLessThan(12.5);
    expect(created.scopes).toEqual(["appointments:read", "appointments:write", "patients:read"]);
  });
});

describe("partner API responses", () => {
  it("/api/v1/partner/** responses carry no Access-Control-Allow-Origin, whatever the status", async () => {
    const good = await key(["appointments:read", "appointments:write"]);
    const restricted = await key(["appointments:read"], { allowedIps: ["203.0.113.1"] });
    const responses = [
      await list(call("/api/v1/partner/appointments", good)),
      await list(call("/api/v1/partner/appointments", null)),
      await list(call("/api/v1/partner/appointments", restricted)),
      await getOne(call("/api/v1/partner/appointments/missing", good), params("missing")),
      await POST(call("/api/v1/partner/appointments", good, { method: "POST", body: { nonsense: true } })),
      await resources(call("/api/v1/partner/resources", good)),
    ];
    expect(responses.map((r) => r.status)).toEqual([200, 401, 403, 404, 422, 200]);
    for (const r of responses) {
      expect([...r.headers.keys()].filter((h) => h.startsWith("access-control-"))).toEqual([]);
      expect(r.headers.get("cache-control")).toBe("no-store");
    }
  });

  it("every partner call is audited as api.request with the key as actor", async () => {
    const secret = await key(["appointments:read"]);
    await list(call("/api/v1/partner/appointments", secret));
    const [k] = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, (await import("@/lib/ids")).sha256(secret)));
    const rows = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.action, "api.request"), eq(auditLog.actorId, k.id)));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ orgId: p.orgId, actorType: "api_key", metadata: { method: "GET", route: "appointments.list", status: 200 } });
    expect(rows[0].ipHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("a restricted patient's visit carries only ids and the flags, and every read lands in the patient's access log", async () => {
    const d = await createAppointment({
      orgId: p.orgId,
      serviceId: p.visit,
      practitionerId: p.drA,
      locationId: p.milano,
      startsAt: zonedToUtc(MONDAY, 11 * 60, TZ),
      patient: { firstName: "Valeria", lastName: "Russi", phone: "+393489990177", email: "valeria.r@example.org", birthDate: "2001-07-18" },
      patientNote: "dolore forte",
      source: "staff",
      online: false,
      now: NOW,
    });
    await db.update(patients).set({ restrictedAt: NOW }).where(eq(patients.id, d.patient.id));
    const secret = await key(["appointments:read", "notes:read", "patients:read"]);
    const { appointment } = await (await getOne(call(`/api/v1/partner/appointments/${d.appointment.id}`, secret), params(d.appointment.id))).json();
    expect(appointment).toMatchObject({ id: d.appointment.id, serviceId: p.visit, serviceName: null, patientNote: null, internalNote: null });
    expect(appointment.patient).toEqual({ id: d.patient.id, name: null, email: null, phone: null, birthDate: null, noShowCount: null, restricted: true, erased: false });
    const listed = await (await list(call("/api/v1/partner/appointments", secret))).json();
    const text = JSON.stringify(listed);
    for (const leak of ["Valeria", "Russi", "valeria.r@example.org", "+393489990177", "2001-07-18", "dolore forte"]) expect(text).not.toContain(leak);
    // Unrestricted patients are still served in full.
    expect(text).toContain("Gino Sala");

    const [k] = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, (await import("@/lib/ids")).sha256(secret)));
    const reads = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.action, "patient.view"), eq(auditLog.actorId, k.id), eq(auditLog.entityId, d.patient.id)));
    expect(reads.map((r) => r.metadata)).toEqual([
      { via: "partner_api", route: "appointments.get" },
      { via: "partner_api", route: "appointments.list" },
    ]);
  });

  it("resources never expose the calendar-feed secret's hash", async () => {
    await db.update(practitioners).set({ icsTokenHash: "f".repeat(64) }).where(eq(practitioners.id, p.drA));
    const body = await (await resources(call("/api/v1/partner/resources", await key(["appointments:read"])))).json();
    expect(JSON.stringify(body)).not.toContain("f".repeat(64));
    expect(body.practitioners[0]).not.toHaveProperty("icsTokenHash");
    expect(body.practitioners[0]).not.toHaveProperty("icsToken");
    // Nor staff account ids (who generated the feed, who approved the profile).
    expect(body.practitioners[0]).not.toHaveProperty("icsIssuedByUserId");
    expect(body.practitioners[0]).not.toHaveProperty("userId");
  });
});
