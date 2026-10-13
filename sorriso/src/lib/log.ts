/**
 * The only place that writes logs (eslint no-console exempts this file).
 *
 * Logs end up with the hosting provider, outside the practice's records, so they must never
 * carry personal data. Callers pass ids and counts as `meta`; everything written — messages,
 * error text, stack frames and causes — goes through redact() first. That masks phone numbers
 * and emails that slip through (provider errors often quote the recipient) and drops the bound
 * values drizzle appends to failed queries (patient names, notes, message bodies…).
 */

export type LogMeta = Record<string, string | number | boolean | null>;

const DOTS = "•••";

/** "+393331234567" -> "+39•••4567". Anything too short to be a phone number is fully masked. */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return DOTS;
  return `+${digits.slice(0, 2)}${DOTS}${digits.slice(-4)}`;
}

/** "mario.rossi@dominio.it" -> "m•••@d•••". */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at <= 0 || at === email.length - 1) return DOTS;
  return `${email[0]}${DOTS}@${email[at + 1]}${DOTS}`;
}

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
// E.164 as stored ("+393331234567", also inside "whatsapp:+39…").
const E164 = /\+\d{8,15}(?!\d)/g;
// The same typed with separators ("+39 333 123-4567", "+39 (02) 1234 5678").
const E164_SPACED = /\+\d(?:[ .()-]{1,2}\d|\d){7,14}(?!\d)/g;
// URL-encoded ("To=%2B393331234567" in a quoted request).
const E164_ENCODED = /%2B(\d{8,15})(?!\d)/gi;
// International with 00 instead of + ("0039 333 1234567").
const INTL_00 = /\b00\d(?:[ .()-]{1,2}\d|\d){7,14}(?!\d)/g;
// Italian with the country code but no + ("393331234567"): mobiles start 3, landlines 0.
const IT_NO_PLUS = /\b39[03]\d{7,10}(?!\d)/g;
// Italian national forms, as a provider error may echo an unnormalised recipient: mobiles
// ("3331234567", "333 1234567", "333 123 4567") and landlines ("02 12345678", "0612345678").
const IT_MOBILE = /\b3\d{2}(?:[ .-]?\d{3}[ .-]?\d{3,4}|[ .-]?\d{6,7})(?!\d)/g;
const IT_LANDLINE = /\b0\d{1,3}[ .-]?\d{5,8}(?!\d)/g;
// DrizzleQueryError: "Failed query: <sql>\nparams: <values>". Values may span lines; stop at
// the first stack frame or cause.
const PARAMS = /\bparams:[^\n]*(?:\n(?!\s+at\s|\s+caused by:)[^\n]*)*/g;

/** A number written without its country code: only the last 4 digits survive. */
const maskNational = (n: string) => `${DOTS}${n.replace(/\D/g, "").slice(-4)}`;

export function redact(text: string): string {
  return (
    text
      .replace(PARAMS, "params: [redacted]")
      // Emails first: an address may contain digits that look like a phone number.
      .replace(EMAIL, maskEmail)
      .replace(E164, maskPhone)
      .replace(E164_SPACED, maskPhone)
      .replace(E164_ENCODED, (_, digits: string) => maskPhone(digits))
      .replace(INTL_00, (m) => maskPhone(m.replace(/^00/, "")))
      .replace(IT_NO_PLUS, maskPhone)
      .replace(IT_MOBILE, maskNational)
      .replace(IT_LANDLINE, maskNational)
  );
}

function formatMeta(meta?: LogMeta): string {
  if (!meta) return "";
  return Object.entries(meta)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => ` ${k}=${typeof v === "string" && /[\s"=]/.test(v) ? JSON.stringify(v) : String(v)}`)
    .join("");
}

const MAX_FRAMES = 10;

function describe(err: unknown, depth = 0): string {
  if (err instanceof Error) {
    const code = (err as { code?: unknown }).code;
    let out = `${typeof code === "string" || typeof code === "number" ? `[${code}] ` : ""}${err.name}: ${err.message}`;
    // Only the frames: the stack's header repeats the message (and its "params:" tail).
    const frames = (err.stack ?? "").split("\n").filter((l) => /^\s+at\s/.test(l));
    if (frames.length) out += `\n${frames.slice(0, MAX_FRAMES).join("\n")}`;
    if (err.cause !== undefined && depth < 3) out += `\n  caused by: ${describe(err.cause, depth + 1)}`;
    return out;
  }
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err) ?? String(err);
  } catch {
    return String(err);
  }
}

/** "[scope] first line key=value…" then the rest (stack frames, causes). */
function write(stream: NodeJS.WriteStream, scope: string, meta: LogMeta | undefined, body: () => string) {
  try {
    // Redact separately so a "params:" tail in the body can't swallow the meta.
    const text = redact(body());
    const nl = text.indexOf("\n");
    const head = nl === -1 ? text : text.slice(0, nl);
    const rest = nl === -1 ? "" : text.slice(nl);
    stream.write(`[${scope}] ${head}${redact(formatMeta(meta))}${rest}\n`);
  } catch {
    // Logging must never take the caller down (closed pipe, odd throwables, no process streams).
  }
}

/** Log a failure. `meta` is for ids, counts and codes — never names, contacts or free text. */
export function logError(scope: string, err: unknown, meta?: LogMeta): void {
  write(process.stderr, scope, meta, () => describe(err));
}

export function logInfo(scope: string, msg: string, meta?: LogMeta): void {
  write(process.stdout, scope, meta, () => msg);
}
