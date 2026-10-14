"use client";

import { LifeBuoy } from "lucide-react";
import { rich } from "@/i18n/rich";
import { useT } from "@/i18n/provider";
import { cx } from "./ui";

/**
 * How to reach the practice for help, shown in the same place and the same words in the booking
 * sidebar and on the manage page (WCAG 3.2.6 Consistent Help).
 */
export function ClinicHelp({
  clinicName,
  phone,
  email,
  className,
}: {
  clinicName: string;
  phone: string | null | undefined;
  email?: string | null;
  className?: string;
}) {
  const t = useT("booking");
  const link = "font-semibold text-brand-700 underline underline-offset-2";
  return (
    <div className={cx("flex gap-2.5 text-sm text-slate-600", className)}>
      <LifeBuoy size={16} className="mt-0.5 shrink-0 text-brand-700" aria-hidden />
      <p>
        <span className="block font-semibold text-slate-800">{t("help.title")}</span>
        {phone
          ? rich(
              t,
              "help.call",
              { tel: (c) => <a className={link} href={`tel:${phone.replace(/[^\d+]/g, "")}`}>{c}</a> },
              { clinic: clinicName, phone },
            )
          : email
            ? rich(t, "help.email", { mail: (c) => <a className={link} href={`mailto:${email}`}>{c}</a> }, { clinic: clinicName, email })
            : t("help.contact", { clinic: clinicName })}
      </p>
    </div>
  );
}
