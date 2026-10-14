import { and, count, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { apiKeys, organizations } from "@/db/schema";
import { isLocale } from "@/i18n/config";
import { requirePermission } from "@/lib/permissions";
import { buildRegister, customRegisterEntries, registerCsv } from "@/lib/privacy/register";
import { resolveSettings } from "@/lib/settings";

/** GET /dashboard/settings/privacy/register/csv?lang=it — the Art. 30 register as CSV (privacy.settings). */
export async function GET(req: Request) {
  const s = await requirePermission("privacy.settings");
  const lang = new URL(req.url).searchParams.get("lang");
  const locale = isLocale(lang) ? lang : "it";
  const [[org], [{ keys }]] = await Promise.all([
    db.select().from(organizations).where(eq(organizations.id, s.org.id)),
    db.select({ keys: count() }).from(apiKeys).where(and(eq(apiKeys.orgId, s.org.id), isNull(apiKeys.revokedAt))),
  ]);
  const register = buildRegister(org, resolveSettings(org.settings), { locale, hasApiKeys: keys > 0, custom: customRegisterEntries(org) });
  return new Response(registerCsv(register), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="register-${org.slug}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
