import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { messages, patients, type Patient } from "@/db/schema";
import { newId } from "@/lib/ids";
import { withdrawConsent } from "@/lib/privacy/consent";
import { createPractice, NOW } from "@/test/fixtures";
import { sendPatientMessage } from "./index";

/**
 * Every patient-facing namespace is still empty, so the texts come from a fake dictionary.
 * The kinds are cast: PatientMessageKind only knows the kinds of the real English files.
 */
const DICT: Record<string, Record<string, string>> = {
  recall: {
    subject: "Time for a check-up at {clinic}",
    body: "It's been a while. Book your check-up at {clinic}.",
    cta: "Book now",
    sms: "{clinic}: time for a check-up. Book: {url}",
  },
  emailOnly: { subject: "Receipt from {clinic}", body: "We received your request." },
  smsOnly: { sms: "{clinic}: your practice has moved." },
};

vi.mock("@/i18n/t", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/i18n/t")>()),
  getT: () => {
    const lookup = (key: string) => {
      const [kind, leaf] = key.split(".");
      return DICT[kind]?.[leaf];
    };
    const t = (key: string, vars: Record<string, string | number> = {}) =>
      (lookup(key) ?? key).replace(/\{(\w+)\}/g, (_, v: string) => String(vars[v] ?? `{${v}}`));
    return Object.assign(t, { has: (key: string) => lookup(key) !== undefined });
  },
}));

let orgId: string;

async function makePatient(values: Partial<typeof patients.$inferInsert> = {}): Promise<Patient> {
  const id = newId();
  await db.insert(patients).values({
    id,
    orgId,
    firstName: "Giulia",
    lastName: "Rossi",
    phone: "+393331112222",
    email: "giulia@example.com",
    birthDate: "1990-05-01",
    ...values,
  });
  const [p] = await db.select().from(patients).where(eq(patients.id, id));
  return p;
}

const send = (patient: Patient, kind: string, extra: Record<string, unknown> = {}) =>
  sendPatientMessage({
    orgId,
    patient,
    ns: "careMessages",
    kind: kind as never,
    vars: { clinic: "Studio Test", url: "https://sorriso.test/b" } as never,
    url: "https://sorriso.test/b",
    now: NOW,
    ...extra,
  });

beforeAll(async () => {
  ({ orgId } = await createPractice());
});

describe("sendPatientMessage", () => {
  it("texts an SMS patient and logs the message against the patient", async () => {
    const p = await makePatient();
    const res = await send(p, "recall");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.message).toMatchObject({ channel: "sms", to: "+393331112222", orgId, patientId: p.id });
    expect(res.message.body).toBe("Studio Test: time for a check-up. Book: https://sorriso.test/b");
    const [row] = await db.select().from(messages).where(eq(messages.id, res.message.id));
    expect(row.patientId).toBe(p.id);
  });

  it("emails a patient who prefers email, with the button opening `url`", async () => {
    const p = await makePatient({ preferredChannel: "email" });
    const res = await send(p, "recall");
    expect(res.ok && res.message).toMatchObject({
      channel: "email",
      to: "giulia@example.com",
      subject: "Time for a check-up at Studio Test",
    });
    if (!res.ok) return;
    expect(res.message.html).toContain('href="https://sorriso.test/b"');
    expect(res.message.html).toContain("Book now");
    expect(res.message.body).toContain("Book your check-up at Studio Test.");
  });

  it("falls back to the channel the kind has texts for", async () => {
    const p = await makePatient();
    const res = await send(p, "emailOnly");
    expect(res.ok && res.message.channel).toBe("email");
  });

  it("reports no_template when the patient is reachable only where the kind has no text", async () => {
    const p = await makePatient({ phone: null });
    expect(await send(p, "smsOnly")).toEqual({ ok: false, reason: "no_template" });
  });

  it("reports unreachable without an opted-in contact", async () => {
    const p = await makePatient({ smsOptIn: false, emailOptIn: false });
    expect(await send(p, "recall")).toEqual({ ok: false, reason: "unreachable" });
  });

  it("skips restricted patients and withdrawn purposes", async () => {
    const restricted = await makePatient({ restrictedAt: NOW });
    expect(await send(restricted, "recall")).toEqual({ ok: false, reason: "restricted" });

    const objected = await makePatient();
    await withdrawConsent(db, {
      orgId,
      patientId: objected.id,
      purpose: "recalls",
      locale: "it",
      method: "staff_recorded",
      source: "staff",
    });
    expect(await send(objected, "recall", { purpose: "recalls" })).toEqual({ ok: false, reason: "not_allowed" });
    expect((await send(await makePatient(), "recall", { purpose: "recalls" })).ok).toBe(true);
  });

  it("writes to the guardian of a child under 14", async () => {
    const child = await makePatient({
      birthDate: "2022-01-01",
      phone: null,
      email: null,
      guardianName: "Maria Rossi",
      guardianPhone: "+393339998888",
    });
    const res = await send(child, "recall");
    expect(res.ok && res.message).toMatchObject({ channel: "sms", to: "+393339998888", patientId: child.id });
  });

  it("refuses a patient of another practice", async () => {
    const p = await makePatient();
    await expect(send({ ...p, orgId: "another-org" }, "recall")).rejects.toThrow(/another practice/);
  });
});
