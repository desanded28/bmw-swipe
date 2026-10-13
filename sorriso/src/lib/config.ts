export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "Sorriso";
export const APP_URL = (process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3010").replace(
  /\/$/,
  "",
);
export const DEFAULT_TIMEZONE = "Europe/Rome";
export const DEFAULT_COUNTRY_CODE = process.env.DEFAULT_COUNTRY_CODE ?? "39";

export function absoluteUrl(path: string): string {
  return `${APP_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
