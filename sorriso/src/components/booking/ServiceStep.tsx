"use client";

import type { PublicClinic } from "@/lib/directory";
import { CATEGORY_LABELS, formatPrice } from "@/lib/format";
import { cx } from "../ui";

export function ServiceStep({
  services,
  selected,
  onSelect,
}: {
  services: PublicClinic["services"];
  selected: string;
  onSelect: (id: string) => void;
}) {
  const groups = new Map<string, PublicClinic["services"]>();
  for (const s of services) groups.set(s.category, [...(groups.get(s.category) ?? []), s]);
  return (
    <div className="animate-fade-up space-y-5">
      <h2 className="text-lg font-bold">What do you need?</h2>
      {[...groups.entries()].map(([category, list]) => (
        <div key={category}>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">{CATEGORY_LABELS[category] ?? category}</p>
          <div className="grid gap-2">
            {list.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => onSelect(s.id)}
                className={cx(
                  "flex items-start justify-between gap-4 rounded-xl bg-white p-4 text-left ring-1 transition hover:ring-brand-400",
                  selected === s.id ? "ring-2 ring-brand-600" : "ring-slate-200",
                )}
              >
                <div>
                  <div className="font-semibold text-slate-900">{s.name}</div>
                  {s.description ? <div className="mt-0.5 text-sm text-slate-500">{s.description}</div> : null}
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-bold text-slate-900">{formatPrice(s.priceCents)}</div>
                  <div className="text-xs text-slate-500">{s.durationMinutes} min</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
