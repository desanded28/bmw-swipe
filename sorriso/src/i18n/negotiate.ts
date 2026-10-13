import { isLocale, type Locale } from "./config";

/**
 * Pick a supported locale from an Accept-Language header, honouring q-values and matching on the
 * primary subtag (de-CH -> de, pt-BR -> pt). Returns null when nothing matches, so the caller
 * chooses the fallback (usually DEFAULT_LOCALE). A wildcard (*) matches nothing on purpose.
 */
export function negotiate(acceptLanguage: string | null | undefined): Locale | null {
  if (!acceptLanguage) return null;
  const ranges = acceptLanguage
    .split(",")
    .map((entry, index) => {
      const [tag, ...params] = entry.trim().split(";");
      let q = 1;
      for (const param of params) {
        const [k, v] = param.trim().split("=");
        if (k?.trim().toLowerCase() === "q") {
          const n = Number(v);
          q = Number.isFinite(n) ? Math.min(Math.max(n, 0), 1) : 0;
        }
      }
      return { primary: tag.trim().split(/[-_]/)[0].toLowerCase(), q, index };
    })
    .filter((r) => r.primary && r.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index);
  for (const r of ranges) if (isLocale(r.primary)) return r.primary;
  return null;
}
