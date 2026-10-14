"use client";

import { LoaderCircle, Lock, Search, UserX, X } from "lucide-react";
import Link from "next/link";
import { useId, useState, useTransition } from "react";
import { listPatientRows, type PatientPage } from "@/app/dashboard/actions/patients";
import { useT } from "@/i18n/provider";
import { Badge, Button, Card, EmptyState, Input } from "../ui";

/**
 * The patients list with its search. The search is a POST server action (never a ?q= in the URL):
 * names typed here don't end up in the address bar, the browser history, proxies or server logs.
 * Without a search, pages are plain links (?page=N carries no personal data).
 */
export function PatientSearch({ initial }: { initial: PatientPage }) {
  const t = useT("privacyAdmin");
  const [q, setQ] = useState("");
  const [result, setResult] = useState<{ q: string; page: PatientPage } | null>(null);
  const [pending, start] = useTransition();
  const inputId = useId();
  const hintId = useId();

  const run = (term: string, page = 1) =>
    start(async () => {
      if (!term.trim()) return setResult(null);
      setResult({ q: term, page: await listPatientRows(term, page) });
    });

  const data = result?.page ?? initial;
  const searching = Boolean(result);

  return (
    <div>
      <form
        role="search"
        className="mb-4 flex max-w-xl flex-wrap items-start gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(q);
        }}
      >
        <div className="relative min-w-0 flex-1">
          <label htmlFor={inputId} className="sr-only">
            {t("patients.searchLabel")}
          </label>
          <Search size={16} className="pointer-events-none absolute left-3 top-3 text-slate-400" aria-hidden />
          <Input
            id={inputId}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("patients.searchPlaceholder")}
            aria-describedby={hintId}
            autoComplete="off"
            className="pl-9"
          />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? <LoaderCircle size={16} className="animate-spin" aria-hidden /> : null}
          {t("patients.search")}
        </Button>
        {searching ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setQ("");
              setResult(null);
            }}
          >
            <X size={16} aria-hidden /> {t("patients.clear")}
          </Button>
        ) : null}
        <p id={hintId} className="w-full text-xs text-slate-500">
          {t("patients.searchHint")}
        </p>
      </form>

      <p className="mb-2 text-sm text-slate-500" aria-live="polite">
        {searching ? t("patients.results", { count: data.total }) : t("patients.count", { count: data.total })}
      </p>

      {data.rows.length === 0 ? (
        <EmptyState title={searching ? t("patients.noResults") : t("patients.empty")} />
      ) : (
        <PatientTable page={data} />
      )}

      {data.pages > 1 ? (
        <nav className="mt-4 flex items-center justify-between text-sm font-semibold" aria-label={t("patients.page", { page: data.page, pages: data.pages })}>
          {data.page > 1 ? (
            searching ? (
              <button type="button" className="text-brand-700 hover:underline" onClick={() => run(result!.q, data.page - 1)}>
                ← {t("patients.previous")}
              </button>
            ) : (
              <Link href={`?page=${data.page - 1}`} className="text-brand-700 hover:underline">
                ← {t("patients.previous")}
              </Link>
            )
          ) : (
            <span />
          )}
          <span className="text-slate-500">{t("patients.page", { page: data.page, pages: data.pages })}</span>
          {data.page < data.pages ? (
            searching ? (
              <button type="button" className="text-brand-700 hover:underline" onClick={() => run(result!.q, data.page + 1)}>
                {t("patients.next")} →
              </button>
            ) : (
              <Link href={`?page=${data.page + 1}`} className="text-brand-700 hover:underline">
                {t("patients.next")} →
              </Link>
            )
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}

function PatientTable({ page }: { page: PatientPage }) {
  const t = useT("privacyAdmin");
  return (
    <Card className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
          <tr>
            <th scope="col" className="px-4 py-2.5">
              {t("patients.columns.name")}
            </th>
            <th scope="col" className="px-4 py-2.5">
              {t("patients.columns.contact")}
            </th>
            <th scope="col" className="px-4 py-2.5">
              {t("patients.columns.next")}
            </th>
            <th scope="col" className="px-4 py-2.5">
              {t("patients.columns.last")}
            </th>
            <th scope="col" className="px-4 py-2.5 text-right">
              {t("patients.columns.visits")}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {page.rows.map((p) => (
            <tr key={p.id} className="hover:bg-slate-50">
              <td className="px-4 py-2.5">
                <Link href={`/dashboard/patients/${p.id}`} className="font-semibold hover:underline focus-visible:underline">
                  {p.name ?? t("patients.restrictedName")}
                </Link>
                {p.erased ? (
                  <Badge className="ml-2">{t("patients.erased")}</Badge>
                ) : p.restricted ? (
                  <Badge tone="amber" className="ml-2">
                    <Lock size={11} aria-hidden /> {t("patients.restricted")}
                  </Badge>
                ) : null}
                {p.noShows ? (
                  <Badge tone="red" className="ml-2" title={t("patients.noShows", { count: p.noShows })}>
                    <UserX size={11} aria-hidden /> <span className="sr-only">{t("patients.noShows", { count: p.noShows })}</span>
                    <span aria-hidden>{p.noShows}</span>
                  </Badge>
                ) : null}
              </td>
              <td className="px-4 py-2.5 text-slate-600">
                {p.phone ?? "—"}
                {p.email ? <span className="block text-xs text-slate-400">{p.email}</span> : null}
              </td>
              <td className="px-4 py-2.5">{p.next ?? "—"}</td>
              <td className="px-4 py-2.5 text-slate-600">{p.last ?? "—"}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{p.visits}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
