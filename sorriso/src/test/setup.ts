import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// Each test file gets its own throwaway SQLite database.
const dir = mkdtempSync(path.join(tmpdir(), "sorriso-test-"));
process.env.DATABASE_URL = `file:${path.join(dir, "test.db")}`;
process.env.APP_URL = "https://sorriso.test";
// Fixed keys, so tests run the configured path rather than the development fallback. (Not secrets:
// the key is sha256("sorriso-test-key") in base64.)
process.env.DATA_ENCRYPTION_KEYS = "test:rItDmtOr7aIKiloPusmsA2x2tO8+C8GWAFeJWU/BP5A=";
process.env.HMAC_SECRET = "sorriso-test-hmac-secret";
delete process.env.SMTP_URL;
delete process.env.TWILIO_ACCOUNT_SID;
