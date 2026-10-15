/**
 * WCAG 2.x contrast for the practice's brand colour, which sits behind white text in every
 * patient email (header, main button) and on the public pages. No server imports.
 */

/** Text on the brand colour needs 4.5:1 (WCAG 1.4.3, normal text). */
export const MIN_BRAND_CONTRAST = 4.5;

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contrast ratio of two #rrggbb colours (1 to 21). */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** White ("#fff"), or near-black when white text would not reach 4.5:1 and dark reads better. */
export function readableTextOn(background: string): "#fff" | "#0f172a" {
  const white = contrastRatio(background, "#ffffff");
  return white >= MIN_BRAND_CONTRAST || white >= contrastRatio(background, "#0f172a") ? "#fff" : "#0f172a";
}
