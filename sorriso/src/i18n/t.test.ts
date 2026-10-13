import { spawnSync } from "node:child_process";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const ROOT = path.resolve(__dirname, "../..");

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("i18n/t outside Next", () => {
  // vitest aliases "server-only" to an empty module, so only a real tsx run shows whether a
  // script (npm run reminders, retention, seed) can reach getT, the OTP sender and the
  // consent ledger (which audits) without the react-server condition.
  it("loads under plain tsx, with the modules scripts reach", () => {
    const code = [
      'Promise.all([import("./src/i18n/t.ts"), import("./src/lib/otp.ts"), import("./src/lib/privacy/consent.ts")])',
      '.then(([m]) => process.stdout.write((m.getT ?? m.default.getT)("it", "consents")("marketing.label", { practice: "X" })))',
      ".catch((e) => { process.stderr.write(String(e && e.message)); process.exit(1); });",
    ].join("");
    const r = spawnSync(path.join(ROOT, "node_modules/.bin/tsx"), ["-e", code], { cwd: ROOT, env: process.env, encoding: "utf8" });
    expect(r.stderr).toBe("");
    expect(r.stdout).toBe("Desidero ricevere novità e offerte da X.");
  });

  it("refuses to load the dictionaries in a browser", async () => {
    vi.stubGlobal("window", {});
    await expect(import("./registry")).rejects.toThrow(/browser/);
  });
});
