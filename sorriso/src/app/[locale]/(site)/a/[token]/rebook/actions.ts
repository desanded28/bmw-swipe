"use server";

import { headers } from "next/headers";
import { toLocale } from "@/i18n/config";
import { fmtWhen } from "@/i18n/datefmt";
import { practitionerName } from "@/lib/format";
import { TOKEN_SHAPE } from "@/lib/forms";
import { logError } from "@/lib/log";
import { rateLimitByIp } from "@/lib/rate-limit";
import { acceptAlternative, requestCallBack } from "@/lib/rebooking";

/**
 * The patient's side of the rebooking assistant, reached with the appointment link only: pick
 * one of the offered times, or ask to be called. Rate limited per network.
 */

async function allowed(): Promise<boolean> {
  return (await rateLimitByIp(await headers(), "care-rebook", 30, 10 * 60_000)).ok;
}

export type ChooseResult = { ok: true; when: string; practitioner: string } | { ok: false; reason: string };

export async function chooseNewTime(token: string, locale: string, key: string): Promise<ChooseResult> {
  if (!TOKEN_SHAPE.test(token)) return { ok: false, reason: "invalid" };
  if (!(await allowed())) return { ok: false, reason: "rate_limited" };
  try {
    const res = await acceptAlternative(token, String(key ?? ""), { headers: await headers() });
    if (!res.ok) return { ok: false, reason: res.reason };
    const l = toLocale(locale);
    return {
      ok: true,
      when: fmtWhen(res.d.appointment.startsAt, res.d.location.timezone, l),
      practitioner: practitionerName(res.d.practitioner),
    };
  } catch (err) {
    logError("care rebook", err, { step: "choose" });
    return { ok: false, reason: "error" };
  }
}

export async function askForCall(token: string): Promise<{ ok: boolean; reason?: string }> {
  if (!TOKEN_SHAPE.test(token)) return { ok: false, reason: "invalid" };
  if (!(await allowed())) return { ok: false, reason: "rate_limited" };
  try {
    const res = await requestCallBack(token, { headers: await headers() });
    return res === "ok" ? { ok: true } : { ok: false, reason: res };
  } catch (err) {
    logError("care rebook", err, { step: "call" });
    return { ok: false, reason: "error" };
  }
}
