import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Locale } from "@/i18n/config";
import { I18nProvider } from "@/i18n/provider";
// Tests run in Node and load the dictionaries directly; components themselves use useT().
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { getMessages } from "@/i18n/t";
import { SlotPicker, type Availability, type SlotDTO } from "./SlotPicker";

const TODAY = "2026-10-14"; // a Wednesday

function slotAt(date: string, time: string, practitionerId = "p1", locationId = "l1"): SlotDTO {
  return { start: `${date}T${time}:00.000Z`, end: `${date}T${time}:30.000Z`, time, practitionerId, locationId };
}

function render(locale: Locale, data: Availability, extra: Partial<Parameters<typeof SlotPicker>[0]> = {}) {
  return renderToStaticMarkup(
    h(I18nProvider, {
      locale,
      messages: getMessages(locale, ["booking", "errors"]),
      children: h(SlotPicker, {
        clinicSlug: "studio",
        serviceId: "s1",
        timezone: "Europe/Rome",
        today: TODAY,
        maxAdvanceDays: 60,
        practitionerNames: { p1: "Dr. Anna Rossi", p2: "Dr. Bruno Bianchi" },
        selectedStart: `${TODAY}T10:00:00.000Z`,
        onSelect: () => {},
        initialData: data,
        ...extra,
      }),
    }),
  );
}

const week: Availability = {
  nextAvailable: null,
  dates: [
    { date: "2026-10-14", slots: [slotAt("2026-10-14", "10:00"), slotAt("2026-10-14", "10:30", "p2")] },
    { date: "2026-10-15", slots: Array.from({ length: 11 }, (_, i) => slotAt("2026-10-15", `${String(8 + i).padStart(2, "0")}:00`)) },
    ...["2026-10-16", "2026-10-17", "2026-10-18", "2026-10-19", "2026-10-20"].map((date) => ({ date, slots: [] })),
  ],
};

describe("SlotPicker", () => {
  it("renders one group per day, labelled by that day's header", () => {
    const html = render("en", week);
    const groups = [...html.matchAll(/role="group" aria-labelledby="([^"]+)"/g)].map((m) => m[1]);
    expect(groups).toHaveLength(7);
    for (const id of groups) expect(html).toContain(`id="${id}"`);
    expect(html).toMatch(/id="[^"]+"[^>]*><span[^>]*>Today<\/span><span[^>]*>14 Oct<\/span>/);
  });

  it("names each time with weekday, date, time and practitioner, and exposes aria-pressed", () => {
    const html = render("en", week);
    expect(html).toContain('aria-pressed="true" aria-label="Wednesday 14 October at 10:00, Dr. Anna Rossi"');
    expect(html).toContain('aria-pressed="false" aria-label="Wednesday 14 October at 10:30, Dr. Bruno Bianchi"');
  });

  it("formats the dates in the page language", () => {
    // The Italian dictionary is WP9's: until then the sentence falls back to English, the date never does.
    expect(render("it", week)).toMatch(/aria-label="mercoledì 14 ottobre [^"]*10:00, Dr\. Anna Rossi"/);
    expect(render("pl", week)).toMatch(/aria-label="środa, 14 października [^"]*10:00/);
  });

  it("localises the navigation, today, more and empty-day labels", () => {
    const html = render("en", week);
    expect(html).toContain('aria-label="Previous days"');
    expect(html).toContain('aria-label="Next days"');
    expect(html).toContain("+3 more");
    expect(html).toContain('aria-label="Show 3 more times on Thursday 15 October"');
    expect(html).toContain('<span aria-hidden="true">—</span><span class="sr-only">No free times</span>');
  });

  it("announces the result in a status region", () => {
    expect(render("en", week)).toMatch(/<p role="status" class="sr-only">13 times available from 14 Oct to 20 Oct\.<\/p>/);
    const empty = render("en", { nextAvailable: null, dates: week.dates.map((d) => ({ ...d, slots: [] })) });
    expect(empty).toMatch(/<p role="status" class="sr-only">No free times from 14 Oct to 20 Oct\.<\/p>/);
  });

  it("shows captions at 11px or more, without faded colours", () => {
    const html = render("en", week);
    expect(html).not.toMatch(/text-\[10px\]/);
    expect(html).not.toMatch(/text-brand-700\/70|text-white\/80|text-slate-300|text-slate-400/);
    expect(html).toMatch(/block truncate text-\[11px\]/);
  });
});
