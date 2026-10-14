import { ArrowRight, Clock, Download, Eraser, FileCheck2, Lock, UserPen } from "lucide-react";
import Link from "next/link";
import { PRIVACY_REQUEST_TYPES } from "@/db/enums";
import type { Translator } from "@/i18n/types";
import { Badge, Button, Card, EmptyState, Select } from "../ui";

/**
 * Server-rendered views of the privacy requests inbox, shared by the practice inbox
 * (/dashboard/privacy) and Sorriso's own (/dashboard/platform/privacy). Data comes in scoped and
 * formatted; the translator comes from the page.
 */

type T = Translator<"privacyAdmin">;
type Due = { tone: "red" | "amber" | "slate" | "green"; label: string };

export type InboxRow = {
  id: string;
  type: string;
  channel: string;
  status: string;
  received: string;
  requester: string | null;
  due: Due;
};

export type InboxFilter = { status: "open" | "closed" | "all"; type: string | null; overdue: boolean };

const label = (t: T, group: "types" | "statuses" | "channels" | "decisions", key: string) => {
  const k = `requests.${group}.${key}` as const;
  return t.has(k) ? t(k) : key;
};

export function RequestInbox({ t, rows, filter, base }: { t: T; rows: InboxRow[]; filter: InboxFilter; base: string }) {
  return (
    <div className="space-y-4">
      <form method="get" className="flex flex-wrap items-end gap-3" aria-label={t("requests.filters.apply")}>
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold text-slate-700">{t("requests.filters.status")}</span>
          <Select name="status" defaultValue={filter.status} className="w-40">
            <option value="open">{t("requests.filters.open")}</option>
            <option value="closed">{t("requests.filters.closed")}</option>
            <option value="all">{t("requests.filters.all")}</option>
          </Select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold text-slate-700">{t("requests.filters.type")}</span>
          <Select name="type" defaultValue={filter.type ?? ""} className="w-48">
            <option value="">{t("requests.filters.allTypes")}</option>
            {PRIVACY_REQUEST_TYPES.map((v) => (
              <option key={v} value={v}>
                {label(t, "types", v)}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex h-10 items-center gap-2 text-sm">
          <input type="checkbox" name="overdue" value="1" defaultChecked={filter.overdue} className="h-4 w-4 accent-brand-700" />
          {t("requests.filters.overdue")}
        </label>
        <Button type="submit" variant="secondary">
          {t("requests.filters.apply")}
        </Button>
      </form>

      {rows.length === 0 ? (
        <EmptyState title={t("requests.empty")} />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-2.5">
                  {t("requests.columns.type")}
                </th>
                <th scope="col" className="px-4 py-2.5">
                  {t("requests.columns.requester")}
                </th>
                <th scope="col" className="px-4 py-2.5">
                  {t("requests.columns.received")}
                </th>
                <th scope="col" className="px-4 py-2.5">
                  {t("requests.columns.due")}
                </th>
                <th scope="col" className="px-4 py-2.5">
                  {t("requests.columns.status")}
                </th>
                <th scope="col" className="px-4 py-2.5">
                  <span className="sr-only">{t("requests.view")}</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5">
                    <span className="font-semibold">{label(t, "types", r.type)}</span>
                    <span className="block text-xs text-slate-500">{label(t, "channels", r.channel)}</span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">{r.requester ?? <span className="text-slate-400">{t("requests.unlinked")}</span>}</td>
                  <td className="px-4 py-2.5 text-slate-600">{r.received}</td>
                  <td className="px-4 py-2.5">
                    <Badge tone={r.due.tone}>
                      <Clock size={11} aria-hidden /> {r.due.label}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge>{label(t, "statuses", r.status)}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Link href={`${base}/${r.id}`} className="inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline">
                      {t("requests.view")} <ArrowRight size={14} aria-hidden />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

export type RequestFacts = {
  type: string;
  channel: string;
  status: string;
  received: string;
  due: string;
  dueBadge: Due;
  originalDue: string | null;
  extensionReason: string | null;
  language: string;
  requester: string | null;
  details: string | null;
  /** The request's reply contact (answerContact): kept from an erased record, or given by an unlinked requester. */
  contact?: string | null;
  /** The contact was kept from the linked record when it was erased (staff answer by hand). */
  contactKept?: boolean;
  decision: string | null;
  decisionReason: string | null;
  closedAt: string | null;
};

/** The request's facts, in a definition list. */
export function RequestFactsCard({ t, f }: { t: T; f: RequestFacts }) {
  const rows: [string, React.ReactNode][] = [
    [t("requests.detail.status"), <Badge key="s">{label(t, "statuses", f.status)}</Badge>],
    [t("requests.detail.received"), f.received],
    [
      f.originalDue ? t("requests.detail.extendedUntil") : t("requests.detail.due"),
      <span key="d" className="inline-flex flex-wrap items-center gap-2">
        {f.due}
        <Badge tone={f.dueBadge.tone}>
          <Clock size={11} aria-hidden /> {f.dueBadge.label}
        </Badge>
      </span>,
    ],
    ...(f.originalDue ? ([[t("requests.detail.originalDue"), f.originalDue]] as [string, React.ReactNode][]) : []),
    ...(f.extensionReason ? ([[t("requests.detail.extensionReason"), f.extensionReason]] as [string, React.ReactNode][]) : []),
    [t("requests.detail.channel"), label(t, "channels", f.channel)],
    [t("requests.detail.language"), f.language],
    [t("requests.detail.requester"), f.requester ?? t("requests.unlinked")],
    ...(f.decision ? ([[t("requests.detail.decision"), label(t, "decisions", f.decision)]] as [string, React.ReactNode][]) : []),
    ...(f.decisionReason ? ([[t("requests.detail.reason"), f.decisionReason]] as [string, React.ReactNode][]) : []),
    ...(f.closedAt ? ([[t("requests.detail.closedAt"), f.closedAt]] as [string, React.ReactNode][]) : []),
  ];
  return (
    <Card className="p-5">
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-[180px_1fr]">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-slate-500">{k}</dt>
            <dd className="font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      <h2 className="mb-1 mt-5 text-sm font-bold">{t("requests.detail.details")}</h2>
      <p className="whitespace-pre-line rounded-xl bg-slate-50 p-3 text-sm text-slate-700">{f.details ?? t("requests.detail.noDetails")}</p>
      {f.contact && f.contactKept ? (
        <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
          <p className="font-semibold">{t("requests.detail.contactSnapshot")}</p>
          <p className="break-all">{f.contact}</p>
          <p className="mt-1 text-xs">{t("requests.detail.contactSnapshotHint")}</p>
        </div>
      ) : f.contact ? (
        <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700 ring-1 ring-slate-200">
          <p className="font-semibold">{t("requests.detail.replyTo")}</p>
          <p className="break-all">{f.contact}</p>
          <p className="mt-1 text-xs text-slate-500">{t("requests.detail.replyToHint")}</p>
        </div>
      ) : null}
    </Card>
  );
}

/**
 * Links that open the patient record with the matching action ready. The erasure link carries the
 * request, so erasing also answers it (to the patient's contact, before it is removed).
 */
export function OneClickActions({
  t,
  requestId,
  patientId,
  type,
  allowed,
}: {
  t: T;
  requestId?: string;
  patientId: string;
  type: string;
  allowed: { export: boolean; erase: boolean; restrict: boolean; write: boolean };
}) {
  const href = (action: string) => `/dashboard/patients/${patientId}?action=${action}`;
  const links = [
    { show: allowed.export && (type === "access" || type === "portability"), href: href("export"), icon: <Download size={15} aria-hidden />, label: t("requests.detail.oneClick.export") },
    {
      show: allowed.erase && type === "erasure",
      href: requestId ? `${href("erase")}&request=${encodeURIComponent(requestId)}` : href("erase"),
      icon: <Eraser size={15} aria-hidden />,
      label: t("requests.detail.oneClick.erase"),
    },
    { show: allowed.restrict && (type === "restriction" || type === "objection"), href: href("restrict"), icon: <Lock size={15} aria-hidden />, label: t("requests.detail.oneClick.restrict") },
    { show: allowed.write && (type === "objection" || type === "consent_withdrawal"), href: href("consents"), icon: <FileCheck2 size={15} aria-hidden />, label: t("requests.detail.oneClick.consents") },
    { show: allowed.write && type === "rectification", href: `/dashboard/patients/${patientId}`, icon: <UserPen size={15} aria-hidden />, label: t("requests.detail.oneClick.rectify") },
    { show: true, href: `/dashboard/patients/${patientId}`, icon: <ArrowRight size={15} aria-hidden />, label: t("requests.detail.openPatient") },
  ].filter((l) => l.show);
  return (
    <Card className="p-5">
      <h2 className="font-bold">{t("requests.detail.oneClick.title")}</h2>
      <p className="mb-3 mt-0.5 text-sm text-slate-500">{t("requests.detail.oneClick.hint")}</p>
      <div className="flex flex-wrap gap-2">
        {links.map((l) => (
          <Link key={l.href + l.label} href={l.href} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-brand-50 px-3 text-sm font-semibold text-brand-800 hover:bg-brand-100">
            {l.icon} {l.label}
          </Link>
        ))}
      </div>
    </Card>
  );
}
