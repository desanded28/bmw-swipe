import type { Locale } from "./config";
import { EN_MESSAGES, LOCALE_MESSAGES } from "./messages";
import type { Namespace } from "./namespaces";
import { mergeMessages } from "./translator";
import type { Messages } from "./types";

/*
 * Not "server-only": tsx scripts load this module without the react-server condition (see
 * t.ts). A browser must still never get here, since that would mean every dictionary was bundled.
 */
if (typeof window !== "undefined") {
  throw new Error("i18n/registry loaded in a browser: client components get dictionaries from <ClientMessages>");
}

const merged = new Map<Locale, Messages>();

/**
 * A locale's complete dictionary: its own texts deep-merged over English, so a key the
 * translators have not reached yet renders in English rather than as a raw key. Built once per
 * locale per process.
 */
export function messagesFor(locale: Locale): Messages {
  let m = merged.get(locale);
  if (!m) {
    const base = EN_MESSAGES as unknown as Messages;
    m = locale === "en" ? base : mergeMessages(base, LOCALE_MESSAGES[locale]);
    merged.set(locale, m);
  }
  return m;
}

export function namespaceFor<N extends Namespace>(locale: Locale, ns: N): Messages[N] {
  return messagesFor(locale)[ns];
}
