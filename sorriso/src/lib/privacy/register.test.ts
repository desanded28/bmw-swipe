import { describe, expect, it } from "vitest";
import type { OrgSettings } from "@/db/schema";
import { DEFAULT_SETTINGS } from "../settings";
import { activePurposes, buildRegister, csvCell, customRegisterEntries, REGISTER_COLUMNS, registerCsv, SECURITY_CONTROLS } from "./register";
import { PURPOSES } from "./roles";
import { resolvePrivacySettings } from "./settings";

/** A small RFC 4180 parser (quoted cells with commas, quotes and line breaks). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\r" && s[i + 1] === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      i++;
    } else cell += c;
  }
  if (cell || row.length) rows.push([...row, cell]);
  return rows;
}

const ORG = {
  id: "org1",
  name: "Studio Rossi",
  legalName: "Studio Dentistico Rossi S.r.l.",
  vatNumber: "IT01234567890",
  registeredAddress: "Via Roma 1, Milano",
  privacyEmail: "privacy@studiorossi.it",
  dpoName: null,
  dpoEmail: null,
  email: "info@studiorossi.it",
  phone: null,
};

function settingsWith(over: { privacy?: Partial<OrgSettings["privacy"]>; retention?: Partial<OrgSettings["privacy"]["retention"]> } = {}): OrgSettings {
  return {
    ...DEFAULT_SETTINGS,
    privacy: resolvePrivacySettings({ ...DEFAULT_SETTINGS.privacy, ...over.privacy, retention: { ...DEFAULT_SETTINGS.privacy.retention, ...over.retention } }),
  };
}

describe("Art. 30 register", () => {
  it("has one row per active processing purpose of the practice, following its settings", () => {
    const base = activePurposes(settingsWith());
    expect(base).not.toContain("marketing");
    expect(base).not.toContain("adaptive_reminders");
    expect(base).not.toContain("partner_api");
    expect(base).not.toContain("booking_marketplace"); // Sorriso's own purpose: in Sorriso's register
    for (const id of base) expect(PURPOSES[id].controller).toBe("practice");
    const more = activePurposes(settingsWith({ privacy: { marketingEnabled: true, riskBasedReminders: true } }), { hasApiKeys: true });
    expect(more).toEqual(expect.arrayContaining(["marketing", "adaptive_reminders", "partner_api"]));
  });

  it("writes a CSV whose rows and retention values match the settings", () => {
    const settings = settingsWith({ privacy: { marketingEnabled: true }, retention: { auditMonths: 36, messageBodyMonths: 6, waitlistDays: 45 } });
    const register = buildRegister(ORG, settings, { locale: "en" });
    const rows = parseCsv(registerCsv(register));
    const [header, ...body] = rows;
    expect(header).toEqual(["Processing activity", "Purpose", "Legal basis", "Data subjects", "Categories of personal data", "Recipients", "Transfers outside the EU", "Erasure time limits", "Security measures"]);
    expect(body).toHaveLength(activePurposes(settings).length);
    expect(body.every((r) => r.length === REGISTER_COLUMNS.length)).toBe(true);

    const byActivity = new Map(register.rows.map((r) => [r.id, r]));
    expect(byActivity.get("security_logs")!.retention).toContain("36 months");
    expect(byActivity.get("reminders")!.retention).toContain("Message text: 6 months");
    expect(byActivity.get("waitlist")!.retention).toContain("45 days");
    expect(byActivity.get("booking_practice")!.retention).toContain(`${settings.privacy.retention.patientInactiveMonths} months`);
    expect(byActivity.get("booking_practice")!.legalBasis).toContain("Art. 9(2)(h)");
    // WhatsApp is listed only when the practice enables it.
    expect(byActivity.get("reminders")!.recipients).not.toContain("WhatsApp");
    const withWa = buildRegister(ORG, settingsWith({ privacy: { whatsappEnabled: true } }), { locale: "en" });
    expect(withWa.rows.find((r) => r.id === "reminders")!.recipients).toContain("WhatsApp");
    expect(withWa.rows.find((r) => r.id === "reminders")!.transfers).toContain("Data Privacy Framework");
  });

  it("appends the practice's own rows and its controller details", () => {
    const custom = customRegisterEntries({
      settings: {
        register: [
          { id: "c1", activity: "Paper clinical records", purpose: "Care", legalBasis: "Art. 9(2)(h)", retention: "10 years", recipients: "", subjects: "", dataCategories: "", transfers: "", security: "Locked cabinet" },
          { id: "bad" },
        ],
      },
    });
    expect(custom).toHaveLength(1);
    const register = buildRegister(ORG, settingsWith(), { locale: "en", custom });
    expect(register.rows.at(-1)).toMatchObject({ activity: "Paper clinical records", custom: true });
    expect(register.controller).toMatchObject({ name: "Studio Dentistico Rossi S.r.l.", vatNumber: "IT01234567890", contact: "privacy@studiorossi.it" });
  });

  it("defuses spreadsheet formulas and lists only implemented controls", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("-12")).toBe("-12");
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
    expect(new Set(SECURITY_CONTROLS.map((c) => c.id)).size).toBe(SECURITY_CONTROLS.length);
  });
});
