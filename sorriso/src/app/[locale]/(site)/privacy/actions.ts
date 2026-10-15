"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { CONSENT_PURPOSES, LOCALES, type ConsentPurpose, type Locale } from "@/db/enums";
import { toLocale } from "@/i18n/config";
import { fmtDay, zonedDate } from "@/i18n/datefmt";
import { lhref } from "@/i18n/href";
import { getT } from "@/i18n/server";
import { DEFAULT_TIMEZONE } from "@/lib/config";
import { logError } from "@/lib/log";
import { endPatientSession, getPatientSession, rememberUnlocked, replacePatientSession, startPatientSession } from "@/lib/privacy/patient-session";
import {
  answerChallenge,
  CENTER_REQUEST_TYPES,
  checkTicketCode,
  confirmContactChange,
  fileRequest,
  isReviewReturnPath,
  openTicket,
  parseContact,
  recordStepUpVerification,
  requestContactChange,
  requestPrivacyCenterCode,
  setConsentChoice,
  updatePreferences,
  withdrawOwnReview,
  type CenterRequestType,
} from "@/lib/privacy/privacy-center";
import type { PrivacyFormState } from "@/components/privacy/ActionForm";
import type { ContactChangeState } from "@/components/privacy/RecordForms";

/**
 * Server actions of the patient privacy center (/[locale]/privacy). Every action re-reads the
 * session cookie and re-checks that the record is one the session may see in full
 * (privacy-center.ts), so a hidden field can't reach anyone else's data. Results are short,
 * translated messages for the form that sent them. Writes are audited in privacy-center.ts.
 */

/** A sign-in takes as long whether or not the contact is known (privacy-center.ts). */
const SIGN_IN_MIN_MS = 2000;

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const localeOf = (fd: FormData): Locale => toLocale(fd.get("locale"));
const ok = (message: string): PrivacyFormState => ({ ok: true, message });
const fail = (message: string): PrivacyFormState => ({ ok: false, message });

function refresh(locale: Locale) {
  revalidatePath(lhref(locale, "/privacy/me"));
}

async function sessionOrFail(locale: Locale) {
  const session = await getPatientSession();
  return { session, expired: session ? null : fail(getT(locale, "privacy")("me.errors.session")) };
}

/** Step 1: send a code (or a decoy) and go to the code form; the same answer either way. */
export async function requestCodeAction(_prev: PrivacyFormState, fd: FormData): Promise<PrivacyFormState> {
  const locale = localeOf(fd);
  const t = getT(locale, "privacy");
  const contact = parseContact(str(fd, "contact"), str(fd, "dial") || null);
  if (!contact) return fail(t("center.errors.invalidContact"));
  let ticket: string;
  try {
    const r = await requestPrivacyCenterCode({ contact, locale, headers: await headers(), minDurationMs: SIGN_IN_MIN_MS });
    if (!r.ok) return fail(t("center.errors.rateLimited"));
    ticket = r.ticket;
  } catch (err) {
    logError("privacy-center", err, { step: "request_code" });
    return fail(t("center.errors.generic"));
  }
  redirect(lhref(locale, `/privacy/verify?t=${ticket}`));
}

/**
 * Step 2: check the code and open the 30-minute session. A ticket from the appointment link's
 * step-up also records the contact as verified for that patient (an explicit act through it),
 * audited as the new session, and one from a visit's review page leads back to it.
 */
export async function verifyCodeAction(_prev: PrivacyFormState, fd: FormData): Promise<PrivacyFormState> {
  const locale = localeOf(fd);
  const t = getT(locale, "privacy");
  const raw = str(fd, "ticket");
  const code = str(fd, "code").replace(/\s+/g, "");
  if (!openTicket(raw, "privacy_center")) return fail(t("verify.errors.ticket"));
  if (!/^\d{6}$/.test(code)) return fail(t("verify.errors.format"));
  const res = await checkTicketCode(raw, code, "privacy_center");
  if (!res.ok) return fail(t(`verify.errors.${res.reason}`));
  const h = await headers();
  const session = await startPatientSession(res.contact, { headers: h });
  if (res.ticket.pid) await recordStepUpVerification(session, { patientId: res.ticket.pid, contact: res.contact, headers: h });
  // A step-up from a visit's review page goes back there (the path is sealed in the ticket).
  redirect(lhref(locale, res.ticket.r && isReviewReturnPath(res.ticket.r) ? res.ticket.r : "/privacy/me"));
}

export async function signOutAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  await endPatientSession(await getPatientSession());
  redirect(lhref(locale, "/privacy?signedOut=1"));
}

export async function challengeAction(_prev: PrivacyFormState, fd: FormData): Promise<PrivacyFormState> {
  const locale = localeOf(fd);
  const t = getT(locale, "privacy");
  const { session, expired } = await sessionOrFail(locale);
  if (!session) return expired;
  const patientId = str(fd, "patientId");
  const r = await answerChallenge(session, patientId, { lastName: str(fd, "lastName"), birthDate: str(fd, "birthDate") }, { headers: await headers() });
  if (!r.ok) {
    const key = r.reason === "rate_limited" ? "me.challenge.rateLimited" : r.reason === "unavailable" ? "me.challenge.unavailable" : "me.challenge.wrong";
    return fail(t(key));
  }
  // The unlock lives with the session: where the contact matches two adults the record would ask again.
  await rememberUnlocked(patientId);
  refresh(locale);
  return ok(t("me.choices.saved"));
}

export async function consentAction(_prev: PrivacyFormState, fd: FormData): Promise<PrivacyFormState> {
  const locale = localeOf(fd);
  const t = getT(locale, "privacy");
  const { session, expired } = await sessionOrFail(locale);
  if (!session) return expired;
  const purpose = str(fd, "purpose");
  if (!(CONSENT_PURPOSES as readonly string[]).includes(purpose)) return fail(t("me.choices.notAllowed"));
  const r = await setConsentChoice(session, {
    patientId: str(fd, "patientId"),
    purpose: purpose as ConsentPurpose,
    on: str(fd, "on") === "1",
    locale,
    headers: await headers(),
  });
  if (!r.ok) return fail(r.reason === "guardian_required" ? t("me.choices.guardianRequired") : t("me.choices.notAllowed"));
  refresh(locale);
  return ok(t("me.choices.saved"));
}

export async function preferencesAction(_prev: PrivacyFormState, fd: FormData): Promise<PrivacyFormState> {
  const locale = localeOf(fd);
  const t = getT(locale, "privacy");
  const { session, expired } = await sessionOrFail(locale);
  if (!session) return expired;
  const messageLocale = str(fd, "messageLocale");
  const channel = str(fd, "channel");
  if (!(LOCALES as readonly string[]).includes(messageLocale) || !["sms", "whatsapp", "email"].includes(channel)) return fail(t("me.errors.generic"));
  const r = await updatePreferences(session, {
    patientId: str(fd, "patientId"),
    locale: messageLocale as Locale,
    channel: channel as "sms" | "whatsapp" | "email",
    whatsappConfirmed: str(fd, "whatsapp") === "1",
    shownIn: locale,
    headers: await headers(),
  });
  if (!r.ok) {
    const key =
      r.reason === "whatsapp_consent_required"
        ? "me.preferences.whatsappRequired"
        : r.reason === "channel_unavailable"
          ? "me.preferences.unavailable"
          : r.reason === "guardian_required"
            ? "me.choices.guardianRequired"
            : "me.errors.generic";
    return fail(t(key));
  }
  refresh(locale);
  return ok(t("me.preferences.saved"));
}

export async function contactRequestAction(_prev: ContactChangeState, fd: FormData): Promise<ContactChangeState> {
  const locale = localeOf(fd);
  const t = getT(locale, "privacy");
  const { session, expired } = await sessionOrFail(locale);
  if (!session) return expired;
  const kind = str(fd, "kind") === "email" ? "email" : "phone";
  const r = await requestContactChange(session, {
    patientIds: fd.getAll("patientIds").map(String).filter(Boolean),
    kind,
    value: str(fd, "value"),
    dialCode: str(fd, "dial") || null,
    locale,
    headers: await headers(),
  });
  if (!r.ok) return fail(t(`me.contact.errors.${r.reason}`));
  return { ok: true, message: t("me.contact.codeSent", { contact: r.masked }), ticket: r.ticket };
}

export async function contactConfirmAction(_prev: ContactChangeState, fd: FormData): Promise<ContactChangeState> {
  const locale = localeOf(fd);
  const t = getT(locale, "privacy");
  const { session, expired } = await sessionOrFail(locale);
  if (!session) return expired;
  const h = await headers();
  const r = await confirmContactChange(session, { ticket: str(fd, "ticket"), code: str(fd, "code"), headers: h });
  if (!r.ok) return { ok: false, message: t(`me.contact.errors.${r.reason}`), ticket: str(fd, "ticket") };
  if (r.renewSessionWith) await replacePatientSession(session, r.renewSessionWith, { headers: h });
  refresh(locale);
  return ok(t("me.contact.done"));
}

export async function requestAction(_prev: PrivacyFormState, fd: FormData): Promise<PrivacyFormState> {
  const locale = localeOf(fd);
  const t = getT(locale, "privacy");
  const { session, expired } = await sessionOrFail(locale);
  if (!session) return expired;
  const type = str(fd, "type");
  if (!(CENTER_REQUEST_TYPES as readonly string[]).includes(type)) return fail(t("me.errors.generic"));
  const r = await fileRequest(session, {
    patientId: str(fd, "patientId"),
    type: type as CenterRequestType,
    toSorriso: str(fd, "to") === "sorriso",
    details: str(fd, "details") || null,
    locale,
    headers: await headers(),
  });
  if (!r.ok) return fail(t("me.errors.generic"));
  const date = fmtDay(zonedDate(r.dueAt, DEFAULT_TIMEZONE), "long", locale);
  refresh(locale);
  return ok(r.duplicate ? t("me.requests.duplicate", { date }) : t("me.requests.filed", { date }));
}

export async function withdrawReviewAction(_prev: PrivacyFormState, fd: FormData): Promise<PrivacyFormState> {
  const locale = localeOf(fd);
  const t = getT(locale, "privacy");
  const { session, expired } = await sessionOrFail(locale);
  if (!session) return expired;
  const r = await withdrawOwnReview(session, str(fd, "reviewId"));
  if (!r.ok) return fail(t("me.errors.generic"));
  refresh(locale);
  return ok(t("me.reviews.withdrawn"));
}
