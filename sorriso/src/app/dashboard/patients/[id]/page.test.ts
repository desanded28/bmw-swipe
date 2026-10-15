import { eq } from "drizzle-orm";
import { isValidElement, type ReactNode } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { messages, organizations, patients, users } from "@/db/schema";
import type { StaffSession } from "@/lib/auth";
import { newId } from "@/lib/ids";
import { createPractice } from "@/test/fixtures";

const state = vi.hoisted(() => ({ session: null as StaffSession | null }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-real-ip": "203.0.113.10" }), cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/auth", async (orig) => ({
  ...(await orig<typeof import("@/lib/auth")>()),
  requireStaff: async () => {
    if (!state.session) throw new Error("no session in test");
    return state.session;
  },
}));

const { default: PatientPage } = await import("./page");

/** Every string in a rendered tree (server output; client components are not run). */
function texts(node: ReactNode): string[] {
  if (typeof node === "string") return [node];
  if (Array.isArray(node)) return node.flatMap(texts);
  if (isValidElement(node)) return texts((node.props as { children?: ReactNode }).children);
  return [];
}

let orgId: string;
let patientId: string;

beforeAll(async () => {
  ({ orgId } = await createPractice());
  const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
  const userId = newId();
  await db.insert(users).values({ id: userId, email: `owner-${userId}@example.org`, name: "Owner", passwordHash: "x" });
  state.session = { sessionId: "s1", user: { id: userId, name: "Owner", email: "x@example.org", isPlatformAdmin: false, locale: "en" }, org, role: "owner", orgs: [{ org, role: "owner" }] };
  patientId = newId();
  await db.insert(patients).values({ id: patientId, orgId, firstName: "Ada", lastName: "Link", phone: "+393330001122", locale: "it" });
  await db.insert(messages).values({
    id: newId(),
    orgId,
    patientId,
    channel: "sms",
    direction: "outbound",
    to: "+393330001122",
    body: "Studio Test: fill in the form: https://sorriso.test/a/SECRETtoken1234567890/forms/anamnesis and see https://example.org/info",
    status: "captured",
    provider: "dev",
  });
});

describe("patient record: message log", () => {
  it("shows sent texts without the patient's personal links (staff get those only through the audited link action)", async () => {
    const out = texts(await PatientPage({ params: Promise.resolve({ id: patientId }), searchParams: Promise.resolve({}) })).join(" ");
    expect(out).toContain("fill in the form: [patient link]");
    expect(out).toContain("https://example.org/info");
    expect(out).not.toContain("SECRETtoken1234567890");
  });
});
