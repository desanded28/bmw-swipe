import { readFileSync } from "node:fs";
import path from "node:path";
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
  usePathname: () => "/dashboard/patients/duplicates",
}));
vi.mock("@/app/auth-actions", () => ({ logout: action }));
vi.mock("@/app/dashboard/actions/session", () => ({ switchOrg: action, updateMyLocale: action }));
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
const { Sidebar } = await import("./Sidebar");
const { handleBackdropClick, handleCancel, modalForPrint } = await import("./modal");
const { permissionsFor } = await import("@/lib/permissions");

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
    awaitingAdultConfirmation: false,
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

  it("marks a message in the patient's language with lang when it isn't the dashboard's (WCAG 3.1.2)", () => {
    const ro = { ...message, body: "Pot să vin mai târziu?", locale: "ro" };
    expect(render(h(MessageThread, { messages: [ro], tz: TZ, headingId: "h" }), "it")).toMatch(/<p[^>]*lang="ro"[^>]*>Pot să vin/);
    // Same language as the dashboard: no attribute.
    expect(render(h(MessageThread, { messages: [{ ...ro, locale: "it" }], tz: TZ, headingId: "h" }), "it")).not.toContain('lang="it"');
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

describe("Sidebar", () => {
  const tDash = getT("en", "dashboard");
  const sidebar = (role: "owner" | "reception", platformAdmin: boolean) =>
    render(
      h(Sidebar, {
        user: { name: "Test", email: "t@example.org", locale: null },
        org: { id: "o1", name: "Studio", slug: "studio", brandColor: "#0ea5e9" },
        orgs: [{ id: "o1", name: "Studio" }],
        role,
        permissions: permissionsFor(role),
        platformAdmin,
        counts: { attention: 0, requests: 0, waitlist: 0 },
      }),
    );

  it("links the duplicates queue for roles that read patients, and marks it as the current page", () => {
    const html = sidebar("reception", false);
    expect(html).toContain('href="/dashboard/patients/duplicates"');
    expect(html).toContain(tDash("nav.duplicates"));
    // Only the deepest matching entry is current, not the patients list as well.
    const current = [...html.matchAll(/<a [^>]*aria-current="page"[^>]*>/g)].map((m) => m[0]);
    expect(current).toHaveLength(1);
    expect(current[0]).toContain('href="/dashboard/patients/duplicates"');
  });

  it("the logo link's name starts with its visible text (WCAG 2.5.3)", () => {
    const html = sidebar("reception", false);
    const link = [...html.matchAll(/<a [^>]*>/g)].map((m) => m[0]).find((a) => a.includes('href="/dashboard"')) ?? "";
    const label = /aria-label="([^"]*)"/.exec(link)?.[1] ?? "";
    expect(label.startsWith("Sorriso")).toBe(true);
  });

  it("the language and practice selects change nothing on their own: no onchange handler applies them, a button does", () => {
    // Rendered on the server, a select's handler doesn't show; what does is that nothing is applied
    // until submit: each select sits in a form, and the apply buttons appear only once a different
    // value is picked (so the first paint has none).
    const html = render(
      h(Sidebar, {
        user: { name: "Test", email: "t@example.org", locale: null },
        org: { id: "o1", name: "Studio", slug: "studio", brandColor: "#0ea5e9" },
        orgs: [
          { id: "o1", name: "Studio" },
          { id: "o2", name: "Altro" },
        ],
        role: "owner",
        permissions: permissionsFor("owner"),
        platformAdmin: false,
        counts: { attention: 0, requests: 0, waitlist: 0 },
      }),
    );
    expect(html.match(/<form[^>]*>(?:(?!<\/form>).)*<select/gs)).toHaveLength(2);
    expect(html).not.toContain('type="submit"');
    const src = readFileSync(path.join(__dirname, "Sidebar.tsx"), "utf8");
    // The handlers only keep the pick: switchOrg and updateMyLocale run on submit.
    for (const m of src.matchAll(/onChange=\{([^}]*)\}/g)) expect(m[1]).not.toMatch(/switchOrg|updateMyLocale|run\(|start\(/);
  });

  it("shows Sorriso's privacy inbox to platform admins only", () => {
    expect(sidebar("owner", true)).toContain('href="/dashboard/platform/privacy"');
    expect(sidebar("owner", false)).not.toContain('href="/dashboard/platform/privacy"');
    expect(sidebar("owner", true)).toContain(tDash("nav.platformPrivacy"));
  });
});

describe("modal dialogs (modal.ts)", () => {
  it("Escape closes only the topmost dialog: the cancel event is stopped there", () => {
    const calls: string[] = [];
    handleCancel({ preventDefault: () => calls.push("prevent"), stopPropagation: () => calls.push("stop") }, () => calls.push("close"));
    expect(calls).toEqual(["prevent", "stop", "close"]);
  });

  it("closes on a backdrop click, not on a click inside", () => {
    let closed = 0;
    const box = {};
    handleBackdropClick({ target: {}, currentTarget: box }, () => closed++);
    expect(closed).toBe(0);
    handleBackdropClick({ target: box, currentTarget: box }, () => closed++);
    expect(closed).toBe(1);
  });

  it("prints a modal as a plain dialog and puts the modal back afterwards", () => {
    const log: string[] = [];
    const dialog = {
      open: true,
      modal: true,
      matches(this: { modal: boolean }, q: string) {
        return q === ":modal" && this.modal;
      },
      showModal(this: { open: boolean; modal: boolean }) {
        this.open = true;
        this.modal = true;
        log.push("showModal");
      },
      show(this: { open: boolean; modal: boolean }) {
        this.open = true;
        this.modal = false;
        log.push("show");
      },
      close(this: { open: boolean; modal: boolean }) {
        this.open = false;
        this.modal = false;
        log.push("close");
      },
      querySelector: () => null,
    };
    const restore = modalForPrint(dialog as never);
    expect(log).toEqual(["close", "show"]);
    restore?.();
    expect(log).toEqual(["close", "show", "close", "showModal"]);
    expect(dialog.modal).toBe(true);
    // Not open as a modal: nothing to do.
    expect(modalForPrint({ ...dialog, open: false } as never)).toBeNull();
  });
});
