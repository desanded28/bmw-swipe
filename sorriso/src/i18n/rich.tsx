import { Fragment, type ReactNode } from "react";
import type { Namespace } from "./namespaces";
import { interpolate } from "./translator";
import type { MessageKey, TArgsParam, Translator } from "./types";

export type RichTags = Record<string, (chunk: ReactNode) => ReactNode>;

type Node = string | { tag: string; children: Node[] };

const TAG = /<(\/?)([A-Za-z][\w-]*)\s*(\/?)>/g;

/** Tokenise into a tree. Only bare <name>, </name> and <name/> are tags; anything else is text. */
function parse(text: string): Node[] {
  const root: Node[] = [];
  const stack: { tag: string; children: Node[] }[] = [];
  const top = () => (stack.length ? stack[stack.length - 1].children : root);
  let last = 0;
  for (const m of text.matchAll(TAG)) {
    const [whole, closing, name, selfClosing] = m;
    const at = m.index ?? 0;
    if (at > last) top().push(text.slice(last, at));
    last = at + whole.length;
    if (selfClosing) {
      top().push({ tag: name, children: [] });
    } else if (!closing) {
      const node = { tag: name, children: [] as Node[] };
      top().push(node);
      stack.push(node);
    } else if (stack.length && stack[stack.length - 1].tag === name) {
      stack.pop();
    } else {
      top().push(whole); // stray closing tag: keep it as text
    }
  }
  if (last < text.length) top().push(text.slice(last));
  return root;
}

/** `fill` substitutes variables in text nodes only, after parsing, so values never become tags. */
function render(nodes: Node[], tags: RichTags, prefix: string, fill: (text: string) => string): ReactNode[] {
  return nodes.map((node, i) => {
    if (typeof node === "string") return fill(node);
    const key = `${prefix}${i}`;
    const inner = render(node.children, tags, `${key}.`, fill);
    const chunk = inner.length === 0 ? null : inner.length === 1 ? inner[0] : inner;
    const fn = tags[node.tag];
    // An unknown tag (a translator's typo) renders its text without the wrapper.
    return <Fragment key={key}>{fn ? fn(chunk) : chunk}</Fragment>;
  });
}

/** Stand-ins for string values while the translator fills the template: no "<", so never a tag. */
const SLOT = /\u0000(\d+)\u0000/g;

/**
 * Render a translated string with markup placeholders, without parsing HTML:
 *
 *   rich(t("terms"), { link: (c) => <a href="/legal/terms">{c}</a> })
 *   rich(t, "thanks", { link: (c) => <a href={href}>{c}</a> }, { name: patient.firstName })
 *
 * for "I accept the <link>terms</link>." and "Thanks {name}, read our <link>terms</link>.".
 * With variables, pass the translator and the key (the variables are typed as for t()): the
 * template is parsed before they are filled in, so a name such as "Mario <link>x</link>" stays
 * text. Never call rich(t(key, vars)): that would parse the values as markup. Tags may nest; an
 * unclosed tag wraps the rest of the text.
 */
export function rich(text: string, tags: RichTags, vars?: Record<string, string | number>): ReactNode[];
export function rich<N extends Namespace, K extends MessageKey<N>>(
  t: Translator<N>,
  key: K,
  tags: RichTags,
  ...vars: TArgsParam<N, K>
): ReactNode[];
export function rich(source: unknown, a: unknown, b?: unknown, c?: unknown): ReactNode[] {
  if (typeof source === "string") {
    const vars = b as Record<string, string | number> | undefined;
    return render(parse(source), a as RichTags, "r", vars ? (s) => interpolate(s, vars) : (s) => s);
  }
  const t = source as (key: string, vars?: Record<string, unknown>) => string;
  const values: string[] = [];
  const slots: Record<string, unknown> = {};
  for (const [k, v] of Object.entries((c ?? {}) as Record<string, unknown>)) {
    // Numbers print as digits and separators, never markup; a plural's count must stay a number.
    slots[k] = typeof v === "number" ? v : `\u0000${values.push(String(v)) - 1}\u0000`;
  }
  const fill = (s: string) => s.replace(SLOT, (_, i: string) => values[Number(i)]);
  return render(parse(t(a as string, slots)), b as RichTags, "r", fill);
}
