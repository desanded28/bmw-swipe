import type { Locale } from "@/i18n/config";

/**
 * The shared email layout: a coloured header with the sender's name, a greeting, an intro
 * paragraph, an optional details table, buttons and a footer. Every package builds its emails
 * with renderEmailLayout() and sends them through deliver() (src/lib/messaging/index.ts).
 *
 * Rules for callers (patient emails): no remote images and no tracking or redirect links;
 * pass already-translated, already-formatted strings (this module does no i18n). Every string
 * is HTML-escaped here, so pass plain text, never markup.
 *
 * The signature is frozen. WP3 owns the implementation (html lang and Content-Language from
 * `locale`, the privacy footer, List-Unsubscribe are added around it, not by callers).
 */

export type EmailButton = { label: string; url: string; variant?: "primary" | "secondary" | "danger" };

export type EmailLayoutInput = {
  /** Language of the email (the recipient's). */
  locale: Locale;
  /** Header and primary-button colour, "#rrggbb"; anything else falls back to the Sorriso teal. */
  brandColor: string;
  /** Sender shown in the coloured header: the practice's name, or Sorriso's. */
  brandName: string;
  /** First paragraph. */
  intro: string;
  /** "Hi Giulia," — omitted when not given. */
  greeting?: string;
  /** Inbox preview text, hidden in the body. */
  preheader?: string;
  /** Label/value rows shown in a box under the intro. */
  details?: [string, string][];
  buttons?: EmailButton[];
  /** Small print, one line each (who sent it and why, address, privacy links). */
  footerLines: string[];
};

export const DEFAULT_BRAND_COLOR = "#0d9488";

/** Escape text for HTML element content and double- or single-quoted attributes. */
export function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderEmailLayout(opts: EmailLayoutInput): { html: string; text: string } {
  const details = opts.details ?? [];
  const buttons = opts.buttons ?? [];
  const color = /^#[0-9a-f]{6}$/i.test(opts.brandColor) ? opts.brandColor : DEFAULT_BRAND_COLOR;

  const btnStyle = (v: EmailButton["variant"]) =>
    v === "danger"
      ? "background:#fff;color:#b91c1c;border:1px solid #fecaca;"
      : v === "secondary"
        ? "background:#fff;color:#0f172a;border:1px solid #e2e8f0;"
        : `background:${color};color:#fff;border:1px solid ${color};`;

  const preheader = opts.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">${esc(opts.preheader)}</div>\n`
    : "";
  const greeting =
    opts.greeting !== undefined ? `<p style="margin:0 0 12px;font-size:16px">${esc(opts.greeting)}</p>\n` : "";

  const html = `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a">
${preheader}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0">
<tr><td style="background:${color};padding:20px 28px;color:#fff;font-size:18px;font-weight:700">${esc(opts.brandName)}</td></tr>
<tr><td style="padding:28px">
${greeting}<p style="margin:0 0 20px;font-size:15px;line-height:1.55;color:#334155">${esc(opts.intro)}</p>
${
  details.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:12px;padding:16px 18px;margin-bottom:22px">${details
        .map(
          ([k, v]) =>
            `<tr><td style="padding:5px 0;color:#64748b;font-size:13px;width:110px;vertical-align:top">${esc(k)}</td><td style="padding:5px 0;font-size:14px;font-weight:600">${esc(v)}</td></tr>`,
        )
        .join("")}</table>`
    : ""
}
${buttons
  .map(
    (b) =>
      `<a href="${esc(b.url)}" style="display:inline-block;margin:0 8px 10px 0;padding:11px 18px;border-radius:10px;font-size:14px;font-weight:600;text-decoration:none;${btnStyle(b.variant)}">${esc(b.label)}</a>`,
  )
  .join("")}
</td></tr>
<tr><td style="padding:16px 28px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;line-height:1.5">${opts.footerLines.map(esc).join("<br>")}</td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    ...(opts.greeting !== undefined ? [opts.greeting, ""] : []),
    opts.intro,
    "",
    ...details.map(([k, v]) => `${k}: ${v}`),
    "",
    ...buttons.map((b) => `${b.label}: ${b.url}`),
    "",
    ...opts.footerLines,
  ].join("\n");

  return { html, text };
}
