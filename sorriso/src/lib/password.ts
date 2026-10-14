import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { COMMON_PASSWORDS_RAW } from "./security/common-passwords";

const scrypt = promisify(scryptCb) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltB64, hashB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64url");
  const actual = await scrypt(password, Buffer.from(saltB64, "base64url"), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/**
 * A fixed scrypt hash nobody knows the password of. Login checks unknown emails against it, so
 * "no such account" costs the same scrypt round as "wrong password" and response times don't
 * reveal which emails have accounts.
 */
const DUMMY_HASH =
  "scrypt$BLIBK3YlnEI0HZDsZY1jzg$vhyAWUhU1IJ9iQD5G06IPSZXVhq5mbCfK1wGX6ZAV90gQoGPqKbQSlASsFd1jRLdNxb-ymJYe-DCOErtHxE5kQ";

/** Burn the same time as verifyPassword() for an account that doesn't exist. Always false. */
export async function verifyAgainstDummy(password: string): Promise<false> {
  await verifyPassword(password, DUMMY_HASH);
  return false;
}

// ---------------------------------------------------------------- policy

export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 128;

/** Why a password was refused (each code has a text in the auth namespace: auth.password.<code>). */
export type PasswordProblem = "too_short" | "too_long" | "common" | "too_simple" | "contains_personal";

let common: Set<string> | null = null;
function commonPasswords(): Set<string> {
  common ??= new Set(COMMON_PASSWORDS_RAW.split(/\s+/).filter(Boolean));
  return common;
}

/** Is this (lower-cased) one of the 10,000 most common passwords? */
export function isCommonPassword(password: string): boolean {
  return commonPasswords().has(password.toLowerCase());
}

/**
 * NIST SP 800-63B style: length 12-128 (any characters, spaces included; no composition rules),
 * not a common password, not a common password with digits or symbols tacked on
 * ("dragon123456!"), not a run of 4 or fewer distinct characters, and not built around the
 * user's own email or name. Returns null when the password is acceptable.
 */
export function checkPasswordPolicy(password: string, context: { email?: string | null; name?: string | null } = {}): PasswordProblem | null {
  const length = [...password].length;
  if (length < PASSWORD_MIN) return "too_short";
  if (length > PASSWORD_MAX) return "too_long";
  const lower = password.toLowerCase();
  if (isCommonPassword(lower)) return "common";
  // A common word dressed up with a numeric or symbol prefix/suffix.
  const core = lower.replace(/^[\d\W_]+|[\d\W_]+$/g, "");
  if (core.length >= 4 && core !== lower && isCommonPassword(core)) return "common";
  if (new Set(lower).size <= 4) return "too_simple";
  const personal = [context.email?.split("@")[0], ...(context.name ?? "").split(/\s+/)]
    .map((s) => s?.toLowerCase().trim() ?? "")
    .filter((s) => s.length >= 4);
  if (personal.some((p) => lower.includes(p))) return "contains_personal";
  return null;
}
