import { MapPin, Search, Stethoscope } from "lucide-react";
import { SERVICE_CATEGORIES } from "@/db/enums";
import { CATEGORY_LABELS } from "@/lib/format";
import { cx } from "./ui";

export function SearchForm({
  cities,
  defaults = {},
  compact = false,
}: {
  cities: { city: string }[];
  defaults?: { city?: string; category?: string; q?: string };
  compact?: boolean;
}) {
  return (
    <form
      action="/search"
      className={cx(
        "grid gap-2 rounded-2xl bg-white p-2 shadow-pop ring-1 ring-slate-200/70",
        compact ? "sm:grid-cols-[1fr_1fr_1fr_auto]" : "sm:grid-cols-[1.2fr_1fr_auto]",
      )}
    >
      <label className="flex items-center gap-2 rounded-xl px-3 py-2 hover:bg-slate-50">
        <Stethoscope size={18} className="shrink-0 text-brand-700" />
        <select
          name="category"
          defaultValue={defaults.category ?? ""}
          className="w-full bg-transparent py-1 text-sm font-semibold text-ink outline-none"
          aria-label="Treatment"
        >
          <option value="">Any treatment</option>
          {SERVICE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
      </label>
      {compact ? (
        <label className="flex items-center gap-2 rounded-xl px-3 py-2 hover:bg-slate-50">
          <Search size={18} className="shrink-0 text-brand-700" />
          <input
            name="q"
            defaultValue={defaults.q}
            placeholder="Name, practice, treatment…"
            className="w-full bg-transparent py-1 text-sm font-semibold text-ink outline-none placeholder:font-medium placeholder:text-slate-400"
          />
        </label>
      ) : null}
      <label className="flex items-center gap-2 rounded-xl px-3 py-2 hover:bg-slate-50">
        <MapPin size={18} className="shrink-0 text-brand-700" />
        <select
          name="city"
          defaultValue={defaults.city ?? ""}
          className="w-full bg-transparent py-1 text-sm font-semibold text-ink outline-none"
          aria-label="City"
        >
          <option value="">All cities</option>
          {cities.map((c) => (
            <option key={c.city} value={c.city}>
              {c.city}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-brand-700 px-6 text-sm font-bold text-white hover:bg-brand-800"
      >
        <Search size={17} /> Search
      </button>
    </form>
  );
}
