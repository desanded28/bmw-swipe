export function formatPrice(cents: number | null | undefined, locale = "it-IT"): string {
  if (cents == null) return "Price on request";
  if (cents === 0) return "Free";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

export function initials(name: string): string {
  return name
    .replace(/^(dr\.?|dott\.?(ssa)?\.?|prof\.?)\s+/i, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function fullName(p: { firstName: string; lastName: string }): string {
  return `${p.firstName} ${p.lastName}`.trim();
}

export function practitionerName(p: { title: string; name: string }): string {
  return p.title ? `${p.title} ${p.name}` : p.name;
}

export function pluralize(n: number, one: string, many: string = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export const CATEGORY_LABELS: Record<string, string> = {
  checkup: "Check-up & first visit",
  hygiene: "Cleaning & hygiene",
  orthodontics: "Orthodontics & aligners",
  implants: "Implants",
  aesthetic: "Whitening & aesthetic",
  endodontics: "Root canal",
  pediatric: "Children's dentistry",
  surgery: "Oral surgery",
  emergency: "Dental emergency",
  prosthetics: "Crowns & prosthetics",
};
