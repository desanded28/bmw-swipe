import { describe, expect, it } from "vitest";
import { z } from "zod";
import { LOCALES } from "./config";
import { zodErrorMap } from "./zod";

describe("zodErrorMap", () => {
  const schema = z.object({ name: z.string().min(2), email: z.email() });
  const bad = { name: "a", email: "nope" };

  it("localises messages per parse, without touching the global config", () => {
    const messages = (error?: ReturnType<typeof zodErrorMap>) =>
      schema.safeParse(bad, error ? { error } : undefined).error?.issues.map((i) => i.message) ?? [];
    const en = messages();
    const it_ = messages(zodErrorMap("it"));
    expect(it_).toHaveLength(2);
    expect(it_).not.toEqual(en);
    expect(it_.join(" ")).toMatch(/email/i);
    // The default (English) map is unaffected by the per-parse one.
    expect(messages()).toEqual(en);
  });

  it("exists for every locale and is cached", () => {
    for (const l of LOCALES) expect(zodErrorMap(l)).toBe(zodErrorMap(l));
    const pl = schema.safeParse(bad, { error: zodErrorMap("pl") }).error?.issues[0].message;
    const de = schema.safeParse(bad, { error: zodErrorMap("de") }).error?.issues[0].message;
    expect(pl).not.toEqual(de);
  });
});
