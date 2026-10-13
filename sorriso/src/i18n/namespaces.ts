/**
 * Dictionary namespaces. Each one is a file per locale under messages/<locale>/<ns>.ts and is
 * owned by exactly one package (see docs/i18n.md). Pure: safe in client components.
 */
export const NAMESPACES = [
  "common",
  "consents",
  "site",
  "a11y",
  "booking",
  "manage",
  "errors",
  "accessibility",
  "dashboard",
  "calendar",
  "analytics",
  "patientMessages",
  "reminders",
  "privacy",
  "legalPatient",
  "privacyMessages",
  "privacyAdmin",
  "legalPractice",
  "privacyAdminEmails",
  "auth",
  "security",
  "authEmails",
  "marketplace",
  "reviews",
  "catalog",
  "reviewEmails",
  "care",
  "careMessages",
] as const;
export type Namespace = (typeof NAMESPACES)[number];

/**
 * Message and email texts rendered only on the server. They are never shipped to the browser,
 * so getMessages() and useT() refuse them at the type level.
 */
export const SERVER_ONLY_NAMESPACES = [
  "patientMessages",
  "privacyMessages",
  "privacyAdminEmails",
  "authEmails",
  "reviewEmails",
  "careMessages",
] as const satisfies readonly Namespace[];
export type ServerOnlyNamespace = (typeof SERVER_ONLY_NAMESPACES)[number];
export type ClientNamespace = Exclude<Namespace, ServerOnlyNamespace>;

export const CLIENT_NAMESPACES = NAMESPACES.filter(
  (ns): ns is ClientNamespace => !(SERVER_ONLY_NAMESPACES as readonly string[]).includes(ns),
);

export function isNamespace(v: unknown): v is Namespace {
  return typeof v === "string" && (NAMESPACES as readonly string[]).includes(v);
}

export function isClientNamespace(v: unknown): v is ClientNamespace {
  return isNamespace(v) && !(SERVER_ONLY_NAMESPACES as readonly string[]).includes(v);
}
