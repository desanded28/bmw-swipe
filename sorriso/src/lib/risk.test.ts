import { describe, expect, it } from "vitest";
import { NO_CARE_FLAGS } from "@/components/dashboard/slots/contracts";
import { permissionsFor } from "./permissions";
import { loadCareFlags } from "./risk";

describe("loadCareFlags (stub contract)", () => {
  it("returns an entry for every id, with nothing to show yet", async () => {
    const flags = await loadCareFlags("org1", ["a1", "a2"], permissionsFor("reception"));
    expect([...flags.keys()]).toEqual(["a1", "a2"]);
    for (const f of flags.values()) expect(f).toEqual(NO_CARE_FLAGS);
    expect(flags.get("a1")).not.toBe(flags.get("a2"));
    expect((await loadCareFlags("org1", [], permissionsFor("owner"))).size).toBe(0);
  });
});
