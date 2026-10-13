/**
 * Translators and dictionaries for code that renders texts without a request: server
 * components and actions, and also tsx scripts and jobs (reminders, retention, seeds). Those run
 * without the react-server condition, where "server-only" throws on import, so nothing reachable
 * from here may import it; the request helpers (getRequestLocale, getStaffLocale) stay in
 * server.ts.
 *
 * Never import this from a client component: it bundles every locale's dictionary (client code
 * gets its namespaces from <ClientMessages>), and registry.ts throws when loaded in a browser.
 */
import type { Locale } from "./config";
import { isClientNamespace, type ClientNamespace, type Namespace } from "./namespaces";
import { messagesFor } from "./registry";
import { createTranslator } from "./translator";
import type { Messages, Translator } from "./types";

const translators = new Map<string, unknown>();

/** A translator for server code (pages, actions, messages, emails, scripts). Synchronous and memoised. */
export function getT<N extends Namespace>(locale: Locale, ns: N): Translator<N> {
  const id = `${locale}:${ns}`;
  let t = translators.get(id) as Translator<N> | undefined;
  if (!t) {
    t = createTranslator(locale, ns, messagesFor(locale)[ns]);
    translators.set(id, t);
  }
  return t;
}

/**
 * Namespaces for an I18nProvider, merged over English and serialisable. Server-only namespaces
 * are refused (they are excluded by the type too) so they never reach a client bundle.
 */
export function getMessages<N extends ClientNamespace>(locale: Locale, ns: readonly N[]): Pick<Messages, N> {
  const all = messagesFor(locale);
  const out = {} as Pick<Messages, N>;
  for (const n of ns) {
    if (!isClientNamespace(n)) throw new Error(`Namespace "${n}" is server-only`);
    out[n] = all[n];
  }
  return out;
}
