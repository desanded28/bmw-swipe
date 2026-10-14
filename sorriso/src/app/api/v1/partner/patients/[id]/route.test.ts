import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { apiKeys, auditLog, organizations, patients, type ApiScope } from "@/db/schema";
import { newId, newToken, sha256 } from "@/lib/ids";
import { createPractice } from "@/test/fixtures";
import { DELETE, ERASE_RATE, GET } from "./route";

let orgId: string;

async function key(scopes: ApiScope[], allowedIps: string[] | null = null) {
  const secret = `sk_${newToken()}`;
  await db.insert(apiKeys).values({ id: newId(), orgId, name: "test", prefix: secret.slice(0, 10), keyHash: sha256(secret), scopes, allowedIps });
  return secret;
}

async function addPatient() {
  const [p] = await db.insert(patients).values({ id: newId(), orgId, firstName: "Ugo", lastName: "Partner", phone: "+393475550001" }).returning();
  return p;
}

const call = (handler: typeof GET, id: string, secret?: string, body?: unknown) =>
  handler(
    new Request(`https://sorriso.test/api/v1/partner/patients/${id}`, {
      method: handler === DELETE ? "DELETE" : "GET",
      headers: { ...(secret ? { authorization: `Bearer ${secret}` } : {}), "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    }),
    { params: Promise.resolve({ id }) },
  );

beforeAll(async () => {
  ({ orgId } = await createPractice());
});

describe("partner API: /api/v1/partner/patients/:id", () => {
  it("needs a key with the patients:erase scope to erase", async () => {
    const p = await addPatient();
    expect((await call(DELETE, p.id)).status).toBe(401);
    const readOnly = await key(["patients:read"]);
    const res = await call(DELETE, p.id, readOnly);
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("insufficient_scope");
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("honours the key's IP allow-list (403 ip_not_allowed) and limits erasures per key", async () => {
    const fenced = await key(["patients:erase", "patients:read"], ["198.51.100.7"]);
    const p = await addPatient();
    const res = await call(GET, p.id, fenced);
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("ip_not_allowed");

    const eraser = await key(["patients:erase"]);
    for (let i = 0; i < ERASE_RATE.limit; i++) expect((await call(DELETE, `missing-${i}`, eraser)).status).not.toBe(429);
    const limited = await call(DELETE, p.id, eraser);
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBeTruthy();
    expect((await db.select().from(patients).where(eq(patients.id, p.id)))[0].erasedAt).toBeNull();
  });

  it("erases with the practice's default (restrict by default needs a keep-until date)", async () => {
    const eraser = await key(["patients:erase", "patients:read"]);
    const p = await addPatient();
    const refused = await call(DELETE, p.id, eraser, {});
    expect(refused.status).toBe(422);
    expect((await refused.json()).error.code).toBe("retain_until_required");

    const ok = await call(DELETE, p.id, eraser, { retainUntil: "2040-01-01", reason: "Richiesta del paziente" });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ mode: "restrict", patient: { id: p.id, restricted: true, erased: false, retainUntil: "2040-01-01" } });
    // Recipients can read the flags (Art. 19).
    expect(await (await call(GET, p.id, eraser)).json()).toMatchObject({ patient: { restricted: true } });
  });

  it("pseudonymises when the practice chose it, and audits with the key as actor", async () => {
    const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
    await db
      .update(organizations)
      .set({ settings: { ...org.settings, privacy: { ...org.settings.privacy, erasureDefault: "anonymise" } } })
      .where(eq(organizations.id, orgId));
    const eraser = await key(["patients:erase"]);
    const p = await addPatient();
    const res = await call(DELETE, p.id, eraser);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ mode: "anonymise", patient: { erased: true } });
    const [row] = await db.select().from(patients).where(eq(patients.id, p.id));
    expect(row.phone).toBeNull();
    const [a] = await db.select().from(auditLog).where(and(eq(auditLog.action, "patient.erase"), eq(auditLog.entityId, p.id)));
    expect(a.actorType).toBe("api_key");
    expect((await call(DELETE, p.id, eraser)).status).toBe(409);
    // Another practice's patient is not found.
    const other = await createPractice();
    const [q] = await db.insert(patients).values({ id: newId(), orgId: other.orgId, firstName: "X", lastName: "Y" }).returning();
    expect((await call(DELETE, q.id, eraser)).status).toBe(404);
  });
});
