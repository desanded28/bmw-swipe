import { and, eq } from "drizzle-orm";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ManageAppointment } from "@/components/booking/ManageAppointment";
import { db } from "@/db";
import { appointments, auditLog, organizations, patients } from "@/db/schema";
import { LOCALES } from "@/i18n/config";
import { newId } from "@/lib/ids";
import { issueManageToken } from "@/lib/links";
import { createPractice, MONDAY } from "@/test/fixtures";

/** The request the page sees: next/headers is mocked, everything else is real (database included). */
let requestHeaders = new Headers();
vi.mock("next/headers", () => ({
  headers: async () => requestHeaders,
  cookies: async () => ({ get: () => undefined }),
}));

const { default: ManagePage, generateMetadata } = await import("./page");

let ipCounter = 0;
beforeEach(() => {
  // A fresh client per test: rate limits are counted per network.
  ipCounter += 1;
  requestHeaders = new Headers({ "x-real-ip": `198.51.100.${ipCounter}`, "user-agent": "Mozilla/5.0 (X11; Linux x86_64) Firefox/131.0" });
});

async function appointmentWithToken(opts: { endsDaysAgo?: number } = {}) {
  const p = await createPractice();
  await db.update(organizations).set({ name: "Studio Riservato" }).where(eq(organizations.id, p.orgId));
  const patientId = newId();
  await db.insert(patients).values({ id: patientId, orgId: p.orgId, firstName: "Ottavia", lastName: "Segreti", phone: "+393331112299", locale: "it" });
  const id = newId();
  const { token, hash } = issueManageToken();
  const startsAt = opts.endsDaysAgo ? new Date(Date.now() - opts.endsDaysAgo * 86_400_000 - 30 * 60_000) : new Date(`${MONDAY}T08:00:00Z`);
  const endsAt = new Date(startsAt.getTime() + 30 * 60_000);
  await db.insert(appointments).values({
    id,
    orgId: p.orgId,
    locationId: p.milano,
    practitionerId: p.drA,
    roomId: p.chair1,
    serviceId: p.visit,
    patientId,
    startsAt,
    endsAt,
    blockedUntil: endsAt,
    source: "online",
    status: opts.endsDaysAgo ? "completed" : "scheduled",
    manageToken: `h:${id}`,
    manageTokenHash: hash,
    manageTokenEnc: token,
  });
  return { token, id, orgId: p.orgId };
}

const open = (token: string, locale = "it", query: { do?: string } = {}) =>
  ManagePage({ params: Promise.resolve({ locale, token }), searchParams: Promise.resolve(query) });

const html = (node: ReactNode) => renderToStaticMarkup(node as ReactElement);

/** Depth-first search of a server component's element tree (without rendering async children). */
function findElement(node: ReactNode, type: unknown): ReactElement<Record<string, unknown>> | null {
  if (Array.isArray(node)) {
    for (const n of node) {
      const hit = findElement(n, type);
      if (hit) return hit;
    }
    return null;
  }
  if (!isValidElement(node)) return null;
  if (node.type === type) return node as ReactElement<Record<string, unknown>>;
  return findElement((node.props as { children?: ReactNode }).children, type);
}

describe("/[locale]/a/[token]", () => {
  it("shows a generic page for an unknown token, with nothing about any practice or patient", async () => {
    await createPractice();
    const page = html(await open(issueManageToken().token));
    expect(page).toContain("This link doesn&#x27;t work");
    expect(page).not.toMatch(/Studio|Ottavia|Segreti/);
    expect(html(await open("not a token"))).toContain("This link doesn&#x27;t work");
  });

  it("shows a generic page for an expired link, distinct from an unknown one", async () => {
    const { token } = await appointmentWithToken({ endsDaysAgo: 90 });
    const page = html(await open(token));
    expect(page).toContain("This link has expired");
    expect(page).not.toMatch(/Studio Riservato|Ottavia|Segreti/);
  });

  it("renders the appointment for a valid link and audits the view as the patient link", async () => {
    const { token, id, orgId } = await appointmentWithToken();
    const tree = await open(token, "de", { do: "confirm" });
    const manage = findElement(tree, ManageAppointment);
    expect(manage).not.toBeNull();
    expect((manage!.props.data as { token: string }).token).toBe(token);
    expect(manage!.props.initialPanel).toBe("confirm");
    const rows = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.orgId, orgId), eq(auditLog.entityId, id), eq(auditLog.action, "appointment.view")));
    expect(rows).toHaveLength(1);
    expect(rows[0].actorType).toBe("patient_link");
    expect(rows[0].ipHash).toBeTruthy();
  });

  it("answers the 31st request from one network within 10 minutes with the rate-limit page", async () => {
    const { token } = await appointmentWithToken();
    for (let i = 0; i < 30; i++) expect(findElement(await open(token), ManageAppointment)).not.toBeNull();
    const page = html(await open(token));
    expect(page).toContain("Too many requests");
    expect(page).not.toMatch(/Studio Riservato|Ottavia/);
    // Another network is unaffected.
    requestHeaders = new Headers({ "x-real-ip": "192.0.2.77" });
    expect(html(await open(issueManageToken().token))).not.toContain("Too many requests");
  });

  it("gives link-preview bots a page without data, outside the rate limit", async () => {
    const { token } = await appointmentWithToken();
    requestHeaders = new Headers({ "x-real-ip": "203.0.113.9", "user-agent": "WhatsApp/2.24.1 A" });
    for (let i = 0; i < 40; i++) {
      const page = html(await open(token));
      expect(page).toContain("Open this link in your browser");
      expect(page).not.toMatch(/Studio Riservato|Ottavia/);
    }
  });

  it("has generic, noindex, no-referrer metadata with every language alternate", async () => {
    const { token } = await appointmentWithToken();
    const meta = await generateMetadata({ params: Promise.resolve({ locale: "fr", token }) });
    expect(meta.title).toBe("Your appointment");
    expect(JSON.stringify(meta)).not.toMatch(/Studio Riservato|Ottavia/);
    expect(meta.robots).toMatchObject({ index: false, follow: false });
    expect(meta.referrer).toBe("no-referrer");
    const languages = meta.alternates?.languages as Record<string, string>;
    expect(Object.keys(languages).sort()).toEqual([...LOCALES, "x-default"].sort());
    expect(languages["x-default"]).toBe(`/a/${token}`);
  });
});
