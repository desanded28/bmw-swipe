import { requirePermission } from "@/lib/permissions";
import { toCsv } from "@/lib/privacy/register";
import { loadAuditRows, parseAuditFilter } from "../query";

const MAX_ROWS = 50_000;
const COLUMNS = ["seq", "at", "actorType", "actorId", "actorName", "action", "entityType", "entityId", "reason", "metadata", "ipHash", "uaHash", "prevHash", "hash"];

/**
 * GET /dashboard/audit/export?<filters> — the filtered access log as CSV (audit.read), with the
 * hash-chain fields so the export can be verified independently. Newest first, at most 50,000 rows.
 */
export async function GET(req: Request) {
  const s = await requirePermission("audit.read");
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const f = { ...parseAuditFilter(sp), before: null };
  const rows = await loadAuditRows(s.org.id, f, s.org.timezone, MAX_ROWS);
  const csv = toCsv(
    COLUMNS,
    rows.map(({ row, name }) => ({ ...row, at: row.at.toISOString(), actorName: name, metadata: row.metadata ? JSON.stringify(row.metadata) : null })),
  );
  const date = new Date().toISOString().slice(0, 10);
  return new Response(`﻿${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="audit-log-${s.org.slug}-${date}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
