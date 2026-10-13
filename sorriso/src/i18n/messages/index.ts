/**
 * Every locale's dictionaries as written, before merging over English. For registry.ts, the
 * dictionary tests and scripts/i18n-report.ts. Never import this from a client component: it
 * pulls in all 8 x 28 files (client code gets its namespaces from <ClientMessages>).
 */
import type { Locale } from "../config";
import type { PartialMessages, SourceMessages } from "../types";
import de from "./de";
import en from "./en";
import es from "./es";
import fr from "./fr";
import it from "./it";
import pl from "./pl";
import pt from "./pt";
import ro from "./ro";

export const EN_MESSAGES: SourceMessages = en;

export const LOCALE_MESSAGES: Record<Locale, PartialMessages> = { it, en, de, fr, es, pt, ro, pl };
