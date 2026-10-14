import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { and, eq, isNull } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { CONSENT_PURPOSES, LOCALES, NOTICE_KINDS, type NoticeKind } from "@/db/enums";
import { noticeVersions, organizations } from "@/db/schema";
import { getT } from "@/i18n/t";
import enLegal from "@/i18n/messages/en/legalPatient";
import { SESSION_COOKIE_NAMES } from "@/lib/auth";
import { newId } from "@/lib/ids";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import { migrateOnce } from "@/test/fixtures";
import { consentTextKey } from "./consent";
import {
  BROWSER_STORAGE,
  buildNotice,
  clearNoticeCache,
  COOKIES,
  noticePageChrome,
  noticePath,
  practicePurposes,
  publishNotice,
  recordBookingNotices,
  recordNoticeVersion,
  recordPracticeNotices,
  type NoticeOrg,
} from "./notices";
import { PATIENT_SESSION_COOKIE_NAMES } from "./patient-session";
import { PURPOSES, type ProcessingPurpose } from "./roles";
import { DEFAULT_RETENTION } from "./settings";
import { SUBPROCESSORS } from "./subprocessors";
import { NOTICE_VERSIONS } from "./versions";

const org: NoticeOrg = {
  id: "org1",
  slug: "studio",
  name: "Studio Bianchi",
  legalName: "Studio Bianchi S.r.l.",
  vatNumber: "IT01234567890",
  registeredAddress: "Via Roma 1, Milano",
  privacyEmail: "privacy@studio.test",
  dpoName: null,
  dpoEmail: null,
  email: "info@studio.test",
  phone: null,
  settings: DEFAULT_SETTINGS,
};

const withPrivacy = (privacy: Partial<typeof DEFAULT_SETTINGS.privacy>, extra: Partial<typeof DEFAULT_SETTINGS> = {}): NoticeOrg => ({
  ...org,
  settings: { ...DEFAULT_SETTINGS, ...extra, privacy: { ...DEFAULT_SETTINGS.privacy, ...privacy } },
});

const text = (kind: NoticeKind, o: NoticeOrg | null = org, locale: (typeof LOCALES)[number] = "en") =>
  buildNotice(kind, { org: o, locale }).sections.map((s) => `${s.title}\n${s.body}`).join("\n\n");

const section = (kind: NoticeKind, id: string, o: NoticeOrg | null = org) => buildNotice(kind, { org: o, locale: "en" }).sections.find((s) => s.id === id)!;

describe("consent texts", () => {
  it("every CONSENT_PURPOSES value has an English text key (the one the ledger stores)", () => {
    const tc = getT("en", "consents");
    for (const purpose of CONSENT_PURPOSES) {
      const key = consentTextKey(purpose).replace(/^consents\./, "");
      expect(tc.has(key), purpose).toBe(true);
      expect(tc.has(`${purpose}.title`), purpose).toBe(true);
      expect(tc.has(`${purpose}.description`), purpose).toBe(true);
    }
  });
});

describe("legalPatient dictionary", () => {
  it("has a title and a body for every processing purpose, and a label for every legal basis and service", () => {
    for (const p of Object.keys(PURPOSES) as ProcessingPurpose[]) {
      expect(enLegal.purposes[p]?.title, p).toBeTruthy();
      expect(enLegal.purposes[p]?.body, p).toBeTruthy();
      for (const b of PURPOSES[p].legalBases) expect(enLegal.bases[b], b).toBeTruthy();
    }
    const t = getT("en", "legalPatient");
    for (const s of SUBPROCESSORS) expect(t.has(`services.${s.service}`), s.service).toBe(true);
  });
});

describe("buildNotice", () => {
  it("returns the kind's version, anchored sections and a content hash", () => {
    const n = buildNotice("practice_patient", { org, locale: "it" });
    expect(n.version).toBe(NOTICE_VERSIONS.practice_patient);
    expect(n.contentHash).toMatch(/^[0-9a-f]{64}$/);
    const ids = n.sections.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of n.sections) {
      expect(s.id).toMatch(/^[a-z][a-z-]*$/);
      expect(s.title.length).toBeGreaterThan(0);
      expect(s.body.length).toBeGreaterThan(0);
    }
    expect(ids[0]).toBe("summary");
  });

  it("covers everything Art. 13 asks for in the practice notice", () => {
    const ids = buildNotice("practice_patient", { org, locale: "en" }).sections.map((s) => s.id);
    for (const id of ["controller", "purposes", "recipients", "transfers", "retention", "rights", "complaint", "mandatory", "automated", "minors", "marketplace"]) {
      expect(ids, id).toContain(id);
    }
    const all = text("practice_patient");
    expect(all).toContain("Studio Bianchi S.r.l.");
    expect(all).toContain("IT01234567890");
    expect(all).toContain("privacy@studio.test");
    expect(all).toContain("has not appointed a data protection officer");
    expect(all).toContain("Art. 6(1)(b) GDPR");
    expect(all).toContain("Art. 9(2)(h)");
    expect(all).toContain("Garante per la protezione dei dati personali");
    expect(all).toContain("Art. 22 GDPR");
    expect(all).toContain("withdraw your consent at any time");
    expect(all).toContain("https://sorriso.test/en/privacy");
    expect(all).toContain("https://sorriso.test/en/c/studio/privacy/minors");
  });

  it("names the DPO when the practice has one", () => {
    const body = section("practice_patient", "controller", { ...org, dpoName: "Avv. Rossi", dpoEmail: "dpo@studio.test" }).body;
    expect(body).toContain("Avv. Rossi, dpo@studio.test");
    expect(body).not.toContain("has not appointed");
  });

  it("lists every active sub-processor, and WhatsApp only when the practice enables it", () => {
    const off = section("practice_patient", "recipients").body;
    const on = section("practice_patient", "recipients", withPrivacy({ whatsappEnabled: true })).body;
    for (const s of SUBPROCESSORS) {
      if (s.onlyWhen) expect(off).not.toContain(s.name);
      else expect(off).toContain(s.name);
      expect(on).toContain(s.name);
    }
    const platform = section("platform_patient", "recipients", null).body;
    for (const s of SUBPROCESSORS) expect(platform).toContain(s.name);
  });

  it("describes each transfer with its safeguard", () => {
    const body = section("practice_patient", "transfers").body;
    for (const s of SUBPROCESSORS.filter((x) => x.transfer !== "eu" && !x.onlyWhen)) expect(body).toContain(s.name);
    expect(body).toContain("EU-US Data Privacy Framework");
  });

  it("lists every retention period from the practice's settings", () => {
    const body = section("practice_patient", "retention").body;
    const r = DEFAULT_RETENTION;
    for (const n of [r.patientInactiveMonths, r.neverSeenPatientMonths, r.messageBodyMonths, r.messageMetaMonths, r.auditMonths, r.consentMonths, r.privacyRequestMonths]) {
      expect(body).toContain(`${n} months`);
    }
    for (const n of [r.patientNoteDays, r.reminderDays, r.waitlistDays, r.providerMessageDays]) expect(body).toContain(`${n} days`);
    const custom = withPrivacy({ retention: { ...r, patientInactiveMonths: 200, waitlistDays: 45 } });
    const changed = section("practice_patient", "retention", custom).body;
    expect(changed).toContain("200 months");
    expect(changed).toContain("45 days");
    expect(buildNotice("practice_patient", { org: custom, locale: "en" }).contentHash).not.toBe(buildNotice("practice_patient", { org, locale: "en" }).contentHash);
  });

  it("lists only the purposes the practice's settings switch on, and discloses profiling", () => {
    expect(practicePurposes({ ...DEFAULT_SETTINGS })).not.toContain("marketing");
    const base = text("practice_patient");
    expect(base).not.toContain("News and offers");
    expect(base).not.toContain("This practice uses adaptive reminders");
    const on = text("practice_patient", withPrivacy({ marketingEnabled: true, riskBasedReminders: true }));
    expect(on).toContain("News and offers");
    expect(on).toContain("lapses after 24 months");
    expect(on).toContain("This practice uses adaptive reminders");
    expect(on).toContain("profiling");
  });

  it("explains Sorriso's two roles and the effect of withdrawing the platform consent", () => {
    const all = text("platform_patient", null);
    expect(all).toContain("independent controller");
    expect(all).toContain("processor for the practices");
    expect(all).toContain("Sorriso stops its own processing");
    expect(all).toContain("Art. 9(2)(a) GDPR");
  });

  it("hashes deterministically, per locale and per practice", () => {
    const a = buildNotice("practice_patient", { org, locale: "it" }).contentHash;
    expect(buildNotice("practice_patient", { org, locale: "it" }).contentHash).toBe(a);
    expect(buildNotice("practice_patient", { org, locale: "de" }).contentHash).not.toBe(a);
    expect(buildNotice("practice_patient", { org: { ...org, legalName: "Altro S.r.l." }, locale: "it" }).contentHash).not.toBe(a);
  });

  it("needs the practice for practice notices only", () => {
    expect(() => buildNotice("practice_patient", { locale: "it" })).toThrow(/needs the practice/);
    expect(() => buildNotice("minor", { org: null, locale: "en" })).toThrow(/needs the practice/);
    for (const kind of ["platform_patient", "cookies", "staff", "practitioner"] satisfies NoticeKind[])
      expect(buildNotice(kind, { locale: "en" }).version).toBe(NOTICE_VERSIONS[kind]);
  });

  it("renders every kind in all 8 locales with no missing key or unfilled placeholder", () => {
    for (const locale of LOCALES) {
      for (const kind of NOTICE_KINDS) {
        const n = buildNotice(kind, { org, locale });
        for (const s of n.sections) {
          expect(s.title, `${locale} ${kind} ${s.id}`).not.toMatch(/^(sections|legalPatient)\./);
          expect(s.body, `${locale} ${kind} ${s.id}`).not.toMatch(/\{[a-zA-Z_]+\}/);
          expect(s.body).not.toMatch(/(^|\s)(legalPatient|purposes|retention|rights)\.[a-z]/);
        }
      }
    }
  });

  it("the cookie notice names every cookie Sorriso sets", () => {
    expect([...COOKIES.staffSession]).toEqual([...SESSION_COOKIE_NAMES]);
    expect([...COOKIES.privacyCenter]).toEqual([...PATIENT_SESSION_COOKIE_NAMES]);
    const all = text("cookies", null);
    for (const name of [...COOKIES.staffSession, ...COOKIES.locale, ...COOKIES.privacyCenter]) expect(all).toContain(name);
    expect(all).toContain("OpenStreetMap");
    expect(all).toContain("Art. 122");
  });

  it("the cookie notice lists every localStorage and sessionStorage key the code uses", () => {
    const root = path.resolve(__dirname, "../..");
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) walk(full);
        else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) files.push(full);
      }
    };
    walk(root);
    const used = new Set<string>();
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      if (!/\b(localStorage|sessionStorage)\b/.test(src) || file.endsWith(path.join("privacy", "notices.ts"))) continue;
      // The key argument: a string literal, or a constant defined in the same file.
      for (const m of src.matchAll(/(?:localStorage|sessionStorage)\s*\.\s*(?:getItem|setItem|removeItem)\(\s*([^,)]+)/g)) {
        const arg = m[1].trim();
        const literal = /^["'`]([^"'`]+)["'`]$/.exec(arg)?.[1];
        const constant = literal ? null : new RegExp(`\\b${arg}\\s*=\\s*["'\`]([^"'\`]+)["'\`]`).exec(src)?.[1];
        const key = literal ?? constant;
        expect(key, `${path.relative(root, file)}: storage key ${arg} must be a literal or a constant in the same file`).toBeTruthy();
        used.add(key!);
      }
    }
    expect(used.size).toBeGreaterThan(0);
    const listed = new Set<string>(BROWSER_STORAGE.map((s) => s.key));
    for (const key of used) expect(listed, `${key} is missing from BROWSER_STORAGE`).toContain(key);
    const all = text("cookies", null);
    for (const s of BROWSER_STORAGE) {
      expect(all).toContain(s.key);
      expect(all).toContain(getT("en", "legalPatient")(`cookies.storageItems.${s.purpose}`));
    }
  });

  it("the staff notice explains the access log (Art. 4 L. 300/1970)", () => {
    const all = text("staff", null);
    expect(all).toContain("access log");
    expect(all).toContain("Law 300/1970");
  });

  it("publishes each notice at a stable path", () => {
    expect(noticePath("practice_patient", "studio")).toBe("/c/studio/privacy");
    expect(noticePath("minor", "studio")).toBe("/c/studio/privacy/minors");
    expect(noticePath("platform_patient")).toBe("/legal/privacy");
    expect(noticePath("cookies")).toBe("/legal/cookies");
  });
});

describe("notice pages", () => {
  it("show the version and date in every locale, and the Italian-prevails banner on translations", () => {
    const at = new Date("2026-10-14T10:00:00Z");
    for (const locale of LOCALES) {
      const c = noticePageChrome({ kind: "practice_patient", locale, publishedAt: at, path: "/c/studio/privacy" });
      expect(c.version).toContain(NOTICE_VERSIONS.practice_patient);
      expect(c.updated).toMatch(/14/);
      if (locale === "it") expect(c.italian).toBeNull();
      else expect(c.italian).toEqual({ text: expect.stringMatching(/Italian version prevails/), linkLabel: expect.any(String), href: "/it/c/studio/privacy" });
    }
    expect(noticePageChrome({ kind: "staff", locale: "de", publishedAt: at, path: "/legal/privacy?for=staff" }).italian?.href).toBe("/it/legal/privacy?for=staff");
  });
});

describe("recording notice versions", () => {
  let realOrg: NoticeOrg;

  beforeAll(async () => {
    await migrateOnce();
    const id = newId();
    await db.insert(organizations).values({ id, slug: `n-${id.toLowerCase()}`, name: "Studio N", settings: DEFAULT_SETTINGS, legalName: "Studio N S.r.l." });
    realOrg = { ...org, id, slug: `n-${id.toLowerCase()}`, name: "Studio N", legalName: "Studio N S.r.l." };
  });
  beforeEach(() => clearNoticeCache());

  const rows = (orgId: string | null, kind: NoticeKind, locale: "it" | "en") =>
    db
      .select()
      .from(noticeVersions)
      .where(and(orgId ? eq(noticeVersions.orgId, orgId) : isNull(noticeVersions.orgId), eq(noticeVersions.kind, kind), eq(noticeVersions.locale, locale)));

  it("records a row the first time a content hash is published, and only then", async () => {
    const t1 = new Date("2030-01-01T10:00:00Z");
    const first = await publishNotice("practice_patient", { org: realOrg, locale: "it", now: t1 });
    expect(first.publishedAt).toEqual(t1);
    clearNoticeCache();
    const again = await publishNotice("practice_patient", { org: realOrg, locale: "it", now: new Date("2030-02-01T10:00:00Z") });
    expect(again.publishedAt).toEqual(t1);
    expect(await rows(realOrg.id, "practice_patient", "it")).toHaveLength(1);

    // The practice changes its legal name: a new hash, a new row, a new "in force since".
    const renamed = { ...realOrg, legalName: "Studio N S.p.A." };
    const t3 = new Date("2030-03-01T10:00:00Z");
    const changed = await publishNotice("practice_patient", { org: renamed, locale: "it", now: t3 });
    expect(changed.publishedAt).toEqual(t3);
    expect(changed.notice.contentHash).not.toBe(first.notice.contentHash);
    const stored = await rows(realOrg.id, "practice_patient", "it");
    expect(stored.map((r) => r.contentHash).sort()).toEqual([first.notice.contentHash, changed.notice.contentHash].sort());
    expect(stored.every((r) => r.version === NOTICE_VERSIONS.practice_patient)).toBe(true);
  });

  it("deduplicates platform notices too (org NULL is outside the unique index)", async () => {
    const n = buildNotice("cookies", { locale: "en" });
    const a = await recordNoticeVersion(n, { kind: "cookies", orgId: null, locale: "en" }, { now: new Date("2030-01-01T00:00:00Z") });
    clearNoticeCache();
    const b = await recordNoticeVersion(n, { kind: "cookies", orgId: null, locale: "en" }, { now: new Date("2030-05-01T00:00:00Z") });
    expect(b).toEqual(a);
    expect((await rows(null, "cookies", "en")).filter((r) => r.contentHash === n.contentHash)).toHaveLength(1);
  });

  it("records the notices a booking shows when it is made, before anyone opens the notice page", async () => {
    const at = new Date("2030-06-01T08:00:00Z");
    await recordBookingNotices({ orgId: realOrg.id, locale: "pl", context: "marketplace", now: at });
    const practice = await db.select().from(noticeVersions).where(and(eq(noticeVersions.orgId, realOrg.id), eq(noticeVersions.kind, "practice_patient"), eq(noticeVersions.locale, "pl")));
    expect(practice).toHaveLength(1);
    expect(practice[0].publishedAt).toEqual(at);
    const platform = await db.select().from(noticeVersions).where(and(isNull(noticeVersions.orgId), eq(noticeVersions.kind, "platform_patient"), eq(noticeVersions.locale, "pl")));
    expect(platform.map((r) => r.publishedAt)).toContainEqual(at);
    // The page opened later shows the booking's moment as "in force since".
    clearNoticeCache();
    const [row] = await db.select().from(organizations).where(eq(organizations.id, realOrg.id));
    const page = await publishNotice("practice_patient", { org: row, locale: "pl", now: new Date("2030-07-01T08:00:00Z") });
    expect(page.publishedAt).toEqual(at);
    // Never throws, even for an unknown practice.
    await expect(recordBookingNotices({ orgId: "nope", locale: "it", context: "practice" })).resolves.toBeUndefined();
  });

  it("records the practice notices in every language on demand", async () => {
    await recordPracticeNotices(realOrg);
    const all = await db.select().from(noticeVersions).where(eq(noticeVersions.orgId, realOrg.id));
    for (const locale of LOCALES) {
      expect(all.some((r) => r.kind === "practice_patient" && r.locale === locale)).toBe(true);
      expect(all.some((r) => r.kind === "minor" && r.locale === locale)).toBe(true);
    }
  });
});
