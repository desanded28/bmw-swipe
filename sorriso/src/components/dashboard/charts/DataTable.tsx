/**
 * The table view of a chart, behind a disclosure (`summary`): every value a chart draws is
 * readable here as text (screen readers, keyboard users, anyone who wants the exact numbers).
 * Without `summary` the table is shown as it is. Server component.
 */
export function DataTable({
  summary,
  caption,
  headers,
  rows,
  empty,
}: {
  summary?: string;
  caption: string;
  headers: string[];
  rows: { key: string; cells: (string | number)[] }[];
  /** Shown instead of an empty table when there is no `summary`. */
  empty?: string;
}) {
  if (!rows.length) return !summary && empty ? <p className="text-sm text-slate-500">{empty}</p> : null;
  const table = (
    // relative: the sr-only caption (absolutely positioned) stays inside the scroll container.
    <div className={summary ? "relative mt-2 overflow-x-auto" : "relative overflow-x-auto"}>
      <table className="w-full min-w-[20rem] border-collapse text-left text-xs">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-slate-200 text-slate-600">
            {headers.map((h, i) => (
              <th key={h} scope="col" className={i === 0 ? "py-1.5 pr-3 font-semibold" : "py-1.5 pl-3 text-right font-semibold"}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-b border-slate-100 last:border-0">
              {r.cells.map((c, i) =>
                i === 0 ? (
                  <th key={i} scope="row" className="py-1.5 pr-3 font-medium text-slate-800">
                    {c}
                  </th>
                ) : (
                  <td key={i} className="py-1.5 pl-3 text-right tabular-nums text-slate-700">
                    {c}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  if (!summary) return table;
  return (
    <details className="mt-3 text-sm">
      <summary className="cursor-pointer text-xs font-semibold text-brand-700 hover:underline">{summary}</summary>
      {table}
    </details>
  );
}
