/**
 * Demo mode (DEMO_MODE=1) unlocks the demo login, the reply simulator and similar showcase
 * features. Those must never reach real people, so messaging is fenced by an allowlist.
 */

export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === "1";
}

/** "whatsapp:+39 333 123 4567" -> "+393331234567"; emails are compared case-insensitively. */
function normalizeRecipient(value: string): string {
  const v = value.trim().replace(/^whatsapp:/i, "");
  if (v.includes("@")) return v.toLowerCase();
  return v.replace(/[\s().-]/g, "");
}

/** MESSAGING_ALLOWLIST: comma-separated E.164 numbers and/or emails. */
export function messagingAllowlist(): Set<string> {
  return new Set(
    (process.env.MESSAGING_ALLOWLIST ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map(normalizeRecipient),
  );
}

/**
 * Is this the live deployment, free to message anyone? Only with NODE_ENV=production, outside
 * demo mode, with MESSAGING_LIVE=1, and on Vercel only in VERCEL_ENV=production. NODE_ENV alone
 * says nothing: previews, staging boxes and `next start` all run as production, often with real
 * provider keys and a copy of production data. Forgetting MESSAGING_LIVE in production captures
 * messages (visible in the message log); forgetting a fence would text real patients.
 */
export function isLiveMessaging(): boolean {
  if (process.env.NODE_ENV !== "production" || isDemoMode() || process.env.MESSAGING_LIVE !== "1") return false;
  const vercel = process.env.VERCEL_ENV;
  return !vercel || vercel === "production";
}

/**
 * May a real SMS / email / WhatsApp go to this recipient? Callers record the message as
 * "captured" instead of sending it when this is false.
 *
 * Only the live deployment sends freely. Everything else (demo mode, a dev machine with real
 * provider keys, a preview or staging copy of production data) sends only to the allowlist, and
 * an empty list means nobody.
 */
export function isAllowedRecipient(to: string): boolean {
  if (isLiveMessaging()) return true;
  return messagingAllowlist().has(normalizeRecipient(to));
}
