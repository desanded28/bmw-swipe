"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Locale } from "./config";
import type { ClientNamespace } from "./namespaces";
import { createTranslator } from "./translator";
import type { Messages, Translator } from "./types";

export type ClientMessagesMap = { [N in ClientNamespace]?: Messages[N] };

type I18nContext = { locale: Locale; messages: ClientMessagesMap };

const Ctx = createContext<I18nContext | null>(null);

/**
 * Makes dictionaries available to client components below it. Usually rendered by the server
 * component <ClientMessages>, which fills `messages` from getMessages(). A nested provider for the
 * same locale adds its namespaces to the ones from above, so a page can load only what its own
 * client components need on top of the layout's set.
 */
export function I18nProvider({
  locale,
  messages,
  children,
}: {
  locale: Locale;
  messages: ClientMessagesMap;
  children: ReactNode;
}) {
  const parent = useContext(Ctx);
  const value = useMemo<I18nContext>(
    () => ({
      locale,
      messages: parent && parent.locale === locale ? { ...parent.messages, ...messages } : messages,
    }),
    [parent, locale, messages],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function useI18n(): I18nContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useT/useLocale need an <I18nProvider> (render <ClientMessages> above this component)");
  return ctx;
}

export function useLocale(): Locale {
  return useI18n().locale;
}

/** A translator for one namespace; the namespace must have been passed to a provider above. */
export function useT<N extends ClientNamespace>(ns: N): Translator<N> {
  const { locale, messages } = useI18n();
  const dict = messages[ns] as Messages[N] | undefined;
  if (!dict && process.env.NODE_ENV !== "production") {
    throw new Error(`useT("${ns}"): namespace not loaded; add it to <ClientMessages ns={[...]}>`);
  }
  return useMemo(() => createTranslator(locale, ns, dict ?? ({} as Messages[N])), [locale, ns, dict]);
}
