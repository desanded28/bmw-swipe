"use client";

import { useT } from "@/i18n/provider";

/**
 * "Skip to main content": the first focusable element of every public page (WCAG 2.4.1), parked
 * above the viewport until it is focused. Targets <main id="content" tabIndex={-1}>, which every
 * public layout renders.
 */
export function SkipLink({ target = "content" }: { target?: string }) {
  const t = useT("a11y");
  return (
    <a
      href={`#${target}`}
      className="fixed left-3 top-3 z-[60] -translate-y-24 rounded-lg bg-white px-4 py-3 text-sm font-semibold text-brand-800 shadow-pop ring-2 ring-brand-600 focus:translate-y-0"
    >
      {t("skipToContent")}
    </a>
  );
}
