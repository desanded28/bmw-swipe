import type { CareSettings, PrivacySettings, RetentionSettings, StoredOrgSettings } from "@/db/schema";

type Limit = { min: number; max: number; default: number; unit: "days" | "months" | "hours" };

/**
 * Retention limits. Defaults are conservative; practices can tune them within the range.
 * Clinical-record obligations (e.g. 10 years for dental records kept by the practice) are
 * honoured by deferring patient erasure (patients.retainUntil), not by these settings.
 */
export const RETENTION_LIMITS: Record<keyof RetentionSettings, Limit> = {
  patientInactiveMonths: { min: 24, max: 240, default: 120, unit: "months" },
  neverSeenPatientMonths: { min: 6, max: 36, default: 12, unit: "months" },
  messageBodyMonths: { min: 1, max: 24, default: 12, unit: "months" },
  messageMetaMonths: { min: 12, max: 60, default: 24, unit: "months" },
  reminderDays: { min: 30, max: 365, default: 90, unit: "days" },
  waitlistDays: { min: 30, max: 365, default: 90, unit: "days" },
  patientNoteDays: { min: 30, max: 3650, default: 90, unit: "days" },
  auditMonths: { min: 24, max: 60, default: 24, unit: "months" },
  providerMessageDays: { min: 1, max: 90, default: 30, unit: "days" },
  formSubmissionMonths: { min: 12, max: 240, default: 120, unit: "months" },
  consentMonths: { min: 24, max: 120, default: 120, unit: "months" },
  privacyRequestMonths: { min: 24, max: 120, default: 60, unit: "months" },
};

export const DEFAULT_RETENTION: RetentionSettings = Object.fromEntries(
  Object.entries(RETENTION_LIMITS).map(([k, v]) => [k, v.default]),
) as RetentionSettings;

export const SESSION_HOURS_LIMITS = { min: 1, max: 24, default: 12 };

export const DEFAULT_PRIVACY: PrivacySettings = {
  messageContentLevel: "discreet",
  whatsappEnabled: false,
  marketingEnabled: false,
  icsFeedsEnabled: false,
  icsDetail: "none",
  embedOrigins: [],
  requireMfa: true,
  sessionHours: SESSION_HOURS_LIMITS.default,
  riskBasedReminders: false,
  staffWaLinks: false,
  erasureDefault: "restrict",
  retention: DEFAULT_RETENTION,
};

export const DEFAULT_CARE: CareSettings = {
  recallsEnabled: true,
  recallMaxAttempts: 2,
  anamnesisEnabled: false,
  anamnesisRefreshMonths: 12,
};

const clamp = (n: unknown, min: number, max: number, fallback: number) => {
  const v = typeof n === "number" && Number.isFinite(n) ? Math.round(n) : fallback;
  return Math.max(min, Math.min(max, v));
};

export function resolveRetention(raw?: Partial<RetentionSettings> | null): RetentionSettings {
  const out = {} as RetentionSettings;
  for (const [key, lim] of Object.entries(RETENTION_LIMITS) as [keyof RetentionSettings, Limit][]) {
    out[key] = clamp(raw?.[key], lim.min, lim.max, lim.default);
  }
  return out;
}

function sanitizeOrigins(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  const out: string[] = [];
  for (const item of list) {
    if (typeof item !== "string") continue;
    try {
      const u = new URL(item.trim());
      if (u.protocol === "https:" || (u.protocol === "http:" && u.hostname === "localhost")) out.push(u.origin);
    } catch {
      /* ignore invalid origins */
    }
  }
  return [...new Set(out)].slice(0, 10);
}

export function resolvePrivacySettings(raw?: StoredOrgSettings["privacy"] | null): PrivacySettings {
  const r = raw ?? {};
  return {
    messageContentLevel: r.messageContentLevel === "detailed" ? "detailed" : "discreet",
    whatsappEnabled: r.whatsappEnabled ?? DEFAULT_PRIVACY.whatsappEnabled,
    marketingEnabled: r.marketingEnabled ?? DEFAULT_PRIVACY.marketingEnabled,
    icsFeedsEnabled: r.icsFeedsEnabled ?? DEFAULT_PRIVACY.icsFeedsEnabled,
    icsDetail: r.icsDetail === "initials" ? "initials" : "none",
    embedOrigins: sanitizeOrigins(r.embedOrigins),
    requireMfa: r.requireMfa ?? DEFAULT_PRIVACY.requireMfa,
    sessionHours: clamp(r.sessionHours, SESSION_HOURS_LIMITS.min, SESSION_HOURS_LIMITS.max, SESSION_HOURS_LIMITS.default),
    riskBasedReminders: r.riskBasedReminders ?? DEFAULT_PRIVACY.riskBasedReminders,
    staffWaLinks: r.staffWaLinks ?? DEFAULT_PRIVACY.staffWaLinks,
    erasureDefault: r.erasureDefault === "anonymise" ? "anonymise" : "restrict",
    retention: resolveRetention(r.retention),
  };
}

export function resolveCareSettings(raw?: Partial<CareSettings> | null): CareSettings {
  const r = raw ?? {};
  return {
    recallsEnabled: r.recallsEnabled ?? DEFAULT_CARE.recallsEnabled,
    recallMaxAttempts: clamp(r.recallMaxAttempts, 0, 3, DEFAULT_CARE.recallMaxAttempts),
    anamnesisEnabled: r.anamnesisEnabled ?? DEFAULT_CARE.anamnesisEnabled,
    anamnesisRefreshMonths: clamp(r.anamnesisRefreshMonths, 1, 60, DEFAULT_CARE.anamnesisRefreshMonths),
  };
}

export function getPrivacy(org: { settings: unknown }): PrivacySettings {
  return resolvePrivacySettings((org.settings as StoredOrgSettings | null)?.privacy);
}

export function getCare(org: { settings: unknown }): CareSettings {
  return resolveCareSettings((org.settings as StoredOrgSettings | null)?.care);
}
