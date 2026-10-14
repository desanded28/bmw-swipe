"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { LOCALES, type ConsentPurpose, type Locale } from "@/db/enums";
import { toLocale } from "@/i18n/config";
import { lhref } from "@/i18n/href";
import { getT } from "@/i18n/server";
import { getAppointmentDetails } from "@/lib/appointments";
import { confirmAdultBooking, declineAdultBooking } from "@/lib/privacy/adult-confirmation";
import { applyConsentChoice, applyPreferences, linkRecord, requestLinkStepUp } from "@/lib/privacy/privacy-center";
import type { PrivacyFormState } from "@/components/privacy/ActionForm";

/**
 * Server actions of the appointment link's privacy page (/[locale]/a/<token>/privacy). The link
 * itself is the credential, so these do only what is safe without a one-time code: language and
 * channel, withdrawing optional consents and objecting, unsubscribing. Everything else (seeing
 * all data, exporting, filing requests) goes through the step-up: a code to the contact on file
 * that opens a privacy-center session. Audited with actor type patient_link.
 */

const TOKEN_SHAPE = /^[A-Za-z0-9_-]{8,128}$/;
/** What the link may switch off without a code. Turning things on happens where their notice is shown. */
const WITHDRAWABLE: readonly ConsentPurpose[] = [
  "feedback_request",
  "marketing",
  "whatsapp_channel",
  "platform_booking_art9",
  "sms_channel",
  "email_channel",
  "no_show_tracking",
  "adaptive_reminders",
  "recalls",
];

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

async function load(fd: FormData) {
  const locale: Locale = toLocale(fd.get("locale"));
  const token = str(fd, "token");
  const d = TOKEN_SHAPE.test(token) ? await getAppointmentDetails({ token }) : null;
  return { locale, token, d, t: getT(locale, "privacy") };
}

const fail = (message: string): PrivacyFormState => ({ ok: false, message });

export async function linkPreferencesAction(_prev: PrivacyFormState, fd: FormData): Promise<PrivacyFormState> {
  const { locale, token, d, t } = await load(fd);
  if (!d) return fail(t("me.errors.generic"));
  const messageLocale = str(fd, "messageLocale");
  const channel = str(fd, "channel");
  if (!(LOCALES as readonly string[]).includes(messageLocale) || !["sms", "whatsapp", "email"].includes(channel)) return fail(t("me.errors.generic"));
  const { rec, acting } = linkRecord(d);
  const r = await applyPreferences(rec, acting, {
    locale: messageLocale as Locale,
    channel: channel as "sms" | "whatsapp" | "email",
    whatsappConfirmed: str(fd, "whatsapp") === "1",
    shownIn: locale,
    headers: await headers(),
  });
  if (!r.ok) {
    return fail(
      t(
        r.reason === "whatsapp_consent_required"
          ? "me.preferences.whatsappRequired"
          : r.reason === "channel_unavailable"
            ? "me.preferences.unavailable"
            : r.reason === "guardian_required"
              ? "me.choices.guardianRequired"
              : "me.errors.generic",
      ),
    );
  }
  revalidatePath(lhref(locale, `/a/${token}/privacy`));
  return { ok: true, message: t("linkPage.saved") };
}

/** Withdraw a consent, object, or unsubscribe from a channel: only ever "off" from here. */
export async function linkWithdrawAction(_prev: PrivacyFormState, fd: FormData): Promise<PrivacyFormState> {
  const { locale, token, d, t } = await load(fd);
  if (!d) return fail(t("me.errors.generic"));
  const purpose = str(fd, "purpose") as ConsentPurpose;
  if (!WITHDRAWABLE.includes(purpose)) return fail(t("me.choices.notAllowed"));
  const { rec, acting } = linkRecord(d);
  const r = await applyConsentChoice(rec, acting, { purpose, on: false, locale, headers: await headers() });
  if (!r.ok) return fail(t("me.choices.notAllowed"));
  revalidatePath(lhref(locale, `/a/${token}/privacy`));
  const practice = d.org.name;
  const message =
    purpose === "sms_channel"
      ? t("linkPage.unsubscribe.smsDone", { practice })
      : purpose === "email_channel"
        ? t("linkPage.unsubscribe.emailDone", { practice })
        : t("linkPage.saved");
  return { ok: true, message };
}

/** The step-up: a code to the contact on file, then the privacy center's code form. */
export async function linkStepUpAction(_prev: PrivacyFormState, fd: FormData): Promise<PrivacyFormState> {
  const { locale, d, t } = await load(fd);
  if (!d) return fail(t("me.errors.generic"));
  const kind = str(fd, "kind") === "email" ? "email" : "phone";
  const { rec } = linkRecord(d);
  const r = await requestLinkStepUp({ rec, kind, locale, headers: await headers() });
  if (!r.ok) return fail(r.reason === "rate_limited" ? t("center.errors.rateLimited") : t("linkPage.full.noContact"));
  redirect(lhref(locale, `/privacy/verify?t=${r.ticket}`));
}

/** A marketplace booking made for this adult: they confirm it and give Sorriso's consent themselves. */
export async function confirmAdultAction(_prev: PrivacyFormState, fd: FormData): Promise<PrivacyFormState> {
  const { locale, token, d, t } = await load(fd);
  if (!d) return fail(t("me.errors.generic"));
  if (str(fd, "consent") !== "1") return fail(t("confirm.consentRequired"));
  const r = await confirmAdultBooking({ token, locale, headers: await headers() });
  if (!r.ok) return fail(t("confirm.notWaiting"));
  return { ok: true, message: r.status === "scheduled" ? t("confirm.confirmed") : t("confirm.requested") };
}

export async function declineAdultAction(_prev: PrivacyFormState, fd: FormData): Promise<PrivacyFormState> {
  const { token, d, t } = await load(fd);
  if (!d) return fail(t("me.errors.generic"));
  const r = await declineAdultBooking({ token, headers: await headers() });
  if (!r.ok) return fail(t("confirm.notWaiting"));
  return { ok: true, message: t("confirm.declined") };
}
