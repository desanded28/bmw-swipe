import { desc, eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { messages, verificationCodes } from "@/db/schema";
import { migrateOnce } from "@/test/fixtures";
import { contactHash } from "./contact";
import { OTP_MAX_FAILURES, OTP_TTL_MS, sendOtp, verifyOtp } from "./otp";

// Capture what would reach the provider; the message log must not hold the same text.
const sent: { to: string; text: string }[] = [];
vi.mock("./messaging/providers", () => ({
  providerStatus: () => ({ email: "captured", sms: "captured", whatsapp: "captured" }),
  sendSms: async (i: { to: string; text: string }) => {
    sent.push(i);
    return { status: "captured", provider: "dev", providerId: null, from: null };
  },
  sendEmail: async (i: { to: string; text: string }) => {
    sent.push(i);
    return { status: "captured", provider: "dev", providerId: null, from: null };
  },
  sendWhatsApp: async () => ({ status: "captured", provider: "dev", providerId: null, from: null }),
}));

beforeAll(migrateOnce);
beforeEach(() => {
  sent.length = 0;
});

let seq = 3310000000;
const phone = () => `+39${seq++}`;
// A fresh client address per call unless a test shares one on purpose.
let ipSeq = 0;
const visitor = () => new Headers({ "x-real-ip": `203.0.${Math.floor(ipSeq / 250)}.${(ipSeq++ % 250) + 1}` });
const NOW = new Date("2030-03-01T09:00:00Z");
const at = (ms: number) => new Date(NOW.getTime() + ms);
const MIN = 60_000;
const DAY = 24 * 60 * MIN;
const codeIn = (text: string) => text.match(/\b\d{6}\b/)![0];
const otp = (to: string, now: Date, headers = visitor()) =>
  sendOtp({ purpose: "privacy_center", channel: "sms", to, locale: "en", headers, now });

async function send(to = phone(), now = NOW) {
  const r = await otp(to, now);
  if (!r.ok) throw new Error("rate limited");
  return { to, challengeId: r.challengeId, code: codeIn(sent.at(-1)!.text) };
}

const wrongFor = (code: string) => (code === "000000" ? "111111" : "000000");

describe("sendOtp", () => {
  it("sends a 6-digit code and stores only its HMAC and a redacted body", async () => {
    const { to, challengeId, code } = await send();
    expect(sent.at(-1)!.text).toContain(code);

    const [row] = await db.select().from(verificationCodes).where(eq(verificationCodes.id, challengeId));
    expect(row.targetHash).toBe(contactHash("phone", to));
    expect(row.expiresAt.getTime() - NOW.getTime()).toBe(OTP_TTL_MS);
    expect(JSON.stringify(row)).not.toContain(code);

    const [msg] = await db.select().from(messages).where(eq(messages.to, to)).orderBy(desc(messages.createdAt));
    expect(msg.body).not.toContain(code);
    expect(msg.body).toContain("••••••");
    expect(msg.patientId).toBeNull();
  });

  it("redacts email codes and does not store an HTML part", async () => {
    const r = await sendOtp({ purpose: "contact_change", channel: "email", to: "Otp.Test@Example.com", locale: "it", headers: visitor(), now: NOW });
    expect(r.ok).toBe(true);
    const code = codeIn(sent.at(-1)!.text);
    expect(sent.at(-1)!.to).toBe("otp.test@example.com");
    const [msg] = await db.select().from(messages).where(eq(messages.to, "otp.test@example.com"));
    expect(msg.subject).toBeTruthy();
    expect(msg.body).not.toContain(code);
    expect(msg.html).toBeNull();
  });

  it("allows 3 codes per contact per 15 minutes", async () => {
    const to = phone();
    for (let i = 0; i < 3; i++) expect((await otp(to, at(i * 1000))).ok).toBe(true);
    // Any spelling of the same number counts against the same limit.
    const local = to.replace("+39", "");
    expect(await otp(local, at(5000))).toEqual({ ok: false, reason: "rate_limited" });
    expect((await otp(to, at(15 * MIN + 1))).ok).toBe(true);
  });

  it("allows 10 codes per contact per day", async () => {
    const to = phone();
    for (let i = 0; i < 10; i++) expect((await otp(to, at(Math.floor(i / 3) * 16 * MIN + i * 1000))).ok).toBe(true);
    expect(await otp(to, at(4 * 16 * MIN))).toEqual({ ok: false, reason: "rate_limited" });
    expect((await otp(to, at(DAY + 1000))).ok).toBe(true);
  });

  it("allows 10 codes per IP per hour", async () => {
    const headers = new Headers({ "x-real-ip": "198.51.100.77" });
    for (let i = 0; i < 10; i++) expect((await otp(phone(), NOW, headers)).ok).toBe(true);
    expect((await otp(phone(), NOW, headers)).ok).toBe(false);
    expect((await otp(phone(), at(60 * MIN + 1), headers)).ok).toBe(true);
  });

  it("counts an IPv6 client by its /64, so rotating addresses doesn't reset the limit", async () => {
    const t = at(10 * DAY);
    for (let i = 1; i <= 10; i++) expect((await otp(phone(), t, new Headers({ "x-real-ip": `2001:db8:77:1::${i.toString(16)}` }))).ok).toBe(true);
    expect((await otp(phone(), t, new Headers({ "x-real-ip": "2001:db8:77:1:ffff:1:2:3" }))).ok).toBe(false);
    expect((await otp(phone(), t, new Headers({ "x-real-ip": "2001:db8:77:2::1" }))).ok).toBe(true);
  });

  it("fails closed without a client address: such requests share one bucket", async () => {
    const t = at(20 * DAY);
    for (let i = 0; i < 10; i++) expect((await otp(phone(), t, new Headers())).ok).toBe(true);
    expect((await otp(phone(), t, new Headers({ "x-real-ip": "<script>" }))).ok).toBe(false);
    expect((await otp(phone(), t, visitor())).ok).toBe(true);
  });

  it("rejects malformed contacts", async () => {
    await expect(sendOtp({ purpose: "privacy_center", channel: "email", to: "nope", locale: "en", headers: visitor() })).rejects.toThrow(TypeError);
  });
});

describe("verifyOtp", () => {
  it("accepts the right code once and returns the contact hash", async () => {
    const { to, challengeId, code } = await send();
    expect(await verifyOtp({ challengeId, code: `${code.slice(0, 3)} ${code.slice(3)}`, purpose: "privacy_center", now: at(1000) })).toEqual({
      ok: true,
      targetHash: contactHash("phone", to),
      purpose: "privacy_center",
      channel: "sms",
    });
    expect(await verifyOtp({ challengeId, code, now: at(2000) })).toEqual({ ok: false, reason: "invalid" });
  });

  it("rejects wrong codes, unknown challenges and another flow's code", async () => {
    const { challengeId, code } = await send();
    const wrong = wrongFor(code);
    expect(await verifyOtp({ challengeId, code: wrong, now: at(1000) })).toEqual({ ok: false, reason: "invalid" });
    expect(await verifyOtp({ challengeId: "missing", code, now: at(1000) })).toEqual({ ok: false, reason: "invalid" });
    expect(await verifyOtp({ challengeId, code, purpose: "form_signature", now: at(1000) })).toEqual({ ok: false, reason: "invalid" });
    expect((await verifyOtp({ challengeId, code, purpose: "privacy_center", now: at(1000) })).ok).toBe(true);
  });

  it("expires after 5 minutes", async () => {
    const { challengeId, code } = await send();
    expect(await verifyOtp({ challengeId, code, now: at(OTP_TTL_MS) })).toEqual({ ok: false, reason: "expired" });
  });

  it("allows 5 attempts: the 6th fails even with the right code", async () => {
    const { challengeId, code } = await send();
    const wrong = wrongFor(code);
    for (let i = 0; i < 5; i++) expect(await verifyOtp({ challengeId, code: wrong, now: at(1000) })).toEqual({ ok: false, reason: "invalid" });
    expect(await verifyOtp({ challengeId, code, now: at(1000) })).toEqual({ ok: false, reason: "too_many_attempts" });
  });

  it("counts parallel guesses atomically", async () => {
    const { challengeId, code } = await send();
    const wrong = wrongFor(code);
    const results = await Promise.all(Array.from({ length: 8 }, () => verifyOtp({ challengeId, code: wrong, now: at(1000) })));
    expect(results.filter((r) => !r.ok && r.reason === "invalid")).toHaveLength(5);
    const [row] = await db.select().from(verificationCodes).where(eq(verificationCodes.id, challengeId));
    expect(row.attempts).toBe(5);
  });
});

describe("per-contact lockout", () => {
  it(`locks a contact after ${OTP_MAX_FAILURES} wrong codes in a day: no new codes, no checks`, async () => {
    const to = phone();
    const t0 = at(30 * DAY);
    const later = (ms: number) => new Date(t0.getTime() + ms);
    const a = await send(to, t0);
    for (let i = 0; i < 5; i++) expect((await verifyOtp({ challengeId: a.challengeId, code: wrongFor(a.code), now: later(1000) })).ok).toBe(false);
    const b = await send(to, later(2000));
    for (let i = 0; i < 4; i++) expect((await verifyOtp({ challengeId: b.challengeId, code: wrongFor(b.code), now: later(3000) })).ok).toBe(false);
    const c = await send(to, later(4000));
    expect(await verifyOtp({ challengeId: c.challengeId, code: wrongFor(c.code), now: later(5000) })).toEqual({ ok: false, reason: "invalid" });

    // 10 failures: even the right codes of live challenges are refused, and no code is sent.
    expect(await verifyOtp({ challengeId: c.challengeId, code: c.code, now: later(6000) })).toEqual({ ok: false, reason: "too_many_attempts" });
    expect(await verifyOtp({ challengeId: b.challengeId, code: b.code, now: later(6000) })).toEqual({ ok: false, reason: "too_many_attempts" });
    expect(await otp(to, later(20 * MIN))).toEqual({ ok: false, reason: "rate_limited" });
    // Other contacts are unaffected.
    expect((await send(phone(), later(20 * MIN))).code).toMatch(/^\d{6}$/);

    // A day after the failures the contact works again.
    const d = await send(to, later(DAY + 5000));
    expect((await verifyOtp({ challengeId: d.challengeId, code: d.code, now: later(DAY + 6000) })).ok).toBe(true);
  });

  it("holds the lock against parallel guesses on several codes", async () => {
    const to = phone();
    const t0 = at(40 * DAY);
    const codes = [await send(to, t0), await send(to, t0), await send(to, t0)];
    const guesses = codes.flatMap((c) => Array.from({ length: 5 }, () => verifyOtp({ challengeId: c.challengeId, code: wrongFor(c.code), now: t0 })));
    const results = await Promise.all(guesses);
    expect(results.filter((r) => !r.ok && r.reason === "invalid")).toHaveLength(OTP_MAX_FAILURES);
  });
});
