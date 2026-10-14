import { createHmac } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { messages, organizations } from "@/db/schema";
import { createPractice, NOW } from "@/test/fixtures";
import { newId } from "../ids";
import { purgeProviderCopies } from "../reminders";
import { deliver } from "./index";
import { deleteProviderMessage, sendSms, twilioSmsBaseUrl } from "./providers";
import { chooseTextChannel, hasWhatsAppTemplate, sendWhatsApp, whatsappVariables } from "./whatsapp";

/** Provider hygiene: Twilio's EU edge for SMS, deletion of provider copies, redacted errors, clean logs. */

const PHONE = "+393331234567";
const SID = (n: number) => `SM${n.toString(16).padStart(32, "0")}`;

const calls: { url: string; method: string; body: string; auth: string | null }[] = [];
let reply: (url: string, method: string) => Response = () => new Response(JSON.stringify({ sid: SID(1) }), { status: 201 });
const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  const method = init?.method ?? "GET";
  calls.push({ url, method, body: String(init?.body ?? ""), auth: new Headers(init?.headers).get("authorization") });
  return reply(url, method);
});

const logLines: string[] = [];
const spies = [process.stdout, process.stderr].map((s) =>
  vi.spyOn(s, "write").mockImplementation((chunk: string | Uint8Array) => {
    logLines.push(String(chunk));
    return true;
  }),
);
afterAll(() => spies.forEach((s) => s.mockRestore()));

function ie1() {
  vi.stubEnv("TWILIO_ACCOUNT_SID", "ACtest");
  vi.stubEnv("TWILIO_REGION", "ie1");
  vi.stubEnv("TWILIO_EDGE", "dublin");
  vi.stubEnv("TWILIO_IE1_API_KEY_SID", "SKie1");
  vi.stubEnv("TWILIO_IE1_API_KEY_SECRET", "ie1-secret");
  vi.stubEnv("TWILIO_US1_AUTH_TOKEN", "us1-token");
  vi.stubEnv("TWILIO_FROM", "+390200000000");
  vi.stubEnv("TWILIO_WHATSAPP_FROM", "+14155238886");
  vi.stubEnv("MESSAGING_ALLOWLIST", PHONE);
}

let orgId: string;
beforeAll(async () => {
  ({ orgId } = await createPractice());
});
beforeEach(() => {
  calls.length = 0;
  reply = () => new Response(JSON.stringify({ sid: SID(1) }), { status: 201 });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Twilio regions", () => {
  it("sends SMS through the IE1 Dublin edge with the IE1 API key, WhatsApp through the default region", async () => {
    ie1();
    expect(twilioSmsBaseUrl()).toBe("https://api.dublin.ie1.twilio.com");
    const sms = await sendSms({ to: PHONE, text: "Promemoria" });
    expect(sms).toMatchObject({ status: "sent", provider: "twilio:ie1", providerId: SID(1) });
    expect(calls[0].url.startsWith("https://api.dublin.ie1.twilio.com/2010-04-01/Accounts/ACtest/Messages.json")).toBe(true);
    expect(calls[0].auth).toBe(`Basic ${Buffer.from("SKie1:ie1-secret").toString("base64")}`);
    expect(new URLSearchParams(calls[0].body).get("StatusCallback")).toBe("https://sorriso.test/api/webhooks/twilio/status");

    vi.stubEnv("TWILIO_WHATSAPP_CONTENT_SIDS", JSON.stringify({ reminder: { it: `HX${"b".repeat(32)}` } }));
    const wa = await sendWhatsApp({ to: PHONE, kind: "reminder", locale: "it", variables: { "1": "Giulia" } });
    expect(wa).toMatchObject({ status: "sent", provider: "twilio" });
    expect(calls[1].url.startsWith("https://api.twilio.com/")).toBe(true);
    expect(calls[1].auth).toBe(`Basic ${Buffer.from("ACtest:us1-token").toString("base64")}`);
    const params = new URLSearchParams(calls[1].body);
    expect(params.get("ContentSid")).toBe(`HX${"b".repeat(32)}`);
    expect(params.get("To")).toBe(`whatsapp:${PHONE}`);
    expect(params.get("Body")).toBeNull();
  });

  it("sends a practice's texts from its own number or Messaging Service, so replies come back to it", async () => {
    ie1();
    const service = `MG${"d".repeat(32)}`;
    await db.update(organizations).set({ inboundNumber: service }).where(eq(organizations.id, orgId));
    const msg = await deliver({ orgId, channel: "sms", to: PHONE, text: "Promemoria" });
    expect(msg.status).toBe("sent");
    expect(new URLSearchParams(calls[0].body).get("MessagingServiceSid")).toBe(service);
    await db.update(organizations).set({ inboundNumber: "+390200000777" }).where(eq(organizations.id, orgId));
    await deliver({ orgId, channel: "sms", to: PHONE, text: "Promemoria" });
    expect(new URLSearchParams(calls[1].body).get("From")).toBe("+390200000777");
    await db.update(organizations).set({ inboundNumber: null }).where(eq(organizations.id, orgId));
    await deliver({ orgId, channel: "sms", to: PHONE, text: "Promemoria" });
    expect(new URLSearchParams(calls[2].body).get("From")).toBe("+390200000000");
  });

  it("uses the default endpoint without a region", () => {
    vi.stubEnv("TWILIO_REGION", "");
    expect(twilioSmsBaseUrl()).toBe("https://api.twilio.com");
  });

  it("captures instead of sending to anyone off the allowlist outside the live deployment", async () => {
    ie1();
    vi.stubEnv("MESSAGING_ALLOWLIST", "+393339999999");
    expect(await sendSms({ to: PHONE, text: "x" })).toMatchObject({ status: "captured", provider: "allowlist" });
    vi.stubEnv("DEMO_MODE", "1");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("MESSAGING_LIVE", "1");
    expect(await sendSms({ to: PHONE, text: "x" })).toMatchObject({ status: "captured", provider: "allowlist" });
    expect(calls).toHaveLength(0);
  });
});

describe("WhatsApp templates", () => {
  it("skips a kind without an approved template in the patient's language", async () => {
    ie1();
    vi.stubEnv("TWILIO_WHATSAPP_CONTENT_SIDS", JSON.stringify({ reminder: { it: `HX${"c".repeat(32)}` } }));
    expect(hasWhatsAppTemplate("reminder", "it")).toBe(true);
    expect(hasWhatsAppTemplate("reminder", "en")).toBe(false);
    expect(await sendWhatsApp({ to: PHONE, kind: "reminder", locale: "en", variables: {} })).toEqual({ status: "skipped", reason: "no_template" });
    expect(calls).toHaveLength(0);
  });

  it("chooses WhatsApp only with the practice setting, the consent and a template", async () => {
    vi.stubEnv("TWILIO_WHATSAPP_CONTENT_SIDS", JSON.stringify({ reminder: { it: `HX${"c".repeat(32)}` } }));
    const patient = {
      id: "nobody",
      firstName: "Giulia",
      email: null,
      phone: PHONE,
      locale: "it" as const,
      emailOptIn: true,
      smsOptIn: true,
      preferredChannel: "whatsapp" as const,
      guardianName: null,
      guardianPhone: null,
      guardianEmail: null,
      birthDate: null,
      restrictedAt: null,
      erasedAt: null,
    };
    // No whatsapp_channel grant in the ledger for this patient: SMS.
    expect(await chooseTextChannel(patient, { whatsappEnabled: true }, { kind: "reminder" })).toBe("sms");
    expect(await chooseTextChannel(patient, { whatsappEnabled: false }, { kind: "reminder" })).toBe("sms");
    expect(await chooseTextChannel({ ...patient, smsOptIn: false }, { whatsappEnabled: false }, { kind: "reminder" })).toBeNull();
  });

  it("puts only discreet variables in a template", () => {
    expect(whatsappVariables({ name: " Giulia\n", date: "mer 16 set\talle 10:30", clinic: "Studio", link: "https://sorriso.test/a/x" })).toEqual({
      "1": "Giulia",
      "2": "mer 16 set alle 10:30",
      "3": "Studio",
      "4": "https://sorriso.test/a/x",
    });
  });
});

describe("provider copies", () => {
  it("deletes a Twilio message in the region it went through; a message already gone is fine", async () => {
    ie1();
    reply = () => new Response(null, { status: 204 });
    await deleteProviderMessage("twilio:ie1", SID(2));
    expect(calls[0]).toMatchObject({ method: "DELETE", url: `https://api.dublin.ie1.twilio.com/2010-04-01/Accounts/ACtest/Messages/${SID(2)}.json` });
    await deleteProviderMessage("twilio", SID(3));
    expect(calls[1].url).toBe(`https://api.twilio.com/2010-04-01/Accounts/ACtest/Messages/${SID(3)}.json`);
    reply = () => new Response(JSON.stringify({ message: "not found", code: 20404 }), { status: 404 });
    await expect(deleteProviderMessage("twilio", SID(4))).resolves.toBeUndefined();
    // Nothing to delete for email or captured messages.
    await deleteProviderMessage("smtp", "<id@smtp>");
    await deleteProviderMessage("dev", SID(5));
    expect(calls).toHaveLength(3);
  });

  it("throws when Twilio refuses, so the copy is not marked deleted", async () => {
    ie1();
    reply = () => new Response(JSON.stringify({ message: "Cannot delete message in progress", code: 20009 }), { status: 400 });
    await expect(deleteProviderMessage("twilio:ie1", SID(6))).rejects.toThrow(/Twilio 400/);
  });

  it("the reminders cron deletes copies older than the practice's retention and marks them", async () => {
    ie1();
    await db
      .update(organizations)
      .set({ settings: { privacy: { retention: { providerMessageDays: 7 } } } })
      .where(eq(organizations.id, orgId));
    const old = new Date(NOW.getTime() - 8 * 86_400_000);
    const fresh = new Date(NOW.getTime() - 2 * 86_400_000);
    const row = (createdAt: Date, providerId: string, provider = "twilio:ie1") => ({
      id: newId(),
      orgId,
      channel: "sms" as const,
      direction: "outbound" as const,
      to: PHONE,
      body: "x",
      status: "delivered" as const,
      provider,
      providerId,
      createdAt,
    });
    const rows = [row(old, SID(10)), row(fresh, SID(11)), row(old, SID(12), "dev")];
    await db.insert(messages).values(rows);
    reply = () => new Response(null, { status: 204 });
    const summary = await purgeProviderCopies(NOW);
    expect(summary.deleted).toBeGreaterThanOrEqual(1);
    const get = async (id: string) => (await db.select().from(messages).where(eq(messages.id, id)))[0];
    expect((await get(rows[0].id)).providerDeletedAt).not.toBeNull();
    expect((await get(rows[1].id)).providerDeletedAt).toBeNull();
    expect((await get(rows[2].id)).providerDeletedAt).toBeNull();
    expect(calls.some((c) => c.url.endsWith(`${SID(10)}.json`))).toBe(true);
  });
});

describe("status webhook", () => {
  it("records the final status time", async () => {
    vi.stubEnv("TWILIO_AUTH_TOKEN", "tok");
    const id = newId();
    await db.insert(messages).values({ id, orgId, channel: "sms", direction: "outbound", to: PHONE, body: "x", status: "sent", provider: "twilio", providerId: SID(20) });
    const params = { MessageSid: SID(20), MessageStatus: "delivered", To: PHONE };
    const url = "https://sorriso.test/api/webhooks/twilio/status";
    const signature = createHmac("sha1", "tok")
      .update(Object.keys(params).sort().reduce((acc, k) => acc + k + params[k as keyof typeof params], url))
      .digest("base64");
    const { POST } = await import("@/app/api/webhooks/twilio/status/route");
    const res = await POST(new Request(url, { method: "POST", headers: { "x-twilio-signature": signature }, body: new URLSearchParams(params) }));
    expect(res.status).toBe(204);
    const [m] = await db.select().from(messages).where(eq(messages.id, id));
    expect(m.status).toBe("delivered");
    expect(m.finalStatusAt).not.toBeNull();
    const bad = await POST(new Request(url, { method: "POST", headers: { "x-twilio-signature": "nope" }, body: new URLSearchParams(params) }));
    expect(bad.status).toBe(403);
  });
});

describe("errors and logs", () => {
  it("stores provider errors redacted and never logs a phone number or an email", async () => {
    ie1();
    reply = () =>
      new Response(JSON.stringify({ message: `The 'To' number ${PHONE} is not valid (contact giulia@example.com)`, code: 21211 }), { status: 400 });
    const msg = await deliver({ orgId, channel: "sms", to: PHONE, text: "Promemoria" });
    expect(msg.status).toBe("failed");
    expect(msg.error).toContain("Twilio 400");
    expect(msg.error).not.toContain(PHONE);
    expect(msg.error).not.toContain("giulia@example.com");
    const text = logLines.join("");
    expect(text).toContain("[messaging]");
    expect(text).not.toMatch(/\+\d{8,15}/);
    expect(text).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z]{2,}/);
  });
});
