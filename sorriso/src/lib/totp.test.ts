import { describe, expect, it } from "vitest";
import {
  base32Decode,
  base32Encode,
  formatSecret,
  generateRecoveryCodes,
  generateTotpSecret,
  hotp,
  looksLikeRecoveryCode,
  normalizeRecoveryCode,
  otpauthUri,
  totp,
  verifyTotp,
} from "./totp";

// RFC 6238 Appendix B: the SHA1 seed is the ASCII string "12345678901234567890".
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890", "ascii"));
const RFC_VECTORS: [seconds: number, code8: string][] = [
  [59, "94287082"],
  [1111111109, "07081804"],
  [1111111111, "14050471"],
  [1234567890, "89005924"],
  [2000000000, "69279037"],
  [20000000000, "65353130"],
];

describe("RFC 6238 (SHA1)", () => {
  it.each(RFC_VECTORS)("T=%i gives %s", (seconds, code8) => {
    expect(totp(RFC_SECRET, seconds * 1000, 8)).toBe(code8);
    // 6 digits are the same truncation modulo 10^6.
    expect(totp(RFC_SECRET, seconds * 1000)).toBe(code8.slice(-6));
  });

  it("matches the RFC 4226 HOTP vectors", () => {
    const key = Buffer.from("12345678901234567890", "ascii");
    const expected = ["755224", "287082", "359152", "969429", "338314", "254676", "287922", "162583", "399871", "520489"];
    expect(expected.map((_, i) => hotp(key, i))).toEqual(expected);
  });
});

describe("base32", () => {
  it("round-trips and ignores case, spaces and padding", () => {
    const bytes = Buffer.from("foobar");
    expect(base32Encode(bytes)).toBe("MZXW6YTBOI");
    expect(base32Decode("mzxw 6ytb oi======")).toEqual(bytes);
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(base32Encode(base32Decode(secret))).toBe(secret);
  });

  it("rejects other characters", () => {
    expect(() => base32Decode("ABC1")).toThrow();
  });
});

describe("verifyTotp", () => {
  const secret = generateTotpSecret();
  const now = Date.UTC(2026, 9, 14, 10, 0, 15);

  it("accepts the current code and ±1 step of drift, returning the matched step", () => {
    const step = Math.floor(now / 30_000);
    expect(verifyTotp(secret, totp(secret, now), now)).toBe(step);
    expect(verifyTotp(secret, totp(secret, now - 30_000), now)).toBe(step - 1);
    expect(verifyTotp(secret, totp(secret, now + 30_000), now)).toBe(step + 1);
  });

  it("refuses codes two steps away, malformed input and a bad secret", () => {
    expect(verifyTotp(secret, totp(secret, now - 60_000), now)).toBeNull();
    expect(verifyTotp(secret, totp(secret, now + 60_000), now)).toBeNull();
    expect(verifyTotp(secret, "12345", now)).toBeNull();
    expect(verifyTotp(secret, "abcdef", now)).toBeNull();
    expect(verifyTotp("not base32!", "123456", now)).toBeNull();
  });

  it("accepts spaces in the typed code", () => {
    const code = totp(secret, now);
    expect(verifyTotp(secret, `${code.slice(0, 3)} ${code.slice(3)}`, now)).not.toBeNull();
  });
});

describe("otpauth URI and recovery codes", () => {
  it("builds the Key Uri Format", () => {
    const uri = otpauthUri({ secret: "JBSWY3DPEHPK3PXP", account: "anna@example.com", issuer: "Sorriso" });
    expect(uri).toBe(
      "otpauth://totp/Sorriso:anna%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=Sorriso&algorithm=SHA1&digits=6&period=30",
    );
    expect(formatSecret("JBSWY3DPEHPK3PXP")).toBe("JBSW Y3DP EHPK 3PXP");
  });

  it("generates 10 distinct, readable recovery codes", () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    for (const c of codes) {
      expect(c).toMatch(/^[A-HJKMNP-Z2-9]{5}-[A-HJKMNP-Z2-9]{5}$/);
      expect(looksLikeRecoveryCode(c)).toBe(true);
    }
    expect(normalizeRecoveryCode(" abcde-fghjk ")).toBe("ABCDEFGHJK");
    expect(looksLikeRecoveryCode("123456")).toBe(false);
  });
});
