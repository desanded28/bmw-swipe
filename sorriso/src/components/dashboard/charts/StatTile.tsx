import { Card } from "../../ui";
import { SERIES, TRACK } from "./palette";

/**
 * A headline figure: label, value and the counts behind it. When `ratio` is given (0-1) a thin
 * meter under the value shows it against 100%, in the same ramp as the charts. Server component.
 */
export function StatTile({ label, value, hint, ratio }: { label: string; value: string; hint?: string; ratio?: number | null }) {
  return (
    <Card className="p-5">
      <p className="text-sm font-semibold text-slate-600">{label}</p>
      <p className="mt-2 text-3xl font-extrabold tracking-tight text-ink">{value}</p>
      {ratio != null ? <Meter ratio={ratio} className="mt-2" /> : null}
      {hint ? <p className="mt-2 text-xs text-slate-600">{hint}</p> : null}
    </Card>
  );
}

/** A 0-1 meter drawn in SVG (decorative: the number next to it is the readable value). */
export function Meter({ ratio, className }: { ratio: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, ratio * 100));
  return (
    <svg width="100%" height="6" aria-hidden focusable="false" className={className}>
      <rect x="0" y="0" width="100%" height="6" rx="3" fill={TRACK} />
      {pct > 0 ? <rect x="0" y="0" width={`${pct}%`} height="6" rx="3" fill={SERIES} /> : null}
    </svg>
  );
}
