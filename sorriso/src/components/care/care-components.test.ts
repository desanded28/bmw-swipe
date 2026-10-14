import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { I18nProvider } from "@/i18n/provider";
// Tests render on the server: the dictionaries come from the server-side loader.
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { getMessages } from "@/i18n/t";
import { DEFAULT_ANAMNESIS_V1 } from "@/lib/forms";
import { AnamnesisForm } from "./AnamnesisForm";
import { PatientCareView } from "./PatientCareView";
import type { PatientCareData } from "./types";

const render = (el: React.ReactElement) =>
  renderToStaticMarkup(h(I18nProvider, { locale: "en", messages: getMessages("en", ["care", "common"]), children: el }));

describe("AnamnesisForm (server render)", () => {
  const html = render(h(AnamnesisForm, { token: "tok12345678", schema: DEFAULT_ANAMNESIS_V1, clinic: "Studio", contactHint: "+39•••4567" }));

  it("renders every question with its label in the page language, yes/no as labelled radio groups", () => {
    expect(html).toContain("Do you take blood thinners");
    expect(html).toContain("How do you feel about dental treatment?");
    // Each choice question is a fieldset with a legend; each radio sits inside its label.
    const fieldsets = html.match(/<fieldset/g) ?? [];
    const choices = DEFAULT_ANAMNESIS_V1.sections.flatMap((s) => s.fields).filter((f) => f.type !== "text");
    expect(fieldsets).toHaveLength(choices.length);
    expect(html.match(/<legend/g)).toHaveLength(choices.length);
    expect(html).toMatch(/<label[^>]*><input type="radio"[^>]*name="anticoagulants" value="yes"\/>Yes<\/label>/);
    // Free-text questions are labelled controls.
    expect(html).toMatch(/<label for="[^"]+"[^>]*><span[^>]*>Other medicines you take regularly<\/span><\/label>/);
    // Nothing about the signature yet: answers first.
    expect(html).not.toContain("Send the code");
  });
});

describe("PatientCareView (server render)", () => {
  const base: PatientCareData = {
    patientId: "p1",
    recalls: [{ id: "r1", serviceName: "Professional cleaning", dueDate: "2030-09-04", status: "due", intervalMonths: 6, confirmed: false }],
    minor: true,
    viaGuardian: true,
    guardian: { name: "Laura Ferri", relation: "parent", phone: null, email: null },
    submissions: [{ id: "s1", signedAt: "2030-03-01T09:00:00.000Z", signerName: "Laura Ferri", exportedAt: null, redFlags: null }],
    duplicate: { ofName: "Matteo Ferri", flaggedBy: 0 },
    canReadClinical: false,
  };

  it("shows recalls, the guardian and the forms; no clinical detail without patient.clinical.read", () => {
    const html = render(h(PatientCareView, { data: base }));
    expect(html).toContain("Professional cleaning");
    expect(html).toContain("Every 6 months");
    expect(html).toContain("Waiting for a clinician");
    expect(html).toContain("Parental consent required");
    expect(html).toContain("Laura Ferri");
    expect(html).toContain("Messages go to the parent or guardian");
    expect(html).toContain("Signed on");
    expect(html).not.toContain("medical alert");
    expect(html).not.toContain(">Show<");
    expect(html).toContain('href="/dashboard/patients/duplicates#p-p1"');
  });

  it("shows the alerts and the button to clinicians", () => {
    const html = render(h(PatientCareView, { data: { ...base, canReadClinical: true, submissions: [{ ...base.submissions[0], redFlags: ["anticoagulants"] }] } }));
    expect(html).toContain("1 medical alert");
    expect(html).toContain(">Show<");
  });
});
