/**
 * Chart colours for the analytics page (light surface only: the dashboard has no dark theme).
 * Checked with the data-viz palette validator against the white card surface:
 *   SERIES      brand-500, one series per chart (lightness band, chroma and >= 3:1 contrast pass)
 *   ORDINAL     brand-400 -> brand-500 -> brand-700 for ordered stages (funnel): monotone
 *               lightness, single hue, light end 2.3:1 against the surface
 * Text never takes these colours: labels and values use the slate text tokens.
 */
export const SERIES = "#0fa18b";
export const ORDINAL = ["#27bda4", "#0fa18b", "#0c675d"] as const;
/** Unfilled track behind a rate bar: a light step of the same ramp. */
export const TRACK = "#e6f6f2";
/** Hairline gridlines and baselines. */
export const GRID = "#e2e8f0";
