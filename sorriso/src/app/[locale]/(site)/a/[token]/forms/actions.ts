"use server";

import { headers } from "next/headers";
import type { ManageCareCard } from "@/components/care/types";
import { toLocale } from "@/i18n/config";
import { zonedDate } from "@/i18n/datefmt";
import { getAppointmentDetails } from "@/lib/appointments";
import { anamnesisStatuses, startFormSignature, submitAnamnesis, TOKEN_SHAPE, type AnswerError } from "@/lib/forms";
import { logError } from "@/lib/log";
import { getCare } from "@/lib/privacy/settings";
import { rateLimitByIp } from "@/lib/rate-limit";
import { needsRebooking } from "@/lib/rebooking";

/**
 * The patient's side of the medical-history form, reached with the appointment link only (no
 * account): the manage page's care card, sending the signature code, and signing. Each call is
 * rate limited per network; the code itself is limited per contact (src/lib/otp.ts).
 */

const LIMIT = 40;
const WINDOW_MS = 10 * 60_000;

async function allowed(bucket: string): Promise<boolean> {
  return (await rateLimitByIp(await headers(), bucket, LIMIT, WINDOW_MS)).ok;
}

/** The manage page's care card: the form's status for this visit, and whether the visit needs a new time. */
export async function formsCardStatus(token: string): Promise<ManageCareCard | null> {
  if (!TOKEN_SHAPE.test(token) || !(await allowed("care-card"))) return null;
  const d = await getAppointmentDetails({ token });
  if (!d) return null;
  const care = getCare(d.org);
  const info = (await anamnesisStatuses(d.org.id, [d.appointment], care)).get(d.appointment.id);
  const now = new Date();
  const upcoming = ["scheduled", "requested"].includes(d.appointment.status) && d.appointment.startsAt > now;
  const restricted = Boolean(d.patient.restrictedAt || d.patient.erasedAt);
  return {
    anamnesis:
      info?.status && !restricted
        ? {
            status: info.status,
            signedOn: info.signedAt ? zonedDate(info.signedAt, d.location.timezone) : null,
            canFill: care.anamnesisEnabled && upcoming,
          }
        : null,
    rebookNeeded: !restricted && (await needsRebooking(d.appointment, now)),
  };
}

export type SendCodeResult = { ok: true; challengeId: string; masked: string } | { ok: false; reason: string };

/** Send the 6-digit signature code to the contact on file (never to an address the visitor types). */
export async function sendSignatureCode(token: string, locale: string): Promise<SendCodeResult> {
  if (!TOKEN_SHAPE.test(token)) return { ok: false, reason: "invalid" };
  if (!(await allowed("care-form"))) return { ok: false, reason: "rate_limited" };
  try {
    const res = await startFormSignature({ token, locale: toLocale(locale), headers: await headers() });
    return res.ok ? { ok: true, challengeId: res.challengeId, masked: res.masked } : { ok: false, reason: res.reason };
  } catch (err) {
    logError("care form", err, { step: "send-code" });
    return { ok: false, reason: "generic" };
  }
}

export type SubmitFormResult = { ok: true } | { ok: false; reason: string; errors?: Record<string, AnswerError> };

/** Sign and store the medical history (answers checked, then the code). */
export async function submitAnamnesisForm(
  token: string,
  locale: string,
  payload: { answers: Record<string, unknown>; challengeId: string; code: string; signerName: string },
): Promise<SubmitFormResult> {
  if (!TOKEN_SHAPE.test(token)) return { ok: false, reason: "invalid" };
  if (!(await allowed("care-form"))) return { ok: false, reason: "rate_limited" };
  try {
    const res = await submitAnamnesis({
      token,
      answers: payload.answers,
      challengeId: String(payload.challengeId ?? ""),
      code: String(payload.code ?? ""),
      signerName: String(payload.signerName ?? ""),
      locale: toLocale(locale),
      headers: await headers(),
    });
    if (res.ok) return { ok: true };
    return res.reason === "answers" ? { ok: false, reason: "answers", errors: res.errors } : { ok: false, reason: res.reason };
  } catch (err) {
    logError("care form", err, { step: "submit" });
    return { ok: false, reason: "generic" };
  }
}
