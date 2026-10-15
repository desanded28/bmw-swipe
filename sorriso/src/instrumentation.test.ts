import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { audit, auditChainHead, logAuditHeads } from "@/lib/audit";
import { newId } from "@/lib/ids";
import { migrateOnce } from "@/test/fixtures";
import { register } from "./instrumentation";

const jobs = vi.hoisted(() => ({
  processDueReminders: vi.fn(),
  purgeProviderCopies: vi.fn(),
  expireAdultConfirmations: vi.fn(),
  runCareJobs: vi.fn(),
  runRetention: vi.fn(),
}));
vi.mock("./lib/reminders", () => ({ processDueReminders: jobs.processDueReminders, purgeProviderCopies: jobs.purgeProviderCopies }));
vi.mock("./lib/privacy/adult-confirmation", () => ({ expireAdultConfirmations: jobs.expireAdultConfirmations }));
vi.mock("./lib/recalls", () => ({ runCareJobs: jobs.runCareJobs }));
vi.mock("./lib/privacy/retention", () => ({ runRetention: jobs.runRetention }));

const log = vi.hoisted(() => ({ logInfo: vi.fn(), logError: vi.fn() }));
vi.mock("./lib/log", async (importOriginal) => ({ ...(await importOriginal<object>()), ...log }));

const auditFailures = vi.hoisted(() => vi.fn(() => 0));
vi.mock("./lib/audit", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getAuditFailureCount: auditFailures,
}));

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const g = globalThis as unknown as { __sorrisoJobs?: { stop: () => void } };

beforeAll(migrateOnce);

beforeEach(() => {
  jobs.processDueReminders.mockResolvedValue({ due: 0, sent: 0, skipped: 0, failed: 0, retry: 0 });
  jobs.purgeProviderCopies.mockResolvedValue({ deleted: 0, failed: 0 });
  jobs.expireAdultConfirmations.mockResolvedValue(0);
  jobs.runCareJobs.mockResolvedValue({ recallsSent: 0, risksRefreshed: 0, formInvites: 0 });
  jobs.runRetention.mockImplementation(async (now = new Date()) => ({
    startedAt: now,
    finishedAt: now,
    orgs: 0,
    counts: {},
  }));
  auditFailures.mockReturnValue(0);
  vi.stubEnv("NEXT_RUNTIME", "nodejs");
  vi.stubEnv("VERCEL", "");
  vi.stubEnv("REMINDER_WORKER", "");
  vi.stubEnv("SORRISO_ALLOW_DEV_KEY", "");
  vi.stubEnv("SMTP_URL", "");
});

afterEach(() => {
  g.__sorrisoJobs?.stop();
  delete g.__sorrisoJobs;
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("register: startup checks", () => {
  it("does nothing outside the Node.js runtime", async () => {
    vi.stubEnv("NEXT_RUNTIME", "edge");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATA_ENCRYPTION_KEYS", "");
    vi.useFakeTimers();
    await expect(register()).resolves.toBeUndefined();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("needs no extra environment in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DATA_ENCRYPTION_KEYS", "");
    vi.stubEnv("HMAC_SECRET", "");
    vi.stubEnv("SMTP_URL", "smtp://localhost:1025");
    vi.stubEnv("REMINDER_WORKER", "off");
    // crypto.ts warns once that it falls back to the development key.
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    await expect(register()).resolves.toBeUndefined();
    stderr.mockRestore();
  });

  it("refuses to start in production without keys or the SMTP provider's identity", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL", "1");
    const keys = process.env.DATA_ENCRYPTION_KEYS!;
    // crypto.ts caches the parsed keys per process (keyed on the variable alone): start from a fresh copy.
    vi.resetModules();

    vi.stubEnv("DATA_ENCRYPTION_KEYS", "");
    await expect(register()).rejects.toThrow("DATA_ENCRYPTION_KEYS is required in production");

    vi.stubEnv("DATA_ENCRYPTION_KEYS", keys);
    vi.stubEnv("HMAC_SECRET", "");
    await expect(register()).rejects.toThrow("HMAC_SECRET is required in production");

    vi.stubEnv("HMAC_SECRET", "a-production-secret");
    vi.stubEnv("SMTP_URL", "smtp://user:pass@smtp.example.com:587");
    for (const k of ["SMTP_PROVIDER_NAME", "SMTP_PROVIDER_ENTITY", "SMTP_PROVIDER_REGION"]) vi.stubEnv(k, "");
    await expect(register()).rejects.toThrow("Sub-processor list incomplete");

    vi.stubEnv("SMTP_PROVIDER_NAME", "Mailer");
    vi.stubEnv("SMTP_PROVIDER_ENTITY", "Mailer GmbH");
    vi.stubEnv("SMTP_PROVIDER_REGION", "EU — Germany");
    // Sorriso's identity as controller, for its notices (Art. 13(1)(a)-(b)).
    for (const k of ["PLATFORM_LEGAL_NAME", "PLATFORM_ADDRESS", "PLATFORM_PRIVACY_EMAIL"]) vi.stubEnv(k, "");
    await expect(register()).rejects.toThrow("set PLATFORM_LEGAL_NAME, PLATFORM_ADDRESS, PLATFORM_PRIVACY_EMAIL");
    vi.stubEnv("PLATFORM_LEGAL_NAME", "Sorriso S.r.l.");
    vi.stubEnv("PLATFORM_ADDRESS", "Via Esempio 1, 20100 Milano");
    await expect(register()).rejects.toThrow("set PLATFORM_PRIVACY_EMAIL");
    vi.stubEnv("PLATFORM_PRIVACY_EMAIL", "privacy@sorriso.example");
    await expect(register()).resolves.toBeUndefined();
  });

  it("runs a production build on the development keys only as a local demo, never on the one flag alone", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("REMINDER_WORKER", "off");
    vi.resetModules();
    vi.stubEnv("DATA_ENCRYPTION_KEYS", "");
    vi.stubEnv("HMAC_SECRET", "");
    vi.stubEnv("SORRISO_ALLOW_DEV_KEY", "1");
    vi.stubEnv("DEMO_MODE", "");
    await expect(register()).rejects.toThrow("DATA_ENCRYPTION_KEYS is required in production");
    vi.stubEnv("DEMO_MODE", "1");
    vi.stubEnv("DATABASE_URL", "libsql://sorriso-prod.example.turso.io");
    await expect(register()).rejects.toThrow("DATA_ENCRYPTION_KEYS is required in production");
    vi.stubEnv("DATABASE_URL", "file:./data/sorriso.db");
    vi.stubEnv("VERCEL", "1");
    await expect(register()).rejects.toThrow("DATA_ENCRYPTION_KEYS is required in production");
    // Real keys but no HMAC secret: the flag alone doesn't excuse it either.
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("DEMO_MODE", "");
    vi.stubEnv("DATA_ENCRYPTION_KEYS", `k1:${Buffer.alloc(32, 7).toString("base64")}`);
    await expect(register()).rejects.toThrow("HMAC_SECRET is required in production");

    // The local demo: allowed, and said loudly.
    vi.stubEnv("DEMO_MODE", "1");
    vi.stubEnv("DATA_ENCRYPTION_KEYS", "");
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    await expect(register()).resolves.toBeUndefined();
    expect(stderr.mock.calls.map((c) => String(c[0])).join("")).toContain("INSECURE DEMO");
    stderr.mockRestore();
  });

  it("rejects a malformed key list in any environment", async () => {
    vi.stubEnv("DATA_ENCRYPTION_KEYS", "k1:tooshort");
    await expect(register()).rejects.toThrow("must be 32 bytes");
  });
});

describe("register: background jobs", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2030-01-07T02:00:00Z"));
  });

  it.each([
    ["on Vercel", "VERCEL", "1"],
    ["with REMINDER_WORKER=off", "REMINDER_WORKER", "off"],
  ])("runs none %s", async (_, name, value) => {
    vi.stubEnv(name, value);
    await register();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("runs reminders every minute, care jobs every 15 minutes and retention daily at 02:15 UTC", async () => {
    await register();
    const timers = vi.getTimerCount();
    await register(); // a second registration in the same process adds nothing
    expect(vi.getTimerCount()).toBe(timers);

    await vi.advanceTimersByTimeAsync(5 * SECOND);
    expect(jobs.processDueReminders).toHaveBeenCalledTimes(1);
    expect(jobs.runCareJobs).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(MINUTE); // 01:05 after startup
    expect(jobs.processDueReminders).toHaveBeenCalledTimes(2);
    expect(jobs.runCareJobs).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(14 * MINUTE); // 02:15:05 UTC
    expect(jobs.processDueReminders).toHaveBeenCalledTimes(16);
    expect(jobs.runCareJobs).toHaveBeenCalledTimes(1);
    expect(jobs.runRetention).toHaveBeenCalledTimes(1);
    expect(log.logInfo).toHaveBeenCalledWith("retention", "run", { orgs: 0, ms: 0 });

    await vi.advanceTimersByTimeAsync(MINUTE); // 16:05 after startup
    expect(jobs.runCareJobs).toHaveBeenCalledTimes(2);
    // Held bookings for another adult expire with every reminder tick.
    expect(jobs.expireAdultConfirmations).toHaveBeenCalledTimes(jobs.processDueReminders.mock.calls.length);
    expect(jobs.purgeProviderCopies).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(60 * MINUTE); // 03:16:05 UTC: the providers' copies, daily
    expect(jobs.purgeProviderCopies).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(24 * 60 * MINUTE);
    expect(jobs.runRetention).toHaveBeenCalledTimes(2);
    expect(jobs.purgeProviderCopies).toHaveBeenCalledTimes(2);
    expect(log.logError).not.toHaveBeenCalled();
  });

  it("a failing adult-confirmation expiry doesn't stop the reminder tick", async () => {
    const err = new Error("boom");
    jobs.expireAdultConfirmations.mockRejectedValueOnce(err);
    jobs.expireAdultConfirmations.mockResolvedValueOnce(2);
    await register();
    await vi.advanceTimersByTimeAsync(5 * SECOND);
    expect(jobs.processDueReminders).toHaveBeenCalledTimes(1);
    expect(log.logError).toHaveBeenCalledWith("jobs", err, { job: "adult-confirmations" });
    await vi.advanceTimersByTimeAsync(MINUTE);
    expect(log.logInfo).toHaveBeenCalledWith("reminders", "adult confirmations expired", { expired: 2 });
  });

  it("logs reminder ticks only when something was due", async () => {
    jobs.processDueReminders.mockResolvedValueOnce({ due: 0, sent: 0, skipped: 0, failed: 0, retry: 0 });
    jobs.processDueReminders.mockResolvedValueOnce({ due: 2, sent: 2, skipped: 0, failed: 0, retry: 0 });
    await register();
    await vi.advanceTimersByTimeAsync(5 * SECOND + MINUTE);
    expect(log.logInfo).toHaveBeenCalledTimes(1);
    expect(log.logInfo).toHaveBeenCalledWith("reminders", "tick", { due: 2, sent: 2, skipped: 0, failed: 0, retry: 0 });
  });

  it("never overlaps two runs of the same job", async () => {
    let finish!: () => void;
    jobs.processDueReminders.mockImplementationOnce(
      () => new Promise((resolve) => (finish = () => resolve({ due: 0, sent: 0, skipped: 0, failed: 0, retry: 0 }))),
    );
    await register();
    await vi.advanceTimersByTimeAsync(5 * SECOND + 5 * MINUTE);
    expect(jobs.processDueReminders).toHaveBeenCalledTimes(1);

    finish();
    await vi.advanceTimersByTimeAsync(MINUTE);
    expect(jobs.processDueReminders).toHaveBeenCalledTimes(2);
  });

  it("logs the audit chain heads 2 minutes after startup, with lost audit rows as an error", async () => {
    auditFailures.mockReturnValue(3);
    await audit({ orgId: null, actor: { type: "system", id: null }, action: "retention.run" });
    await register();
    await vi.advanceTimersByTimeAsync(2 * MINUTE);
    await vi.waitFor(() => expect(log.logError).toHaveBeenCalled());
    expect(log.logInfo).toHaveBeenCalledWith("audit", "chain head", expect.objectContaining({ org: "platform" }));
    expect(log.logError).toHaveBeenCalledWith("audit", "access-log rows could not be written since startup", {
      failures: 3,
    });
  });

  it("logs a failing run and tries again on the next tick", async () => {
    const err = new Error("boom");
    jobs.runCareJobs.mockRejectedValueOnce(err);
    await register();
    await vi.advanceTimersByTimeAsync(MINUTE);
    expect(log.logError).toHaveBeenCalledWith("jobs", err, { job: "care" });

    await vi.advanceTimersByTimeAsync(15 * MINUTE);
    expect(jobs.runCareJobs).toHaveBeenCalledTimes(2);
  });
});

describe("logAuditHeads", () => {
  it("logs the head of every chain, the platform's included", async () => {
    const org = newId();
    const system = { type: "system", id: null } as const;
    for (let i = 0; i < 3; i++) await audit({ orgId: org, actor: system, action: "retention.run" });
    await audit({ orgId: null, actor: system, action: "retention.run" });
    const orgHead = (await auditChainHead(org))!;
    const platformHead = (await auditChainHead(null))!;
    expect(orgHead.seq).toBe(3);

    expect(await logAuditHeads()).toBeGreaterThanOrEqual(2);
    expect(log.logInfo).toHaveBeenCalledWith("audit", "chain head", { org, seq: 3, hash: orgHead.hash });
    expect(log.logInfo).toHaveBeenCalledWith("audit", "chain head", { org: "platform", ...platformHead });
  });
});
