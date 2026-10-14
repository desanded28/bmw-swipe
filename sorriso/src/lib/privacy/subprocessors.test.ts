import { afterEach, describe, expect, it, vi } from "vitest";
import { assertSubprocessorsConfigured, getSubprocessors, missingSubprocessorConfig } from "./subprocessors";

afterEach(() => vi.unstubAllEnvs());

const smtp = () => getSubprocessors().find((s) => s.id === "smtp")!;
const unsetSmtpProvider = () => {
  for (const k of ["SMTP_PROVIDER_NAME", "SMTP_PROVIDER_ENTITY", "SMTP_PROVIDER_REGION", "SMTP_PROVIDER_TRANSFER"]) vi.stubEnv(k, "");
};

describe("the SMTP sub-processor", () => {
  it("never claims a region the deployment didn't state, and is treated as a transfer", () => {
    unsetSmtpProvider();
    expect(smtp()).toMatchObject({ region: null, transfer: "dpf+scc", tia: true });
    expect(missingSubprocessorConfig()).toEqual(["SMTP_PROVIDER_NAME", "SMTP_PROVIDER_ENTITY", "SMTP_PROVIDER_REGION"]);
  });

  it("is described by the environment", () => {
    vi.stubEnv("SMTP_PROVIDER_NAME", "Mailer");
    vi.stubEnv("SMTP_PROVIDER_ENTITY", "Mailer GmbH");
    vi.stubEnv("SMTP_PROVIDER_REGION", "EU — Germany");
    vi.stubEnv("SMTP_PROVIDER_TRANSFER", "eu");
    expect(smtp()).toMatchObject({ name: "Mailer", legalEntity: "Mailer GmbH", region: "EU — Germany", transfer: "eu", tia: false });
    expect(missingSubprocessorConfig()).toEqual([]);
  });

  it("refuses to start in production with SMTP but no provider identity", () => {
    unsetSmtpProvider();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SMTP_URL", "smtp://user:pass@smtp.example.com:587");
    expect(() => assertSubprocessorsConfigured()).toThrow(/SMTP_PROVIDER_NAME, SMTP_PROVIDER_ENTITY, SMTP_PROVIDER_REGION/);
    vi.stubEnv("SMTP_URL", "");
    expect(() => assertSubprocessorsConfigured()).not.toThrow();
    vi.stubEnv("SMTP_URL", "smtp://x");
    vi.stubEnv("NODE_ENV", "development");
    expect(() => assertSubprocessorsConfigured()).not.toThrow();
  });
});
