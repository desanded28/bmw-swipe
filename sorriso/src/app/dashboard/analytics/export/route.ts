import { getT } from "@/i18n/server";
import { requireStaff } from "@/lib/auth";
import { analyticsCsv, loadAnalytics, toRange } from "@/lib/analytics";
import { staffLocaleOf } from "@/lib/dashboard";
import { can } from "@/lib/permissions";
import { todayIn } from "@/lib/time";

/**
 * GET /dashboard/analytics/export?months=24: the analytics page's figures as CSV (analytics.read).
 * Signed-out requests go to the login page (requireStaff); a role without the permission gets
 * 403. Aggregates only, no patient data; never cached.
 */
export async function GET(req: Request): Promise<Response> {
  const s = await requireStaff();
  const locale = await staffLocaleOf(s);
  if (!can(s.role, "analytics.read")) {
    return new Response(getT(locale, "analytics")("forbidden"), {
      status: 403,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "private, no-store" },
    });
  }
  const months = toRange(new URL(req.url).searchParams.get("months"));
  const data = await loadAnalytics(s.org, { months });
  const filename = `${getT(locale, "analytics")("csv.filename")}-${s.org.slug}-${todayIn(s.org.timezone)}.csv`.replace(/[^\w.-]+/g, "-");
  return new Response(analyticsCsv(data, locale), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
