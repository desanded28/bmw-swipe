import { SERIES, TRACK } from "./palette";

export type BarDatum = {
  key: string;
  label: string;
  /** null = no data for this item (drawn as an empty track). */
  value: number | null;
  /** The formatted value shown at the bar's tip ("12,5 %", "48"). */
  display: string;
  /** Hover text with the details behind the value ("3 no-shows in 24 visits"). */
  detail?: string;
  /** Overrides the series colour (ordered stages of a funnel). */
  color?: string;
};

/**
 * Horizontal bars, one series, inline SVG. Bars grow from a single baseline, are at most 12px
 * thick with a 3px rounded data end (square at the baseline), and carry their value at the tip in
 * text colours; the label column is HTML so long treatment names wrap instead of being clipped.
 * Hover shows the detail (SVG <title>); every value is also in the text and in the table view.
 *
 * Server component: no client JavaScript, nothing tracked.
 */
export function BarChart({ caption, data, max, empty, id }: { caption: string; data: BarDatum[]; max?: number; empty: string; id?: string }) {
  const top = max ?? Math.max(1, ...data.map((d) => d.value ?? 0));
  return (
    <figure className="min-w-0" aria-labelledby={id ? `${id}-caption` : undefined}>
      <figcaption id={id ? `${id}-caption` : undefined} className="mb-3 text-sm font-semibold text-slate-700">
        {caption}
      </figcaption>
      {data.length === 0 ? (
        <p className="text-sm text-slate-500">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {data.map((d) => {
            const pct = d.value == null ? 0 : Math.max(0, Math.min(100, (d.value / top) * 100));
            return (
              <li key={d.key} className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_auto] items-center gap-3 text-sm sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_auto]">
                <span className="min-w-0 text-slate-700 [overflow-wrap:anywhere]">{d.label}</span>
                <svg width="100%" height="14" aria-hidden focusable="false" className="block overflow-visible">
                  <rect x="0" y="1" width="100%" height="12" rx="3" fill={TRACK} />
                  {pct > 0 ? (
                    <g fill={d.color ?? SERIES}>
                      {d.detail ? <title>{d.detail}</title> : null}
                      <rect x="0" y="1" width={`${pct}%`} height="12" rx="3" />
                      {/* Square the end that sits on the baseline. */}
                      <rect x="0" y="1" width={Math.min(4, pct)} height="12" />
                    </g>
                  ) : null}
                </svg>
                <span className="text-right font-semibold tabular-nums text-ink" title={d.detail}>
                  {d.display}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </figure>
  );
}
