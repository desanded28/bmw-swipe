import { describe, expect, it } from "vitest";
import { negotiate } from "./negotiate";

describe("negotiate", () => {
  it.each([
    ["de-CH", "de"],
    ["pt-BR", "pt"],
    ["en-US", "en"],
    ["zh-CN", null],
    ["it", "it"],
    ["FR-fr", "fr"],
    ["ro_RO", "ro"],
    ["zh-CN,zh;q=0.9,pl;q=0.8,en;q=0.5", "pl"],
    ["en;q=0.4,de;q=0.9", "de"],
    ["es;q=0.8,fr;q=0.8", "es"],
    ["de;q=0,en", "en"],
    ["de;q=0", null],
    ["*", null],
    ["*;q=1,ro;q=0.1", "ro"],
    ["xx, ,;q=1, en-GB ; q=0.7", "en"],
    ["en;q=abc,it;q=0.2", "it"],
    ["", null],
  ])("%j -> %j", (header, expected) => {
    expect(negotiate(header)).toBe(expected);
  });

  it("accepts null and undefined", () => {
    expect(negotiate(null)).toBeNull();
    expect(negotiate(undefined)).toBeNull();
  });
});
