import type { OrgSettings, StoredOrgSettings } from "@/db/schema";
import { DEFAULT_CARE, DEFAULT_PRIVACY, resolveCareSettings, resolvePrivacySettings } from "./privacy/settings";

export const DEFAULT_SETTINGS: OrgSettings = {
  booking: {
    minNoticeMinutes: 120,
    maxAdvanceDays: 90,
    slotStepMinutes: 15,
    cancelUntilHours: 24,
    requireApproval: false,
  },
  reminders: {
    rules: [
      { id: "r48", channel: "email", offsetMinutes: 48 * 60, askConfirmation: true, fallbackToEmail: true },
      { id: "r24", channel: "sms", offsetMinutes: 24 * 60, askConfirmation: true, fallbackToEmail: true },
      { id: "r2", channel: "sms", offsetMinutes: 2 * 60, askConfirmation: false, fallbackToEmail: false },
    ],
    sendBookingConfirmation: true,
    requestReviews: true,
    autoOfferToWaitlist: true,
    smsAsciiFallback: false,
  },
  privacy: DEFAULT_PRIVACY,
  care: DEFAULT_CARE,
};

/** Fill in any settings keys missing from older rows and clamp out-of-range values. */
export function resolveSettings(settings: StoredOrgSettings | OrgSettings | null | undefined): OrgSettings {
  const s = (settings ?? {}) as StoredOrgSettings;
  return {
    booking: { ...DEFAULT_SETTINGS.booking, ...(s.booking ?? {}) },
    reminders: { ...DEFAULT_SETTINGS.reminders, ...(s.reminders ?? {}) },
    privacy: resolvePrivacySettings(s.privacy),
    care: resolveCareSettings(s.care),
  };
}

/** @deprecated English-only; use the reminders namespace (src/i18n) to describe offsets. */
export function describeOffset(minutes: number): string {
  if (minutes % (24 * 60) === 0) {
    const d = minutes / (24 * 60);
    return `${d} day${d === 1 ? "" : "s"} before`;
  }
  if (minutes % 60 === 0) {
    const h = minutes / 60;
    return `${h} hour${h === 1 ? "" : "s"} before`;
  }
  return `${minutes} minutes before`;
}
