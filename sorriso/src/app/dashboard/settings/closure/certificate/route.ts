import { isLocale, type Locale } from "@/i18n/config";
import { fmtDay, zonedDate } from "@/i18n/datefmt";
import { negotiate } from "@/i18n/negotiate";
import { getT } from "@/i18n/t";
import { APP_NAME } from "@/lib/config";
import { esc } from "@/lib/messaging/layout";
import { loadCertificate } from "@/lib/privacy/org-closure";

/**
 * GET /dashboard/settings/closure/certificate?c=<signed token>[&lang=it] — the certificate of
 * deletion of a purged practice, as a printable page. A route handler, not a page: the practice's
 * accounts no longer exist when it is opened, so it can't sit behind the dashboard's session. The
 * signed token (emailed to the owners) is the only way in; the data comes from the certificate row
 * in Sorriso's own audit chain, whose hash is printed as a seal.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const lang = url.searchParams.get("lang");
  const locale: Locale = isLocale(lang) ? lang : (negotiate(req.headers.get("accept-language")) ?? "it");
  const t = getT(locale, "privacyAdmin");
  const cert = await loadCertificate(url.searchParams.get("c"));
  const headers = { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex" };
  if (!cert) {
    return new Response(`<!doctype html><html lang="${locale}"><meta charset="utf-8"><title>${esc(t("certificate.title"))}</title><p>${esc(t("certificate.invalid"))}</p></html>`, {
      status: 404,
      headers,
    });
  }
  const day = (d: Date) => fmtDay(zonedDate(d, "Europe/Rome"), "long", locale);
  const rows = Object.entries(cert.tables)
    .filter(([, n]) => n > 0)
    .map(([table, n]) => `<tr><td>${esc(table)}</td><td class="n">${n}</td></tr>`)
    .join("");
  const html = `<!doctype html>
<html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(t("certificate.title"))} — ${esc(cert.orgName)}</title>
<style>
body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;max-width:760px;margin:0 auto;padding:32px 16px;line-height:1.5}
h1{font-size:26px;margin:0 0 8px}dl{display:grid;grid-template-columns:minmax(0,260px) 1fr;gap:6px 16px}dt{color:#64748b}dd{margin:0;font-weight:600}
table{border-collapse:collapse;width:100%;margin-top:8px;font-size:14px}td,th{border-bottom:1px solid #e2e8f0;padding:5px 8px;text-align:left}.n{text-align:right;font-variant-numeric:tabular-nums}
code{word-break:break-all;font-size:12px}button{margin-top:24px;padding:8px 14px;border-radius:10px;border:1px solid #cbd5e1;background:#fff;font-weight:600;cursor:pointer}
@media print{button{display:none}}
</style></head><body>
<p style="color:#0c675d;font-weight:800">${esc(APP_NAME)}</p>
<h1>${esc(t("certificate.title"))}</h1>
<p>${esc(t("certificate.intro"))}</p>
<dl>
<dt>${esc(t("certificate.practice"))}</dt><dd>${esc(cert.orgName)}</dd>
<dt>${esc(t("certificate.purgedAt"))}</dt><dd>${esc(day(cert.purgedAt))}</dd>
<dt>${esc(t("certificate.backups"))}</dt><dd>${esc(day(cert.backupsExpireAt))}</dd>
<dt>${esc(t("certificate.reference"))}</dt><dd><code>${esc(cert.id)}</code></dd>
<dt>${esc(t("certificate.seal"))}</dt><dd><code>${esc(cert.hash)}</code></dd>
</dl>
<h2>${esc(t("certificate.tables"))}</h2>
<table><thead><tr><th>${esc(t("certificate.table"))}</th><th class="n">${esc(t("certificate.rows"))}</th></tr></thead><tbody>${rows}</tbody></table>
<button type="button" onclick="window.print()">${esc(t("certificate.print"))}</button>
</body></html>`;
  return new Response(html, { headers });
}
