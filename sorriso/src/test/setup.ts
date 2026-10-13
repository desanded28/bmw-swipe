import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// Each test file gets its own throwaway SQLite database.
const dir = mkdtempSync(path.join(tmpdir(), "sorriso-test-"));
process.env.DATABASE_URL = `file:${path.join(dir, "test.db")}`;
process.env.APP_URL = "https://sorriso.test";
delete process.env.SMTP_URL;
delete process.env.TWILIO_ACCOUNT_SID;
