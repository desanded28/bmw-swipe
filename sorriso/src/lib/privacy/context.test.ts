import { describe, expect, it } from "vitest";
import { processingContextFor, signPracticeRef, verifyPracticeRef, type BookingSource, type ContextInput } from "./context";

const ORG = "org_a";
const ctx = (i: Partial<ContextInput> & { source: BookingSource }) =>
  processingContextFor({ viaApiKey: false, embedded: false, orgId: ORG, ...i });

describe("processingContextFor", () => {
  it.each([
    // [source, viaApiKey, embedded, ref, expected]
    ["staff", false, false, null, "practice"],
    ["api", true, false, null, "practice"],
    ["online", true, false, null, "practice"],
    // 'widget' is a body field on the public route: alone it proves nothing.
    ["widget", false, false, null, "marketplace"],
    ["widget", false, true, null, "practice"],
    ["widget", false, false, "valid", "practice"],
    ["online", false, true, null, "practice"],
    ["online", false, false, "valid", "practice"],
    ["waitlist", false, false, "valid", "practice"],
    ["online", false, false, null, "marketplace"],
    ["online", false, false, "forged", "marketplace"],
    ["online", false, false, "other_org", "marketplace"],
    ["waitlist", false, false, null, "marketplace"],
    ["api", false, false, null, "marketplace"],
  ] as const)("%s apiKey=%s embedded=%s ref=%s -> %s", (source, viaApiKey, embedded, ref, expected) => {
    const practiceRef = ref === "valid" ? signPracticeRef(ORG) : ref === "other_org" ? signPracticeRef("org_b") : ref === "forged" ? "0123456789abcdef" : null;
    expect(ctx({ source, viaApiKey, embedded, practiceRef })).toBe(expected);
  });

  it("keeps the context of the booking being continued, except for practice channels", () => {
    expect(ctx({ source: "waitlist", inherit: "practice" })).toBe("practice");
    expect(ctx({ source: "online", inherit: "marketplace", embedded: true })).toBe("marketplace");
    expect(ctx({ source: "staff", inherit: "marketplace" })).toBe("practice");
  });
});

describe("practice refs", () => {
  it("are 16 characters, per practice, and verified in constant time", () => {
    const ref = signPracticeRef(ORG);
    expect(ref).toHaveLength(16);
    expect(verifyPracticeRef(ORG, ref)).toBe(true);
    expect(verifyPracticeRef("org_b", ref)).toBe(false);
    expect(verifyPracticeRef(ORG, `${ref.slice(0, 15)}${ref[15] === "0" ? "1" : "0"}`)).toBe(false);
    expect(verifyPracticeRef(ORG, `${ref}x`)).toBe(false);
    expect(verifyPracticeRef(ORG, "")).toBe(false);
    expect(verifyPracticeRef(ORG, null)).toBe(false);
  });
});
