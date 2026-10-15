/**
 * What went wrong with a failed message, as a code staff see in their own language
 * (reminders.messages.errors.<code>). messages.error keeps the provider's own (redacted, English,
 * technical) text for support; the dashboard never shows it.
 */
export const DELIVERY_ERROR_CODES = ["no_whatsapp_template", "whatsapp_not_configured", "not_configured", "invalid_number", "provider_error"] as const;
export type DeliveryErrorCode = (typeof DELIVERY_ERROR_CODES)[number];

export function deliveryErrorCode(error: string | null | undefined): DeliveryErrorCode | null {
  if (!error) return null;
  if (/^whatsapp: no approved template/i.test(error)) return "no_whatsapp_template";
  if (/^whatsapp: not configured/i.test(error)) return "whatsapp_not_configured";
  if (/not configured|missing (credentials|config)/i.test(error)) return "not_configured";
  // Twilio 21211 / 21614: the 'To' number is not a valid (mobile) number.
  if (/\b(21211|21614)\b|number .* is not valid/i.test(error)) return "invalid_number";
  return "provider_error";
}
