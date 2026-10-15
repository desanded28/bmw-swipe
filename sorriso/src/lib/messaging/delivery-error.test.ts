import { describe, expect, it } from "vitest";
import { getT } from "@/i18n/t";
import { DELIVERY_ERROR_CODES, deliveryErrorCode } from "./delivery-error";

describe("deliveryErrorCode", () => {
  it("turns stored provider errors into codes staff see in their own language", () => {
    expect(deliveryErrorCode(null)).toBeNull();
    expect(deliveryErrorCode("whatsapp: no approved template for reminder in de")).toBe("no_whatsapp_template");
    expect(deliveryErrorCode("whatsapp: not configured (TWILIO_WHATSAPP_FROM)")).toBe("whatsapp_not_configured");
    expect(deliveryErrorCode("Twilio 400: The 'To' number +39•••1234 is not valid (21211)")).toBe("invalid_number");
    expect(deliveryErrorCode("Twilio 500: Internal error")).toBe("provider_error");
  });

  it("has a text for every code", () => {
    const t = getT("en", "reminders");
    for (const code of DELIVERY_ERROR_CODES) expect(t.has(`messages.errors.${code}`)).toBe(true);
  });
});
