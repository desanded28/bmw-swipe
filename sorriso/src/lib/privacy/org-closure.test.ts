import { eq, inArray } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/db";
import { appointments, auditLog, memberships, messages, organizations, patients, practitioners, users } from "@/db/schema";
import { GET as certificateRoute } from "@/app/dashboard/settings/closure/certificate/route";
import { createPractice } from "@/test/fixtures";
import { newId } from "../ids";
import { cancelClosure, certificateToken, loadCertificate, purgeDateFor, purgeOrg, requestClosure } from "./org-closure";

describe("account closure", () => {
  it("schedules the purge 60 days out (30-day transition + 30 days to retrieve), and can be cancelled", async () => {
    const { orgId } = await createPractice();
    const now = new Date("2030-01-10T10:00:00Z");
    const { purgeAfter } = await requestClosure(orgId, { actor: { type: "system", id: null }, now });
    expect(purgeAfter.getTime()).toBe(purgeDateFor(now).getTime());
    expect(purgeAfter.getTime() - now.getTime()).toBe(60 * 86_400_000);
    await expect(requestClosure(orgId, { actor: { type: "system", id: null } })).rejects.toMatchObject({ code: "already_requested" });
    await cancelClosure(orgId, { actor: { type: "system", id: null } });
    const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
    expect(org).toMatchObject({ closureRequestedAt: null, purgeAfter: null, listed: false });
  });

  it("purges every row of the practice and its own staff, and issues a verifiable certificate", async () => {
    const p = await createPractice();
    const keep = await createPractice();
    const solo = newId();
    const shared = newId();
    await db.insert(users).values([
      { id: solo, email: `solo-${solo}@example.org`, name: "Solo", passwordHash: "x" },
      { id: shared, email: `shared-${shared}@example.org`, name: "Shared", passwordHash: "x" },
    ]);
    await db.insert(memberships).values([
      { userId: solo, orgId: p.orgId, role: "owner" },
      { userId: shared, orgId: p.orgId, role: "admin" },
      { userId: shared, orgId: keep.orgId, role: "owner" },
    ]);
    const patientId = newId();
    await db.insert(patients).values({ id: patientId, orgId: p.orgId, firstName: "A", lastName: "B" });
    const apptId = newId();
    const start = new Date("2030-02-01T09:00:00Z");
    await db.insert(appointments).values({ id: apptId, orgId: p.orgId, locationId: p.milano, practitionerId: p.drA, serviceId: p.visit, patientId, startsAt: start, endsAt: start, blockedUntil: start, source: "staff", manageToken: `h:${apptId}` });
    await db.insert(messages).values({ id: newId(), orgId: p.orgId, patientId, channel: "sms", direction: "outbound", to: "+390000", body: "x", status: "sent", provider: "dev" });

    const now = new Date("2030-03-01T10:00:00Z");
    const { counts, certificateId } = await purgeOrg(p.orgId, { now });
    expect(counts).toMatchObject({ organizations: 1, patients: 1, appointments: 1, messages: 1, practitioners: 3, locations: 2, memberships: 2, users: 1 });
    expect(await db.select().from(organizations).where(eq(organizations.id, p.orgId))).toEqual([]);
    expect(await db.select().from(practitioners).where(eq(practitioners.orgId, p.orgId))).toEqual([]);
    expect((await db.select().from(users).where(inArray(users.id, [solo, shared]))).map((u) => u.id)).toEqual([shared]);
    expect(await db.select().from(organizations).where(eq(organizations.id, keep.orgId))).toHaveLength(1);

    expect(certificateId).toBeTruthy();
    const cert = await loadCertificate(certificateToken(certificateId!));
    expect(cert).toMatchObject({ orgId: p.orgId, orgName: "Studio Test", tables: { patients: 1, appointments: 1 } });
    expect(cert!.backupsExpireAt.getTime()).toBe(now.getTime() + 30 * 86_400_000);
    expect(await loadCertificate(`${certificateId}.forged`)).toBeNull();
    const [row] = await db.select().from(auditLog).where(eq(auditLog.id, certificateId!));
    expect(row).toMatchObject({ orgId: null, action: "org.close" });

    const page = await certificateRoute(new Request(`https://sorriso.test/dashboard/settings/closure/certificate?c=${encodeURIComponent(certificateToken(certificateId!))}&lang=en`));
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain("Certificate of deletion");
    expect(html).toContain(cert!.hash);
    expect((await certificateRoute(new Request("https://sorriso.test/dashboard/settings/closure/certificate?c=nope"))).status).toBe(404);
  });
});
