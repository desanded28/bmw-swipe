import { and, eq } from "drizzle-orm";
import { strFromU8, unzipSync } from "fflate";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { appointments, auditLog, messages, patients, reviewReports, reviews, users, waitlist, type Patient } from "@/db/schema";
import { createPractice } from "@/test/fixtures";
import { audit } from "../audit";
import { encrypt } from "../crypto";
import { newId } from "../ids";
import { heldCommentValue, reportDetailsValue } from "../reviews";
import { recordConsent } from "./consent";
import {
  buildPatientExport,
  EXPORT_SCHEMA_VERSION,
  exportSchemaFields,
  ORG_EXPORT_TABLES,
  orgExportStream,
  patientExportJsonSchema,
  patientExportSchema,
} from "./export";
import { fhirUuid } from "./fhir";
import privacyAdmin from "@/i18n/messages/en/privacyAdmin";

// The dashboard route's session and step-up come from WP6's modules: drive them from the test.
const auth = vi.hoisted(() => ({ session: null as unknown, stepUp: "ok" as "ok" | "required" | "redirect" }));
vi.mock("@/lib/permissions", async (orig) => ({
  ...(await orig<typeof import("@/lib/permissions")>()),
  requirePermission: async () => auth.session,
}));
vi.mock("@/lib/auth", () => ({
  requireStepUp: async () => {
    if (auth.stepUp === "required") throw Object.assign(new Error("Step-up required"), { code: "step_up_required" });
    // What WP6's requireStepUp does in a GET route: redirect to the re-authentication page.
    if (auth.stepUp === "redirect") throw Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/dashboard/account/security/verify?next=%2Fx;307;" });
  },
}));
const { GET: exportRoute } = await import("@/app/dashboard/patients/[id]/export/route");

const NOW = new Date("2030-03-01T09:00:00Z");
const ACTOR = { type: "user" as const, id: "u1" };
let p: Awaited<ReturnType<typeof createPractice>>;
let patient: Patient;
let apptId: string;

beforeAll(async () => {
  p = await createPractice();
  [patient] = await db
    .insert(patients)
    .values({ id: newId(), orgId: p.orgId, firstName: "Jürgen", lastName: "Weiß", email: "j.weiss@example.de", phone: "+4915112345678", birthDate: "1980-02-29", locale: "de", notes: "Angst vor dem Bohrer" })
    .returning();
  apptId = newId();
  const start = new Date("2030-02-10T09:00:00Z");
  await db.insert(appointments).values({
    id: apptId,
    orgId: p.orgId,
    locationId: p.milano,
    practitionerId: p.drA,
    serviceId: p.visit,
    patientId: patient.id,
    startsAt: start,
    endsAt: new Date(start.getTime() + 30 * 60_000),
    blockedUntil: new Date(start.getTime() + 30 * 60_000),
    status: "completed",
    confirmation: "confirmed",
    source: "online",
    manageToken: `h:${apptId}`,
    manageTokenHash: "secret-hash",
    patientNote: "Bitte Deutsch",
  });
  await db.insert(messages).values({ id: newId(), orgId: p.orgId, patientId: patient.id, appointmentId: apptId, channel: "sms", direction: "outbound", to: patient.phone!, body: "Erinnerung an Ihren Termin", status: "sent", provider: "dev" });
  await db.insert(waitlist).values({ id: newId(), orgId: p.orgId, patientId: patient.id, serviceId: p.visit, earliestDate: "2030-03-01", latestDate: "2030-03-31", note: "Morgens" });
  await db.insert(reviews).values({ id: newId(), orgId: p.orgId, practitionerId: p.drA, appointmentId: apptId, rating: 5, comment: "Sehr gut", authorName: "J.", status: "published" });
  await db.transaction((tx) =>
    recordConsent(tx, { orgId: p.orgId, patientId: patient.id, purpose: "feedback_request", granted: true, locale: "de", method: "web_checkbox", source: "booking", now: NOW }),
  );
  await audit({ orgId: p.orgId, actor: { type: "user", id: "u1" }, action: "patient.view", entity: { type: "patient", id: patient.id }, at: NOW });
});

describe("buildPatientExport", () => {
  it("builds a ZIP with patient.json (valid against the schema), CSVs, summary.html and fhir.json", async () => {
    const file = await buildPatientExport(p.orgId, patient.id, { locale: "de", format: "zip", actor: ACTOR, now: NOW });
    expect(file.contentType).toBe("application/zip");
    expect(file.filename).toBe(`patient-${patient.id}-2030-03-01.zip`);
    const zip = unzipSync(file.body);
    expect(Object.keys(zip).sort()).toEqual(
      [
        "patient.json",
        "summary.html",
        "fhir.json",
        "csv/patient.csv",
        "csv/appointments.csv",
        "csv/consents.csv",
        "csv/messages.csv",
        "csv/waitlist.csv",
        "csv/reviews.csv",
        "csv/recalls.csv",
        "csv/forms.csv",
        "csv/privacy_requests.csv",
        "csv/access_log.csv",
      ].sort(),
    );

    const data = JSON.parse(strFromU8(zip["patient.json"]));
    const parsed = patientExportSchema.safeParse(data);
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
    expect(data.schemaVersion).toBe(EXPORT_SCHEMA_VERSION);
    expect(data.schema).toBe("https://sorriso.test/de/developers/export-schema");
    expect(data.patient).toMatchObject({ firstName: "Jürgen", lastName: "Weiß", notes: "Angst vor dem Bohrer" });
    expect(data.appointments[0]).toMatchObject({ id: apptId, patientNote: "Bitte Deutsch", status: "completed" });
    expect(data.messages[0].body).toBe("Erinnerung an Ihren Termin");
    expect(data.consents.map((c: { purpose: string }) => c.purpose)).toEqual(["feedback_request"]);
    expect(data.waitlist[0].note).toBe("Morgens");
    expect(data.reviews[0].comment).toBe("Sehr gut");
    expect(data.accessLog.map((a: { action: string }) => a.action)).toContain("patient.view");
    // No secrets in the export.
    expect(strFromU8(zip["patient.json"])).not.toContain("secret-hash");

    const csv = strFromU8(zip["csv/appointments.csv"]);
    expect(csv.split("\r\n")[0]).toContain("id,start,end,status");
    expect(csv).toContain(apptId);
    expect(strFromU8(zip["csv/recalls.csv"]).replace("﻿", "").trim()).toBe("id,serviceId,dueDate,intervalMonths,status,createdAt");

    const html = strFromU8(zip["summary.html"]);
    expect(html).toMatch(/^<!doctype html>\s*<html lang="de">/);
    expect(html).toContain("Jürgen Weiß");
    expect(html).toContain("garanteprivacy.it");
    expect(html).not.toMatch(/<script|https?:\/\/(?!www\.garanteprivacy)/);

    const fhir = JSON.parse(strFromU8(zip["fhir.json"]));
    expect(fhir.resourceType).toBe("Bundle");
    expect(fhir.type).toBe("collection");
    const types = fhir.entry.map((e: { resource: { resourceType: string } }) => e.resource.resourceType);
    expect(types).toEqual(expect.arrayContaining(["Organization", "Location", "Practitioner", "Patient", "Appointment"]));
    const appt = fhir.entry.find((e: { resource: { resourceType: string } }) => e.resource.resourceType === "Appointment").resource;
    expect(appt.status).toBe("fulfilled");
    expect(appt.participant[0].actor.reference).toBe(`urn:uuid:${fhirUuid("Patient", patient.id)}`);
    expect(appt.participant[1].actor.reference).toBe(`urn:uuid:${fhirUuid("Practitioner", p.drA)}`);
    const fullUrls = new Set(fhir.entry.map((e: { fullUrl: string }) => e.fullUrl));
    for (const part of appt.participant) expect(fullUrls.has(part.actor.reference)).toBe(true);
  });

  it("refuses another practice's patient", async () => {
    const other = await createPractice();
    await expect(buildPatientExport(other.orgId, patient.id, { locale: "it", format: "json", actor: ACTOR })).rejects.toThrow();
  });

  it("documents the schema as JSON Schema", () => {
    const schema = patientExportJsonSchema() as { properties: Record<string, unknown>; required: string[] };
    expect(Object.keys(schema.properties)).toEqual(expect.arrayContaining(["patient", "appointments", "consents", "accessLog"]));
    expect(schema.required).toContain("patient");
  });

  it("has a translatable description for every described field of the documentation page", () => {
    const fields = exportSchemaFields();
    const described = fields.filter((f) => f.description);
    expect(described.length).toBeGreaterThan(20);
    const keys = privacyAdmin.exportSchema.descriptions as Record<string, string>;
    for (const f of described) {
      expect(f.descriptionKey, f.path).toBeTruthy();
      expect(keys[f.descriptionKey!], `privacyAdmin.exportSchema.descriptions.${f.descriptionKey} (${f.path})`).toBeDefined();
    }
    // Shared descriptions (every date and instant) use one key each.
    expect(fields.find((f) => f.path === "generatedAt")?.descriptionKey).toBe("instant");
    expect(fields.find((f) => f.path === "patient.birthDate")?.descriptionKey).toBe("date");
    expect(fields.find((f) => f.path === "accessLog[].actorRole")?.descriptionKey).toBe("accessLogActorRole");
  });
});

/** The practice-wide export, unzipped. */
async function orgExport(orgId: string) {
  const chunks: Uint8Array[] = [];
  const reader = orgExportStream(orgId, { now: NOW }).getReader();
  for (let r = await reader.read(); !r.done; r = await reader.read()) chunks.push(r.value);
  const body = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let offset = 0;
  for (const c of chunks) {
    body.set(c, offset);
    offset += c.length;
  }
  return unzipSync(body);
}

describe("reviews and the access log in exports", () => {
  let q: Awaited<ReturnType<typeof createPractice>>;
  let author: Patient;
  let heldId: string;
  let removedId: string;
  let practiceReport: string;
  let noticeReport: string;

  beforeAll(async () => {
    q = await createPractice();
    [author] = await db.insert(patients).values({ id: newId(), orgId: q.orgId, firstName: "Rita", lastName: "Levi", locale: "it" }).returning();
    const visit = async (day: number) => {
      const id = newId();
      const start = new Date(Date.UTC(2030, 0, day, 9));
      await db.insert(appointments).values({
        id,
        orgId: q.orgId,
        locationId: q.milano,
        practitionerId: q.drA,
        serviceId: q.visit,
        patientId: author.id,
        startsAt: start,
        endsAt: new Date(start.getTime() + 30 * 60_000),
        blockedUntil: new Date(start.getTime() + 30 * 60_000),
        status: "completed",
        source: "online",
        manageToken: `h:${id}`,
      });
      return id;
    };
    const base = { orgId: q.orgId, practitionerId: q.drA, rating: 2, authorName: "R." };
    // Held by the automatic check (encrypted, never shown to the practice) and removed after a report.
    await db.insert(reviews).values({ ...base, id: (heldId = newId()), appointmentId: await visit(5), status: "pending", comment: heldCommentValue("Testo trattenuto di Rita") });
    await db.insert(reviews).values({
      ...base,
      id: (removedId = newId()),
      appointmentId: await visit(6),
      status: "removed",
      comment: heldCommentValue("Testo rimosso di Rita"),
      removedReason: encrypt("Motivazione della rimozione", "reviews.removed_reason"),
      decidedAt: NOW,
    });
    const reporter = newId();
    await db.insert(users).values({ id: reporter, email: `r-${reporter}@example.org`, name: "Reception", passwordHash: "x" });
    await db.insert(reviewReports).values([
      {
        id: (practiceReport = newId()),
        reviewId: removedId,
        orgId: q.orgId,
        reporterUserId: reporter,
        ground: "other",
        details: reportDetailsValue("Segnalazione dello studio"),
        patientResponse: encrypt("Risposta dell'autrice", "review_reports.patient_response"),
        decision: "remove",
        decisionReason: encrypt("Decisione motivata", "review_reports.decision_reason"),
        status: "decided",
        decidedAt: NOW,
      },
      { id: (noticeReport = newId()), reviewId: removedId, orgId: q.orgId, reporterContactHash: "h", ground: "other", details: reportDetailsValue("Segnalazione di un terzo") },
    ]);
    // Accesses filed on something else than the record, naming it in metadata.patientId.
    const staff = { type: "user" as const, id: "u1" };
    await audit({ orgId: q.orgId, actor: staff, action: "waitlist.update", entity: { type: "waitlist", id: newId() }, metadata: { status: "removed", patientId: author.id }, at: NOW });
    await audit({ orgId: q.orgId, actor: staff, action: "message.view", entity: { type: "message", id: newId() }, metadata: { patientId: author.id }, at: NOW });
    await audit({ orgId: q.orgId, actor: { type: "patient_link", id: null }, action: "form.submit", entity: { type: "form_submission", id: newId() }, metadata: { patientId: author.id }, at: NOW });
    await audit({ orgId: q.orgId, actor: staff, action: "message.view", entity: { type: "message", id: newId() }, metadata: { patientId: "someone-else" }, at: NOW });
  });

  const patientJson = async (actor: Parameters<typeof buildPatientExport>[2]["actor"]) =>
    JSON.parse(strFromU8((await buildPatientExport(q.orgId, author.id, { locale: "it", format: "json", actor, now: NOW })).body));

  it("lists accesses filed on waiting-list entries, messages and forms that name the patient", async () => {
    const data = await patientJson(ACTOR);
    const actions = data.accessLog.map((a: { action: string }) => a.action);
    expect(actions).toEqual(expect.arrayContaining(["waitlist.update", "message.view", "form.submit"]));
    expect(actions.filter((a: string) => a === "message.view")).toHaveLength(1);
  });

  it("shows staff the reviews as the practice sees them, and the patient their own text", async () => {
    const staff = await patientJson(ACTOR);
    const byId = (d: { reviews: { id: string }[] }, id: string) => d.reviews.find((r) => r.id === id);
    expect(byId(staff, heldId)).toMatchObject({ comment: null, removedReason: null });
    expect(byId(staff, removedId)).toMatchObject({ comment: null, removedReason: null });
    const own = await patientJson({ type: "patient_session", id: null });
    expect(patientExportSchema.safeParse(own).success).toBe(true);
    expect(byId(own, heldId)).toMatchObject({ comment: "Testo trattenuto di Rita", removedReason: null });
    expect(byId(own, removedId)).toMatchObject({ comment: "Testo rimosso di Rita", removedReason: "Motivazione della rimozione" });
    expect(JSON.stringify(own)).not.toContain("v1:");
  });

  it("decrypts the practice's own review reports in the practice-wide export, and leaves Sorriso's out", async () => {
    const zip = await orgExport(q.orgId);
    const all = Object.values(zip).map((f) => strFromU8(f)).join("\n");
    expect(all).not.toMatch(/"v1:|,v1:/);
    const revs = JSON.parse(strFromU8(zip["json/reviews.json"]));
    expect(revs.find((r: { id: string }) => r.id === heldId)).toMatchObject({ comment: null });
    expect(revs.find((r: { id: string }) => r.id === removedId)).toMatchObject({ comment: null, removedReason: null });
    const reports = JSON.parse(strFromU8(zip["json/review_reports.json"]));
    expect(reports.map((r: { id: string }) => r.id)).toEqual([practiceReport]);
    expect(reports[0]).toMatchObject({ details: "Segnalazione dello studio", decisionReason: "Decisione motivata", patientResponse: null });
    expect(reports[0]).not.toHaveProperty("reporterContactHash");
    expect(all).not.toContain("Segnalazione di un terzo");
    expect(noticeReport).toBeTruthy();
  });
});

describe("orgExportStream", () => {
  it("streams every table as CSV and JSON, a FHIR bundle and a manifest, without secrets", async () => {
    const chunks: Uint8Array[] = [];
    const reader = orgExportStream(p.orgId, { now: NOW }).getReader();
    for (let r = await reader.read(); !r.done; r = await reader.read()) chunks.push(r.value);
    const body = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
    let offset = 0;
    for (const c of chunks) {
      body.set(c, offset);
      offset += c.length;
    }
    const zip = unzipSync(body);
    for (const t of ORG_EXPORT_TABLES) {
      expect(zip[`csv/${t.name}.csv`], t.name).toBeDefined();
      expect(() => JSON.parse(strFromU8(zip[`json/${t.name}.json`]))).not.toThrow();
    }
    const pts = JSON.parse(strFromU8(zip["json/patients.json"]));
    expect(pts.map((x: { id: string }) => x.id)).toContain(patient.id);
    expect(pts.find((x: { id: string }) => x.id === patient.id).notes).toBe("Angst vor dem Bohrer");
    const appts = strFromU8(zip["csv/appointments.csv"]);
    expect(appts).not.toContain("secret-hash");
    const header = (csv: string) => csv.replace("\uFEFF", "").split("\r\n")[0].split(",");
    expect(header(appts)).not.toContain("manageTokenHash");
    expect(header(appts)).not.toContain("manageTokenEnc");
    expect(header(strFromU8(zip["csv/practitioners.csv"]))).not.toContain("icsTokenHash");
    expect(header(strFromU8(zip["csv/api_keys.csv"]))).not.toContain("keyHash");
    const bundle = JSON.parse(strFromU8(zip["fhir/bundle.json"]));
    expect(bundle.resourceType).toBe("Bundle");
    expect(bundle.entry.length).toBeGreaterThan(5);
    const manifest = JSON.parse(strFromU8(zip["manifest.json"]));
    expect(manifest.tables.patients).toBeGreaterThanOrEqual(1);
    // Scoped to the practice.
    const other = await createPractice();
    expect(strFromU8(zip["json/organization.json"])).not.toContain(other.orgId);
  });
});

describe("GET /dashboard/patients/:id/export", () => {
  let ownerId: string;
  beforeEach(async () => {
    if (!ownerId) {
      ownerId = newId();
      await db.insert(users).values({ id: ownerId, email: `o-${ownerId}@example.org`, name: "Owner", passwordHash: "x" });
    }
    auth.session = { user: { id: ownerId }, org: { id: p.orgId }, role: "owner" };
    auth.stepUp = "ok";
  });
  const call = (id = patient.id, accept = "application/zip") =>
    exportRoute(new Request(`https://sorriso.test/dashboard/patients/${id}/export`, { headers: { accept } }), { params: Promise.resolve({ id }) });
  const exportsLogged = async () =>
    (await db.select().from(auditLog).where(and(eq(auditLog.action, "patient.export"), eq(auditLog.entityId, patient.id), eq(auditLog.actorId, ownerId)))).length;

  it("fails with step_up_required without a recent second factor, and logs nothing", async () => {
    auth.stepUp = "required";
    const res = await call();
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: { code: "step_up_required" } });
    expect(await exportsLogged()).toBe(0);
  });

  it("answers step_up_required to a script when step-up redirects, and lets a browser follow the redirect", async () => {
    auth.stepUp = "redirect";
    const res = await call();
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: { code: "step_up_required", verify: "/dashboard/account/security/verify?next=%2Fx" } });
    await expect(call(patient.id, "text/html")).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_REDIRECT") });
    expect(await exportsLogged()).toBe(0);
  });

  it("downloads the ZIP and logs patient.export", async () => {
    const res = await call();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/zip");
    expect(res.headers.get("content-disposition")).toContain(`patient-${patient.id}-`);
    expect(res.headers.get("cache-control")).toContain("no-store");
    const zip = unzipSync(new Uint8Array(await res.arrayBuffer()));
    expect(zip["patient.json"]).toBeDefined();
    expect(await exportsLogged()).toBe(1);
  });

  it("is 404 for another practice's patient", async () => {
    const other = await createPractice();
    auth.session = { user: { id: ownerId }, org: { id: other.orgId }, role: "owner" };
    expect((await call()).status).toBe(404);
  });
});

describe("step-up redirect from WP6's requireStepUp in a GET route", () => {
  it("answers 403 step_up_required to a script and lets a navigation follow the redirect", async () => {
    const { stepUpRedirect, wantsHtml } = await import("./gates");
    const redirect = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/dashboard/account/security/verify?next=%2Fdashboard;307;" });
    expect(stepUpRedirect(redirect)).toBe("/dashboard/account/security/verify?next=%2Fdashboard");
    expect(stepUpRedirect(Object.assign(new Error("x"), { digest: "NEXT_REDIRECT;replace;/login;307;" }))).toBeNull();
    expect(stepUpRedirect(new Error("boom"))).toBeNull();
    expect(wantsHtml(new Request("https://x.test", { headers: { accept: "text/html,application/xhtml+xml" } }))).toBe(true);
    expect(wantsHtml(new Request("https://x.test", { headers: { accept: "application/zip" } }))).toBe(false);
  });
});
