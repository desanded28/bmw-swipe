import { describe, expect, it } from "vitest";
import { renderEmailLayout } from "./layout";
import { templates, type AppointmentTemplateData } from "./templates";

describe("renderEmailLayout", () => {
  const input = {
    locale: "de" as const,
    brandColor: "#123abc",
    brandName: "Praxis <Müller>",
    intro: "Ihr Termin & mehr",
    footerLines: ["Praxis Müller", "Via Roma 1 <Bozen>"],
  };

  it("escapes every string and renders footer lines", () => {
    const { html, text } = renderEmailLayout({
      ...input,
      details: [["Wann", "<script>"]],
      buttons: [{ label: "Öffnen", url: "https://x.test/?a=1&b=\"2\"" }],
    });
    expect(html).toContain("Praxis &lt;Müller&gt;");
    expect(html).toContain("Ihr Termin &amp; mehr");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain('href="https://x.test/?a=1&amp;b=&quot;2&quot;"');
    expect(html).toContain("Praxis Müller<br>Via Roma 1 &lt;Bozen&gt;");
    expect(html).not.toContain("<script>");
    expect(text).toBe(
      ["Ihr Termin & mehr", "", "Wann: <script>", "", 'Öffnen: https://x.test/?a=1&b="2"', "", "Praxis Müller", "Via Roma 1 <Bozen>"].join("\n"),
    );
  });

  it("omits the greeting unless given and hides the preheader", () => {
    const plain = renderEmailLayout(input);
    expect(plain.html).not.toContain("margin:0 0 12px");
    expect(plain.html).not.toContain("display:none");
    const full = renderEmailLayout({ ...input, greeting: "Hallo Anna,", preheader: "Termin am 3. November" });
    expect(full.text.startsWith("Hallo Anna,\n\nIhr Termin")).toBe(true);
    expect(full.html).toContain('<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">Termin am 3. November</div>');
    expect(full.text).not.toContain("Termin am 3. November");
  });

  it("only accepts #rrggbb brand colours", () => {
    expect(renderEmailLayout(input).html).toContain("background:#123abc");
    expect(renderEmailLayout({ ...input, brandColor: "red;x:url(y)" }).html).toContain("background:#0d9488");
  });

  it("shows Sorriso in the header unless a sender name is given", () => {
    expect(renderEmailLayout(input).html).toContain("font-weight:700\">Praxis &lt;Müller&gt;</td>");
    const { brandName, ...noName } = input;
    expect(renderEmailLayout(noName).html).toContain("font-weight:700\">Sorriso</td>");
  });

  it("has no remote images", () => {
    expect(renderEmailLayout({ ...input, greeting: "Hi" }).html).not.toMatch(/<img/i);
  });

  it("declares the recipient's language and renders footer links and the note", () => {
    const { html, text } = renderEmailLayout({
      ...input,
      note: "Details <online>",
      footerLinks: [
        { label: "Datenschutz", url: "https://sorriso.test/de/c/x/privacy" },
        { label: "Bad", url: "javascript:alert(1)" },
      ],
    });
    expect(html.startsWith('<!doctype html><html lang="de"><head><meta charset="utf-8">')).toBe(true);
    expect(html).toContain("Details &lt;online&gt;");
    expect(html).toContain('<a href="https://sorriso.test/de/c/x/privacy" style="color:#64748b;text-decoration:underline">Datenschutz</a>');
    expect(html).toContain('<a href="#"');
    expect(html).not.toContain("javascript:");
    expect(text).toContain("Datenschutz: https://sorriso.test/de/c/x/privacy");
  });
});

const base: AppointmentTemplateData = {
  locale: "it",
  patientFirstName: "Giulia <b>",
  clinicName: "Studio \"Rossi\" & Figli",
  clinicPhone: "+39 02 1234 5678",
  brandColor: "#1d4ed8",
  practitionerName: "Dr. Marco Rossi",
  serviceName: "Igiene <professionale>",
  start: new Date("2026-11-03T08:30:00Z"),
  timezone: "Europe/Rome",
  locationName: "Milano Centro",
  address: "Via Roma 1, Milano",
  manageUrl: "https://sorriso.test/a/tok123",
  icsUrl: "https://sorriso.test/api/ics/appointment/tok123",
};

/**
 * Every template, rendered with fixed data. The snapshot pins the output: a change to a patient
 * text or to the layout shows up in review (regenerated for WP3's discreet, translated templates).
 */
function renderAll(d: AppointmentTemplateData) {
  return {
    bookingConfirmation: templates.bookingConfirmation(d),
    bookingConfirmationSms: templates.bookingConfirmationSms(d),
    bookingRequested: templates.bookingRequested(d),
    bookingApproved: templates.bookingApproved(d),
    reminderEmailAsk: templates.reminderEmail(d, true),
    reminderEmail: templates.reminderEmail(d, false),
    reminderSmsAsk: templates.reminderSms(d, true),
    reminderSms: templates.reminderSms(d, false),
    cancelledEmailStaff: templates.cancelledEmail(d, "staff", "https://sorriso.test/book/x"),
    cancelledEmailPatient: templates.cancelledEmail(d, "patient", "https://sorriso.test/book/x"),
    cancelledSms: templates.cancelledSms(d, "https://sorriso.test/book/x"),
    rescheduledEmail: templates.rescheduledEmail(d),
    rescheduledSms: templates.rescheduledSms(d),
    waitlistOfferEmail: templates.waitlistOfferEmail(d, "https://sorriso.test/book/x?slot=1"),
    waitlistOfferSms: templates.waitlistOfferSms(d, "https://sorriso.test/book/x?slot=1"),
    reviewRequest: templates.reviewRequest(d, "https://sorriso.test/a/tok123/review"),
    replyConfirmed: templates.reply.confirmed(d),
    replyCancelled: templates.reply.cancelled(d, "https://sorriso.test/book/x"),
    replyReschedule: templates.reply.reschedule(d),
    replyUnknown: templates.reply.unknown(d),
    replyStop: templates.reply.stop(d.locale, d.clinicName),
    replyNone: templates.reply.none(d.locale, d.clinicName),
  };
}

describe("appointment templates", () => {
  it.each(["it", "en", "de"] as const)("render as reviewed in %s", (locale) => {
    expect(renderAll({ ...base, locale })).toMatchSnapshot();
  });

  it("fall back to the default brand colour", () => {
    const { html } = templates.bookingRequested({ ...base, brandColor: "red;background:url(x)" });
    expect(html).toContain("background:#0d9488");
    expect(html).not.toContain("url(x)");
  });
});
