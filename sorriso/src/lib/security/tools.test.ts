import { eq } from "drizzle-orm";
import { getTableConfig, SQLiteTable } from "drizzle-orm/sqlite-core";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { client, db } from "@/db";
import * as schema from "@/db/schema";
import { decrypt } from "@/lib/crypto";
import { newId } from "@/lib/ids";
import { checkPasswordPolicy, isCommonPassword } from "@/lib/password";
import { peekRateLimit, rateLimit } from "@/lib/rate-limit";
import { createPractice, MONDAY, NOW, TZ } from "@/test/fixtures";
import { ipAllowed, ipInRange, normalizeIpRange, parseIp } from "./ip";
import { ENCRYPTED_COLUMNS, ENCRYPTED_TEXT_VALUES, reencryptColumns } from "./reencrypt";
import { demoSeedRefusal, fakePhone, isFakePhone } from "./seed-guard";
import { ALLOWED_COOKIES, cspNonce, cssUrls, disallowedCookies, resourceUrls, scriptsMissingNonce, thirdPartyUrls } from "./third-party";
import { describeUserAgent, parseUserAgent } from "./user-agent";

describe("password policy", () => {
  it("bundles the 10,000 most common passwords", () => {
    expect(isCommonPassword("password")).toBe(true);
    expect(isCommonPassword("QWERTY")).toBe(true);
    expect(isCommonPassword("unbelievable")).toBe(true);
    expect(isCommonPassword("correct horse battery staple")).toBe(false);
  });

  it("needs 12-128 characters, refuses common and dressed-up common passwords", () => {
    expect(checkPasswordPolicy("short pass")).toBe("too_short");
    expect(checkPasswordPolicy("x".repeat(129))).toBe("too_long");
    expect(checkPasswordPolicy("unbelievable")).toBe("common");
    expect(checkPasswordPolicy("dragon123456")).toBe("common");
    expect(checkPasswordPolicy("!!Password2024")).toBe("common");
    expect(checkPasswordPolicy("aaaaaaaaaaaaaaaa")).toBe("too_simple");
    expect(checkPasswordPolicy("abcabcabcabcabc")).toBe("too_simple");
    expect(checkPasswordPolicy("giulia.verdi-studio-2026", { email: "giulia.verdi@example.com" })).toBe("contains_personal");
    expect(checkPasswordPolicy("sorriso molare 4 ever", { name: "Paolo Rossi" })).toBeNull();
    // Unicode counts as characters, not bytes.
    expect(checkPasswordPolicy("çàèìòù€ßøåæœ")).toBeNull();
  });
});

describe("IP allow-lists", () => {
  it("parses IPv4, IPv6 (compressed, embedded IPv4, zone ids) and CIDR ranges", () => {
    expect(parseIp("203.0.113.5")).toEqual({ v: 4, n: 0xcb007105n });
    expect(parseIp("::ffff:203.0.113.5")).toEqual({ v: 4, n: 0xcb007105n });
    expect(parseIp("2001:db8::1")?.v).toBe(6);
    expect(parseIp("2001:0db8:0000:0000:0000:0000:0000:0001")).toEqual(parseIp("2001:db8::1"));
    expect(parseIp("fe80::1%eth0")?.v).toBe(6);
    for (const bad of ["256.1.1.1", "1.2.3", "2001:db8:::1", "hello", "1::2::3"]) expect(parseIp(bad), bad).toBeNull();
    expect(normalizeIpRange(" 203.0.113.0/24 ")).toBe("203.0.113.0/24");
    for (const bad of ["203.0.113.0/33", "2001:db8::/129", "203.0.113.0/", "a/24", "1.2.3.4/24/1"]) expect(normalizeIpRange(bad), bad).toBeNull();
  });

  it("matches addresses against ranges", () => {
    expect(ipInRange("203.0.113.77", "203.0.113.0/24")).toBe(true);
    expect(ipInRange("203.0.114.1", "203.0.113.0/24")).toBe(false);
    expect(ipInRange("203.0.113.5", "203.0.113.5")).toBe(true);
    expect(ipInRange("2001:db8:abcd::1", "2001:db8::/32")).toBe(true);
    expect(ipInRange("2001:db9::1", "2001:db8::/32")).toBe(false);
    expect(ipInRange("203.0.113.5", "2001:db8::/32")).toBe(false);
    expect(ipAllowed("198.51.100.1", null)).toBe(true);
    expect(ipAllowed("198.51.100.1", [])).toBe(true);
    expect(ipAllowed("198.51.100.1", ["203.0.113.0/24"])).toBe(false);
    expect(ipAllowed("local", ["203.0.113.0/24"])).toBe(false);
  });
});

describe("rate limits counting failures only", () => {
  it("peeks without counting", async () => {
    await createPractice();
    const key = `peek-${newId()}`;
    expect(await peekRateLimit(key, 2)).toEqual({ ok: true, retryAfterSec: 0 });
    await rateLimit(key, 2, 60_000);
    expect((await peekRateLimit(key, 2)).ok).toBe(true);
    await rateLimit(key, 2, 60_000);
    expect((await peekRateLimit(key, 2)).ok).toBe(false);
    expect((await peekRateLimit(key, 2, new Date(Date.now() + 61_000))).ok).toBe(true);
  });
});

describe("user agents", () => {
  it("names browser and system coarsely", () => {
    const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
    expect(parseUserAgent(iphone)).toEqual({ browser: "Safari", os: "iOS" });
    expect(parseUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36 Edg/130.0")).toEqual({ browser: "Edge", os: "Windows" });
    expect(parseUserAgent(null)).toEqual({ browser: null, os: null });
    expect(describeUserAgent(iphone, "en")).toBe("Safari on iOS");
    expect(describeUserAgent(undefined, "en")).toBe("Unknown browser on unknown system");
  });
});

describe("demo seed safety", () => {
  it("refuses production and remote databases unless ALLOW_DEMO_SEED=1", () => {
    expect(demoSeedRefusal({ DATABASE_URL: "file:./data/sorriso.db" })).toBeNull();
    expect(demoSeedRefusal({})).toBeNull();
    expect(demoSeedRefusal({ DATABASE_URL: "libsql://prod-sorriso.turso.io" })).toMatch(/not a local file/);
    expect(demoSeedRefusal({ DATABASE_URL: "file:./x.db", NODE_ENV: "production" })).toMatch(/production/);
    expect(demoSeedRefusal({ DATABASE_URL: "libsql://prod-sorriso.turso.io", ALLOW_DEMO_SEED: "1" })).toBeNull();
  });

  it("uses an unassigned phone range", () => {
    expect(fakePhone(1017)).toBe("+390000001017");
    expect(fakePhone(1017)).toMatch(/^\+[1-9]\d{6,14}$/);
    expect(isFakePhone("+39 000 101 1037")).toBe(true);
    expect(isFakePhone("+393331234567")).toBe(false);
  });
});

describe("third-party check", () => {
  const BASE = "http://localhost:3010/it/c/studio";
  const SELF = ["http://localhost:3010", "https://sorriso.test"];

  it("finds resources that load from other origins, sparing navigation links and the map template", () => {
    const html = `<!doctype html><html><head>
      <link rel="stylesheet" href="/_next/static/css/a.css">
      <link rel="canonical" href="https://sorriso.test/it/c/studio">
      <link rel="alternate" hreflang="de" href="https://elsewhere.example/de">
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <script src="/_next/static/chunks/main.js" nonce="abc"></script>
      <script nonce="abc">self.__next_f=[]</script>
      <script src="https://www.googletagmanager.com/gtag/js?id=G-1"></script>
      <style>.x{background:url(https://cdn.example/bg.png)}</style>
    </head><body>
      <a href="https://studiobianchi.example">Website</a>
      <img src="data:image/png;base64,AAA" srcset="/a.png 1x, https://img.example/b.png 2x">
      <div style="background-image:url('/local.png')"></div>
      <template id="map"><iframe src="https://www.openstreetmap.org/export/embed.html?bbox=1"></iframe></template>
      <iframe src="https://www.openstreetmap.org/export/embed.html?bbox=2"></iframe>
      <form action="https://collector.example/submit"></form>
      <svg><use href="#icon"></use></svg>
    </body></html>`;
    const bad = thirdPartyUrls(resourceUrls(html), BASE, SELF).map((f) => `${f.where} ${f.url}`);
    expect(bad).toEqual([
      "link[rel=preconnect] https://fonts.googleapis.com",
      "script[src] https://www.googletagmanager.com/gtag/js?id=G-1",
      "img[srcset] https://img.example/b.png",
      "iframe[src] https://www.openstreetmap.org/export/embed.html?bbox=2",
      "form[action] https://collector.example/submit",
      "style https://cdn.example/bg.png",
    ]);
  });

  it("reads CSS imports and fonts", () => {
    const urls = cssUrls(`@import url("https://fonts.googleapis.com/css2?family=Inter"); @import "https://cdn.example/x.css"; @font-face{src:url(/_next/static/media/f.woff2) format("woff2")}`);
    expect(urls.sort()).toEqual(["/_next/static/media/f.woff2", "https://cdn.example/x.css", "https://fonts.googleapis.com/css2?family=Inter"]);
  });

  it("allows only the listed cookies", () => {
    expect(disallowedCookies(["NEXT_LOCALE=it; Path=/", "__Host-sorriso_session=x; Secure", "_ga=GA1.2.3; Path=/", "_fbp=fb.1"])).toEqual(["_ga", "_fbp"]);
  });

  it("allows exactly the app's own cookies: staff session, language, privacy-center session", async () => {
    const { SESSION_COOKIE_NAMES } = await import("@/lib/auth");
    const { PATIENT_SESSION_COOKIE_NAMES } = await import("@/lib/privacy/patient-session");
    const { LOCALE_COOKIE } = await import("@/i18n/config");
    expect([...ALLOWED_COOKIES].sort()).toEqual([...SESSION_COOKIE_NAMES, ...PATIENT_SESSION_COOKIE_NAMES, LOCALE_COOKIE].sort());
    expect(disallowedCookies(["__Host-sorriso_pc=x; Secure; HttpOnly", "sorriso_pc=y"])).toEqual([]);
  });

  it("spots scripts the CSP nonce would block", () => {
    const csp = "default-src 'self'; script-src 'self' 'nonce-abc' 'strict-dynamic'";
    expect(cspNonce(csp)).toBe("abc");
    const html = `<script nonce="abc" src="/a.js"></script><script>inline()</script><script type="application/ld+json">{}</script>`;
    expect(scriptsMissingNonce(html, "abc")).toBe(1);
    expect(scriptsMissingNonce(html, null)).toBe(0);
  });
});

describe("re-encryption backfill", () => {
  const original = process.env.DATA_ENCRYPTION_KEYS;
  afterEach(() => {
    process.env.DATA_ENCRYPTION_KEYS = original;
  });
  beforeAll(async () => {
    await createPractice();
  });

  it("lists every encryptedText column of the schema with the AAD the schema binds", () => {
    const fromSchema: string[] = [];
    for (const value of Object.values(schema)) {
      if (!(value instanceof SQLiteTable)) continue;
      const config = getTableConfig(value);
      for (const col of config.columns) {
        if (col.columnType !== "SQLiteCustomColumn") continue;
        fromSchema.push(`${config.name}.${col.name}`);
        const listed = ENCRYPTED_COLUMNS.find((c) => c.table === config.name && c.column === col.name);
        expect(listed, `${config.name}.${col.name}`).toBeDefined();
        // The schema's own encryption must decrypt with the listed AAD.
        expect(decrypt(String(col.mapToDriverValue("probe")), listed!.aad)).toBe("probe");
      }
    }
    expect(fromSchema.sort()).toEqual(ENCRYPTED_COLUMNS.map((c) => `${c.table}.${c.column}`).sort());
  });

  it("re-encrypts plaintext and old-key values under the active key, in batches, idempotently", async () => {
    const { orgId } = await createPractice();
    const ids = [newId(), newId(), newId()];
    await db.insert(schema.patients).values(ids.map((id, i) => ({ id, orgId, firstName: "N", lastName: String(i), notes: `note ${i}` })));
    // One row written before encryption existed.
    await client.execute({ sql: "UPDATE patients SET notes = ? WHERE id = ?", args: ["legacy plaintext", ids[2]] });

    // Rotate: a new key in front, the old one kept for decryption.
    process.env.DATA_ENCRYPTION_KEYS = `k2:${Buffer.alloc(32, 7).toString("base64")},${original}`;
    const column = ENCRYPTED_COLUMNS.filter((c) => c.table === "patients");
    const dry = await reencryptColumns(client, { dryRun: true, columns: column });
    expect(dry[0].pending).toBeGreaterThanOrEqual(3);
    const raw = async (id: string) => String((await client.execute({ sql: "SELECT notes FROM patients WHERE id = ?", args: [id] })).rows[0].notes);
    expect(await raw(ids[2])).toBe("legacy plaintext"); // dry run wrote nothing

    const done = await reencryptColumns(client, { columns: column, batchSize: 2 });
    expect(done[0]).toMatchObject({ rewritten: dry[0].pending, failed: 0 });
    for (const id of ids) expect(await raw(id)).toMatch(/^v1:k2:/);
    const rows = await db.select({ id: schema.patients.id, notes: schema.patients.notes }).from(schema.patients).where(eq(schema.patients.orgId, orgId));
    expect(rows.map((r) => r.notes).sort()).toEqual(["legacy plaintext", "note 0", "note 1"]);

    expect((await reencryptColumns(client, { dryRun: true, columns: column }))[0].pending).toBe(0);
    // Every other column too, without failures.
    const all = await reencryptColumns(client);
    expect(all.reduce((n, r) => n + r.failed, 0)).toBe(0);
  });

  it("rotates the review texts reviews.ts encrypts, but leaves a published (public) comment in plaintext", async () => {
    const p = await createPractice();
    const { createAppointment } = await import("@/lib/booking");
    const { heldCommentValue, readComment, readReportDetails, reportDetailsValue } = await import("@/lib/reviews");
    const { zonedToUtc } = await import("@/lib/time");
    const visit = async (lastName: string) =>
      (
        await createAppointment({
          orgId: p.orgId,
          serviceId: p.visit,
          practitionerId: p.drA,
          locationId: p.milano,
          startsAt: zonedToUtc(MONDAY, 9 * 60 + (lastName === "Pub" ? 0 : 60), TZ),
          patient: { firstName: "Rev", lastName, phone: `+3935${Date.now() % 100_000_000}${lastName.length}` },
          source: "staff",
          online: false,
          force: true,
          now: NOW,
        })
      ).appointment.id;
    const published = newId();
    const held = newId();
    const report = newId();
    const base = { orgId: p.orgId, practitionerId: p.drA, rating: 4, authorName: "R." };
    await db.insert(schema.reviews).values([
      { ...base, id: published, appointmentId: await visit("Pub"), status: "published", comment: "Great, very kind staff" },
      { ...base, id: held, appointmentId: await visit("Held"), status: "pending", comment: heldCommentValue("They pulled my tooth after the infection") },
    ]);
    await db.insert(schema.reviewReports).values({ id: report, reviewId: published, orgId: p.orgId, ground: "defamation", details: reportDetailsValue("Names a colleague") });

    process.env.DATA_ENCRYPTION_KEYS = `k3:${Buffer.alloc(32, 9).toString("base64")},${original}`;
    const done = await reencryptColumns(client, { columns: ENCRYPTED_TEXT_VALUES });
    expect(done.reduce((n, r) => n + r.failed, 0)).toBe(0);
    const raw = async (sql: string, id: string) => String((await client.execute({ sql, args: [id] })).rows[0].v);
    expect(await raw("SELECT comment AS v FROM reviews WHERE id = ?", published)).toBe("Great, very kind staff");
    expect(await raw("SELECT comment AS v FROM reviews WHERE id = ?", held)).toMatch(/^v1:k3:/);
    expect(await raw("SELECT details AS v FROM review_reports WHERE id = ?", report)).toMatch(/^v1:k3:/);
    expect(readComment(await raw("SELECT comment AS v FROM reviews WHERE id = ?", held))).toBe("They pulled my tooth after the infection");
    expect(readReportDetails(await raw("SELECT details AS v FROM review_reports WHERE id = ?", report)).text).toBe("Names a colleague");
    // Idempotent, and the default run covers them.
    const again = await reencryptColumns(client, { dryRun: true });
    for (const c of ENCRYPTED_TEXT_VALUES) expect(again.find((r) => r.table === c.table && r.column === c.column)?.pending, `${c.table}.${c.column}`).toBe(0);
  });
});
