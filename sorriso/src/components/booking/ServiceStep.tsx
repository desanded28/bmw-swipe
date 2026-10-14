"use client";

import { useId } from "react";
import type { ServiceCategory } from "@/db/enums";
import { useT } from "@/i18n/provider";
import type { PublicClinic } from "@/lib/directory";
import { cx } from "../ui";

/** Price and duration texts per service, formatted on the server (BookingFlow's `labels`). */
export type ServiceLabels = Record<string, { price: string; duration: string }>;

export function ServiceStep({
  services,
  selected,
  labels,
  headingId,
  onSelect,
}: {
  services: PublicClinic["services"];
  selected: string;
  labels: ServiceLabels;
  /** The id of this step's heading, which receives focus when the step opens. */
  headingId: string;
  onSelect: (id: string) => void;
}) {
  const t = useT("booking");
  const tc = useT("common");
  const uid = useId();
  const groups = new Map<string, PublicClinic["services"]>();
  for (const s of services) groups.set(s.category, [...(groups.get(s.category) ?? []), s]);
  const categoryLabel = (c: string) => {
    const key = `categories.${c as ServiceCategory}` as const;
    return tc.has(key) ? tc(key) : c;
  };
  return (
    <div className="animate-fade-up space-y-5">
      <h2 id={headingId} tabIndex={-1} className="text-lg font-bold">
        {t("service.heading")}
      </h2>
      {[...groups.entries()].map(([category, list]) => (
        <section key={category} aria-labelledby={`${uid}-${category}`}>
          <h3 id={`${uid}-${category}`} className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-600">
            {categoryLabel(category)}
          </h3>
          <ul className="grid gap-2">
            {list.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => onSelect(s.id)}
                  aria-pressed={selected === s.id}
                  className={cx(
                    "flex w-full items-start justify-between gap-4 rounded-xl bg-white p-4 text-left ring-1 transition hover:ring-brand-500",
                    selected === s.id ? "ring-2 ring-brand-600" : "ring-slate-300",
                  )}
                >
                  <span>
                    <span className="block font-semibold text-slate-900">{s.name}</span>
                    {s.description ? <span className="mt-0.5 block text-sm text-slate-600">{s.description}</span> : null}
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-bold text-slate-900">{labels[s.id]?.price}</span>
                    <span className="block text-xs text-slate-600">{labels[s.id]?.duration}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
