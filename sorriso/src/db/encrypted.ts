import { customType } from "drizzle-orm/sqlite-core";
import { decrypt, encrypt } from "@/lib/crypto";

/**
 * A TEXT column transparently encrypted with AES-256-GCM (see src/lib/crypto.ts).
 * The AAD binds the ciphertext to its column so it can't be copied into another one.
 * Legacy plaintext rows still read fine until `npm run db:encrypt` rewrites them.
 * Never filter, search or sort on an encrypted column.
 */
export const encryptedText = (name: string, aad: string) =>
  customType<{ data: string; driverData: string }>({
    dataType: () => "text",
    toDriver: (value) => encrypt(value, aad),
    fromDriver: (value) => decrypt(value, aad),
  })(name);
