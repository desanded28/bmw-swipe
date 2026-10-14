import { eq } from "drizzle-orm";
import { db } from "@/db";
import { organizations, patients, type ConsentPurpose, type Locale } from "@/db/schema";
import { DEFAULT_LOCALE } from "@/i18n/config";
import { lhref } from "@/i18n/href";
import { negotiate } from "@/i18n/negotiate";
import { getT } from "@/i18n/t";
import { absoluteUrl } from "@/lib/config";
import { sha256 } from "@/lib/ids";
import { verifyUnsubscribeToken } from "@/lib/links";
import { logError } from "@/lib/log";
import { esc } from "@/lib/messaging/layout";
import { currentConsents, withdrawConsent } from "@/lib/privacy/consent";
import { rateLimit, rateLimitByIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type Channel = "email" | "sms" | "whatsapp";

const PURPOSE: Record<Channel, ConsentPurpose> = { email: "email_channel", sms: "sms_channel", whatsapp: "whatsapp_channel" };

/**
 * Invalid or missing tokens per network: tight for someone probing. Valid tokens are never counted
 * against the network: RFC 8058 one-click POSTs come from the mailbox provider's servers (and link
 * scanners from the same networks), so one network carries every patient's unsubscribes and a
 * per-network limit would drop real withdrawals.
 */
const INVALID_LIMIT = { max: 30, windowMs: 10 * 60_000 };
/**
 * Requests per valid token (one patient and channel) and method, so link scanners' GETs never use
 * up the one-click POST: far above any person, and the withdrawal is idempotent anyway.
 */
const TOKEN_LIMIT = { max: 20, windowMs: 10 * 60_000 };

/**
 * /api/privacy/unsubscribe?t=<token>&c=<channel> — the List-Unsubscribe link of every patient email
 * (src/lib/messaging/index.ts: unsubscribeUrl). The token is links.ts unsubscribeToken(): an HMAC
 * over the patient and channel with no expiry, so links in old emails keep working after the
 * appointment link has expired (RFC 8058, mailbox-provider rules).
 *
 * - GET shows a confirmation page with one button. It changes nothing: mail scanners and
 *   link-preview bots open links on their own.
 * - POST unsubscribes. It is the RFC 8058 one-click request ("List-Unsubscribe=One-Click", sent by
 *   the mail client without the patient seeing a page) and also what the page's button sends. It
 *   records a withdrawal in the consent ledger (email_channel or sms_channel; method email_link,
 *   source manage_link), which turns the patient's opt-in off, so the next reminder on that channel
 *   is skipped. Idempotent: an existing opt-out records nothing new.
 *
 * Both answer in the patient's language. No cookie, no third-party resource, never cached.
 *
 * The token is checked first (an HMAC: nothing to guess). Only a missing or invalid token counts
 * against the caller's network; a valid one is limited per token, so the provider's one-click
 * POSTs for many patients from one network all go through.
 */
export async function GET(req: Request) {
  return handle(req, "GET");
}

export async function POST(req: Request) {
  return handle(req, "POST");
}

async function tokenOf(req: Request, method: "GET" | "POST"): Promise<string | null> {
  const fromQuery = new URL(req.url).searchParams.get("t");
  if (fromQuery || method === "GET") return fromQuery;
  const form = await req.formData().catch(() => null);
  const t = form?.get("t");
  return typeof t === "string" ? t : null;
}

async function handle(req: Request, method: "GET" | "POST"): Promise<Response> {
  const fallback = negotiate(req.headers.get("accept-language")) ?? DEFAULT_LOCALE;
  const tooMany = () => {
    const t = getT(fallback, "privacy");
    return page(fallback, 429, t("unsubscribe.title"), { body: t("unsubscribe.rateLimited") });
  };

  const token = await tokenOf(req, method);
  const parsed = token ? verifyUnsubscribeToken(token) : null;
  if (!parsed) {
    if (!(await rateLimitByIp(req.headers, "unsubscribe-invalid", INVALID_LIMIT.max, INVALID_LIMIT.windowMs)).ok) return tooMany();
  } else if (!(await rateLimit(`unsubscribe:${method}:${sha256(token!).slice(0, 32)}`, TOKEN_LIMIT.max, TOKEN_LIMIT.windowMs)).ok) {
    return tooMany();
  }
  const [row] = parsed
    ? await db
        .select({ patient: patients, orgName: organizations.name })
        .from(patients)
        .innerJoin(organizations, eq(organizations.id, patients.orgId))
        .where(eq(patients.id, parsed.patientId))
    : [];
  if (!parsed || !row) {
    const t = getT(fallback, "privacy");
    return page(fallback, 400, t("unsubscribe.title"), { body: t("unsubscribe.invalid", { url: privacyCenterUrl(fallback) }) });
  }

  const { patient, orgName } = row;
  const locale = patient.locale;
  const t = getT(locale, "privacy");
  const channel = parsed.channel;

  if (method === "GET") {
    const action = `/api/privacy/unsubscribe?t=${encodeURIComponent(token!)}&c=${channel}`;
    return page(locale, 200, t(`unsubscribe.confirm.${channel}`, { practice: orgName }), {
      body: t("unsubscribe.body"),
      form: { action, token: token!, button: t("unsubscribe.button") },
    });
  }

  try {
    const purpose = PURPOSE[channel];
    await db.transaction(async (tx) => {
      const latest = (await currentConsents(patient.id, tx))[purpose];
      const flagOff = channel === "email" ? !patient.emailOptIn : channel === "sms" ? !patient.smsOptIn : patient.preferredChannel !== "whatsapp";
      if (latest?.granted === false && flagOff) return;
      await withdrawConsent(tx, {
        orgId: patient.orgId,
        patientId: patient.id,
        purpose,
        source: "manage_link",
        method: "email_link",
        locale,
        headers: req.headers,
        actor: { type: "patient_link", id: null },
      });
    });
  } catch (err) {
    logError("unsubscribe", err, { patientId: patient.id, channel });
    return page(locale, 500, t("unsubscribe.title"), { body: t("me.errors.generic") });
  }
  return page(locale, 200, t(`unsubscribe.done.${channel}`, { practice: orgName }), {
    body: t("unsubscribe.doneBody", { url: privacyCenterUrl(locale) }),
  });
}

function privacyCenterUrl(locale: Locale): string {
  return absoluteUrl(lhref(locale, "/privacy"));
}

/** A small self-contained page: no script, no external resource, links only to the privacy center. */
function page(locale: Locale, status: number, heading: string, extra: { body?: string; form?: { action: string; token: string; button: string } } = {}): Response {
  const t = getT(locale, "privacy");
  const linkify = (s: string) => esc(s).replace(/(https?:\/\/[^\s<]+)/g, (u) => `<a href="${u}">${u}</a>`);
  const form = extra.form
    ? `<form method="post" action="${esc(extra.form.action)}"><input type="hidden" name="t" value="${esc(extra.form.token)}"><button type="submit">${esc(extra.form.button)}</button></form>`
    : "";
  const html = `<!doctype html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="referrer" content="no-referrer">
<title>${esc(t("unsubscribe.title"))}</title>
<style>
body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:#f8fafc;color:#0f172a}
main{max-width:32rem;margin:4rem auto;padding:2rem 1.5rem;background:#fff;border-radius:1rem;box-shadow:0 1px 3px rgba(15,23,42,.08);border:1px solid #e2e8f0}
h1{font-size:1.35rem;line-height:1.35;margin:0 0 .75rem}
p{line-height:1.55;color:#334155}
a{color:#0c675d;font-weight:600}
button{margin-top:1rem;font:inherit;font-weight:600;color:#fff;background:#0f766e;border:0;border-radius:.75rem;padding:.75rem 1.25rem;cursor:pointer}
button:focus-visible,a:focus-visible{outline:2px solid #0d9488;outline-offset:2px}
</style>
</head>
<body><main><h1>${esc(heading)}</h1>${extra.body ? `<p>${linkify(extra.body)}</p>` : ""}${form}</main></body>
</html>`;
  return new Response(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
