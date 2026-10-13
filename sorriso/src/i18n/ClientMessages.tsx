import "server-only";
import type { ReactNode } from "react";
import type { Locale } from "./config";
import type { ClientNamespace } from "./namespaces";
import { I18nProvider } from "./provider";
import { getMessages } from "./server";

/**
 * Server component: ships the listed namespaces (merged over English) to the client components
 * below it. List only what those components use; every namespace adds to the page payload.
 *
 *   <ClientMessages locale={locale} ns={["common", "booking"]}>…</ClientMessages>
 */
export async function ClientMessages({
  locale,
  ns,
  children,
}: {
  locale: Locale;
  ns: readonly ClientNamespace[];
  children: ReactNode;
}) {
  return (
    <I18nProvider locale={locale} messages={getMessages(locale, ns)}>
      {children}
    </I18nProvider>
  );
}

export default ClientMessages;
