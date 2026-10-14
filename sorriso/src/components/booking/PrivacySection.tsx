"use client";

import { lhref } from "@/i18n/href";
import { useLocale, useT } from "@/i18n/provider";
import type { PrivacySectionProps } from "./contracts";

/**
 * STUB (WP4 builds the real section: first-layer notice, opt-ins, client-side checks).
 *
 * A plain first-layer line (booking variant) with a link to the practice's notice: no
 * acknowledgement box, which isn't needed and next to the consent boxes reads as bundled consent
 * (the server records the notice version it displayed). Marketplace bookings add Sorriso's notice
 * and its Art. 9(2)(a) consent (required, unticked); choosing WhatsApp adds its confirmation.
 * Consent labels come from the frozen `consents` namespace, verbatim: the ledger stores that key as
 * proof of what was shown.
 */
export function PrivacySection({ clinic, context, variant, preferredChannel, value, onChange, errors }: PrivacySectionProps) {
  const locale = useLocale();
  const tc = useT("consents");
  const marketplace = context === "marketplace";
  const whatsapp = preferredChannel === "whatsapp" && clinic.privacy.whatsappEnabled;
  const link = "font-semibold text-brand-700 underline";

  return (
    <div className="space-y-2">
      {variant === "booking" ? (
        <p className="px-1 text-sm text-slate-600">
          {clinic.org.name} uses your details to manage this appointment and send you reminders.
        </p>
      ) : null}
      {marketplace ? (
        <Box
          checked={value.platformConsent}
          onChange={(platformConsent) => onChange({ ...value, platformConsent })}
          error={errors.platformConsent}
        >
          {tc("platform_booking_art9.label")}
        </Box>
      ) : null}
      {whatsapp ? (
        <Box checked={value.whatsapp} onChange={(v) => onChange({ ...value, whatsapp: v })} error={errors.whatsapp}>
          {tc("whatsapp_channel.label")}
        </Box>
      ) : null}
      <p className="px-1 text-xs text-slate-500">
        <a className={link} href={lhref(locale, `/c/${clinic.org.slug}/privacy`)} target="_blank" rel="noreferrer">
          Privacy notice of {clinic.legal.controllerName}
        </a>
        {marketplace ? (
          <>
            {" · "}
            <a className={link} href={lhref(locale, "/legal/privacy")} target="_blank" rel="noreferrer">
              Sorriso privacy notice
            </a>
          </>
        ) : null}
      </p>
    </div>
  );
}

function Box({
  checked,
  onChange,
  error,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex items-start gap-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded accent-brand-700"
      />
      <span>
        {children}
        {error ? <span className="block text-xs font-medium text-red-600">{error}</span> : null}
      </span>
    </label>
  );
}
