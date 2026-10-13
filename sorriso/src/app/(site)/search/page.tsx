import { SearchX } from "lucide-react";
import type { Metadata } from "next";
import { PractitionerCard } from "@/components/PractitionerCard";
import { SearchForm } from "@/components/SearchForm";
import { EmptyState } from "@/components/ui";
import { SERVICE_CATEGORIES, type ServiceCategory } from "@/db/schema";
import { listCities, searchPractitioners } from "@/lib/directory";
import { CATEGORY_LABELS } from "@/lib/format";

export const dynamic = "force-dynamic";

type SP = Promise<{ city?: string; category?: string; q?: string }>;

export async function generateMetadata({ searchParams }: { searchParams: SP }): Promise<Metadata> {
  const { city, category } = await searchParams;
  const what = category && CATEGORY_LABELS[category] ? CATEGORY_LABELS[category] : "Dentists";
  return { title: city ? `${what} in ${city}` : what };
}

export default async function SearchPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const category = (SERVICE_CATEGORIES as readonly string[]).includes(sp.category ?? "")
    ? (sp.category as ServiceCategory)
    : undefined;
  const [cities, results] = await Promise.all([
    listCities(),
    searchPractitioners({ city: sp.city, category, q: sp.q }),
  ]);
  const withSlots = results.filter((r) => r.slots.length).length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <SearchForm cities={cities} defaults={{ city: sp.city, category, q: sp.q }} compact />
      <div className="mb-5 mt-8">
        <h1 className="text-2xl font-bold tracking-tight">
          {category ? CATEGORY_LABELS[category] : "Dentists"}
          {sp.city ? ` in ${sp.city}` : " in Italy"}
        </h1>
        <p className="text-sm text-slate-500">
          {results.length} practitioner{results.length === 1 ? "" : "s"} · {withSlots} with online availability this week ·
          sorted by soonest availability
        </p>
      </div>
      {results.length ? (
        <div className="grid gap-4">
          {results.map((r) => (
            <PractitionerCard key={r.practitioner.id} result={r} />
          ))}
        </div>
      ) : (
        <EmptyState icon={<SearchX size={32} />} title="No dentists match your search">
          Try another city or treatment.
        </EmptyState>
      )}
    </div>
  );
}
