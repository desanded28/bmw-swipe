"use client";

import { ErrorView } from "@/components/ErrorView";
import { lhref } from "@/i18n/href";
import { useLocale } from "@/i18n/provider";

/**
 * An error outside the site chrome (the embeddable widget, or the (site) layout itself): the
 * locale layout stays (html lang, skip link), with the skip link's target.
 */
export default function LocaleError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="content" tabIndex={-1} className="outline-none">
      <ErrorView reset={reset} homeHref={lhref(useLocale(), "/")} />
    </main>
  );
}
