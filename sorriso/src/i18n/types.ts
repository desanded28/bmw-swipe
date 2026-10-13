/**
 * Dictionary types. English (messages/en, `as const`) is the type source: keys, placeholder names
 * and plural leaves are all derived from its literal types, so a typo in a key or a missing
 * {placeholder} argument fails to compile instead of rendering "{clinic}" to a patient.
 */
import type { Locale } from "./config";
import type en from "./messages/en";
import type { Namespace } from "./namespaces";

export type PluralCategory = "zero" | "one" | "two" | "few" | "many" | "other";

/** A leaf with one text per CLDR plural category, picked by vars.count. Build it with p(). */
export type Plural = {
  readonly __plural: true;
  zero?: string;
  one?: string;
  two?: string;
  few?: string;
  many?: string;
  other: string;
};
export type PluralForms = Omit<Plural, "__plural">;

/** Literal types to their shape: strings to string, plural leaves to Plural. */
export type Widen<T> = T extends Plural
  ? Plural
  : T extends string
    ? string
    : T extends object
      ? { -readonly [K in keyof T]: Widen<T[K]> }
      : T;

/** Every key optional at every depth; a plural leaf stays whole (a translation brings all its forms). */
export type DeepPartial<T> = T extends Plural
  ? Plural
  : T extends string
    ? string
    : T extends object
      ? { [K in keyof T]?: DeepPartial<T[K]> }
      : T;

/** Dotted paths to the leaves (strings and plurals) of a dictionary tree. */
export type Path<T> = T extends string | Plural
  ? never
  : { [K in keyof T & string]: T[K] extends string | Plural ? K : `${K}.${Path<T[K]>}` }[keyof T & string];

/** The value at a dotted path. */
export type At<T, P extends string> = P extends `${infer H}.${infer R}`
  ? H extends keyof T
    ? At<T[H], R>
    : never
  : P extends keyof T
    ? T[P]
    : never;

type VarsOf<S> = S extends `${string}{${infer V}}${infer Rest}` ? V | VarsOf<Rest> : never;

/**
 * The literal texts of a p() leaf. Categories the leaf does not declare come from Plural as plain
 * `string`, which would swallow the literals in a union, so they are skipped.
 */
type FormTexts<L> = {
  [K in PluralCategory]: K extends keyof L ? (string extends L[K] ? never : Extract<L[K], string>) : never;
}[PluralCategory];

/** Placeholder names in an English leaf; for a plural, the union over all of its forms. */
export type Vars<L> = L extends Plural ? VarsOf<FormTexts<L>> : L extends string ? VarsOf<L> : never;

type Simplify<T> = { [K in keyof T]: T[K] };

/**
 * The argument of a key without placeholders: any variable is a compile error, so code that
 * passes { name } to a text that lost its {name} is caught instead of dropping the name.
 */
export type NoVars = { [name: string]: never };

type ArgsFor<L> = [L] extends [Plural]
  ? Simplify<{ count: number } & { [V in Exclude<Vars<L>, "count">]: string | number }>
  : [Vars<L>] extends [never]
    ? NoVars
    : Simplify<{ [V in Vars<L>]: string | number }>;

/**
 * Dotted paths of leaves typed plain `string`: an English file that lost its `as const`. Such a
 * leaf has no placeholders as far as the types know (Vars<string> is never), so t() would
 * compile without its arguments; messages/en/index.ts asserts this is never.
 */
export type WideLeaves<T, P extends string = ""> = T extends Plural
  ? never
  : T extends string
    ? string extends T
      ? P
      : never
    : T extends object
      ? { [K in keyof T & string]: WideLeaves<T[K], P extends "" ? K : `${P}.${K}`> }[keyof T & string]
      : never;

export type SourceMessages = typeof en;
export type Messages = { [N in Namespace]: Widen<SourceMessages[N]> };
/** A locale's own files: anything may be missing (English fills the gaps at runtime). */
export type PartialMessages = { [N in Namespace]: DeepPartial<Messages[N]> };

export type MessageKey<N extends Namespace> = Path<SourceMessages[N]>;

/** Arguments for a key: its placeholders as string | number, plus count: number for a plural; NoVars without placeholders. */
export type TArgs<N extends Namespace, K extends MessageKey<N>> = ArgsFor<At<SourceMessages[N], K>>;

/** `vars` is required exactly when the key has placeholders (or is a plural), and refused otherwise. */
export type TArgsParam<N extends Namespace, K extends MessageKey<N>> =
  TArgs<N, K> extends NoVars ? [vars?: NoVars] : [vars: TArgs<N, K>];

export type Translator<N extends Namespace> = {
  <K extends MessageKey<N>>(key: K, ...vars: TArgsParam<N, K>): string;
  /** Narrows a computed key (an API error code, a status from the DB) before calling t(). */
  has(key: string): key is MessageKey<N>;
  readonly locale: Locale;
  readonly ns: N;
};
