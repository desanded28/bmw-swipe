/**
 * Privacy check for the public pages: no third-party requests and no unexpected cookies (F9 rule 7).
 *
 *   npm run check:third-party                          # against http://localhost:3010
 *   npm run check:third-party -- --base https://staging.example --org studio-bianchi --token <manage token>
 *
 * Fetches /, /it/search, /it/c/<demo>, /it/book/<demo>, /it/embed/<demo> and a patient manage link
 * from a running server (following redirects, collecting every Set-Cookie on the way), plus the
 * same-origin stylesheets they load. Fails when the HTML or CSS loads anything from an origin
 * other than the server's own (or APP_URL's): scripts, styles, fonts, images, frames, preconnects.
 * The OpenStreetMap URL inside the click-to-load map <template> is the one exception. Also fails
 * on any cookie outside the allowed list, and on scripts without the response's CSP nonce
 * (a page prerendered at build time, whose scripts the browser would block).
 *
 * Without --org/--token the demo practice and an upcoming appointment are read from DATABASE_URL.
 */
import { and, asc, eq, gt, isNotNull } from "drizzle-orm";
import {
  ALLOWED_COOKIES,
  cspNonce,
  cssUrls,
  disallowedCookies,
  originOf,
  resourceUrls,
  scriptsMissingNonce,
  thirdPartyUrls,
} from "../src/lib/security/third-party";

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
};

async function demoTargets(): Promise<{ org: string; token: string | null }> {
  const { db } = await import("../src/db");
  const { appointments, organizations } = await import("../src/db/schema");
  const [org] = await db.select().from(organizations).where(eq(organizations.isDemo, true)).orderBy(asc(organizations.createdAt)).limit(1);
  if (!org) throw new Error("No demo practice in the database: run npm run db:reset, or pass --org and --token.");
  const [appt] = await db
    .select({ token: appointments.manageTokenEnc })
    .from(appointments)
    .where(and(eq(appointments.orgId, org.id), gt(appointments.startsAt, new Date()), isNotNull(appointments.manageTokenEnc)))
    .orderBy(asc(appointments.startsAt))
    .limit(1);
  return { org: org.slug, token: appt?.token ?? null };
}

type Fetched = { url: string; status: number; html: string; cookies: string[]; csp: string | null };

/** GET with redirects followed by hand, so every hop's Set-Cookie is seen. */
async function fetchPage(url: string): Promise<Fetched> {
  const cookies: string[] = [];
  let current = url;
  for (let hop = 0; hop < 6; hop++) {
    const res = await fetch(current, { redirect: "manual", headers: { "accept-language": "it", accept: "text/html" } });
    cookies.push(...res.headers.getSetCookie());
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      current = new URL(location, current).toString();
      continue;
    }
    return { url: current, status: res.status, html: await res.text(), cookies, csp: res.headers.get("content-security-policy") };
  }
  throw new Error(`Too many redirects from ${url}`);
}

async function main() {
  const base = (arg("base") ?? process.env.BASE_URL ?? "http://localhost:3010").replace(/\/$/, "");
  const self = [base, process.env.APP_URL ?? base];
  const given = { org: arg("org"), token: arg("token") };
  const targets = given.org ? { org: given.org, token: given.token ?? null } : await demoTargets();
  const paths = ["/", "/it/search", `/it/c/${targets.org}`, `/it/book/${targets.org}`, `/it/embed/${targets.org}`];
  if (targets.token) paths.push(`/a/${targets.token}`);
  else console.warn("! no upcoming appointment with a manage link: the manage page is not checked");

  const problems: string[] = [];
  const cssChecked = new Set<string>();
  for (const path of paths) {
    const shown = path.startsWith("/a/") ? "/a/<token>" : path;
    let page: Fetched;
    try {
      page = await fetchPage(`${base}${path}`);
    } catch (err) {
      problems.push(`${shown}: could not fetch (${err instanceof Error ? err.message : err}). Is the server running at ${base}?`);
      continue;
    }
    if (page.status >= 400) problems.push(`${shown}: HTTP ${page.status}`);
    const found = resourceUrls(page.html);
    for (const f of thirdPartyUrls(found, page.url, self)) problems.push(`${shown}: third-party ${f.where} -> ${f.url}`);
    for (const name of disallowedCookies(page.cookies)) problems.push(`${shown}: sets cookie "${name}" (allowed: ${ALLOWED_COOKIES.join(", ")})`);
    const missing = scriptsMissingNonce(page.html, cspNonce(page.csp));
    if (missing) problems.push(`${shown}: ${missing} script tag(s) without the CSP nonce (page prerendered? the browser will block them)`);
    if (!page.csp) problems.push(`${shown}: no Content-Security-Policy header`);

    // Same-origin stylesheets: fonts and imports pulled from elsewhere hide there.
    for (const f of found.filter((x) => x.where.startsWith("link[rel=") && /stylesheet/i.test(x.where))) {
      const href = new URL(f.url, page.url).toString();
      if (cssChecked.has(href) || originOf(href, page.url) !== new URL(page.url).origin) continue;
      cssChecked.add(href);
      const css = await (await fetch(href)).text();
      const urls = cssUrls(css).map((u) => ({ url: u, where: `css ${new URL(href).pathname}`, inTemplate: false }));
      for (const x of thirdPartyUrls(urls, href, self)) problems.push(`${shown}: third-party ${x.where} -> ${x.url}`);
    }
    console.log(`checked ${shown} (${page.status}, ${found.length} resources)`);
  }

  if (problems.length) {
    console.error(`\n✗ ${problems.length} problem(s):`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log(`\n✓ no third-party requests and only allowed cookies on ${paths.length} page(s)`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
