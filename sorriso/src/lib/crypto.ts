import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";

/**
 * Application-level encryption for free text that may contain health data
 * (patient notes, appointment notes, message bodies, anamnesis answers…).
 *
 * Format: "v1:<kid>:<iv>:<tag>:<ciphertext>" (AES-256-GCM, base64url parts).
 * Keys: DATA_ENCRYPTION_KEYS="k2:<base64 32 bytes>,k1:<base64 32 bytes>" — the first key
 * encrypts, all keys decrypt (rotation: add a new key in front, run `npm run db:encrypt`).
 * An optional AAD (e.g. "patients.notes") binds a ciphertext to its column.
 *
 * Development and tests fall back to a fixed key (with one warning). In production a
 * missing key is a hard error (assertCryptoConfigured, called at startup), except for a local
 * demo of a production build (insecureDemoKeysAllowed).
 */

type Key = { kid: string; key: Buffer };

const DEV_KEY: Key = { kid: "dev", key: createHash("sha256").update("sorriso-development-only-key").digest() };
let cached: { keys: Key[]; source: string } | null = null;
let warned = false;

/**
 * May a production build run with the built-in development key and HMAC secret? Only a local demo
 * of `next start`: SORRISO_ALLOW_DEV_KEY=1 together with DEMO_MODE=1 (demo logins without
 * two-step verification, never a real deployment), on a local SQLite file, not on Vercel. With the
 * development key, health free text is readable and every pseudonym reproducible by anyone with
 * the source, so a single flag must never be enough; assertCryptoConfigured says so loudly at startup.
 */
export function insecureDemoKeysAllowed(env: Record<string, string | undefined> = process.env): boolean {
  if (env.SORRISO_ALLOW_DEV_KEY !== "1" || env.DEMO_MODE !== "1" || env.VERCEL) return false;
  return (env.DATABASE_URL ?? "file:./data/sorriso.db").startsWith("file:");
}

function loadKeys(): Key[] {
  const raw = process.env.DATA_ENCRYPTION_KEYS ?? "";
  if (cached && cached.source === raw) return cached.keys;
  const keys: Key[] = [];
  for (const part of raw.split(",").map((p) => p.trim()).filter(Boolean)) {
    const idx = part.indexOf(":");
    if (idx <= 0) throw new Error("DATA_ENCRYPTION_KEYS: expected <kid>:<base64 key>");
    const kid = part.slice(0, idx);
    const key = Buffer.from(part.slice(idx + 1), "base64");
    if (key.length !== 32) throw new Error(`DATA_ENCRYPTION_KEYS: key "${kid}" must be 32 bytes (base64)`);
    if (!/^[A-Za-z0-9_-]{1,16}$/.test(kid)) throw new Error(`DATA_ENCRYPTION_KEYS: invalid key id "${kid}"`);
    keys.push({ kid, key });
  }
  if (!keys.length) {
    if (process.env.NODE_ENV === "production" && !insecureDemoKeysAllowed()) {
      throw new Error("DATA_ENCRYPTION_KEYS is required in production");
    }
    if (!warned && process.env.NODE_ENV !== "test") {
      warned = true;
      process.stderr.write("[crypto] DATA_ENCRYPTION_KEYS not set — using the built-in development key\n");
    }
    keys.push(DEV_KEY);
  } else {
    // Keep the dev key available for decrypting rows written before keys were configured.
    if (process.env.NODE_ENV !== "production") keys.push(DEV_KEY);
  }
  cached = { keys, source: raw };
  return keys;
}

export function assertCryptoConfigured(): void {
  const keys = loadKeys();
  if (process.env.NODE_ENV !== "production") return;
  if (!process.env.HMAC_SECRET && !insecureDemoKeysAllowed()) throw new Error("HMAC_SECRET is required in production");
  if (keys[0] === DEV_KEY || !process.env.HMAC_SECRET) {
    process.stderr.write(
      "[crypto] INSECURE DEMO: this production build runs with the built-in development key and/or HMAC secret " +
        "(SORRISO_ALLOW_DEV_KEY=1, DEMO_MODE=1, local database). Never use it for real patient data.\n",
    );
  }
}

const b64 = (b: Buffer) => b.toString("base64url");

export function isEncrypted(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("v1:");
}

export function encrypt(plaintext: string, aad?: string): string {
  const { kid, key } = loadKeys()[0];
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  if (aad) cipher.setAAD(Buffer.from(aad, "utf8"));
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return `v1:${kid}:${b64(iv)}:${b64(cipher.getAuthTag())}:${b64(ct)}`;
}

/** Decrypts "v1:…" payloads; anything else is legacy plaintext and is returned unchanged. */
export function decrypt(payload: string, aad?: string): string {
  if (!isEncrypted(payload)) return payload;
  const [, kid, iv, tag, ct] = payload.split(":");
  const entry = loadKeys().find((k) => k.kid === kid);
  if (!entry) throw new Error(`decrypt: unknown key id "${kid}"`);
  const decipher = createDecipheriv("aes-256-gcm", entry.key, Buffer.from(iv, "base64url"));
  if (aad) decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64url")), decipher.final()]).toString("utf8");
}

/** True when the value is plaintext or encrypted with a key other than the active one. */
export function needsReencrypt(value: string | null | undefined): boolean {
  if (value == null) return false;
  if (!isEncrypted(value)) return true;
  return value.split(":")[1] !== loadKeys()[0].kid;
}

export type HmacPurpose = "contact" | "ip" | "ua" | "otp" | "token" | "audit";

/** Keyed, purpose-separated hash for lookups and pseudonymous logging (never store raw IPs). */
export function hmac(value: string, purpose: HmacPurpose): string {
  const secret = process.env.HMAC_SECRET || "sorriso-development-hmac-secret";
  return createHmac("sha256", secret).update(`${purpose}\u0000${value}`).digest("hex");
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
