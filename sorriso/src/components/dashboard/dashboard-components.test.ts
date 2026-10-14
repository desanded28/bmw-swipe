import { createElement as h, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Locale } from "@/i18n/config";
import { fmtWhen } from "@/i18n/datefmt";
import { I18nProvider } from "@/i18n/provider";
// Tests render on the server: the dictionaries come from the server-side loader.
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { getMessages, getT } from "@/i18n/t";
import type { ApptListDTO, Resources, ThreadMessage } from "./types";

/**
 * WP2's client components rendered on the server, as the first paint before any effect runs:
 * what a drawer shows before its audited detail arrives, the status text on short calendar
 * events, the calendar's keyboard tab stop, the privacy screen on the booking drawer's patient
 * data, and the message thread's localised times.
 */

const action = async () => ({ ok: true as const });
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/app/dashboard/actions/appointments", () => ({
  approve: action,
  cancelByStaff: action,
  clearAttention: action,
  confirmByPhone: action,
  createStaffAppointment: action,
  getAppointmentDetail: action,
  getAppointmentPhone: action,
  moveAppointment: action,
  openRestrictedAppointment: action,
  recordOutcome: action,
  remindNow: action,
  saveInternalNote: action,
}));
vi.mock("@/app/dashboard/actions/links", () => ({ issuePatientLink: action }));
vi.mock("@/app/dashboard/actions/patients", () => ({ searchPatients: async () => [] }));
// WP8's panel loads the visit's care data as soon as it is mounted: a marker shows whether it was.
vi.mock("@/components/dashboard/slots/AppointmentCarePanel", () => ({
  AppointmentCarePanel: () => h("div", { "data-care-panel": "" }),
}));
// A clock (the real hook returns null while rendering on the server), before the fixtures' visits.
vi.mock("@/components/useNow", () => ({ useNow: () => Date.parse("2026-01-01T00:00:00Z") }));
// The privacy screen, on: every <Pii> is a marked span.
vi.mock("@/components/dashboard/PrivacyScreen", () => ({
  Pii: ({ children, className }: { children: ReactNode; className?: string }) => h("span", { "data-pii": "", className }, children),
  PrivacyScreenToggle: () => null,
  usePrivacyScreen: () => true,
  setPrivacyScreen: () => {},
}));

const { AppointmentDrawer, MessageThread } = await import("./AppointmentDrawer");
const { AppointmentList } = await import("./AppointmentList");
const { CalendarBoard, slotCursor } = await import("./CalendarBoard");
const { PatientSummary } = await import("./NewAppointmentDrawer");

const TZ = "Europe/Rome";
const tCal = getT("en", "calendar");

const render = (el: ReactElement, locale: Locale = "en") =>
  renderToStaticMarkup(h(I18nProvider, { locale, messages: getMessages(locale, ["calendar", "common", "care", "dashboard"]), children: el }));

const resources: Resources = {
  timezone: TZ,
  practitioners: [{ id: "dr1", name: "Dr Giulia Rossi", color: "#0ea5e9", serviceIds: ["s1"] }],
  locations: [{ id: "l1", name: "Milano", timezone: TZ }],
  rooms: [],
  services: [{ id: "s1", name: "Check-up", durationMinutes: 30 }],
};

function appt(over: Partial<ApptListDTO> = {}): ApptListDTO {
  return {
    id: "a1",
    start: "2030-03-04T08:00:00.000Z",
    end: "2030-03-04T08:30:00.000Z",
    blockedUntil: "2030-03-04T08:30:00.000Z",
    status: "scheduled",
    confirmation: "pending",
    confirmedVia: null,
    needsAttention: false,
    source: "online",
    isNewPatient: false,
    processingContext: "practice",
    hasNotes: false,
    minorFlag: false,
    riskLevel: null,
    riskReasons: [],
    anamnesis: null,
    redFlag: null,
    restricted: false,
    patient: { id: "p1", name: "Ottavia Brambilla", masked: false, noShowCount: 0, preferredChannel: "sms" },
    service: { id: "s1", name: "Check-up", durationMinutes: 30 },
    practitioner: { id: "dr1", name: "Dr Giulia Rossi", color: "#0ea5e9" },
    location: { id: "l1", name: "Milano", timezone: TZ },
    room: null,
    ...over,
  };
}

const drawer = (a: ApptListDTO) => render(h(AppointmentDrawer, { appt: a, resources, onClose: () => {} }));

describe("AppointmentDrawer before its detail has loaded", () => {
  it("mounts no care panel, reminder or patient-link control for a restricted record the viewer may name", () => {
    // An owner's row: restricted, but not masked. Whether a reason was given is only known to the server.
    const html = drawer(appt({ restricted: true }));
    expect(html).not.toContain("data-care-panel");
    expect(html).not.toContain(tCal("drawer.sendReminder"));
    expect(html).not.toContain(tCal("drawer.patientPage"));
    expect(html).not.toContain(tCal("drawer.copyLink"));
    // Neither open nor asking for a reason yet: loading.
    expect(html).toContain(tCal("drawer.loading"));
    expect(html).not.toContain(tCal("drawer.restricted.reasonTitle"));
  });

  it("waits for the server's answer for an unrestricted record too", () => {
    const html = drawer(appt());
    expect(html).not.toContain("data-care-panel");
    expect(html).not.toContain(tCal("drawer.sendReminder"));
    expect(html).not.toContain(tCal("drawer.patientPage"));
    expect(html).toContain(tCal("drawer.loading"));
  });

  it("shows a masked record as restricted straight away", () => {
    const html = drawer(appt({ restricted: true, patient: { ...appt().patient, name: tCal("restrictedPatient"), masked: true } }));
    expect(html).toContain(tCal("drawer.restricted.title"));
    expect(html).not.toContain("data-care-panel");
    expect(html).not.toContain(tCal("drawer.loading"));
  });
});

describe("MessageThread", () => {
  const message: ThreadMessage = {
    id: "m1",
    channel: "sms",
    direction: "outbound",
    status: "sent",
    intent: null,
    createdAt: "2030-03-04T12:30:00.000Z",
    subject: null,
    body: "Reminder",
  };

  it("writes each message's time with the locale's date-time pattern", () => {
    for (const locale of ["it", "ro", "en"] as const) {
      const html = render(h(MessageThread, { messages: [message], tz: TZ, headingId: "h" }), locale);
      expect(html).toContain(fmtWhen(message.createdAt, TZ, locale, "short"));
    }
    expect(fmtWhen(message.createdAt, TZ, "it", "short")).toContain(" alle 13:30");
  });
});

describe("AppointmentList", () => {
  it("offers no call, reminder or confirmation on a restricted patient's row, and says why", () => {
    const html = render(h(AppointmentList, { appointments: [appt({ restricted: true })], resources }));
    expect(html).not.toContain(`aria-label="${tCal("list.call")}"`);
    expect(html).not.toContain(`aria-label="${tCal("list.remind")}"`);
    expect(html).toContain(tCal("list.restricted"));
    const open = render(h(AppointmentList, { appointments: [appt()], resources }));
    expect(open).toContain(`aria-label="${tCal("list.call")}"`);
    expect(open).toContain(`aria-label="${tCal("list.remind")}"`);
    expect(open).not.toContain(tCal("list.restricted"));
  });
});

describe("CalendarBoard", () => {
  const board = (appointments: ApptListDTO[]) =>
    render(
      h(CalendarBoard, {
        resources,
        view: "day",
        display: "grid",
        date: "2030-03-04",
        days: ["2030-03-04"],
        today: "2026-01-01",
        locationId: "all",
        groupBy: "practitioner",
        selected: [],
        showCancelled: false,
        appointments,
        hours: [{ practitionerId: "dr1", locationId: "l1", date: "2030-03-04", start: 8 * 60, end: 18 * 60 }],
        blocks: [],
        gridStart: 8 * 60,
        gridEnd: 18 * 60,
        canWrite: true,
      }),
    );
  const eventHtml = (html: string, id: string) => new RegExp(`<button[^>]*data-appt-id="${id}"[^>]*>(.*?)</button>`).exec(html)?.[1] ?? "";

  it("shows the status as text, not only as an icon, on a 15-minute event", () => {
    const short = appt({ id: "short", confirmation: "confirmed", end: "2030-03-04T08:15:00.000Z", blockedUntil: "2030-03-04T08:15:00.000Z" });
    const pending = appt({ id: "pending", start: "2030-03-04T10:00:00.000Z", end: "2030-03-04T10:20:00.000Z", blockedUntil: "2030-03-04T10:20:00.000Z" });
    const html = board([short, pending]);
    const visible = (s: string) => s.replace(/<[^>]+>/g, "");
    expect(visible(eventHtml(html, "short"))).toContain(tCal("event.statusShort.confirmed"));
    expect(visible(eventHtml(html, "pending"))).toContain(tCal("event.statusShort.pending"));
    // The accessible name keeps the full status.
    expect(html).toMatch(/data-appt-id="short"/);
    expect(html).toContain(`, ${getT("en", "common")("confirmationStatus.confirmed")}"`);
  });

  it("gives each column exactly one keyboard tab stop on its empty slots", () => {
    const html = board([]);
    const stops = html.match(/<button[^>]*data-slot="dr1\|\d+"[^>]*tabindex="0"|<button[^>]*tabindex="0"[^>]*data-slot="dr1\|\d+"/g) ?? [];
    expect(stops).toHaveLength(1);
  });

  it("keeps the tab stop on a slot of the current day's grid (slotCursor)", () => {
    // Monday's cursor at 07:00; Tuesday's grid starts at 09:00.
    expect(slotCursor(7 * 60, 9 * 60, 9 * 60, 18 * 60)).toBe(9 * 60);
    // Past the end: the last slot (17:30 on a grid ending at 18:00).
    expect(slotCursor(19 * 60, undefined, 9 * 60, 18 * 60)).toBe(17 * 60 + 30);
    // Between two slots: the one it falls in.
    expect(slotCursor(10 * 60 + 45, undefined, 9 * 60, 18 * 60)).toBe(10 * 60 + 30);
    // No cursor yet: the first working hour, else the grid's start.
    expect(slotCursor(undefined, 9 * 60 + 15, 8 * 60, 18 * 60)).toBe(9 * 60);
    expect(slotCursor(undefined, undefined, 8 * 60, 18 * 60)).toBe(8 * 60);
    // A cursor already on the grid stays.
    expect(slotCursor(12 * 60, 9 * 60, 8 * 60, 18 * 60)).toBe(12 * 60);
  });
});

describe("NewAppointmentDrawer: patient search results", () => {
  it("puts the name and the contacts under the privacy screen", () => {
    const html = render(h(PatientSummary, { hit: { firstName: "Ottavia", lastName: "Brambilla", phone: "+393331234567", email: "ottavia@example.org" } }));
    const blurred = [...html.matchAll(/<span data-pii=""[^>]*>(.*?)<\/span>/g)].map((m) => m[1]);
    expect(blurred).toHaveLength(2);
    expect(blurred[0]).toBe("Ottavia Brambilla");
    expect(blurred[1]).toContain("ottavia@example.org");
    expect(html.replace(/<span data-pii=""[^>]*>.*?<\/span>/g, "")).not.toMatch(/Ottavia|example\.org|333/);
  });
});
