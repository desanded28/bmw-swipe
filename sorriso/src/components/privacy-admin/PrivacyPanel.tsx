import { CircleCheck, CircleSlash, Clock, Eye } from "lucide-react";
import Link from "next/link";
import type { Translator } from "@/i18n/types";
import { Badge, Card } from "../ui";

/**
 * Server-rendered parts of the patient's privacy panel. They receive the translator from the page
 * (components can't load dictionaries themselves) and data already scoped to the practice and
 * formatted for the viewer.
 */

type T = Translator<"privacyAdmin">;

/** The label of an audit action ("patient.view" -> "Viewed a patient"), or the raw action for unknown ones. */
export function auditActionLabel(t: T, action: string): string {
  const key = `audit.actions.${action}` as const;
  return t.has(key) ? t(key) : action;
}

export type ConsentEntry = {
  id: string;
  title: string;
  granted: boolean;
  /** A legitimate-interest or care purpose: a "no" is an objection, not a withdrawal. */
  objectable: boolean;
  at: string;
  source: string;
  method: string;
  actorRelation: string;
};

/** The consent ledger as a timeline, newest first. */
export function ConsentTimeline({ t, entries }: { t: T; entries: ConsentEntry[] }) {
  if (!entries.length) return <p className="text-sm text-slate-500">{t("privacy.noConsents")}</p>;
  const label = (key: string, group: "sources" | "methods" | "by") => {
    const k = `privacy.${group}.${key}` as const;
    return t.has(k) ? t(k) : key;
  };
  return (
    <ol className="relative space-y-3 border-l border-slate-200 pl-5">
      {entries.map((e) => (
        <li key={e.id} className="relative">
          <span
            className={`absolute -left-[27px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full ring-4 ring-white ${e.granted ? "bg-emerald-500" : "bg-slate-400"}`}
            aria-hidden
          >
            {e.granted ? <CircleCheck size={10} className="text-white" /> : <CircleSlash size={10} className="text-white" />}
          </span>
          <p className="text-sm">
            <span className="font-semibold">{e.title}</span>{" "}
            <Badge tone={e.granted ? "green" : "slate"}>{e.granted ? t("privacy.granted") : e.objectable ? t("privacy.objected") : t("privacy.withdrawn")}</Badge>
          </p>
          <p className="text-xs text-slate-500">
            <time>{e.at}</time> · {t("privacy.consentMeta", { source: label(e.source, "sources"), method: label(e.method, "methods"), by: label(e.actorRelation, "by") })}
          </p>
        </li>
      ))}
    </ol>
  );
}

export type AccessEntry = { id: string; at: string; who: string; action: string };

/** "Who accessed this record": the latest audit rows about the patient and their appointments. */
export function AccessLog({ t, entries, limit }: { t: T; entries: AccessEntry[]; limit: number }) {
  if (!entries.length) return <p className="text-sm text-slate-500">{t("privacy.noAccess")}</p>;
  return (
    <div>
      <ul className="divide-y divide-slate-100 text-sm">
        {entries.map((e) => (
          <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-x-3 py-1.5">
            <span className="inline-flex items-center gap-1.5">
              <Eye size={13} className="text-slate-400" aria-hidden />
              {t("privacy.accessLine", { who: e.who, action: auditActionLabel(t, e.action) })}
            </span>
            <time className="text-xs text-slate-500">{e.at}</time>
          </li>
        ))}
      </ul>
      {entries.length >= limit ? <p className="mt-2 text-xs text-slate-500">{t("privacy.showingLatest", { count: limit })}</p> : null}
    </div>
  );
}

export type RequestEntry = { id: string; type: string; status: string; received: string; due: { tone: "red" | "amber" | "slate" | "green"; label: string } };

export function RequestList({ t, entries, base = "/dashboard/privacy" }: { t: T; entries: RequestEntry[]; base?: string }) {
  if (!entries.length) return <p className="text-sm text-slate-500">{t("privacy.noRequests")}</p>;
  const typeLabel = (k: string) => {
    const key = `requests.types.${k}` as const;
    return t.has(key) ? t(key) : k;
  };
  const statusLabel = (k: string) => {
    const key = `requests.statuses.${k}` as const;
    return t.has(key) ? t(key) : k;
  };
  return (
    <ul className="divide-y divide-slate-100 text-sm">
      {entries.map((r) => (
        <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
          <Link href={`${base}/${r.id}`} className="font-semibold text-brand-700 hover:underline">
            {typeLabel(r.type)}
          </Link>
          <span className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
            <span>{r.received}</span>
            <Badge>{statusLabel(r.status)}</Badge>
            <Badge tone={r.due.tone}>
              <Clock size={11} aria-hidden /> {r.due.label}
            </Badge>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function PanelCard({ title, children, intro }: { title: string; intro?: string; children: React.ReactNode }) {
  return (
    <Card className="p-5">
      <h2 className="font-bold">{title}</h2>
      {intro ? <p className="mb-3 mt-0.5 text-xs text-slate-500">{intro}</p> : <div className="mb-3" />}
      {children}
    </Card>
  );
}
