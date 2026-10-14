import { describe, expect, it } from "vitest";
import { MEMBERSHIP_ROLES } from "@/db/enums";
import { assertPermission, can, PERMISSIONS, PermissionError, permissionsFor, ROLE_PERMISSIONS, visiblePatient } from "./permissions";

describe("permission matrix", () => {
  /**
   * The whole role x permission matrix. A change here is a change to who can see health data:
   * review it as such (and update docs/security.md).
   */
  it("matches the reviewed matrix", () => {
    const matrix = Object.fromEntries(
      PERMISSIONS.map((p) => [p, MEMBERSHIP_ROLES.filter((r) => can(r, p)).join(" ")]),
    );
    expect(matrix).toMatchInlineSnapshot(`
      {
        "analytics.read": "owner admin",
        "apikeys.manage": "owner admin",
        "appointment.notes.read": "owner admin reception practitioner",
        "appointment.notes.write": "owner admin reception practitioner",
        "appointment.write": "owner admin reception practitioner",
        "audit.read": "owner admin",
        "calendar.read": "owner admin reception practitioner",
        "catalog.manage": "owner admin",
        "legal.accept": "owner admin",
        "messages.read": "owner admin reception practitioner",
        "messages.simulate": "owner admin",
        "org.close": "owner",
        "org.export": "owner admin",
        "patient.clinical.read": "owner admin practitioner",
        "patient.contact.read": "owner admin reception practitioner",
        "patient.erase": "owner admin",
        "patient.export": "owner admin",
        "patient.notes.read": "owner admin practitioner",
        "patient.read": "owner admin reception practitioner",
        "patient.restrict": "owner admin",
        "patient.restricted.read": "owner admin",
        "patient.write": "owner admin reception",
        "privacy.requests": "owner admin",
        "privacy.settings": "owner admin",
        "recalls.manage": "owner admin reception practitioner",
        "reminders.manage": "owner admin",
        "reminders.run": "owner admin",
        "reviews.reply": "owner admin",
        "reviews.report": "owner admin",
        "settings.manage": "owner admin",
        "team.manage": "owner admin",
      }
    `);
  });

  it("owners can do everything; admins everything but closing the account", () => {
    for (const p of PERMISSIONS) expect(can("owner", p)).toBe(true);
    expect(PERMISSIONS.filter((p) => !can("admin", p))).toEqual(["org.close"]);
  });

  it("reception never reads clinical notes or the clinical record", () => {
    expect(can("reception", "patient.clinical.read")).toBe(false);
    expect(can("reception", "patient.notes.read")).toBe(false);
    expect(() => assertPermission({ role: "reception" }, "patient.notes.read")).toThrow(PermissionError);
  });

  it("practitioners read clinical data but manage nothing", () => {
    for (const p of ["settings.manage", "team.manage", "audit.read", "patient.export", "patient.erase", "privacy.settings", "apikeys.manage"] as const) {
      expect(can("practitioner", p)).toBe(false);
    }
  });

  it("only grants known permissions, without duplicates", () => {
    for (const role of MEMBERSHIP_ROLES) {
      const perms = ROLE_PERMISSIONS[role];
      expect(new Set(perms).size).toBe(perms.length);
      for (const p of perms) expect(PERMISSIONS).toContain(p);
      expect(permissionsFor(role).sort()).toEqual([...perms].sort());
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

describe("visiblePatient", () => {
  const patient = { id: "p1", firstName: "Gino", notes: "allergic to penicillin" };

  it("drops the clinical notes for roles without patient.notes.read", () => {
    expect(visiblePatient("reception", patient)).toEqual({ ...patient, notes: null });
    expect(visiblePatient(null, patient).notes).toBeNull();
  });

  it("keeps them for clinicians and managers", () => {
    for (const role of ["practitioner", "owner", "admin"] as const) expect(visiblePatient(role, patient)).toBe(patient);
  });
});
