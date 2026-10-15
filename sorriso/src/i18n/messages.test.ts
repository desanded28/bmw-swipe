/**
 * Dictionary integrity. Runs on every `npm test`; `npm run i18n:check` sets I18N_STRICT=1, which
 * also requires every English key in every locale (the translation package's acceptance gate).
 */
import { describe, expect, it } from "vitest";
import {
  APPOINTMENT_STATUSES,
  CHANNELS,
  CONFIRMATION_STATUSES,
  CONSENT_PURPOSES,
  MEMBERSHIP_ROLES,
  SERVICE_CATEGORIES,
  SPOKEN_LANGUAGES,
} from "@/db/enums";
import { LOCALES, type Locale } from "./config";
import { EN_MESSAGES, LOCALE_MESSAGES } from "./messages";
import { NAMESPACES } from "./namespaces";
import { isPlural, pluralCategories } from "./plural";
import type { Plural, PluralCategory } from "./types";

const STRICT = process.env.I18N_STRICT === "1";
const OTHER_LOCALES = LOCALES.filter((l) => l !== "en");

/** Categories every plural leaf must provide; CLDR's optional "many" (it, fr, es, pt) falls back to other. */
const REQUIRED_PLURALS: Partial<Record<Locale, PluralCategory[]>> = {
  pl: ["one", "few", "many", "other"],
  ro: ["one", "few", "other"],
};
const requiredPlurals = (l: Locale) => REQUIRED_PLURALS[l] ?? ["one", "other"];

type Leaf = string | Plural;

function leaves(tree: unknown, prefix = ""): Map<string, Leaf> {
  const out = new Map<string, Leaf>();
  if (typeof tree !== "object" || tree === null) return out;
  for (const [k, v] of Object.entries(tree)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string" || isPlural(v)) out.set(key, v);
    else if (typeof v === "object" && v !== null) for (const [kk, vv] of leaves(v, key)) out.set(kk, vv);
    else out.set(key, v as Leaf); // wrong type: reported by the shape checks below
  }
  return out;
}

const texts = (leaf: Leaf): string[] =>
  typeof leaf === "string" ? [leaf] : Object.entries(leaf).flatMap(([k, v]) => (k === "__plural" ? [] : [v as string]));
const placeholders = (leaf: Leaf) => [...new Set(texts(leaf).flatMap((t) => [...t.matchAll(/\{(\w+)\}/g)].map((m) => m[1])))].sort();
const tags = (leaf: Leaf) => [...new Set(texts(leaf).flatMap((t) => [...t.matchAll(/<\/?([A-Za-z][\w-]*)\s*\/?>/g)].map((m) => m[1])))].sort();

const EN = Object.fromEntries(NAMESPACES.map((ns) => [ns, leaves(EN_MESSAGES[ns])])) as Record<string, Map<string, Leaf>>;

describe("dictionary shape", () => {
  it("every locale has every namespace file", () => {
    for (const l of LOCALES) expect(Object.keys(LOCALE_MESSAGES[l]).sort()).toEqual([...NAMESPACES].sort());
  });

  it("common covers the shared enums exactly", () => {
    const c = EN_MESSAGES.common;
    expect(Object.keys(c.appointmentStatus).sort()).toEqual([...APPOINTMENT_STATUSES].sort());
    expect(Object.keys(c.confirmationStatus).sort()).toEqual([...CONFIRMATION_STATUSES].sort());
    expect(Object.keys(c.channels).sort()).toEqual([...CHANNELS].sort());
    expect(Object.keys(c.categories).sort()).toEqual([...SERVICE_CATEGORIES].sort());
    expect(Object.keys(c.roles).sort()).toEqual([...MEMBERSHIP_ROLES].sort());
    expect(Object.keys(c.languages).sort()).toEqual([...SPOKEN_LANGUAGES].sort());
  });

  it("consents has title, label and description for every consent purpose, in English and Italian", () => {
    for (const l of ["en", "it"] as const) {
      const consents = LOCALE_MESSAGES[l].consents as Record<string, Record<string, string>>;
      expect(Object.keys(consents).sort()).toEqual([...CONSENT_PURPOSES].sort());
      for (const p of CONSENT_PURPOSES) expect(Object.keys(consents[p]).sort()).toEqual(["description", "label", "title"]);
    }
  });
});

describe.each(LOCALES)("%s", (locale) => {
  const own = Object.fromEntries(NAMESPACES.map((ns) => [ns, leaves(LOCALE_MESSAGES[locale][ns])])) as Record<string, Map<string, Leaf>>;

  it("has no keys that English lacks, and each leaf has the English kind", () => {
    const problems: string[] = [];
    for (const ns of NAMESPACES) {
      for (const [key, leaf] of own[ns]) {
        const en = EN[ns].get(key);
        if (en === undefined) problems.push(`${ns}.${key}: not in English`);
        else if (typeof leaf !== "string" && !isPlural(leaf)) problems.push(`${ns}.${key}: not a string or p()`);
        else if (isPlural(en) !== isPlural(leaf)) problems.push(`${ns}.${key}: ${isPlural(en) ? "must" : "must not"} be a plural`);
      }
    }
    expect(problems).toEqual([]);
  });

  it("has no empty strings", () => {
    const empty: string[] = [];
    for (const ns of NAMESPACES)
      for (const [key, leaf] of own[ns]) if (texts(leaf).some((t) => typeof t !== "string" || t.trim() === "")) empty.push(`${ns}.${key}`);
    expect(empty).toEqual([]);
  });

  it("keeps the English placeholders and tags", () => {
    const diffs: string[] = [];
    for (const ns of NAMESPACES) {
      for (const [key, leaf] of own[ns]) {
        const en = EN[ns].get(key);
        if (!en) continue;
        const [a, b] = [placeholders(en).join(","), placeholders(leaf).join(",")];
        if (a !== b) diffs.push(`${ns}.${key}: {${b}} instead of {${a}}`);
        const [ta, tb] = [tags(en).join(","), tags(leaf).join(",")];
        if (ta !== tb) diffs.push(`${ns}.${key}: <${tb}> instead of <${ta}>`);
      }
    }
    expect(diffs).toEqual([]);
  });

  it("gives plural leaves the categories the locale needs, and only categories it has", () => {
    const required = requiredPlurals(locale);
    const known = new Set(pluralCategories(locale));
    const problems: string[] = [];
    for (const ns of NAMESPACES) {
      for (const [key, leaf] of own[ns]) {
        if (!isPlural(leaf)) continue;
        const missing = required.filter((c) => leaf[c] === undefined);
        if (missing.length) problems.push(`${ns}.${key}: missing ${missing.join(", ")}`);
        const unknown = Object.keys(leaf).filter((c) => c !== "__plural" && !known.has(c as PluralCategory));
        if (unknown.length) problems.push(`${ns}.${key}: ${unknown.join(", ")} never selected in ${locale}`);
      }
    }
    expect(problems).toEqual([]);
  });
});

describe("coverage", () => {
  const rows = OTHER_LOCALES.map((l) => {
    const missing: string[] = [];
    let total = 0;
    for (const ns of NAMESPACES) {
      const own = leaves(LOCALE_MESSAGES[l][ns]);
      for (const key of EN[ns].keys()) {
        total++;
        if (!own.has(key)) missing.push(`${ns}.${key}`);
      }
    }
    return { locale: l, total, missing };
  });

  it(STRICT ? "every English key exists in every locale (I18N_STRICT)" : "report (set I18N_STRICT=1 to enforce)", () => {
    if (STRICT) {
      for (const r of rows) expect({ locale: r.locale, missing: r.missing.slice(0, 50) }).toEqual({ locale: r.locale, missing: [] });
      return;
    }
    const lines = rows.map((r) => {
      const pct = r.total ? Math.floor((100 * (r.total - r.missing.length)) / r.total) : 100;
      return `  ${r.locale}: ${r.total - r.missing.length}/${r.total} keys (${pct}%)`;
    });
    process.stdout.write(`\ni18n coverage (non-strict):\n${lines.join("\n")}\n`);
  });
});

describe("counted phrases", () => {
  /**
   * A placeholder followed by a noun whose form depends on the number (Polish has three plural
   * forms). Not a count: "{channel} messages", "{threshold} a year".
   */
  const COUNTED =
    /\{(?!channel\})(\w+)\}\s+(?:(?!a\s|an\s|per\s)[a-z-]+\s+)?(no-shows?|visits?|hours?|days?|minutes?|weeks?|months?|years?|entries|entry|reminders?|patients?|recalls?|attempts?|activities|activity|characters?|appointments?|bookings?|reviews?|messages?|sessions?|times)\b/i;
  /**
   * Texts whose number is a fixed constant of the code, not a count that varies: the translator
   * writes the one form that number takes. Anything that can vary must be a p() plural.
   */
  const FIXED = new Set([
    "privacyMessages.confirmBooking.body", // ADULT_CONFIRMATION_HOURS (48)
    "privacyAdmin.settingsPrivacy.sessionHours.hint", // the allowed range, 1 to 24
    "privacyAdmin.register.add.limit", // MAX_CUSTOM_ENTRIES
    "privacyAdmin.closure.steps.retrieve", // CLOSURE_TRANSITION_DAYS + CLOSURE_RETRIEVAL_DAYS
    "reviews.errors.tooLong", // COMMENT_MAX, REPORT_TEXT_MAX
  ]);

  it("are p() plurals, not plain strings ('1 no-shows in 8 visits', '1 hours')", () => {
    const offenders: string[] = [];
    for (const [ns, map] of Object.entries(EN)) {
      for (const [key, leaf] of map) {
        const id = `${ns}.${key}`;
        if (typeof leaf !== "string" || FIXED.has(id)) continue;
        const m = COUNTED.exec(leaf);
        if (m) offenders.push(`${id}: {${m[1]}} ${m[2]}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
