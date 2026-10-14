import { ShieldAlert, ShieldCheck } from "lucide-react";
import type { Translator } from "@/i18n/types";

/**
 * The audit log's integrity, as verifyAuditChain() reported it: green when every row still
 * matches its hash and follows the previous one, red with the first offending row otherwise.
 * The prop has the shape of AuditChainResult (src/lib/audit.ts, server-only).
 */
type AuditChainResult = { ok: true } | { ok: false; brokenAtId: string | null; reason: "hash" | "link" | "anchor" | "head" };

export function AuditChainStatus({ t, result }: { t: Translator<"privacyAdmin">; result: AuditChainResult }) {
  if (result.ok) {
    return (
      <p role="status" className="flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 ring-1 ring-emerald-200">
        <ShieldCheck size={18} className="mt-0.5 shrink-0" aria-hidden />
        {t("audit.chain.ok")}
      </p>
    );
  }
  const reason = t(`audit.chain.reasons.${result.reason}`);
  return (
    <p role="alert" data-broken-at={result.brokenAtId ?? undefined} className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-800 ring-1 ring-red-200">
      <ShieldAlert size={18} className="mt-0.5 shrink-0" aria-hidden />
      {result.brokenAtId ? t("audit.chain.broken", { id: result.brokenAtId, reason }) : t("audit.chain.brokenNoRow", { reason })}
    </p>
  );
}
