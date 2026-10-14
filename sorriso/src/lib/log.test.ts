import { afterEach, describe, expect, it, vi } from "vitest";
import { logError, logInfo, maskEmail, maskPhone, redact } from "./log";

function capture(stream: NodeJS.WriteStream) {
  const lines: string[] = [];
  vi.spyOn(stream, "write").mockImplementation((chunk: string | Uint8Array) => {
    lines.push(String(chunk));
    return true;
  });
  return lines;
}

afterEach(() => vi.restoreAllMocks());

describe("masking", () => {
  it("masks phones and emails", () => {
    expect(maskPhone("+393331234567")).toBe("+39•••4567");
    expect(maskPhone("+39 333 123 4567")).toBe("+39•••4567");
    expect(maskPhone("12345")).toBe("•••");
    expect(maskEmail("mario.rossi@dominio.it")).toBe("m•••@d•••");
    expect(maskEmail("not-an-email")).toBe("•••");
  });
});

describe("redact", () => {
  it("masks E.164 numbers and emails inside text", () => {
    expect(redact("The 'To' number +393331234567 is not a valid phone number.")).toBe(
      "The 'To' number +39•••4567 is not a valid phone number.",
    );
    expect(redact("to whatsapp:+447700900123 failed")).toBe("to whatsapp:+44•••0123 failed");
    expect(redact("call +39 02 1234 5678 now")).toBe("call +39•••5678 now");
    expect(redact("550 mailbox anna.bianchi+test@example.co.uk unavailable")).toBe("550 mailbox a•••@e••• unavailable");
  });

  it("masks numbers written without + (national, 00, bare country code, URL-encoded)", () => {
    expect(redact("call 3331234567 now")).toBe("call •••4567 now");
    expect(redact("to 333 1234567 and 333 123 4567 and 333-123-4567")).toBe("to •••4567 and •••4567 and •••4567");
    expect(redact("landline 02 12345678 or 0612345678")).toBe("landline •••5678 or •••5678");
    expect(redact("0039 333 1234567")).toBe("+39•••4567");
    expect(redact("0044 7700 900123")).toBe("+44•••0123");
    expect(redact("393331234567")).toBe("+39•••4567");
    expect(redact("To=%2B393331234567&Body=x")).toBe("To=+39•••4567&Body=x");
    expect(redact("To=%2b447700900123")).toBe("To=+44•••0123");
  });

  it("leaves ids, timestamps and offsets alone", () => {
    const text = "appointment=Ab12Cd34Ef56 at=2026-10-13T09:00:00+01:00 ms=1760000000000 count=+12";
    expect(redact(text)).toBe(text);
    const more = "code 21211 status=503 port=3010 took 0.375s date=13-10-2026 time=08:30 ids=Xy3331234567z,3331234 v=1.2.3";
    expect(redact(more)).toBe(more);
  });

  it("drops drizzle's bound parameters, including multi-line values", () => {
    const msg = 'Failed query: insert into "patients" ("id", "first_name", "notes") values (?, ?, ?)\nparams: p1,Mario,allergic to\npenicillin';
    const out = redact(`${msg}\n    at insert (file.js:1:1)`);
    expect(out).not.toMatch(/Mario|penicillin/);
    expect(out).toContain("params: [redacted]");
    expect(out).toContain('insert into "patients"');
    expect(out).toContain("at insert (file.js:1:1)");
  });
});

describe("logError / logInfo", () => {
  it("writes one redacted entry to stderr, causes included", () => {
    const lines = capture(process.stderr);
    const cause = Object.assign(new Error("SQLITE_CONSTRAINT: UNIQUE constraint failed: patients.phone"), { code: "SQLITE_CONSTRAINT" });
    const err = new Error('Failed query: update "patients" set "phone" = ?\nparams: +393331234567,mario@example.com', { cause });
    logError("booking", err, { orgId: "org1", attempt: 2 });
    expect(lines).toHaveLength(1);
    const [line] = lines;
    expect(line.split("\n")[0]).toBe('[booking] Error: Failed query: update "patients" set "phone" = ? orgId=org1 attempt=2');
    expect(line).toContain("params: [redacted]");
    expect(line).toContain("caused by: [SQLITE_CONSTRAINT] Error: SQLITE_CONSTRAINT: UNIQUE constraint failed");
    expect(line).not.toMatch(/3331234567|mario@/);
    expect(line.endsWith("\n")).toBe(true);
  });

  it("handles non-Error throwables and redacts meta", () => {
    const lines = capture(process.stderr);
    logError("messaging", "21211: invalid To +393331234567", { channel: "sms", to: "+393331234567" });
    logError("x", { status: 500 });
    expect(lines[0]).toBe("[messaging] 21211: invalid To +39•••4567 channel=sms to=+39•••4567\n");
    expect(lines[1]).toBe('[x] {"status":500}\n');
  });

  it("writes info to stdout", () => {
    const lines = capture(process.stdout);
    logInfo("reminders", "tick", { due: 3, sent: 2, note: "has spaces" });
    expect(lines).toEqual(['[reminders] tick due=3 sent=2 note="has spaces"\n']);
  });
});
