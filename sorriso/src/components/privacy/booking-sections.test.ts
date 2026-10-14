import { createElement as h, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Locale } from "@/i18n/config";
import { I18nProvider } from "@/i18n/provider";
// Tests run in Node and load the dictionaries directly; components themselves use useT().
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { getMessages } from "@/i18n/t";
import type { PublicClinic } from "@/lib/directory";
import { INITIAL_PRIVACY, INITIAL_RELATION, type PrivacySectionProps, type RelationState } from "../booking/contracts";
import { ManagePrivacyCard } from "../booking/ManagePrivacyCard";
import { PatientRelationSection } from "../booking/PatientRelationSection";
import { PrivacySection } from "../booking/PrivacySection";

/** The booking-form sections (WP4) as the book and embed pages render them: with the privacy and consents namespaces. */
function render(node: ReactElement, locale: Locale = "en") {
  const messages = getMessages(locale, ["common", "errors", "booking", "privacy", "consents"]);
  return renderToStaticMarkup(h(I18nProvider, { locale, messages, children: node }));
}

const clinic = {
  org: { id: "org1", slug: "studio-test", name: "Studio Test", description: null, phone: null, email: null, website: null, brandColor: "#0c675d", timezone: "Europe/Rome" },
  booking: { requireApproval: false, maxAdvanceDays: 60, cancelUntilHours: 24 },
  locations: [],
  practitioners: [],
  services: [],
  privacy: { whatsappEnabled: true, marketingEnabled: false },
  legal: { controllerName: "Studio Test S.r.l.", hasDpo: false },
} as unknown as PublicClinic;

const privacy = (over: Partial<PrivacySectionProps> = {}) =>
  h(PrivacySection, {
    clinic,
    context: "practice",
    variant: "booking",
    preferredChannel: "sms",
    relation: INITIAL_RELATION,
    value: INITIAL_PRIVACY,
    onChange: () => {},
    errors: {},
    ...over,
  });

const checkboxes = (html: string) => html.match(/<input[^>]*type="checkbox"[^>]*>/g) ?? [];

describe("PrivacySection", () => {
  it("shows the first layer and the notice links, with no acknowledgement box and nothing ticked", () => {
    const html = render(privacy());
    expect(html).toContain("Studio Test S.r.l. uses your details");
    expect(html).toContain('href="/en/c/studio-test/privacy"');
    expect(html).toContain('href="/en/c/studio-test/privacy/minors"');
    expect(html).not.toContain('href="/en/legal/privacy"');
    // Only the optional feedback invitation: no Art. 9 box outside the marketplace, no acknowledgement.
    expect(checkboxes(html)).toHaveLength(1);
    for (const c of checkboxes(html)) expect(c).not.toContain("checked");
  });

  it("asks the Art. 9 consent on the marketplace only, unticked and required, in the authoritative Italian wording", () => {
    const html = render(privacy({ context: "marketplace" }), "it");
    expect(html).toContain(
      "Acconsento al trattamento da parte di Sorriso dei dati relativi alla mia prenotazione, che possono rivelare informazioni sulla mia salute, per inoltrarla allo studio scelto e gestire promemoria e modifiche.",
    );
    expect(html).toContain('href="/it/legal/privacy"');
    const boxes = checkboxes(html);
    expect(boxes.some((b) => b.includes('aria-required="true"'))).toBe(true);
    for (const c of boxes) expect(c).not.toContain("checked");
    expect(html).toContain("Dopo la visita, inviatemi un breve invito a lasciare un feedback");
  });

  it("shows the WhatsApp notice and confirmation only when WhatsApp is chosen and offered", () => {
    expect(render(privacy({ preferredChannel: "whatsapp" }))).toContain("Meta");
    expect(render(privacy({ preferredChannel: "sms" }))).not.toContain("Meta");
    const off = { ...clinic, privacy: { whatsappEnabled: false, marketingEnabled: false } } as PublicClinic;
    expect(render(privacy({ preferredChannel: "whatsapp", clinic: off }))).not.toContain("Meta");
  });

  it("offers news and offers only where the practice runs them, and nothing optional on the waitlist", () => {
    expect(render(privacy())).not.toContain("news and offers from Studio Test");
    const on = { ...clinic, privacy: { whatsappEnabled: false, marketingEnabled: true } } as PublicClinic;
    expect(render(privacy({ clinic: on }))).toContain("news and offers from Studio Test");
    expect(checkboxes(render(privacy({ variant: "waitlist" })))).toHaveLength(0);
  });

  it("marks a refused box invalid with its message", () => {
    const html = render(privacy({ context: "marketplace", errors: { platformConsent: "Please consent to continue" } }));
    expect(html).toMatch(/aria-invalid="true"/);
    expect(html).toContain("Please consent to continue");
  });

  it("adds the Art. 14 line when booking for another adult", () => {
    expect(render(privacy({ relation: { ...INITIAL_RELATION, bookedFor: "other_adult" } }))).toContain("Art. 14 GDPR");
  });
});

const relation = (value: RelationState, birthDate = "", errors: Record<string, string> = {}) =>
  render(h(PatientRelationSection, { value, onChange: () => {}, birthDate, errors }));

describe("PatientRelationSection", () => {
  it("asks who the appointment is for, with Me preselected", () => {
    const html = relation(INITIAL_RELATION);
    expect(html).toContain("Who is this appointment for?");
    for (const label of ["Me", "A minor", "Another adult"]) expect(html).toContain(label);
    expect(html).toMatch(/<input[^>]*checked=""[^>]*value="self"/);
  });

  it("warns a child under 14 booking alone, and points teenagers to their notice", () => {
    expect(relation(INITIAL_RELATION, "2020-01-01")).toContain("Under 14, a parent or legal guardian has to book");
    const teen = new Date().getFullYear() - 15;
    expect(relation(INITIAL_RELATION, `${teen}-01-01`)).toContain("version written for young people");
  });

  it("asks the guardian's name, relation and contact for a minor, and the child's birth date", () => {
    const html = relation({ ...INITIAL_RELATION, bookedFor: "minor" });
    expect(html).toContain("Parent or guardian");
    expect(html).toContain("Legal guardian");
    expect(html).toContain("The child&#x27;s date of birth is required.");
    expect(html).toMatch(/type="tel"/);
  });

  it("asks who is booking for another adult, and shows the server's refusal on the group", () => {
    const html = relation({ ...INITIAL_RELATION, bookedFor: "other_adult" }, "", { bookedFor: "Adults book their own appointments here." });
    expect(html).toContain("Who is booking");
    expect(html).toMatch(/role="radiogroup"[^>]*aria-invalid="true"/);
    expect(html).toContain("On Sorriso&#x27;s search pages, adults book for themselves.");
  });
});

describe("ManagePrivacyCard", () => {
  it("links to the appointment's privacy choices, the privacy center and the practice's notice", () => {
    const html = render(h(ManagePrivacyCard, { token: "tok12345678", locale: "de", orgSlug: "studio-test", appointmentId: "a1", status: "scheduled" }), "de");
    expect(html).toContain('href="/de/a/tok12345678/privacy"');
    expect(html).toContain('href="/de/privacy"');
    expect(html).toContain('href="/de/c/studio-test/privacy"');
  });
});
