import { describe, expect, it } from "vitest";
import { effectiveBookingChoices, noticeVersionFor, validateBookingPrivacy, type BookingPrivacyInput } from "./booking-rules";
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
