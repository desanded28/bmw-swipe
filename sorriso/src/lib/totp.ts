import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Time-based one-time passwords (RFC 6238 over RFC 4226 HOTP), as used by every authenticator
 * app: HMAC-SHA1, 30-second steps, 6 digits, base32 secrets. node:crypto only, no dependency.
 *
 * Pure functions: storing the secret (encrypted), replay protection and recovery codes live in
 * src/lib/security/mfa.ts.
 */

export const TOTP_STEP_SECONDS = 30;
export const TOTP_DIGITS = 6;
/** Accepted clock drift, in steps either side of now (±30 s). */
export const TOTP_WINDOW = 1;
/** 160-bit secrets, the size RFC 4226 recommends for HMAC-SHA1. */
export const TOTP_SECRET_BYTES = 20;

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** RFC 4648 base32 without padding (what otpauth:// URIs carry). */
export function base32Encode(bytes: Uint8Array): string {
  let out = "";
  let buffer = 0;
  let bits = 0;
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(buffer >>> (bits - 5)) & 31];
      bits -= 5;
    }
    buffer &= (1 << bits) - 1;
  }
  if (bits > 0) out += B32[(buffer << (5 - bits)) & 31];
  return out;
}

/** Decode base32, ignoring case, spaces, dashes and "=" padding. Throws on any other character. */
export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[\s=-]/g, "");
  const out: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const ch of clean) {
    const v = B32.indexOf(ch);
    if (v === -1) throw new Error("Invalid base32 character");
    buffer = (buffer << 5) | v;
    bits += 5;
    if (bits >= 8) {
      out.push((buffer >>> (bits - 8)) & 255);
      bits -= 8;
    }
    buffer &= (1 << bits) - 1;
  }
  return Buffer.from(out);
}

/** RFC 4226 HOTP with dynamic truncation. */
export function hotp(key: Uint8Array, counter: number, digits = TOTP_DIGITS): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac("sha1", key).update(msg).digest();
  const offset = mac[mac.length - 1] & 0x0f;
  const binary = ((mac[offset] & 0x7f) << 24) | (mac[offset + 1] << 16) | (mac[offset + 2] << 8) | mac[offset + 3];
  return String(binary % 10 ** digits).padStart(digits, "0");
}

/** The time step (counter) for an instant in milliseconds. */
export function totpStep(atMs: number, stepSeconds = TOTP_STEP_SECONDS): number {
  return Math.floor(atMs / 1000 / stepSeconds);
}

/** The code for a base32 secret at an instant. */
export function totp(secret: string, atMs = Date.now(), digits = TOTP_DIGITS): string {
  return hotp(base32Decode(secret), totpStep(atMs), digits);
}

/** Only the digits of what was typed ("123 456" -> "123456"). */
export function normalizeTotpInput(code: string): string {
  return code.replace(/[\s-]/g, "");
}

/**
 * Check a typed code against the secret, allowing ±`window` steps of clock drift. Returns the
 * step that matched (so the caller can refuse to accept the same step twice), or null.
 * Every candidate is compared in constant time.
 */
export function verifyTotp(secret: string, code: string, atMs = Date.now(), window = TOTP_WINDOW): number | null {
  const typed = normalizeTotpInput(code);
  if (!/^\d{6}$/.test(typed)) return null;
  let key: Buffer;
  try {
    key = base32Decode(secret);
  } catch {
    return null;
  }
  if (!key.length) return null;
  const now = totpStep(atMs);
  let matched: number | null = null;
  for (let delta = -window; delta <= window; delta++) {
    const step = now + delta;
    if (step < 0) continue;
    const expected = Buffer.from(hotp(key, step));
    if (timingSafeEqual(expected, Buffer.from(typed)) && matched === null) matched = step;
  }
  return matched;
}

/** A new random secret, base32. */
export function generateTotpSecret(bytes = TOTP_SECRET_BYTES): string {
  return base32Encode(randomBytes(bytes));
}

/** "ABCD EFGH IJKL …": easier to type into an app by hand. */
export function formatSecret(secret: string): string {
  return secret.replace(/(.{4})/g, "$1 ").trim();
}

/**
 * The otpauth:// URI authenticator apps open (Key Uri Format): issuer and account in the label
 * and the issuer parameter, SHA1, 6 digits, 30 seconds.
 */
export function otpauthUri(i: { secret: string; account: string; issuer: string }): string {
  const label = `${encodeURIComponent(i.issuer)}:${encodeURIComponent(i.account)}`;
  const params = new URLSearchParams({
    secret: i.secret,
    issuer: i.issuer,
    algorithm: "SHA1",
    digits: String(TOTP_DIGITS),
    period: String(TOTP_STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

// ---------------------------------------------------------------- recovery codes

/** Unambiguous characters (no 0/O, 1/I/L): codes are read off paper. */
const RECOVERY_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const RECOVERY_CODE_COUNT = 10;

/** One code: 10 characters from a 31-letter alphabet (~49 bits), shown as "XXXXX-XXXXX". */
export function generateRecoveryCode(): string {
  const bytes = randomBytes(10);
  let out = "";
  for (let i = 0; i < 10; i++) out += RECOVERY_ALPHABET[bytes[i] % RECOVERY_ALPHABET.length];
  return `${out.slice(0, 5)}-${out.slice(5)}`;
}

export function generateRecoveryCodes(n = RECOVERY_CODE_COUNT): string[] {
  return Array.from({ length: n }, generateRecoveryCode);
}

/** Canonical form for hashing: upper case, no separators or spaces. */
export function normalizeRecoveryCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Does this look like a recovery code rather than a 6-digit TOTP? */
export function looksLikeRecoveryCode(input: string): boolean {
  return normalizeRecoveryCode(input).length === 10 && !/^\d+$/.test(normalizeRecoveryCode(input));
}
