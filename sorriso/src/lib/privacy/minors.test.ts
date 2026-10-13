import { describe, expect, it } from "vitest";
import type { BookingRelationInput } from "./consent";
import { validateBookingRelation } from "./minors";

// 9:00 in Rome on 4 March 2030.
const AT = new Date("2030-03-04T08:00:00Z");
const guardian = { name: "Anna Bianchi", relation: "parent" as const, phone: "+393339999999", email: null };
const minor = (g: Partial<NonNullable<BookingRelationInput["guardian"]>> | null = {}): BookingRelationInput => ({
  bookedFor: "minor",
  guardian: g === null ? undefined : { ...guardian, ...g },
});

describe("validateBookingRelation", () => {
  it("lets adults and patients from 14 book for themselves", () => {
    expect(validateBookingRelation({ bookedFor: "self" }, "1990-01-01", AT, "marketplace", AT)).toEqual({ ok: true });
    expect(validateBookingRelation({ bookedFor: "self" }, "2016-03-04", AT, "practice", AT)).toEqual({ ok: true });
    expect(validateBookingRelation({ bookedFor: "self" }, null, AT, "practice", AT)).toEqual({ ok: true });
  });

  it("requires a guardian under 14", () => {
    expect(validateBookingRelation({ bookedFor: "self" }, "2016-03-05", AT, "practice", AT)).toEqual({
      ok: false,
      code: "guardian_required",
      field: "bookedFor",
    });
  });

  it("decides the under-14 rule at booking time, the instant the consent ledger checks", () => {
    // 13 when booking, 14 on the day of the appointment.
    const now = new Date("2030-03-01T09:00:00Z");
    const appointment = new Date("2030-04-15T09:00:00Z");
    for (const ctx of ["marketplace", "practice"] as const) {
      expect(validateBookingRelation({ bookedFor: "self" }, "2016-04-01", appointment, ctx, now)).toEqual({
        ok: false,
        code: "guardian_required",
        field: "bookedFor",
      });
      expect(validateBookingRelation(minor(), "2016-04-01", appointment, ctx, now)).toEqual({ ok: true });
    }
    expect(validateBookingRelation({ bookedFor: "self" }, "2016-04-01", appointment, "marketplace", new Date("2030-04-01T09:00:00Z"))).toEqual({ ok: true });
  });

  it("requires a valid birth date under 18 for a minor", () => {
    expect(validateBookingRelation(minor(), null, AT, "practice", AT)).toMatchObject({ code: "birthdate_required", field: "birthDate" });
    expect(validateBookingRelation(minor(), "04/03/2020", AT, "practice", AT)).toMatchObject({ code: "invalid_birthdate" });
    expect(validateBookingRelation(minor(), "2031-01-01", AT, "practice", AT)).toMatchObject({ code: "invalid_birthdate" });
    expect(validateBookingRelation(minor(), "2012-03-04", AT, "practice", AT)).toMatchObject({ code: "not_a_minor" });
    expect(validateBookingRelation(minor(), "2012-03-05", AT, "practice", AT)).toEqual({ ok: true });
    expect(validateBookingRelation(minor(), "2020-06-01", AT, "marketplace", AT)).toEqual({ ok: true });
  });

  it("requires the guardian's name, relation and a contact", () => {
    expect(validateBookingRelation(minor(null), "2020-06-01", AT, "practice", AT)).toMatchObject({ code: "guardian_name_required", field: "guardian.name" });
    expect(validateBookingRelation(minor({ name: "  " }), "2020-06-01", AT, "practice", AT)).toMatchObject({ code: "guardian_name_required" });
    expect(
      validateBookingRelation(minor({ relation: undefined as never }), "2020-06-01", AT, "practice", AT),
    ).toMatchObject({ code: "guardian_relation_required", field: "guardian.relation" });
    expect(validateBookingRelation(minor({ phone: null, email: " " }), "2020-06-01", AT, "practice", AT)).toMatchObject({
      code: "guardian_contact_required",
    });
    expect(validateBookingRelation(minor({ phone: null, email: "anna@example.com" }), "2020-06-01", AT, "practice", AT)).toEqual({ ok: true });
  });

  it("refuses bookings for another adult on the marketplace only", () => {
    expect(validateBookingRelation({ bookedFor: "other_adult" }, "1980-01-01", AT, "marketplace", AT)).toEqual({
      ok: false,
      code: "other_adult_must_book_themselves",
      field: "bookedFor",
    });
    expect(validateBookingRelation({ bookedFor: "other_adult" }, "1980-01-01", AT, "practice", AT)).toEqual({ ok: true });
  });
});
