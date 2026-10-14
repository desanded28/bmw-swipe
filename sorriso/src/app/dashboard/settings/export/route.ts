import { NextResponse } from "next/server";
import { getStaffLocale } from "@/i18n/server";
import { auditStaff } from "@/lib/audit";
import { requireStepUp } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { orgExportStream } from "@/lib/privacy/export";
import { isStepUpRequired, stepUpRedirect, wantsHtml } from "@/lib/privacy/gates";

/**
 * GET /dashboard/settings/export — every table of the practice as CSV and JSON, plus a FHIR R4
 * Bundle and a manifest, streamed as one ZIP (no lock-in: EU Data Act ch. VI; Art. 28(3)(g)).
 * Needs org.export and a recent second factor; audited as export.org. Stays available while
 * the account is being closed, until the purge.
 */
export async function GET(req: Request) {
  const s = await requirePermission("org.export");
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
  const now = new Date();
  await auditStaff(s, "export.org", { type: "org", id: s.org.id }, { metadata: { format: "zip" } });
  const stream = orgExportStream(s.org.id, { now, locale: await getStaffLocale() });
  const filename = `sorriso-${s.org.slug}-${now.toISOString().slice(0, 10)}.zip`;
  return new Response(stream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
