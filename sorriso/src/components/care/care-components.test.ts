import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/provider";
// Tests render on the server: the dictionaries come from the server-side loader.
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { getMessages } from "@/i18n/t";
import { DEFAULT_ANAMNESIS_V1 } from "@/lib/forms";
import { AnamnesisForm } from "./AnamnesisForm";
import { AnamnesisSheetDialog } from "./AnamnesisSheet";
import { handleBackdropClick, handleCancel, modalForPrint, openModal, type ModalDialog } from "./modal";
import { PatientCareView } from "./PatientCareView";
import { RebookChooser } from "./RebookChooser";
import { recallOptions, RECALL_INTERVALS, type AnamnesisSheetData, type PatientCareData } from "./types";

// No app router in a server render: the hooks that need one get a stand-in.
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh() {}, push() {}, replace() {} }) }));

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
    submissions: [{ id: "s1", signedAt: "2030-03-01T09:00:00.000Z", signerName: "Laura Ferri", exportedAt: null, alerts: null }],
    duplicate: { ofName: "Matteo Ferri", ofRestricted: false, flaggedBy: 0 },
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
    const html = render(h(PatientCareView, { data: { ...base, canReadClinical: true, submissions: [{ ...base.submissions[0], alerts: 1 }] } }));
    expect(html).toContain("1 medical alert");
    expect(html).toContain(">Show<");
  });
});

/**
 * A stand-in for an HTMLDialogElement with the top layer as a stack: showModal() puts a dialog on
 * top (everything below it is inert), close() takes it off. No DOM library in this repo, so the
 * browser behaviour the overlays rely on is modelled here.
 */
function topLayer() {
  const stack: FakeDialog[] = [];
  class FakeDialog implements ModalDialog {
    open = false;
    modal = false;
    focused: string | null = null;
    constructor(readonly name: string) {}
    showModal() {
      if (this.open) throw new Error("InvalidStateError: already open");
      this.open = true;
      this.modal = true;
      stack.push(this);
    }
    show() {
      this.open = true;
      this.modal = false;
    }
    close() {
      this.open = false;
      this.modal = false;
      const i = stack.indexOf(this);
      if (i >= 0) stack.splice(i, 1);
    }
    matches(selector: string) {
      if (selector !== ":modal") throw new Error(`unexpected selector ${selector}`);
      return this.modal;
    }
    querySelector<E extends Element = Element>(selector: string): E | null {
      if (selector !== "[data-autofocus]") return null;
      return { focus: () => (this.focused = "autofocus") } as unknown as E;
    }
    get inert() {
      return stack.length > 0 && stack[stack.length - 1] !== this;
    }
  }
  return { stack, dialog: (name: string) => new FakeDialog(name) };
}

describe("care overlays are native modal dialogs", () => {
  it("the medical-history sheet opened from inside the appointment drawer's modal stacks above it, and only it closes", () => {
    const layer = topLayer();
    const drawer = layer.dialog("drawer");
    const closeDrawer = vi.fn();
    openModal(drawer); // WP2's drawer, as useModalDialog opens it
    const sheet = layer.dialog("sheet");
    openModal(sheet);
    // The sheet is on top and usable; the drawer is behind it, inert.
    expect(layer.stack.map((d) => d.name)).toEqual(["drawer", "sheet"]);
    expect(sheet.inert).toBe(false);
    expect(drawer.inert).toBe(true);
    expect(sheet.focused).toBe("autofocus");

    // Escape fires "cancel" on the sheet; React would pass it on to the drawer's onCancel unless stopped.
    const closeSheet = vi.fn();
    const event = { defaultPrevented: false, propagationStopped: false, preventDefault() { this.defaultPrevented = true; }, stopPropagation() { this.propagationStopped = true; } };
    handleCancel(event, closeSheet);
    expect(closeSheet).toHaveBeenCalledTimes(1);
    expect(event).toMatchObject({ defaultPrevented: true, propagationStopped: true });
    if (!event.propagationStopped) closeDrawer();
    expect(closeDrawer).not.toHaveBeenCalled();

    // A click inside the sheet bubbles to the drawer's backdrop handler with another target: the drawer stays.
    const inner = {};
    handleBackdropClick({ target: inner, currentTarget: drawer }, closeDrawer);
    expect(closeDrawer).not.toHaveBeenCalled();
    handleBackdropClick({ target: sheet, currentTarget: sheet }, closeSheet);
    expect(closeSheet).toHaveBeenCalledTimes(2);

    sheet.close();
    expect(drawer.inert).toBe(false);
  });

  it("prints as a plain dialog and comes back as a modal", () => {
    const layer = topLayer();
    const sheet = layer.dialog("sheet");
    openModal(sheet);
    const restore = modalForPrint(sheet)!;
    expect(sheet).toMatchObject({ open: true, modal: false });
    restore();
    expect(sheet).toMatchObject({ open: true, modal: true });
    expect(layer.stack.map((d) => d.name)).toEqual(["sheet"]);
    sheet.close();
    expect(modalForPrint(sheet)).toBeNull();
  });

  it("the sheet renders as a <dialog> named by its title, printable, with focus on its close button", () => {
    const data: AnamnesisSheetData = {
      id: "f1",
      version: "v1",
      locale: "it",
      signedAt: "2030-03-01T09:00:00.000Z",
      signerName: "Ada Neri",
      signedVia: "otp_sms",
      exportedAt: null,
      redFlags: ["anticoagulants"],
      answers: { anticoagulants: "yes" },
      schema: DEFAULT_ANAMNESIS_V1,
      patient: { firstName: "Ada", lastName: "Neri", birthDate: null },
      visit: null,
      clinic: "Studio",
    };
    const html = render(h(AnamnesisSheetDialog, { data, onClose: () => {} }));
    expect(html).toMatch(/^<dialog data-anamnesis-print="true" aria-labelledby="([^"]+)"/);
    const titleId = html.match(/aria-labelledby="([^"]+)"/)![1];
    expect(html).toContain(`<h2 id="${titleId}"`);
    expect(html).not.toContain('role="dialog"');
    expect(html).toMatch(/<button data-autofocus="true" type="button"[^>]*aria-label="Close"/);
    expect(html).toContain("Blood thinners");
  });
});

describe("RebookChooser (server render)", () => {
  it("each button's name is its visible text; the time and practitioner describe it", () => {
    const html = render(
      h(RebookChooser, {
        token: "tok12345678",
        clinic: "Studio",
        callRequested: false,
        moreTimesHref: "/it/a/tok12345678/rebook?more=1",
        options: [{ key: "k1", when: "Tuesday 5 March at 09:00", practitioner: "Dr Anna", location: "Milano" }],
      }),
    );
    const button = html.match(/<button[^>]*>(?:(?!<\/button>).)*Choose this time<\/button>/)![0];
    expect(button).not.toContain("aria-label");
    const describedBy = button.match(/aria-describedby="([^"]+)"/)![1];
    const description = html.slice(html.indexOf(`id="${describedBy}"`));
    expect(description.slice(0, description.indexOf("</div>"))).toMatch(/Tuesday 5 March at 09:00[\s\S]*Dr Anna/);
    // More times stay on the rebooking page (they move this visit), never the public booking page.
    expect(html).toContain('href="/it/a/tok12345678/rebook?more=1"');
    expect(html).not.toContain("/book/");
  });
});

describe("recall picker options", () => {
  it("offers the interval in force even when the list lacks it, in order", () => {
    expect(recallOptions("6")).toEqual([...RECALL_INTERVALS]);
    expect(recallOptions("5")).toEqual([3, 4, 5, 6, 9, 12, 18, 24]);
    expect(recallOptions(15)).toEqual([3, 4, 6, 9, 12, 15, 18, 24]);
    // Out of range or empty: the plain list (recalls store 3–24 months).
    expect(recallOptions("")).toEqual([...RECALL_INTERVALS]);
    expect(recallOptions(36)).toEqual([...RECALL_INTERVALS]);
    expect(recallOptions(null)).toEqual([...RECALL_INTERVALS]);
  });
});
