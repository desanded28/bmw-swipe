import { describe, expect, it } from "vitest";
import {
  bookingPrivacyFormErrors,
  effectiveBookingChoices,
  noticeVersionFor,
  validateBookingPrivacy,
  type BookingPrivacyInput,
} from "./booking-rules";
import { NOTICE_VERSIONS } from "./versions";

const input = (overrides: Partial<BookingPrivacyInput> = {}): BookingPrivacyInput => ({
  context: "practice",
  preferredChannel: "sms",
  choices: {},
  org: { whatsappEnabled: true, marketingEnabled: false },
  ...overrides,
});

describe("validateBookingPrivacy", () => {
  it("accepts a practice booking with nothing ticked", () => {
    expect(validateBookingPrivacy(input())).toEqual({ ok: true });
  });

  it("requires the platform consent on the marketplace only", () => {
    expect(validateBookingPrivacy(input({ context: "marketplace" }))).toEqual({
      ok: false,
      code: "platform_consent_required",
      field: "platformConsent",
    });
    expect(validateBookingPrivacy(input({ context: "marketplace", choices: { platformConsent: true } }))).toEqual({ ok: true });
  });

  it("requires the WhatsApp confirmation, and a practice that offers WhatsApp", () => {
    expect(validateBookingPrivacy(input({ preferredChannel: "whatsapp" }))).toEqual({
      ok: false,
      code: "whatsapp_consent_required",
      field: "whatsapp",
    });
    expect(validateBookingPrivacy(input({ preferredChannel: "whatsapp", choices: { whatsapp: true } }))).toEqual({ ok: true });
    expect(
      validateBookingPrivacy(
        input({ preferredChannel: "whatsapp", choices: { whatsapp: true }, org: { whatsappEnabled: false, marketingEnabled: false } }),
      ),
    ).toEqual({ ok: false, code: "whatsapp_unavailable", field: "preferredChannel" });
  });
});

describe("validateBookingPrivacy: notice and optional choices", () => {
  it("accepts the notice version the form showed only when it is the current one", () => {
    expect(validateBookingPrivacy(input({ noticeVersion: NOTICE_VERSIONS.practice_patient }))).toEqual({ ok: true });
    expect(validateBookingPrivacy(input({ noticeVersion: "2019-01" }))).toEqual({ ok: false, code: "notice_outdated", field: "" });
    expect(
      validateBookingPrivacy(input({ context: "marketplace", choices: { platformConsent: true }, noticeVersion: NOTICE_VERSIONS.platform_patient })),
    ).toEqual({ ok: true });
    // Without a version (staff, partner API) there is nothing to compare.
    expect(validateBookingPrivacy(input({ noticeVersion: null }))).toEqual({ ok: true });
  });

  it("never requires feedback or marketing, and ignores marketing where the practice doesn't run it", () => {
    expect(validateBookingPrivacy(input({ choices: { feedback: false, marketing: false } }))).toEqual({ ok: true });
    expect(validateBookingPrivacy(input({ choices: { marketing: true } }))).toEqual({ ok: true });
    expect(effectiveBookingChoices({ context: "practice", choices: { marketing: true }, org: { whatsappEnabled: false, marketingEnabled: false } }).marketing).toBe(false);
  });

  it("checks the platform consent before anything else, so a marketplace form is told what is missing", () => {
    expect(validateBookingPrivacy(input({ context: "marketplace", preferredChannel: "whatsapp", noticeVersion: "x" }))).toMatchObject({
      code: "platform_consent_required",
    });
  });
});

describe("bookingPrivacyFormErrors (the browser's copy of the rules)", () => {
  const org = { whatsappEnabled: true, marketingEnabled: false };
  it("flags each missing required box with its rule code", () => {
    expect(bookingPrivacyFormErrors({ context: "practice", preferredChannel: "sms", choices: {}, org })).toEqual({});
    expect(bookingPrivacyFormErrors({ context: "marketplace", preferredChannel: "whatsapp", choices: {}, org })).toEqual({
      platformConsent: "platform_consent_required",
      whatsapp: "whatsapp_consent_required",
    });
    expect(
      bookingPrivacyFormErrors({ context: "practice", preferredChannel: "whatsapp", choices: { whatsapp: true }, org: { ...org, whatsappEnabled: false } }),
    ).toEqual({ preferredChannel: "whatsapp_unavailable" });
  });

  it("agrees with the server rule on every combination", () => {
    for (const bookedFor of [undefined, "self", "minor", "other_adult"] as const)
      for (const context of ["practice", "marketplace"] as const)
        for (const preferredChannel of ["sms", "email", "whatsapp"] as const)
          for (const whatsappEnabled of [true, false])
            for (const platformConsent of [true, false])
              for (const whatsapp of [true, false]) {
                const i = { context, preferredChannel, bookedFor, choices: { platformConsent, whatsapp }, org: { whatsappEnabled, marketingEnabled: false } };
                expect(Object.keys(bookingPrivacyFormErrors(i)).length === 0).toBe(validateBookingPrivacy(i).ok);
              }
  });

  it("asks no consent of someone booking for another adult, and records none", () => {
    // Nothing can be ticked for them: no box is shown, so nothing may be required...
    expect(validateBookingPrivacy(input({ bookedFor: "other_adult", context: "marketplace" }))).toEqual({ ok: true });
    expect(validateBookingPrivacy(input({ bookedFor: "other_adult", preferredChannel: "whatsapp" }))).toEqual({ ok: true });
    expect(bookingPrivacyFormErrors({ ...input({ bookedFor: "other_adult", context: "marketplace", preferredChannel: "whatsapp" }) })).toEqual({});
    // ...but a practice without WhatsApp still refuses it, and a guardian still confirms it for a child.
    expect(validateBookingPrivacy(input({ bookedFor: "other_adult", preferredChannel: "whatsapp", org: { whatsappEnabled: false, marketingEnabled: false } }))).toMatchObject({
      code: "whatsapp_unavailable",
    });
    expect(validateBookingPrivacy(input({ bookedFor: "minor", preferredChannel: "whatsapp" }))).toMatchObject({ code: "whatsapp_consent_required" });
    // ...and whatever a client sends anyway is not recorded.
    const all = { platformConsent: true, whatsapp: true, feedback: true, marketing: true };
    expect(effectiveBookingChoices({ context: "marketplace", bookedFor: "other_adult", choices: all, org: { whatsappEnabled: true, marketingEnabled: true } })).toEqual({});
  });
});

describe("effectiveBookingChoices", () => {
  it("drops consents the patient could not have been shown", () => {
    const all = { platformConsent: true, whatsapp: true, feedback: true, marketing: true };
    expect(effectiveBookingChoices({ context: "practice", choices: all, org: { whatsappEnabled: false, marketingEnabled: false } })).toEqual({
      platformConsent: false,
      whatsapp: false,
      feedback: true,
      marketing: false,
    });
    expect(effectiveBookingChoices({ context: "marketplace", choices: all, org: { whatsappEnabled: true, marketingEnabled: true } })).toEqual(all);
  });
});

describe("noticeVersionFor", () => {
  it("records the notice version the server displayed", () => {
    expect(noticeVersionFor("practice")).toBe(NOTICE_VERSIONS.practice_patient);
    expect(noticeVersionFor("marketplace")).toBe(NOTICE_VERSIONS.platform_patient);
  });
});
