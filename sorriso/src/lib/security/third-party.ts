/**
 * The checks behind scripts/check-third-party.ts (npm run check:third-party): public pages must
 * make no third-party request (no scripts, styles, fonts, images, frames or preconnects from other
 * origins) and set no cookie outside the allowed list. Pure functions over HTML, CSS and headers,
 * so they are unit-tested without a server.
 *
 * Navigation links (<a href>) to other sites are fine: they send nothing until clicked. The click-
 * to-load map is the one exception for frames: its OpenStreetMap URL sits inside a <template>
 * that is only instantiated when the visitor asks for the map.
 */

export type FoundUrl = { url: string; where: string; inTemplate: boolean };

/**
 * Cookies a public page may set: the staff session (auth.ts SESSION_COOKIE_NAMES), the language
 * choice, the patient privacy-center session (privacy/patient-session.ts
 * PATIENT_SESSION_COOKIE_NAMES). Spelled out here so the script stays free of the database
 * modules; tools.test.ts checks them against those constants.
 */
export const ALLOWED_COOKIES = ["__Host-sorriso_session", "sorriso_session", "NEXT_LOCALE", "__Host-sorriso_pc", "sorriso_pc"];

/** Origins allowed only inside a <template> (click-to-load embeds). */
export const TEMPLATE_ONLY_ORIGINS = ["https://www.openstreetmap.org"];

/** <link rel> values that load something; canonical, alternate and friends are just metadata. */
const LOADING_RELS = new Set(["stylesheet", "preload", "prefetch", "preconnect", "dns-prefetch", "modulepreload", "icon", "shortcut", "apple-touch-icon", "manifest", "mask-icon", "prerender"]);

const TAG = /<(script|link|img|iframe|frame|source|video|audio|embed|object|input|track|image|use|form|button|meta|style)\b([^>]*)>/gi;
const ATTR = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g;

function attributes(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of raw.matchAll(ATTR)) out[m[1].toLowerCase()] = decodeEntities(m[3] ?? m[4] ?? m[5] ?? "");
  return out;
}

function decodeEntities(s: string): string {
  return s.replace(/&amp;/g, "&").replace(/&#x2F;/gi, "/").replace(/&#47;/g, "/").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

/** url(...) and @import "..." in CSS. */
export function cssUrls(css: string): string[] {
  const out: string[] = [];
  for (const m of css.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi)) out.push(m[2].trim());
  for (const m of css.matchAll(/@import\s+(?:url\()?\s*['"]([^'"]+)['"]/gi)) out.push(m[1].trim());
  return [...new Set(out)];
}

/** Ranges of the HTML that sit inside <template>…</template>. */
function templateRanges(html: string): [number, number][] {
  const ranges: [number, number][] = [];
  const re = /<template\b[^>]*>([\s\S]*?)<\/template>/gi;
  for (const m of html.matchAll(re)) ranges.push([m.index ?? 0, (m.index ?? 0) + m[0].length]);
  return ranges;
}

/** Every URL the page would load by itself (not counting what scripts fetch later). */
export function resourceUrls(html: string): FoundUrl[] {
  const templates = templateRanges(html);
  const inTemplate = (i: number) => templates.some(([a, b]) => i >= a && i < b);
  const found: FoundUrl[] = [];
  const push = (url: string | undefined, where: string, at: number) => {
    const v = url?.trim();
    if (v) found.push({ url: v, where, inTemplate: inTemplate(at) });
  };
  for (const m of html.matchAll(TAG)) {
    const tag = m[1].toLowerCase();
    const at = m.index ?? 0;
    const a = attributes(m[2]);
    if (tag === "link") {
      const rels = (a.rel ?? "").toLowerCase().split(/\s+/);
      if (rels.some((r) => LOADING_RELS.has(r))) push(a.href, `link[rel=${a.rel}]`, at);
      if (a.imagesrcset) for (const part of a.imagesrcset.split(",")) push(part.trim().split(/\s+/)[0], "link[imagesrcset]", at);
      continue;
    }
    if (tag === "meta") {
      if ((a["http-equiv"] ?? "").toLowerCase() === "refresh") push(a.content?.match(/url\s*=\s*(.+)$/i)?.[1], "meta[refresh]", at);
      continue;
    }
    if (tag === "form") {
      push(a.action, "form[action]", at);
      continue;
    }
    if (tag === "button" || tag === "input") push(a.formaction, `${tag}[formaction]`, at);
    if (tag === "style") continue;
    for (const name of ["src", "data", "poster", "href", "xlink:href"]) {
      if (a[name] && !(tag === "use" && a[name].startsWith("#"))) push(a[name], `${tag}[${name}]`, at);
    }
    for (const name of ["srcset", "imagesrcset"]) {
      if (a[name]) for (const part of a[name].split(",")) push(part.trim().split(/\s+/)[0], `${tag}[${name}]`, at);
    }
    if (a.style) for (const u of cssUrls(a.style)) push(u, `${tag}[style]`, at);
  }
  for (const m of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    for (const u of cssUrls(m[1])) push(u, "style", m.index ?? 0);
  }
  return found;
}

/** The origin a URL loads from, or null for same-document and non-network URLs (data:, blob:, #…). */
export function originOf(url: string, base: string): string | null {
  if (/^(data|blob|about|javascript|mailto|tel):/i.test(url) || url.startsWith("#")) return null;
  try {
    return new URL(url, base).origin;
  } catch {
    return null;
  }
}

/** URLs that load from somewhere other than `self` (template-only origins allowed inside <template>). */
export function thirdPartyUrls(found: FoundUrl[], base: string, selfOrigins: string[]): FoundUrl[] {
  const self = new Set(selfOrigins.map((o) => new URL(o).origin));
  return found.filter((f) => {
    const origin = originOf(f.url, base);
    if (!origin || self.has(origin)) return false;
    return !(f.inTemplate && TEMPLATE_ONLY_ORIGINS.includes(origin));
  });
}

/** Cookie names set by Set-Cookie headers that aren't allowed. */
export function disallowedCookies(setCookies: string[], allowed: string[] = ALLOWED_COOKIES): string[] {
  const names = setCookies.map((c) => c.split("=")[0].trim()).filter(Boolean);
  return [...new Set(names.filter((n) => !allowed.includes(n)))];
}

/**
 * Script tags without the response's CSP nonce: the browser blocks them (the page was prerendered
 * at build time instead of rendered per request, or a tag was injected).
 */
export function scriptsMissingNonce(html: string, nonce: string | null): number {
  if (!nonce) return 0;
  let missing = 0;
  for (const m of html.matchAll(/<script\b([^>]*)>/gi)) {
    const a = attributes(m[1]);
    if (a.type && !/javascript|module/i.test(a.type) && a.type !== "") continue; // data blocks (JSON-LD) don't run
    if (a.nonce !== nonce) missing++;
  }
  return missing;
}

/** The nonce in a CSP header's script-src, if any. */
export function cspNonce(csp: string | null): string | null {
  return csp?.match(/script-src[^;]*'nonce-([^']+)'/)?.[1] ?? null;
}
