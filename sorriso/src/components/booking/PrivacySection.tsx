"use client";

import { ExternalLink, Info, ShieldCheck } from "lucide-react";
import { useId, type ReactNode } from "react";
import type { ConsentPurpose } from "@/db/enums";
import { lhref } from "@/i18n/href";
import { useLocale, useT } from "@/i18n/provider";
import { rich } from "@/i18n/rich";
import { OTHER_ADULT_ON_MARKETPLACE } from "@/lib/privacy/minors";
import { cx } from "../ui";
import type { BookingPrivacyState, PrivacySectionProps } from "./contracts";

/**
 * The privacy part of the booking and waitlist forms (WP4).
 *
 * - A first layer of a few lines: who the controller is, why and on what basis, the rights and
 *   where to exercise them, with links to the practice's full notice (and its version for young
 *   people) and, for marketplace bookings, Sorriso's notice. No acknowledgement box: it isn't
 *   needed and next to consent boxes it reads as bundling; the server records the notice version
 *   it displayed.
 * - Marketplace bookings only: Sorriso's Art. 9(2)(a) consent, required and unticked.
 * - WhatsApp chosen: the just-in-time notice (Meta, Twilio, US transfer under DPF + SCC) and an
 *   unticked confirmation, required.
 * - Optional and unticked (booking only): the feedback invitation and, where the practice runs
 *   it, news and offers.
 * - Booking for another adult: no consent box at all. Consent can only come from the patient, so
 *   the section says they make their own choices later; that WhatsApp can't be chosen for them
 *   (it needs their consent: SMS or email instead); and, on the marketplace, that only they
 *   can agree to Sorriso's processing (OTHER_ADULT_ON_MARKETPLACE: refused, or held for them).
 *   Errors the form raises for a box that isn't shown are attached to these lines.
 *
 * Every consent label and description comes verbatim from the frozen `consents` namespace: the
 * ledger stores that key as proof of what was shown. Required boxes carry aria-required and, with
 * an error, aria-invalid, so the form's focusFirstInvalid() lands on them.
 */
export function PrivacySection({ clinic, context, variant, preferredChannel, relation, value, onChange, errors }: PrivacySectionProps) {
  const t = useT("privacy");
  const locale = useLocale();
  const id = useId();
  const marketplace = context === "marketplace";
  const forOther = relation.bookedFor === "other_adult";
  const whatsapp = preferredChannel === "whatsapp" && clinic.privacy.whatsappEnabled;
  const controller = clinic.legal.controllerName;
  const set = (patch: Partial<BookingPrivacyState>) => onChange({ ...value, ...patch });
  const external = (href: string, label: string) => (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      className="inline-flex items-center gap-1 font-semibold text-brand-700 underline underline-offset-2 hover:text-brand-800"
    >
      {label}
      <ExternalLink size={12} aria-hidden />
      <span className="sr-only">{t("booking.links.newTab")}</span>
    </a>
  );

  return (
    <section aria-labelledby={`${id}heading`} className="space-y-3 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200/70">
      <h3 id={`${id}heading`} className="flex items-center gap-2 text-sm font-semibold text-slate-800">
        <ShieldCheck size={16} className="text-brand-700" aria-hidden /> {t("booking.heading")}
      </h3>

      <div className="space-y-1.5 text-[13px] leading-relaxed text-slate-600">
        <p>
          {variant === "booking" ? t("booking.firstLayer.practice", { controller }) : t("booking.firstLayer.practiceWaitlist", { controller })}{" "}
          {marketplace ? t("booking.firstLayer.marketplace") : null}
        </p>
        <p>{t("booking.firstLayer.basis")}</p>
        <p>
          {rich(t("booking.firstLayer.rights"), {
            link: (c) => (
              <a href={lhref(locale, "/privacy")} target="_blank" rel="noopener" className="font-semibold text-brand-700 underline underline-offset-2">
                {c}
              </a>
            ),
          })}
        </p>
        {relation.bookedFor === "other_adult" ? <p className="font-medium text-slate-700">{t("booking.firstLayer.otherAdult")}</p> : null}
        {relation.bookedFor === "minor" ? <p className="font-medium text-slate-700">{t("booking.firstLayer.guardian")}</p> : null}
        <p className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
          {external(lhref(locale, `/c/${clinic.org.slug}/privacy`), t("booking.links.practice", { controller }))}
          {external(lhref(locale, `/c/${clinic.org.slug}/privacy/minors`), t("booking.links.minors"))}
          {marketplace ? external(lhref(locale, "/legal/privacy"), t("booking.links.platform")) : null}
        </p>
      </div>

      {forOther ? (
        <OtherAdultNotes
          marketplace={marketplace}
          whatsapp={whatsapp}
          variant={variant}
          errors={{ platform: errors.platformConsent, whatsapp: errors.whatsapp }}
        />
      ) : null}

      {marketplace && !forOther ? (
        <ConsentBox
          purpose="platform_booking_art9"
          heading={t("booking.platformHeading")}
          required
          checked={value.platformConsent}
          onChange={(platformConsent) => set({ platformConsent })}
          error={errors.platformConsent}
        />
      ) : null}

      {whatsapp && !forOther ? (
        <ConsentBox
          purpose="whatsapp_channel"
          heading={t("booking.whatsappHeading")}
          required
          noticeFirst
          checked={value.whatsapp}
          onChange={(v) => set({ whatsapp: v })}
          error={errors.whatsapp}
        />
      ) : null}

      {variant === "booking" && !forOther ? (
        <fieldset className="space-y-2" aria-describedby={`${id}optional`}>
          <legend className="text-[13px] font-semibold text-slate-700">{t("booking.optionalHeading")}</legend>
          <p id={`${id}optional`} className="text-xs text-slate-500">
            {t("booking.optionalHint")}
          </p>
          <ConsentBox purpose="feedback_request" checked={value.feedback} onChange={(feedback) => set({ feedback })} error={errors.feedback} />
          {clinic.privacy.marketingEnabled ? (
            <ConsentBox
              purpose="marketing"
              vars={{ practice: clinic.org.name }}
              checked={value.marketing}
              onChange={(marketing) => set({ marketing })}
              error={errors.marketing}
            />
          ) : null}
        </fieldset>
      ) : null}
    </section>
  );
}

/**
 * What replaces the consent boxes when booking for another adult. A line the form flagged (it
 * still asks for a box that isn't shown) is marked as an error, so the booker sees why.
 */
function OtherAdultNotes({
  marketplace,
  whatsapp,
  variant,
  errors,
}: {
  marketplace: boolean;
  whatsapp: boolean;
  variant: PrivacySectionProps["variant"];
  errors: { platform?: string; whatsapp?: string };
}) {
  const t = useT("privacy");
  const line = (text: string, error: string | undefined) => (
    <p
      role={error ? "alert" : undefined}
      className={cx("flex items-start gap-2 rounded-xl p-3 text-[13px] leading-relaxed ring-1", error ? "bg-red-50 text-red-800 ring-red-200" : "bg-white text-slate-700 ring-slate-200")}
    >
      <Info size={16} className="mt-0.5 shrink-0" aria-hidden />
      <span>{text}</span>
    </p>
  );
  return (
    <div className="space-y-2">
      {marketplace ? line(OTHER_ADULT_ON_MARKETPLACE === "held" ? t("booking.otherAdult.marketplaceHeld") : t("booking.otherAdult.marketplaceRefused"), errors.platform) : null}
      {whatsapp ? line(t("booking.otherAdult.whatsapp"), errors.whatsapp) : null}
      {variant === "booking" ? line(t("booking.otherAdult.choices"), undefined) : null}
    </div>
  );
}

type BoxPurpose = Extract<ConsentPurpose, "platform_booking_art9" | "whatsapp_channel" | "feedback_request" | "marketing">;

/** One unticked checkbox with the exact consent text, its explanation and its error. */
function ConsentBox({
  purpose,
  heading,
  vars,
  required = false,
  noticeFirst = false,
  checked,
  onChange,
  error,
}: {
  purpose: BoxPurpose;
  heading?: string;
  vars?: { practice: string };
  required?: boolean;
  /** Show the explanation before the box, open: the just-in-time notice for WhatsApp. */
  noticeFirst?: boolean;
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string;
}) {
  const t = useT("privacy");
  const tc = useT("consents");
  const id = useId();
  const label = purpose === "marketing" ? tc("marketing.label", { practice: vars?.practice ?? "" }) : tc(`${purpose}.label`);
  const description = tc(`${purpose}.description`);
  const describedBy = [error ? `${id}error` : null, noticeFirst ? `${id}notice` : null].filter(Boolean).join(" ") || undefined;
  const explanation: ReactNode = noticeFirst ? (
    <p id={`${id}notice`} className="rounded-lg bg-white p-3 text-xs leading-relaxed text-slate-600 ring-1 ring-slate-200">
      {description}
    </p>
  ) : (
    <details className="group text-xs text-slate-600">
      <summary className="cursor-pointer font-semibold text-brand-700 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">
        {t("booking.whatThisMeans")}
      </summary>
      <p className="mt-1 leading-relaxed">{description}</p>
    </details>
  );

  return (
    <div className="space-y-1.5">
      {heading ? <p className="text-[13px] font-semibold text-slate-700">{heading}</p> : null}
      {noticeFirst ? explanation : null}
      <label
        htmlFor={`${id}box`}
        className={cx(
          "flex cursor-pointer items-start gap-3 rounded-xl bg-white p-3 text-sm text-slate-700 ring-1 transition",
          "has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-brand-600",
          error ? "ring-red-300" : checked ? "ring-brand-300" : "ring-slate-200 hover:ring-slate-300",
        )}
      >
        <input
          id={`${id}box`}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-required={required || undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className="mt-0.5 h-5 w-5 shrink-0 rounded accent-brand-700"
        />
        <span className="leading-relaxed">
          {label}
          {required ? (
            <span className="ml-2 inline-block rounded-full bg-slate-100 px-2 py-0.5 align-middle text-[11px] font-semibold text-slate-600">
              {t("booking.required")}
            </span>
          ) : null}
        </span>
      </label>
      {error ? (
        <p id={`${id}error`} className="px-1 text-xs font-medium text-red-600">
          {error}
        </p>
      ) : null}
      {noticeFirst ? null : <div className="px-1">{explanation}</div>}
    </div>
  );
}
