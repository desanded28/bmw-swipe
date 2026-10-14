import { GRID, SERIES } from "./palette";

export type ColumnDatum = {
  key: string;
  /** Short axis label ("Oct", "1–2 days"). */
  label: string;
  value: number;
  /** Formatted value for the column cap. */
  display: string;
  /** Hover text ("October 2026: 12 reviews, average 4.6"), already translated. */
  detail: string;
};

const HEIGHT = 140;

/**
 * Columns over ordered categories (months, lead-time ranges), one series. Each band is a flex
 * cell holding an inline SVG column at most 24px wide (narrower when 24 months share a phone
 * screen), growing from one hairline baseline with a 3px rounded top. The tallest column carries
 * its value; the others show it on hover and in the table view.
 *
 * Server component: no client JavaScript.
 */
export function ColumnChart({ caption, data, empty }: { caption: string; data: ColumnDatum[]; empty: string }) {
  const top = Math.max(1, ...data.map((d) => d.value));
  const maxIndex = data.reduce((best, d, i) => (d.value > data[best].value ? i : best), 0);
  const hasData = data.some((d) => d.value > 0);
  return (
    <figure className="min-w-0">
      <figcaption className="mb-3 text-sm font-semibold text-slate-700">{caption}</figcaption>
      {!hasData ? (
        <p className="text-sm text-slate-500">{empty}</p>
      ) : (
        <div aria-hidden>
          <div className="flex items-end gap-0.5 border-b" style={{ height: HEIGHT + 18, borderColor: GRID }}>
            {data.map((d, i) => {
              const h = d.value > 0 ? Math.max(2, Math.round((d.value / top) * HEIGHT)) : 0;
              return (
                <div key={d.key} title={d.detail} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end">
                  {i === maxIndex ? <span className="mb-1 text-[11px] font-semibold text-slate-800 tabular-nums">{d.display}</span> : null}
                  {h > 0 ? (
                    <svg width="24" height={h} className="block max-w-full" preserveAspectRatio="none" viewBox={`0 0 24 ${h}`} focusable="false">
                      <rect x="0" y="0" width="24" height={h} rx="3" fill={SERIES} />
                      <rect x="0" y={Math.max(0, h - 4)} width="24" height={Math.min(4, h)} fill={SERIES} />
                    </svg>
                  ) : null}
                </div>
              );
            })}
          </div>
          <div className="mt-1 flex gap-0.5 text-[11px] text-slate-600">
            {data.map((d) => (
              <span key={d.key} className="min-w-0 flex-1 truncate text-center">
                {d.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </figure>
  );
}
