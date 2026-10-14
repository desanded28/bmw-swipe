import { and, eq } from "drizzle-orm";
import { unzipSync } from "fflate";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { auditLog, patients } from "@/db/schema";
import { contactHash } from "@/lib/contact";
import { newId } from "@/lib/ids";
import { createPatientSession, patientSessionCookieName } from "@/lib/privacy/patient-session";
import { createPractice } from "@/test/fixtures";
import { GET } from "./route";

// The request's cookie jar (next/headers), as the route reads it.
const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (c: { name: string; value: string }) => void jar.set(c.name, c.value),
    delete: (name: string) => void jar.delete(name),
  }),
  headers: async () => new Headers(),
}));

const PHONE = "+393405550001";
let mine = "";
let theirs = "";

beforeAll(async () => {
  const a = await createPractice();
  const b = await createPractice();
  mine = newId();
  theirs = newId();
  await db.insert(patients).values([
    { id: mine, orgId: a.orgId, firstName: "Sara", lastName: "Galli", phone: PHONE, birthDate: "1985-02-02", locale: "it", verifiedContacts: [contactHash("phone", PHONE)!] },
    { id: theirs, orgId: b.orgId, firstName: "Ugo", lastName: "Neri", phone: "+393405550002", locale: "it" },
  ]);
});
beforeEach(() => jar.clear());

const get = (query: string) => GET(new Request(`https://sorriso.test/api/privacy/export?${query}`, { headers: { "x-real-ip": "192.0.2.10" } }));

describe("/api/privacy/export", () => {
  it("needs a privacy-center session", async () => {
    const res = await get(`p=${mine}&locale=it`);
    expect(res.status).toBe(401);
    expect(res.headers.get("cache-control")).toContain("no-store");
  });

  it("returns the record as a ZIP attachment, never cached, and audits the export", async () => {
    const { session, cookieValue } = await createPatientSession({ kind: "phone", value: PHONE });
    jar.set(patientSessionCookieName(), cookieValue);
    const res = await get(`p=${mine}&locale=it`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/zip");
    expect(res.headers.get("content-disposition")).toMatch(/^attachment; filename="patient-.+\.zip"$/);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    const files = unzipSync(new Uint8Array(await res.arrayBuffer()));
    expect(Object.keys(files)).toEqual(expect.arrayContaining(["patient.json", "summary.html", "fhir.json"]));
    const rows = await db.select().from(auditLog).where(and(eq(auditLog.action, "privacy_center.export"), eq(auditLog.entityId, mine)));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ actorType: "patient_session", actorId: session.id });
  });

  it("refuses a record the session's contact doesn't reach", async () => {
    const { cookieValue } = await createPatientSession({ kind: "phone", value: PHONE });
    jar.set(patientSessionCookieName(), cookieValue);
    const res = await get(`p=${theirs}&locale=it`);
    expect(res.status).toBe(404);
    const rows = await db.select().from(auditLog).where(and(eq(auditLog.action, "privacy_center.export"), eq(auditLog.entityId, theirs)));
    expect(rows).toHaveLength(0);
  });
});
