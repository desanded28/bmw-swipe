import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const jobs = vi.hoisted(() => ({
  reminders: vi.fn(async () => ({ due: 2, sent: 2, skipped: 0, failed: 0 })),
  care: vi.fn(async () => ({ recallsSent: 1, risksRefreshed: 3, formInvites: 0 })),
  retention: vi.fn(async (now: Date = new Date()) => ({
    startedAt: now,
    finishedAt: now,
    orgs: 4,
    counts: { sessionsPurged: 2 },
  })),
  logError: vi.fn(),
  auditHeads: vi.fn(async () => 2),
}));
vi.mock("@/lib/reminders", () => ({ processDueReminders: jobs.reminders }));
vi.mock("@/lib/recalls", () => ({ runCareJobs: jobs.care }));
vi.mock("@/lib/privacy/retention", () => ({ runRetention: jobs.retention }));
vi.mock("@/lib/log", () => ({ logError: jobs.logError }));
vi.mock("@/lib/audit", () => ({ logAuditHeads: jobs.auditHeads }));

const { GET: reminders } = await import("./reminders/route");
const { GET: retention, POST: retentionPost } = await import("./retention/route");

const call = (handler: (req: Request) => Promise<Response>, auth?: string) =>
  handler(new Request("https://sorriso.test/api/cron/x", { headers: auth ? { authorization: auth } : {} }));

beforeEach(() => {
  vi.stubEnv("CRON_SECRET", "s3cret");
  for (const f of Object.values(jobs)) f.mockClear();
});
afterEach(() => vi.unstubAllEnvs());

describe("cron routes", () => {
  it.each([
    ["reminders", reminders],
    ["retention", retention],
  ] as const)("%s refuses a missing or wrong secret", async (_, handler) => {
    expect((await call(handler)).status).toBe(401);
    expect((await call(handler, "Bearer nope")).status).toBe(401);
    expect(jobs.reminders).not.toHaveBeenCalled();
    expect(jobs.retention).not.toHaveBeenCalled();
  });

  it("refuses a wrong secret of the right length (compared in constant time)", async () => {
    expect((await call(retention, "Bearer s3crex")).status).toBe(401);
    expect((await call(reminders, "bearer s3cret")).status).toBe(401);
    expect(jobs.retention).not.toHaveBeenCalled();
  });

  it("refuses everything in production when CRON_SECRET is unset", async () => {
    vi.stubEnv("CRON_SECRET", "");
    vi.stubEnv("NODE_ENV", "production");
    expect((await call(retention)).status).toBe(401);
    expect((await call(reminders)).status).toBe(401);
  });

  it("runs the reminders and then the care jobs", async () => {
    const res = await call(reminders, "Bearer s3cret");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      due: 2,
      sent: 2,
      skipped: 0,
      failed: 0,
      care: { recallsSent: 1, risksRefreshed: 3, formInvites: 0 },
    });
    expect(jobs.reminders).toHaveBeenCalledWith({ limit: 500 });
    expect(jobs.care).toHaveBeenCalledTimes(1);
  });

  it("still reports the reminders when the care jobs fail", async () => {
    jobs.care.mockRejectedValueOnce(new Error("care down"));
    const res = await call(reminders, "Bearer s3cret");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, sent: 2, care: null });
    expect(jobs.logError).toHaveBeenCalledWith("cron", expect.any(Error), { step: "care" });
  });

  it("runs retention on GET and POST", async () => {
    const res = await call(retention, "Bearer s3cret");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, orgs: 4, counts: { sessionsPurged: 2 } });
    expect((await call(retentionPost, "Bearer s3cret")).status).toBe(200);
    expect(jobs.retention).toHaveBeenCalledTimes(2);
    expect(jobs.auditHeads).toHaveBeenCalledTimes(2);
  });

  it("still reports retention when logging the audit heads fails", async () => {
    jobs.auditHeads.mockRejectedValueOnce(new Error("db down"));
    const res = await call(retention, "Bearer s3cret");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, orgs: 4 });
    expect(jobs.logError).toHaveBeenCalledWith("cron", expect.any(Error), { step: "audit-heads" });
  });
});
