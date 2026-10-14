import { NextResponse } from "next/server";
import { toLocale } from "@/i18n/config";
import { getPatientSession } from "@/lib/privacy/patient-session";
import { exportRecord } from "@/lib/privacy/privacy-center";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Exports per session per hour: plenty for a patient with several practices, a brake on scraping. */
const EXPORT_LIMIT = { max: 10, windowMs: 60 * 60_000 };

const NO_STORE = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" };

/**
 * GET /api/privacy/export?p=<patientId>&locale=<locale>: the patient's own data as a ZIP
 * (summary.html in their language, patient.json, CSV per table, fhir.json) for the right of
 * access (Art. 15) and portability (Art. 20).
 *
 * Needs the privacy-center session (a one-time code to the patient's contact; the appointment
 * link's step-up opens the same session), and only for a record that session may see in full.
 * Never cached; audited as privacy_center.export with actor type patient_session.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const patientId = url.searchParams.get("p") ?? "";
  const locale = toLocale(url.searchParams.get("locale"));
  const session = await getPatientSession();
  if (!session) return NextResponse.json({ error: { code: "unauthorized" } }, { status: 401, headers: NO_STORE });
  const limited = await rateLimit(`pc-export:${session.id.slice(0, 32)}`, EXPORT_LIMIT.max, EXPORT_LIMIT.windowMs);
  if (!limited.ok) {
    return NextResponse.json({ error: { code: "rate_limited" } }, { status: 429, headers: { ...NO_STORE, "Retry-After": String(limited.retryAfterSec) } });
  }
  const file = patientId ? await exportRecord(session, { patientId, locale, headers: req.headers }) : null;
  if (!file) return NextResponse.json({ error: { code: "not_found" } }, { status: 404, headers: NO_STORE });
  return new Response(file.body as BodyInit, {
    headers: {
      ...NO_STORE,
      "Content-Type": file.contentType,
      "Content-Disposition": `attachment; filename="${file.filename}"`,
    },
  });
}
