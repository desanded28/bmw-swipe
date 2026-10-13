import { describe, expect, it } from "vitest";
import { PROCESSING_PURPOSES, PURPOSES } from "./roles";

describe("PURPOSES", () => {
  // The register, the notices and the DPA annex are generated from this table: a special-category
  // purpose without an Art. 9(2) condition would be published as such.
  it("gives every purpose that processes health data an Art. 9(2) condition", () => {
    const missing = PROCESSING_PURPOSES.filter((p) => {
      const health = PURPOSES[p].dataCategories.some((c) => c === "health" || c === "health_inferred");
      return health && !PURPOSES[p].legalBases.some((b) => b.startsWith("art9_"));
    });
    expect(missing).toEqual([]);
  });

  it("gives every purpose an Art. 6(1) basis", () => {
    expect(PROCESSING_PURPOSES.filter((p) => !PURPOSES[p].legalBases.some((b) => b.startsWith("art6_")))).toEqual([]);
  });
});
