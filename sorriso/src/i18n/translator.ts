/**
 * The translator: pure and isomorphic (server components, client components, scripts, tests).
 * It never imports a dictionary itself, so a client bundle carries only the namespaces its
 * provider was given.
 */
import type { Locale } from "./config";
import type { Namespace } from "./namespaces";
import { formatDecimal } from "./number";
import { isPlural, plural } from "./plural";
import type { Messages, Translator } from "./types";

type Tree = { [key: string]: unknown };

const PLACEHOLDER = /\{(\w+)\}/g;

/** Replace {name} with vars.name. Unknown placeholders stay visible so tests and reviewers catch them. */
export function interpolate(text: string, vars?: Record<string, unknown>): string {
  if (!vars) return text;
  return text.replace(PLACEHOLDER, (whole, name: string) => {
    const v = vars[name];
    return typeof v === "string" || typeof v === "number" ? String(v) : whole;
  });
}

function lookup(tree: unknown, key: string): unknown {
  let node = tree;
  for (const part of key.split(".")) {
    if (typeof node !== "object" || node === null || isPlural(node)) return undefined;
    node = (node as Tree)[part];
  }
  return node;
}

function isLeaf(v: unknown): boolean {
  return typeof v === "string" || isPlural(v);
}

const warned = new Set<string>();

function warnMissing(locale: Locale, ns: string, key: string) {
  if (process.env.NODE_ENV !== "development") return;
  const id = `${locale}:${ns}.${key}`;
  if (warned.has(id)) return;
  warned.add(id);
  // Isomorphic module (also runs in the browser), so it cannot use the server logger. The
  // message carries only the key, never message text or variables.
  // eslint-disable-next-line no-console
  console.warn(`[i18n] missing key ${ns}.${key} (${locale})`);
}

/**
 * Build a translator over one namespace. `messages` should already be merged over English
 * (getT/getMessages do that); a key missing even there renders as the key itself.
 */
export function createTranslator<N extends Namespace>(locale: Locale, ns: N, messages: Messages[N]): Translator<N> {
  const t = (key: string, vars?: Record<string, unknown>): string => {
    const leaf = lookup(messages, key);
    if (typeof leaf === "string") return interpolate(leaf, vars);
    if (isPlural(leaf)) {
      // The number picks the form; the text shows it with local separators ("1,5 dnia",
      // "1.500 Tage"). count must be a number (typed so), so callers can't pre-format it.
      const count = typeof vars?.count === "number" ? vars.count : Number.NaN;
      const shown = Number.isFinite(count) ? { ...vars, count: formatDecimal(count, locale) } : vars;
      return interpolate(plural(locale, count, leaf), shown);
    }
    warnMissing(locale, ns, key);
    return key;
  };
  return Object.assign(t, {
    has: (key: string) => isLeaf(lookup(messages, key)),
    locale,
    ns,
  }) as unknown as Translator<N>;
}

/**
 * Deep-merge a locale's partial tree over the English one. Strings and plural leaves replace
 * the English value whole: mixing English and Polish plural forms would be worse than falling
 * back to the Polish "other" form. Empty strings count as missing.
 */
export function mergeMessages<T>(base: T, override: unknown): T {
  if (override === undefined || override === null) return base;
  if (isLeaf(base)) {
    if (typeof override === "string") return (override === "" ? base : override) as T;
    return (isPlural(override) ? override : base) as T;
  }
  if (typeof base !== "object" || base === null || typeof override !== "object" || isPlural(override)) return base;
  const out: Tree = { ...(base as Tree) };
  for (const [k, v] of Object.entries(override as Tree)) {
    if (k in out) out[k] = mergeMessages(out[k], v);
  }
  return out as T;
}
