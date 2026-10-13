import { describe, expect, it } from "vitest";
import { MEMBERSHIP_ROLES } from "@/db/enums";
import { assertPermission, can, PERMISSIONS, PermissionError, permissionsFor, ROLE_PERMISSIONS } from "./permissions";

describe("permission matrix", () => {
  it("owners can do everything; admins everything but closing the account", () => {
    for (const p of PERMISSIONS) expect(can("owner", p)).toBe(true);
    expect(PERMISSIONS.filter((p) => !can("admin", p))).toEqual(["org.close"]);
  });

  it("reception books and edits patients, reads appointment notes (F6), never the clinical record", () => {
    expect(permissionsFor("reception").sort()).toEqual(
      [
        "appointment.notes.read",
        "appointment.notes.write",
        "appointment.write",
        "calendar.read",
        "messages.read",
        "patient.contact.read",
        "patient.read",
        "patient.write",
        "recalls.manage",
      ].sort(),
    );
    expect(can("reception", "patient.clinical.read")).toBe(false);
    expect(can("reception", "patient.notes.read")).toBe(false);
  });

  it("practitioners read clinical data but manage nothing", () => {
    expect(permissionsFor("practitioner").sort()).toEqual(
      [
        "appointment.notes.read",
        "appointment.notes.write",
        "appointment.write",
        "calendar.read",
        "messages.read",
        "patient.clinical.read",
        "patient.contact.read",
        "patient.notes.read",
        "patient.read",
        "recalls.manage",
      ].sort(),
    );
    for (const p of ["settings.manage", "team.manage", "audit.read", "patient.export", "patient.erase", "privacy.settings"] as const) {
      expect(can("practitioner", p)).toBe(false);
    }
  });

  it("only grants known permissions, without duplicates", () => {
    for (const role of MEMBERSHIP_ROLES) {
      const perms = ROLE_PERMISSIONS[role];
      expect(new Set(perms).size).toBe(perms.length);
      for (const p of perms) expect(PERMISSIONS).toContain(p);
    }
  });

  it("denies a missing role", () => {
    expect(can(null, "calendar.read")).toBe(false);
    expect(can(undefined, "calendar.read")).toBe(false);
  });
});

describe("assertPermission", () => {
  it("throws a PermissionError with code forbidden", () => {
    expect(() => assertPermission({ role: "owner" }, "org.close")).not.toThrow();
    let caught: unknown;
    try {
      assertPermission({ role: "reception" }, "patient.clinical.read");
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(PermissionError);
    expect(caught).toMatchObject({ code: "forbidden", permission: "patient.clinical.read" });
  });
});
