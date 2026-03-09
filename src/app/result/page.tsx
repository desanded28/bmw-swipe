"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { NormalizedTrim } from "@/lib/types";
import { fetchBMWTrims } from "@/lib/carquery";
import CarImage from "@/components/CarImage";
import ResultCard from "@/components/ResultCard";

export default function ResultPage() {
  return (
    <Suspense fallback={
      <main className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-white/40" />
      </main>
    }>
      <ResultContent />
    </Suspense>
  );
}

function ResultContent() {
  const searchParams = useSearchParams();
  const [cars, setCars] = useState<NormalizedTrim[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [chosen, setChosen] = useState<NormalizedTrim | null>(null);
  const [loading, setLoading] = useState(true);
  const [cardKey, setCardKey] = useState(0);

  useEffect(() => {
    const idsParam = searchParams.get("ids") || "";
    const ids = idsParam.split(",").filter(Boolean);

    fetchBMWTrims().then((allCars) => {
      const matched = allCars.filter((c) => ids.includes(c.id));
      setCars(matched.length > 0 ? matched : allCars.slice(0, 3));
      setLoading(false);
    });
  }, [searchParams]);

  const handleChoice = useCallback(
    (choice: "yes" | "no") => {
      if (choice === "yes") {
        setChosen(cars[currentIndex]);
        return;
      }

      if (currentIndex + 1 < cars.length) {
        setCurrentIndex((i) => i + 1);
        setCardKey((k) => k + 1);
      } else {
        setCurrentIndex(0);
        setCardKey((k) => k + 1);
      }
    },
    [cars, currentIndex]
  );

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-white/40" />
      </main>
    );
  }

  if (chosen) {
    return (
      <main className="flex min-h-screen flex-col items-center px-6 pt-12 pb-8">
        <div className="animate-fade-in w-full max-w-sm text-center">
          <h1 className="mb-1 text-2xl font-semibold tracking-tight text-white">
            Your Perfect BMW
          </h1>
          <p className="mb-6 text-sm text-gray-400">Great choice.</p>

          <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.04]">
            <div className="h-56 overflow-hidden">
              <CarImage modelName={chosen.name} />
            </div>

            <div className="p-6 text-left">
              <h2 className="text-2xl font-semibold tracking-tight text-white">
                BMW {chosen.name}
              </h2>
              <p className="mb-4 text-sm text-gray-400">
                {chosen.year} {chosen.trim && `· ${chosen.trim}`}
              </p>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Power", value: chosen.powerPs ? `${chosen.powerPs} hp` : "N/A" },
                  { label: "Engine", value: chosen.engineCc ? `${chosen.engineCc.toLocaleString()} cc` : "N/A" },
                  { label: "Torque", value: chosen.torqueNm ? `${chosen.torqueNm} Nm` : "N/A" },
                  { label: "Drive", value: chosen.drive },
                  { label: "Fuel", value: chosen.fuel },
                  { label: "Doors", value: chosen.doors },
                  { label: "Body", value: chosen.body },
                  { label: "Cylinders", value: chosen.cylinders ?? "N/A" },
                  { label: "Year", value: chosen.year },
                ].map((spec) => (
                  <div
                    key={spec.label}
                    className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2"
                  >
                    <div className="text-[10px] text-gray-500">{spec.label}</div>
                    <div className="text-xs font-medium text-gray-200">{spec.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-8 flex gap-3">
            <Link
              href="/swipe"
              className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.04] py-3 text-sm font-medium text-gray-300 hover:bg-white/[0.08]"
            >
              Try Again
            </Link>
            <Link
              href="/"
              className="flex-1 rounded-xl bg-[#1a7fd4] py-3 text-sm font-medium text-white hover:bg-[#1570bd]"
            >
              Home
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const car = cars[currentIndex];

  return (
    <main className="flex min-h-screen flex-col items-center px-6 pt-12 pb-8">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="mb-1 text-xl font-semibold tracking-tight text-white">
            Your Top Matches
          </h1>
          <p className="text-sm text-gray-400">
            {currentIndex + 1} of {cars.length}
          </p>
        </div>

        <ResultCard key={cardKey} car={car} onChoice={handleChoice} />

        {cars.length > 1 && (
          <div className="mt-4 flex items-center justify-center gap-6">
            <button
              onClick={() => {
                setCurrentIndex((i) => (i - 1 + cars.length) % cars.length);
                setCardKey((k) => k + 1);
              }}
              className="text-sm text-gray-500 hover:text-gray-300"
            >
              ← Prev
            </button>
            <div className="flex gap-1.5">
              {cars.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 w-1.5 rounded-full ${
                    i === currentIndex ? "bg-[#1a7fd4]" : "bg-white/[0.12]"
                  }`}
                />
              ))}
            </div>
            <button
              onClick={() => {
                setCurrentIndex((i) => (i + 1) % cars.length);
                setCardKey((k) => k + 1);
              }}
              className="text-sm text-gray-500 hover:text-gray-300"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
