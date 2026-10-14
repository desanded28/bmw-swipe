import { describe, expect, it } from "vitest";
import type { NoticeKind } from "@/db/enums";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import { buildNotice, type NoticeOrg } from "./notices";
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

describe("buildNotice (stub contract)", () => {
  it("returns the kind's version, anchored sections and a content hash", () => {
    const n = buildNotice("practice_patient", { org, locale: "it" });
    expect(n.version).toBe(NOTICE_VERSIONS.practice_patient);
    expect(n.sections.length).toBeGreaterThan(0);
    const anyText = expect.any(String);
    for (const s of n.sections) expect(s).toEqual({ id: anyText, title: anyText, body: anyText });
    expect(n.sections[0].body).toContain("Studio Bianchi S.r.l.");
    expect(n.contentHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("hashes deterministically, per locale and per practice", () => {
    const a = buildNotice("practice_patient", { org, locale: "it" }).contentHash;
    expect(buildNotice("practice_patient", { org, locale: "it" }).contentHash).toBe(a);
    expect(buildNotice("practice_patient", { org, locale: "de" }).contentHash).not.toBe(a);
    const other = { ...org, legalName: "Altro S.r.l." };
    expect(buildNotice("practice_patient", { org: other, locale: "it" }).contentHash).not.toBe(a);
  });

  it("needs the practice for practice notices only", () => {
    expect(() => buildNotice("practice_patient", { locale: "it" })).toThrow(/needs the practice/);
    expect(() => buildNotice("minor", { org: null, locale: "en" })).toThrow(/needs the practice/);
    for (const kind of ["platform_patient", "cookies", "staff", "practitioner"] satisfies NoticeKind[])
      expect(buildNotice(kind, { locale: "en" }).version).toBe(NOTICE_VERSIONS[kind]);
  });
});
