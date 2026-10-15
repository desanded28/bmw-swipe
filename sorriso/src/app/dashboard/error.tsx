"use client";

import { ErrorView } from "@/components/ErrorView";

/** A dashboard page failed: the sidebar stays, the text is in the staff member's language. */
export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorView reset={reset} homeHref="/dashboard" />;
}
