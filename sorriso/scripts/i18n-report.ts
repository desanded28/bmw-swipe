/**
 * Translation status report.
 *
 *   npm run i18n:report                                   # coverage and untranslated values per locale
 *   npm run i18n:report -- --locale pl --verbose          # list every missing key for one locale
 *   npm run i18n:report -- --literals src/components/booking src/app/[locale]/(site)/page.tsx
 *
 * Sections:
 *   - missing keys: English keys a locale does not define yet (they render in English);
 *   - same as English: values copied verbatim, ignoring an allowlist of brand names and acronyms;
 *   - --literals <files or folders>: hard-coded user-visible text in .tsx files (JSX text and the
 *     placeholder/title/alt/aria-* attributes). Exits with status 1 if any are found.
 * `--allow <word>` (repeatable) extends the allowlist for both checks.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { LOCALES, type Locale } from "../src/i18n/config";
import { EN_MESSAGES, LOCALE_MESSAGES } from "../src/i18n/messages";
import { NAMESPACES } from "../src/i18n/namespaces";
import { isPlural } from "../src/i18n/plural";

const ALLOW = new Set(["sorriso", "ok", "sms", "whatsapp", "email", "e-mail", "api", "fhir", "ics", "pdf", "csv", "json", "zip", "gdpr", "dpo", "faq"]);

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
function values(name: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] !== name) continue;
    for (let j = i + 1; j < args.length && !args[j].startsWith("--"); j++) out.push(args[j]);
  }
  return out;
}
for (const w of values("--allow")) ALLOW.add(w.toLowerCase());

type Leaf = string | Record<string, unknown>;

function leaves(tree: unknown, prefix = "", out = new Map<string, Leaf>()): Map<string, Leaf> {
  if (typeof tree !== "object" || tree === null) return out;
  for (const [k, v] of Object.entries(tree)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string" || isPlural(v)) out.set(key, v as Leaf);
    else leaves(v, key, out);
  }
  return out;
}

/** True when nothing but placeholders, tags, punctuation, digits and allowlisted words remain. */
function onlyAllowed(text: string): boolean {
  const words = text
    .replace(/\{\w+\}/g, " ")
    .replace(/<\/?[A-Za-z][\w-]*\s*\/?>/g, " ")
    .split(/[^\p{L}-]+/u)
    .map((w) => w.toLowerCase())
    .filter((w) => /\p{L}/u.test(w));
  return words.every((w) => ALLOW.has(w));
}

const texts = (leaf: Leaf) => (typeof leaf === "string" ? [leaf] : Object.entries(leaf).filter(([k]) => k !== "__plural").map(([, v]) => String(v)));

function messagesReport(): void {
  const only = values("--locale").filter((l): l is Locale => (LOCALES as readonly string[]).includes(l));
  const locales = (only.length ? only : LOCALES.filter((l) => l !== "en")) as Locale[];
  const en = Object.fromEntries(NAMESPACES.map((ns) => [ns, leaves(EN_MESSAGES[ns])]));
  const total = NAMESPACES.reduce((n, ns) => n + en[ns].size, 0);

  console.log(`English keys: ${total} in ${NAMESPACES.length} namespaces\n`);
  for (const l of locales) {
    const missing: string[] = [];
    const same: string[] = [];
    const perNs: string[] = [];
    for (const ns of NAMESPACES) {
      const own = leaves(LOCALE_MESSAGES[l][ns]);
      let nsMissing = 0;
      for (const [key, enLeaf] of en[ns]) {
        const leaf = own.get(key);
        if (leaf === undefined) {
          nsMissing++;
          missing.push(`${ns}.${key}`);
        } else if (JSON.stringify(leaf) === JSON.stringify(enLeaf) && !texts(leaf).every(onlyAllowed)) {
          same.push(`${ns}.${key}: ${JSON.stringify(texts(leaf)[0])}`);
        }
      }
      if (nsMissing) perNs.push(`${ns} ${nsMissing}/${en[ns].size}`);
    }
    const pct = total ? Math.floor((100 * (total - missing.length)) / total) : 100;
    console.log(`${l}: ${total - missing.length}/${total} (${pct}%), ${missing.length} missing, ${same.length} same as English`);
    if (perNs.length) console.log(`  missing by namespace: ${perNs.join(", ")}`);
    if (flag("--verbose")) for (const k of missing) console.log(`  - ${k}`);
    for (const s of same) console.log(`  = ${s}`);
  }
}

// ---------- --literals ----------

const TEXT_ATTRIBUTES = new Set(["placeholder", "title", "alt", "label", "aria-label", "aria-description", "aria-placeholder", "aria-roledescription", "aria-valuetext"]);

function tsxFiles(target: string): string[] {
  const st = statSync(target);
  if (st.isFile()) return target.endsWith(".tsx") ? [target] : [];
  return readdirSync(target).flatMap((name) => (name === "node_modules" || name.startsWith(".") ? [] : tsxFiles(path.join(target, name))));
}

function literalsIn(file: string): string[] {
  const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: string[] = [];
  const report = (node: ts.Node, text: string) => {
    const { line, character } = source.getLineAndCharacterOfPosition(node.getStart(source));
    found.push(`${file}:${line + 1}:${character + 1}  ${JSON.stringify(text.trim().replace(/\s+/g, " "))}`);
  };
  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node)) {
      if (/\p{L}/u.test(node.text) && !onlyAllowed(node.text)) report(node, node.text);
    } else if (ts.isJsxAttribute(node) && node.initializer) {
      const name = node.name.getText(source);
      const init = node.initializer;
      const text = ts.isStringLiteral(init)
        ? init.text
        : ts.isJsxExpression(init) && init.expression && ts.isStringLiteralLike(init.expression)
          ? init.expression.text
          : null;
      if (TEXT_ATTRIBUTES.has(name) && text && /\p{L}/u.test(text) && !onlyAllowed(text)) report(node, `${name}=${text}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

function literalsReport(targets: string[]): number {
  const files = targets.flatMap(tsxFiles);
  const found = files.flatMap(literalsIn);
  console.log(`\nJSX text literals in ${files.length} file(s): ${found.length}`);
  for (const f of found) console.log(`  ${f}`);
  return found.length;
}

messagesReport();
const targets = values("--literals");
if (flag("--literals")) {
  if (!targets.length) {
    console.error("--literals needs at least one file or folder");
    process.exit(2);
  }
  if (literalsReport(targets) > 0) process.exit(1);
}
