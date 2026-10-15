"use client";

import { ErrorView } from "@/components/ErrorView";
import { lhref } from "@/i18n/href";
import { useLocale } from "@/i18n/provider";

/** A public page failed: the site header and footer stay, the text is in the page's language. */
export default function SiteError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorView reset={reset} homeHref={lhref(useLocale(), "/")} />;
}
