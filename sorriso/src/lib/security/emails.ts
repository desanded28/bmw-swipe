import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { memberships, organizations, users, type Organization, type User } from "@/db/schema";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/i18n/config";
import { fmtDay, fmtWhen, zonedDate } from "@/i18n/datefmt";
import { getT } from "@/i18n/t";
import type { SourceMessages, Vars } from "@/i18n/types";
import { DEFAULT_TIMEZONE } from "../config";
import { logError } from "../log";
import { deliver } from "../messaging";
import { DEFAULT_BRAND_COLOR, renderEmailLayout } from "../messaging/layout";

/**
 * Emails to staff about their own account (src/i18n/messages/en/authEmails.ts). Sent through
 * deliver() with orgId null, so they never appear in a practice's patient message log, and with a
 * redacted log body: reset, confirmation and invitation links are secrets and must not sit in the
 * database in clear. Delivery failures never throw (deliver() logs them).
 */

type Texts = SourceMessages["authEmails"];
export type AuthEmailKind = {
  [K in keyof Texts]: Texts[K] extends { subject: string; body: string } ? K : never;
}[keyof Texts];
type KindVars<K extends AuthEmailKind> = [Vars<Texts[K][keyof Texts[K]]>] extends [never]
  ? Record<string, never>
  : { [V in Vars<Texts[K][keyof Texts[K]]>]: string | number };

type LooseT = { (key: string, vars?: Record<string, string | number>): string; has(key: string): boolean };

/** The language for emails to a staff member: their own choice, then the practice's default. */
export function staffEmailLocale(user: Pick<User, "locale">, org?: Pick<Organization, "defaultLocale"> | null): Locale {
  if (isLocale(user.locale)) return user.locale;
  if (org && isLocale(org.defaultLocale)) return org.defaultLocale;
  return DEFAULT_LOCALE;
}

/** "Tuesday 13 October at 08:30" in the practice's (or Rome's) time zone. */
export function emailWhen(at: Date, locale: Locale, tz: string = DEFAULT_TIMEZONE): string {
  return fmtWhen(at, tz, locale);
}

/** "Tuesday 13 October 2026" (dates far ahead need the year). */
export function emailDate(at: Date, locale: Locale, tz: string = DEFAULT_TIMEZONE): string {
  return fmtDay(zonedDate(at, tz), "long", locale);
}

export async function sendAuthEmail<K extends AuthEmailKind>(i: {
  to: string;
  name?: string | null;
  locale: Locale;
  kind: K;
  vars: KindVars<K>;
  /** Absolute URL for the button. */
  url?: string;
}): Promise<void> {
  try {
    const t = getT(i.locale, "authEmails") as unknown as LooseT;
    const vars = i.vars as Record<string, string | number>;
    const button = i.url && t.has(`${i.kind}.cta`) ? [{ label: t(`${i.kind}.cta`, vars), url: i.url }] : [];
    const { html, text } = renderEmailLayout({
      locale: i.locale,
      brandColor: DEFAULT_BRAND_COLOR,
      greeting: i.name ? t("greeting", { name: i.name }) : undefined,
      intro: t(`${i.kind}.body`, vars),
      buttons: button,
      footerLines: [t("footer.why"), t("footer.notYou")],
    });
    await deliver({
      orgId: null,
      channel: "email",
      to: i.to,
      subject: t(`${i.kind}.subject`, vars),
      text,
      html,
      // Links in these emails are credentials (reset, confirm, invite): never stored in clear.
      logBody: `[account email: ${String(i.kind)}]`,
    });
  } catch (err) {
    logError("auth-email", err, { kind: String(i.kind) });
  }
}

/** Owners of a practice, with what we need to email them. */
export async function practiceOwners(orgId: string) {
  return db
    .select({ id: users.id, email: users.email, name: users.name, locale: users.locale })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(and(eq(memberships.orgId, orgId), eq(memberships.role, "owner")));
}

export async function orgById(orgId: string): Promise<Organization | null> {
  const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
  return org ?? null;
}
