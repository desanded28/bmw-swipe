import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/db";
import { patients, type Patient } from "@/db/schema";
import { createPractice } from "@/test/fixtures";
import {
  ageOn,
  canReachByEmail,
  canReachByPhone,
  contactHash,
  contactMatchDisclosure,
  contactMatchesNeedingChallenge,
  guardianMatchAllowed,
  isMinor,
  isRestricted,
  markContactVerified,
  matchedVia,
  passesChallenge,
  pickTextChannel,
  recipientFor,
  type ContactMatchRow,
} from "./contact";
import { newId } from "./ids";

const NOW = new Date("2030-03-01T09:00:00Z");

const patient = (overrides: Partial<Patient> = {}): Patient => ({
  id: newId(),
  orgId: "org",
  firstName: "Luca",
  lastName: "Bianchi",
  email: "luca@example.com",
  phone: "+393331111111",
  birthDate: "1990-01-01",
  locale: "it",
  emailOptIn: true,
  smsOptIn: true,
  preferredChannel: "sms",
  notes: null,
  noShowCount: 0,
  createdAt: NOW,
  guardianName: null,
  guardianRelation: null,
  guardianPhone: null,
  guardianEmail: null,
  contactVerifiedAt: null,
  restrictedAt: null,
  restrictionReason: null,
  retainUntil: null,
  erasedAt: null,
  possibleDuplicateOfId: null,
  mergedIntoId: null,
  ...overrides,
});

const child = (birthDate: string, extra: Partial<Patient> = {}) =>
  patient({
    birthDate,
    phone: "+393332222222",
    email: "kid@example.com",
    guardianName: "Anna Bianchi",
    guardianRelation: "parent",
    guardianPhone: "+393339999999",
    guardianEmail: "anna@example.com",
    ...extra,
  });

describe("ageOn", () => {
  it("counts whole years on the Italian calendar date", () => {
    expect(ageOn("2016-03-01", NOW)).toBe(14);
    expect(ageOn("2016-03-02", NOW)).toBe(13);
    expect(ageOn("2012-02-29", "2030-02-28")).toBe(17);
    expect(ageOn("2012-02-29", "2030-03-01")).toBe(18);
    // 23:30 UTC on 1 March is already 2 March in Rome.
    expect(ageOn("2016-03-02", new Date("2030-03-01T23:30:00Z"))).toBe(14);
  });

  it("returns null for missing, malformed or future dates", () => {
    expect(ageOn(null, NOW)).toBeNull();
    expect(ageOn("01/02/2010", NOW)).toBeNull();
    expect(ageOn("2031-01-01", NOW)).toBeNull();
  });

  it("treats unknown ages as adults", () => {
    expect(isMinor({ birthDate: null }, NOW)).toBe(false);
    expect(isMinor({ birthDate: "2013-03-02" }, NOW)).toBe(true);
    expect(isMinor({ birthDate: "2012-03-01" }, NOW)).toBe(false);
  });
});

describe("recipientFor", () => {
  it("routes an under-14 patient's messages to the guardian", () => {
    const r = recipientFor(child("2020-01-01"), NOW);
    expect(r).toEqual({ name: "Anna Bianchi", email: "anna@example.com", phone: "+393339999999", viaGuardian: true, locale: "it" });
  });

  it("uses the patient's own contacts from 14, or without guardian contacts", () => {
    expect(recipientFor(child("2016-03-01"), NOW)).toMatchObject({ phone: "+393332222222", viaGuardian: false });
    const noGuardian = child("2020-01-01", { guardianPhone: null, guardianEmail: null });
    expect(recipientFor(noGuardian, NOW)).toMatchObject({ email: "kid@example.com", viaGuardian: false });
  });

  it("never falls back to the child's contacts for a missing guardian channel", () => {
    const r = recipientFor(child("2020-01-01", { guardianEmail: null }), NOW);
    expect(r).toMatchObject({ email: null, phone: "+393339999999", viaGuardian: true });
    expect(canReachByEmail(child("2020-01-01", { guardianEmail: null }), NOW)).toBe(false);
  });

  it("has no contacts for restricted or erased patients", () => {
    for (const p of [patient({ restrictedAt: NOW }), patient({ erasedAt: NOW }), child("2020-01-01", { restrictedAt: NOW })]) {
      expect(isRestricted(p)).toBe(true);
      expect(recipientFor(p, NOW)).toMatchObject({ email: null, phone: null, viaGuardian: false });
      expect(canReachByEmail(p, NOW)).toBe(false);
      expect(canReachByPhone(p, NOW)).toBe(false);
      expect(pickTextChannel(p, { whatsappEnabled: true }, NOW)).toBeNull();
    }
  });

  it("honours opt-outs", () => {
    expect(canReachByEmail(patient({ emailOptIn: false }), NOW)).toBe(false);
    expect(canReachByPhone(patient({ smsOptIn: false }), NOW)).toBe(false);
    expect(canReachByPhone(patient({ phone: null }), NOW)).toBe(false);
    expect(canReachByEmail(patient(), NOW)).toBe(true);
  });
});

describe("pickTextChannel", () => {
  it("uses WhatsApp only when the practice enabled it and the patient chose it", () => {
    const wa = patient({ preferredChannel: "whatsapp" });
    expect(pickTextChannel(wa, { whatsappEnabled: true }, NOW)).toBe("whatsapp");
    expect(pickTextChannel(wa, { whatsappEnabled: false }, NOW)).toBe("sms");
    expect(pickTextChannel(patient(), { whatsappEnabled: true }, NOW)).toBe("sms");
    expect(pickTextChannel(patient({ smsOptIn: false }), { whatsappEnabled: true }, NOW)).toBeNull();
    expect(pickTextChannel(patient({ phone: null }), { whatsappEnabled: true }, NOW)).toBeNull();
  });
});

describe("guardian matching", () => {
  it("ends at 18 and needs a known birth date", () => {
    expect(guardianMatchAllowed({ birthDate: "2012-03-02" }, NOW)).toBe(true);
    expect(guardianMatchAllowed({ birthDate: "2012-03-01" }, NOW)).toBe(false);
    expect(guardianMatchAllowed({ birthDate: null }, NOW)).toBe(false);
  });
});

describe("privacy-center disclosure", () => {
  const row = (overrides: Partial<ContactMatchRow>): ContactMatchRow => ({
    id: newId(),
    firstName: "Luca",
    lastName: "Bianchi",
    birthDate: "1990-01-01",
    matchedVia: "self",
    matchedContactVerified: true,
    ...overrides,
  });

  it("shows verified records of a single adult, at several practices", () => {
    const rows = [row({}), row({ lastName: "BIANCHI" })];
    expect(contactMatchesNeedingChallenge(rows, NOW)).toEqual([]);
  });

  it("challenges records whose matching contact was never proven", () => {
    const unverified = row({ matchedContactVerified: false });
    expect(contactMatchesNeedingChallenge([row({}), unverified], NOW)).toEqual([unverified.id]);
  });

  it("a proven phone doesn't vouch for a mistyped email on the same record", () => {
    // The adult proved their phone by SMS reply; a stranger owns the mistyped email and passes its OTP.
    const viaEmail = row({ matchedVia: "self", matchedContactVerified: false });
    expect(contactMatchDisclosure([viaEmail], NOW).get(viaEmail.id)).toBe("challenge");
  });

  it("a child's own confirmation doesn't vouch for a mistyped guardian email", () => {
    const viaGuardian = row({ firstName: "Marco", birthDate: "2015-01-01", matchedVia: "guardian", matchedContactVerified: false });
    expect(contactMatchDisclosure([viaGuardian], NOW).get(viaGuardian.id)).toBe("challenge");
    expect(contactMatchDisclosure([{ ...viaGuardian, matchedContactVerified: true }], NOW).get(viaGuardian.id)).toBe("details");
  });

  it("challenges every adult when a contact is shared by two adults", () => {
    const a = row({});
    const b = row({ firstName: "Giulia", birthDate: "1992-05-05" });
    const kid = row({ firstName: "Marco", birthDate: "2020-01-01" });
    expect(contactMatchesNeedingChallenge([a, b, kid], NOW).sort()).toEqual([a.id, b.id].sort());
  });

  it("shows minors through the guardian's contact until 18, then hides them", () => {
    const minor = row({ firstName: "Marco", birthDate: "2015-01-01", matchedVia: "guardian" });
    const adult = row({ firstName: "Sofia", birthDate: "2010-01-01", matchedVia: "guardian" });
    const unknown = row({ firstName: "Pia", birthDate: null, matchedVia: "guardian" });
    const d = contactMatchDisclosure([minor, adult, unknown], NOW);
    expect(d.get(minor.id)).toBe("details");
    expect(d.get(adult.id)).toBe("hidden");
    expect(d.get(unknown.id)).toBe("hidden");
  });

  it("checks the challenge answers loosely on surname, exactly on birth date", () => {
    const r = { lastName: "D'Àngelo", birthDate: "1990-01-01" };
    expect(passesChallenge(r, { lastName: "d angelo", birthDate: "1990-01-01" })).toBe(true);
    expect(passesChallenge(r, { lastName: "Dangelo", birthDate: "1990-01-01" })).toBe(true);
    expect(passesChallenge(r, { lastName: "Angelo", birthDate: "1990-01-01" })).toBe(false);
    expect(passesChallenge(r, { lastName: "D'Angelo", birthDate: "1990-01-02" })).toBe(false);
    expect(passesChallenge({ lastName: "Rossi", birthDate: null }, { lastName: "Rossi", birthDate: "1990-01-01" })).toBe(false);
  });
});

describe("contactHash", () => {
  it("hashes normalised contacts", () => {
    expect(contactHash("phone", "333 123 4567")).toBe(contactHash("phone", "+393331234567"));
    expect(contactHash("email", " Mario@Example.com ")).toBe(contactHash("email", "mario@example.com"));
    expect(contactHash("email", "mario@example.com")).not.toBe(contactHash("phone", "+393331234567"));
    expect(contactHash("email", "not-an-email")).toBeNull();
    expect(contactHash("phone", "abc")).toBeNull();
  });
});

describe("matchedVia", () => {
  it("tells own contacts from guardian contacts, own first", () => {
    const p = child("2020-01-01");
    expect(matchedVia(p, contactHash("phone", "333 222 2222")!)).toBe("self");
    expect(matchedVia(p, contactHash("email", "Anna@Example.com")!)).toBe("guardian");
    expect(matchedVia(p, contactHash("email", "someone@example.com")!)).toBeNull();
    expect(matchedVia({ ...p, phone: p.guardianPhone }, contactHash("phone", p.guardianPhone!)!)).toBe("self");
  });
});

describe("markContactVerified", () => {
  it("records a contact that is on the record, and nothing else", async () => {
    const { orgId } = await createPractice();
    const id = newId();
    await db.insert(patients).values({ id, orgId, firstName: "A", lastName: "B", phone: "+393334445556", guardianEmail: "g@example.com" });
    const verifiedAt = async () => (await db.select().from(patients).where(eq(patients.id, id)))[0].contactVerifiedAt;

    expect(await db.transaction((tx) => markContactVerified(id, { kind: "email", value: "other@example.com" }, tx, NOW))).toBe(false);
    expect(await markContactVerified(id, { kind: "phone", value: "+393330000000" }, db, NOW)).toBe(false);
    expect(await markContactVerified(newId(), { kind: "phone", value: "+393334445556" }, db, NOW)).toBe(false);
    expect(await verifiedAt()).toBeNull();

    expect(await db.transaction((tx) => markContactVerified(id, { kind: "phone", value: "333 444 5556" }, tx, NOW))).toBe(true);
    expect(await verifiedAt()).toEqual(NOW);
    expect(await markContactVerified(id, { kind: "email", value: "G@example.com" }, db, NOW)).toBe(true);
  });
});
