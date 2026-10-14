import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { LOCALES, type Locale } from "@/i18n/config";
import { I18nProvider } from "@/i18n/provider";
// Tests run in Node and load the dictionaries directly; components themselves use useT().
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { getMessages, getT } from "@/i18n/t";
import type { PublicClinic } from "@/lib/directory";
import { BookingFlow, flowReducer, initialFlowState, type FlowState } from "./BookingFlow";
import { CONFIRM_WORD, SLOT_GONE_CODES, apiErrorText, apiFieldErrors } from "./DetailsStep";
import type { PickedSlot } from "./SlotPicker";

const clinic: PublicClinic = {
  org: {
    id: "org1",
    slug: "studio-test",
    name: "Studio Test",
    description: null,
    phone: "+39 02 1234 5678",
    email: "info@studio.test",
    website: null,
    brandColor: "#0c675d",
    timezone: "Europe/Rome",
  },
  booking: { requireApproval: false, maxAdvanceDays: 60, cancelUntilHours: 24 },
  locations: [
    { id: "loc1", name: "Milano", address: "Via Roma 1", city: "Milano", postalCode: "20100", phone: null, lat: null, lng: null, timezone: "Europe/Rome" },
  ],
  practitioners: [
    {
      id: "pr1",
      slug: "anna",
      title: "Dr.",
      name: "Anna Rossi",
      specialty: "Dentist",
      bio: null,
      languages: "Italiano",
      color: "#0c675d",
      acceptsNewPatients: true,
      serviceIds: ["sv1"],
      locationIds: ["loc1"],
      rating: null,
    },
  ],
  services: [{ id: "sv1", name: "Visit", category: "checkup", description: null, durationMinutes: 30, priceCents: 5000 }],
  privacy: { whatsappEnabled: false, marketingEnabled: false },
  legal: { controllerName: "Studio Test S.r.l.", hasDpo: false },
};

const START = "2026-10-20T08:30:00.000Z";
const slot: PickedSlot = { start: START, end: "2026-10-20T09:00:00.000Z", time: "10:30", date: "2026-10-20", practitionerId: "pr1", locationId: "loc1" };

/** A visitor who typed everything, ticked the privacy choices and picked a time. */
function filledState(): FlowState {
  let s = initialFlowState(clinic, { serviceId: "sv1" }, "2026-10-14", "de");
  s = flowReducer(s, { type: "pickSlot", slot });
  s = flowReducer(s, {
    type: "form",
    patch: {
      details: {
        firstName: "Ada",
        lastName: "Neri",
        email: "ada@example.com",
        phone: "0151 2345678",
        phoneCountry: "49",
        birthDate: "1990-04-02",
        note: "Anxious about needles",
        isNewPatient: "no",
        preferredChannel: "email",
        locale: "pl",
        website: "",
      },
      privacy: { noticeAck: false, platformConsent: true, whatsapp: false, feedback: true, marketing: false },
      relation: {
        bookedFor: "minor",
        guardian: { name: "Eva Neri", relation: "parent", phone: "+393331112223", email: "" },
        bookedBy: { name: "", phone: "", email: "" },
      },
      relationAsked: true,
      extras: { fundId: "fund-1" },
    },
  });
  return s;
}

describe("flowReducer", () => {
  it("returns to the times with an alert when the slot was taken, keeping every typed field (WCAG 3.3.7)", () => {
    const before = filledState();
    expect(before.step).toBe("details");
    const after = flowReducer(before, { type: "slotTaken" });
    expect(after.step).toBe("time");
    expect(after.slot).toBeNull();
    expect(after.slotTaken).toBe(true);
    expect(after.focusRequest).toBe(before.focusRequest + 1);
    // Names, contacts, birth date, note, channel, language, privacy and relation choices, extras.
    expect(after.form).toStrictEqual(before.form);
    expect(after.serviceId).toBe("sv1");

    // A new slot, and the details step opens with everything still filled in.
    const again = flowReducer(after, { type: "pickSlot", slot: { ...slot, start: "2026-10-21T08:30:00.000Z" } });
    expect(again.step).toBe("details");
    expect(again.slotTaken).toBe(false);
    expect(again.form).toStrictEqual(before.form);
  });

  it("keeps the form when going back, changing service or practitioner", () => {
    const before = filledState();
    for (const action of [
      { type: "goto", step: "time" },
      { type: "goto", step: "service" },
      { type: "selectService", serviceId: "sv1", keepPractitioner: true },
      { type: "setPractitioner", practitionerId: "pr1" },
      { type: "setLocation", locationId: "loc1" },
    ] as const) {
      expect(flowReducer(before, action).form).toStrictEqual(before.form);
    }
  });

  it("requests focus on every step change but not on the first render", () => {
    const s = initialFlowState(clinic, {}, "2026-10-14", "it");
    expect(s.step).toBe("service");
    expect(s.focusRequest).toBe(0);
    const t1 = flowReducer(s, { type: "selectService", serviceId: "sv1", keepPractitioner: false });
    expect(t1.step).toBe("time");
    expect(t1.focusRequest).toBe(1);
    // Picking a practitioner or office is not a step change.
    expect(flowReducer(t1, { type: "setPractitioner", practitionerId: "pr1" }).focusRequest).toBe(1);
  });

  it("merges field changes into the current details, so autofill filling several fields at once loses none", () => {
    let s = initialFlowState(clinic, {}, "2026-10-14", "it");
    // Two changes dispatched before a re-render, as browser autofill does.
    s = flowReducer(s, { type: "contact", patch: { firstName: "Ada" } });
    s = flowReducer(s, { type: "contact", patch: { lastName: "Neri" } });
    s = flowReducer(s, { type: "contact", patch: { email: "ada@example.com" } });
    expect(s.form.details).toMatchObject({ firstName: "Ada", lastName: "Neri", email: "ada@example.com", locale: "it" });
  });

  it("starts the message language on the page language", () => {
    for (const l of LOCALES) expect(initialFlowState(clinic, {}, "2026-10-14", l).form.details.locale).toBe(l);
  });
});

function renderFlow(locale: Locale, c: PublicClinic = clinic) {
  const messages = getMessages(locale, ["common", "a11y", "booking", "errors", "consents"]);
  return renderToStaticMarkup(
    h(I18nProvider, {
      locale,
      messages,
      children: h(BookingFlow, {
        clinic: c,
        today: "2026-10-14",
        context: "practice",
        initial: { serviceId: "sv1", practitionerId: "pr1", locationId: "loc1", start: START },
      }),
    }),
  );
}

describe("BookingFlow (server render)", () => {
  it.each(LOCALES)("defaults the message language to the page language (%s) and lists all 8 endonyms", (locale) => {
    const html = renderFlow(locale);
    const select = /<select[^>]*>((?:(?!<\/select>).)*lang="it"(?:(?!<\/select>).)*)<\/select>/s.exec(html)?.[1] ?? "";
    expect(select).toMatch(new RegExp(`<option value="${locale}" lang="${locale}" selected="">`));
    for (const l of LOCALES) expect(select).toContain(`value="${l}" lang="${l}"`);
    expect(select.match(/selected=""/g)).toHaveLength(1);
  });

  it("labels the stepper and marks the current step", () => {
    const html = renderFlow("en");
    expect(html).toMatch(/<ol aria-label="Booking steps"/);
    expect(html.match(/aria-current="step"/g)).toHaveLength(1);
    expect(html).toMatch(/aria-current="step"[^>]*>(?:(?!<\/li>).)*Your details/s);
  });

  it("gives the step heading tabIndex -1 so focus can move to it", () => {
    expect(renderFlow("it")).toMatch(/<h2 id="[^"]+" tabindex="-1"[^>]*>/);
  });

  it("offers WhatsApp only when the practice enabled it", () => {
    expect(renderFlow("en")).not.toContain('value="whatsapp"');
    expect(renderFlow("en", { ...clinic, privacy: { whatsappEnabled: true, marketingEnabled: false } })).toContain('value="whatsapp"');
  });

  it("defaults the dial code to the practice's country and posts it from a select", () => {
    expect(renderFlow("de")).toMatch(/<option value="39" selected="">\+39<\/option>/);
  });

  it("sets autocomplete=bday on the birth date and limits the note to 500 characters", () => {
    const html = renderFlow("en");
    expect(html).toMatch(/type="date"[^>]*autoComplete="bday"|autoComplete="bday"[^>]*type="date"/i);
    expect(html).toMatch(/<textarea[^>]*maxLength="500"/i);
    expect(html).toContain("Visible only to the practice. Don&#x27;t include information you don&#x27;t want to share.");
  });

  it("names the reply word of the chosen message language in the phone hint", () => {
    expect(renderFlow("en")).toContain("Reply YES to confirm.");
    expect(renderFlow("it")).toMatch(/SI/);
    expect(CONFIRM_WORD).toEqual({ it: "SI", en: "YES", de: "JA", fr: "OUI", es: "SI", pt: "SIM", ro: "DA", pl: "TAK" });
  });

  it("ignores the browser language: the page decides", () => {
    vi.stubGlobal("navigator", { language: "fr-FR", languages: ["fr-FR", "fr"] });
    try {
      expect(renderFlow("de")).toMatch(/<option value="de" lang="de" selected="">/);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("API errors", () => {
  const te = getT("de", "errors");
  const en = getT("en", "errors");

  it("maps codes to errors.api texts, unknown codes to the generic text", () => {
    expect(apiErrorText(en, "not_accepting")).toBe(en("api.not_accepting"));
    expect(apiErrorText(en, "guardian_required")).toBe(en("api.guardian_required"));
    expect(apiErrorText(en, "made_up")).toBe(en("generic"));
    expect(apiErrorText(en, undefined)).toBe(en("generic"));
    expect(apiErrorText(te, "rate_limited")).toBe(te("api.rate_limited"));
  });

  it("maps validation issues and rule fields to localised field errors", () => {
    const fields = apiFieldErrors(en, {
      code: "validation_error",
      issues: [
        { path: "patient.email", message: "Invalid email" },
        { path: "patient.firstName", message: "First name is required" },
        { path: "patient.phoneCountry", message: "Invalid country code" },
      ],
    });
    expect(fields).toEqual({
      email: en("fields.invalidEmail"),
      firstName: en("fields.required"),
      phoneCountry: en("fields.invalidCountryCode"),
    });
    expect(apiFieldErrors(en, { code: "guardian_name_required", field: "relation.guardian.name", message: "x" })).toEqual({
      "guardian.name": en("api.guardian_name_required"),
    });
  });

  it("treats every slot conflict as a taken slot", () => {
    for (const code of ["practitioner_busy", "no_room", "time_off", "too_soon"]) expect(SLOT_GONE_CODES.has(code)).toBe(true);
    expect(SLOT_GONE_CODES.has("validation_error")).toBe(false);
  });
});
