import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { patients } from "@/db/schema";
import { auditStaff } from "@/lib/audit";
import { requireStepUp } from "@/lib/auth";
import { isRestricted } from "@/lib/contact";
import { can, requirePermission } from "@/lib/permissions";
import { hasRestrictedAccess } from "@/lib/privacy/erasure";
import { buildPatientExport } from "@/lib/privacy/export";
import { isStepUpRequired, stepUpRedirect, wantsHtml } from "@/lib/privacy/gates";

/**
 * GET /dashboard/patients/:id/export — the patient's data as a ZIP (patient.json, CSV per table,
 * summary.html in the patient's language, fhir.json) for an access or portability request.
 *
 * Needs patient.export and a recent second factor (requireStepUp: 403 step_up_required when it
 * throws). A restricted record also needs a reason given on the patient page in the last minutes
 * (patient.restricted_access). Audited as patient.export.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await requirePermission("patient.export");
  try {
    await requireStepUp();
  } catch (err) {
    // A navigation follows WP6's redirect to the re-authentication page; a script gets the code.
    const verify = stepUpRedirect(err);
    if (isStepUpRequired(err) || (verify && !wantsHtml(req))) {
      return NextResponse.json({ error: { code: "step_up_required", verify } }, { status: 403 });
    }
    throw err;
  }
  const { id } = await params;
  const [patient] = await db
    .select({ id: patients.id, locale: patients.locale, restrictedAt: patients.restrictedAt, erasedAt: patients.erasedAt })
    .from(patients)
    .where(and(eq(patients.orgId, s.org.id), eq(patients.id, id)));
  if (!patient) return NextResponse.json({ error: { code: "not_found" } }, { status: 404 });
  if (isRestricted(patient) && !(can(s.role, "patient.restricted.read") && (await hasRestrictedAccess(s, id)))) {
    return NextResponse.json({ error: { code: "restricted_reason_required" } }, { status: 403 });
  }

  const format = new URL(req.url).searchParams.get("format") === "json" ? "json" : "zip";
  const file = await buildPatientExport(s.org.id, id, { locale: patient.locale, format, actor: { type: "user", id: s.user.id } });
  await auditStaff(s, "patient.export", { type: "patient", id }, { metadata: { format, bytes: file.body.byteLength } });
  return new Response(file.body as BodyInit, {
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": `attachment; filename="${file.filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
