import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { db } from "@/db";
import { appointments, patients } from "@/db/schema";
import type { Locale } from "@/i18n/config";
import { newId } from "@/lib/ids";
import { issueManageToken } from "@/lib/links";
import { createPractice, MONDAY } from "@/test/fixtures";
import { GET as tokenGET } from "./[token]/route";
import { GET as restGET } from "./[token]/[...rest]/route";

const ORIGIN = "https://sorriso.test";

/** An appointment whose patient booked in `locale`, reachable by the returned manage token. */
async function appointmentWithToken(locale: Locale) {
  const p = await createPractice();
  const patientId = newId();
  await db
    .insert(patients)
    .values({ id: patientId, orgId: p.orgId, firstName: "Ada", lastName: "Neri", phone: "+393331112223", locale });
  const id = newId();
  const { token, hash } = issueManageToken();
  const startsAt = new Date(`${MONDAY}T08:00:00Z`);
  const endsAt = new Date(`${MONDAY}T08:30:00Z`);
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
    manageToken: `h:${id}`,
    manageTokenHash: hash,
    manageTokenEnc: token,
  });
  return token;
}

function request(path: string, opts: { cookie?: string; acceptLanguage?: string } = {}) {
  const headers = new Headers();
  if (opts.cookie) headers.set("cookie", opts.cookie);
  if (opts.acceptLanguage) headers.set("accept-language", opts.acceptLanguage);
  return new NextRequest(`${ORIGIN}${path}`, { headers });
}

const open = (token: string, opts?: Parameters<typeof request>[1]) =>
  tokenGET(request(`/a/${token}`, opts), { params: Promise.resolve({ token }) });

function expectRedirect(res: Response, to: string) {
  expect(res.status).toBe(307);
  expect(res.headers.get("location")).toBe(`${ORIGIN}${to}`);
  expect(res.headers.get("cache-control")).toBe("private, no-store");
  expect(res.headers.get("referrer-policy")).toBe("no-referrer");
}

describe("legacy /a/<token> links", () => {
  it("redirect to the language the patient booked in, ahead of the browser's", async () => {
    const token = await appointmentWithToken("de");
    expectRedirect(await open(token, { acceptLanguage: "fr-FR,fr;q=0.9" }), `/de/a/${token}`);
    expectRedirect(await open(token), `/de/a/${token}`);
  });

  it("let an explicit choice (cookie) win", async () => {
    const token = await appointmentWithToken("de");
    expectRedirect(await open(token, { cookie: "NEXT_LOCALE=pl", acceptLanguage: "fr" }), `/pl/a/${token}`);
    // Not a locale: ignored.
    expectRedirect(await open(token, { cookie: "NEXT_LOCALE=xx", acceptLanguage: "fr" }), `/de/a/${token}`);
  });

  it("keep the rest of the path and the query", async () => {
    const token = await appointmentWithToken("ro");
    const res = await restGET(request(`/a/${token}/review?rating=5`, { acceptLanguage: "en" }), {
      params: Promise.resolve({ token, rest: ["review"] }),
    });
    expectRedirect(res, `/ro/a/${token}/review?rating=5`);
    expectRedirect(await open(token, { cookie: "NEXT_LOCALE=en" }), `/en/a/${token}`);
  });

  it("send unknown or malformed tokens to the negotiated language", async () => {
    await createPractice(); // migrated database, no matching appointment
    const unknown = issueManageToken().token;
    expectRedirect(await open(unknown, { acceptLanguage: "de-CH,de;q=0.9" }), `/de/a/${unknown}`);
    expectRedirect(await open(unknown), `/it/a/${unknown}`);
    expectRedirect(await open(unknown, { acceptLanguage: "zh-CN" }), `/it/a/${unknown}`);
    expectRedirect(await open("short", { acceptLanguage: "es" }), "/es/a/short");
    expectRedirect(await open(unknown, { cookie: "NEXT_LOCALE=pt", acceptLanguage: "de" }), `/pt/a/${unknown}`);
  });
});
