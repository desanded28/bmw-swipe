"use client";

import { Baby, ClipboardCheck, ClipboardX, TriangleAlert } from "lucide-react";
import { useT } from "@/i18n/provider";
import { Badge, cx } from "../../ui";
import type { CalendarEventBadgesProps } from "./contracts";

/**
 * Small badges on calendar events and appointment rows: no-show risk (medium and high only), minor
 * (parental consent required), anamnesis missing or received, and the medical alert — which only
 * a viewer with patient.clinical.read ever gets (redFlag is null otherwise, see loadCareFlags).
 * Compact: icons only, each with its text for screen readers and as a tooltip.
 */
export function CalendarEventBadges({ appt, compact }: CalendarEventBadgesProps) {
  const t = useT("care");
  const risky = appt.riskLevel === "medium" || appt.riskLevel === "high";
  const upcoming = appt.status === "scheduled" || appt.status === "requested";
  const items: { key: string; label: string; icon: React.ReactNode; tone: "red" | "amber" | "green" | "violet" }[] = [];
  if (appt.redFlag) items.push({ key: "flag", label: t("badges.redFlag"), icon: <TriangleAlert size={12} aria-hidden />, tone: "red" });
  if (risky && upcoming) {
    items.push({
      key: "risk",
      label: t(`risk.levelLabel.${appt.riskLevel!}`),
      icon: (
        <span
          aria-hidden
          className={cx("inline-block h-2 w-2 rounded-full", appt.riskLevel === "high" ? "bg-red-600" : "bg-amber-500")}
        />
      ),
      tone: appt.riskLevel === "high" ? "red" : "amber",
    });
  }
  if (appt.minorFlag) items.push({ key: "minor", label: t("badges.parentalConsent"), icon: <Baby size={12} aria-hidden />, tone: "violet" });
  if (appt.anamnesis === "missing" && upcoming) {
    items.push({ key: "form", label: t("badges.anamnesisMissing"), icon: <ClipboardX size={12} aria-hidden />, tone: "amber" });
  } else if (appt.anamnesis === "complete") {
    items.push({ key: "form", label: t("badges.anamnesisComplete"), icon: <ClipboardCheck size={12} aria-hidden />, tone: "green" });
  }
  if (!items.length) return null;

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1" data-care-badges>
        {items.map((i) => (
          <span
            key={i.key}
            title={i.label}
            data-badge={i.key}
            className={cx(
              "inline-flex h-4 w-4 items-center justify-center rounded-full",
              i.tone === "red" && "bg-red-100 text-red-700",
              i.tone === "amber" && "bg-amber-100 text-amber-800",
              i.tone === "green" && "bg-emerald-100 text-emerald-700",
              i.tone === "violet" && "bg-violet-100 text-violet-700",
            )}
          >
            {i.icon}
            <span className="sr-only">{i.label}</span>
          </span>
        ))}
      </span>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-1" data-care-badges>
      {items.map((i) => (
        <Badge key={i.key} tone={i.tone} data-badge={i.key}>
          {i.icon} {i.label}
        </Badge>
      ))}
    </span>
  );
}
