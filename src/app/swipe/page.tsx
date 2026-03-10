"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { NormalizedTrim, SwipeRound, AttributeKey } from "@/lib/types";
import { fetchBMWTrims } from "@/lib/carquery";
import {
  getNextRound,
  applyNumericChoice,
  applyCategoricalChoice,
} from "@/lib/algorithm";
import SwipeCard from "@/components/SwipeCard";
import CategoryPicker from "@/components/CategoryPicker";
import ProgressBar from "@/components/ProgressBar";

export default function SwipePage() {
  const router = useRouter();
  const [cars, setCars] = useState<NormalizedTrim[]>([]);
  const [totalCars, setTotalCars] = useState(0);
  const [completedAttributes, setCompletedAttributes] = useState<AttributeKey[]>([]);
  const [roundNumber, setRoundNumber] = useState(1);
  const [currentRound, setCurrentRound] = useState<SwipeRound | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roundKey, setRoundKey] = useState(0);

  useEffect(() => {
    fetchBMWTrims()
      .then((trims) => {
        setCars(trims);
        setTotalCars(trims.length);
        const round = getNextRound(trims, []);
        setCurrentRound(round);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load car data. Please try again.");
        setLoading(false);
      });
  }, []);

  const advance = useCallback(
    (newCars: NormalizedTrim[], attribute: AttributeKey) => {
      const newCompleted = [...completedAttributes, attribute];

      setCars(newCars);
      setCompletedAttributes(newCompleted);
      setRoundNumber((r) => r + 1);
      setRoundKey((k) => k + 1);

      if (newCars.length <= 3) {
        const ids = newCars.map((c) => c.id).join(",");
        router.push(`/result?ids=${encodeURIComponent(ids)}`);
        return;
      }

      const next = getNextRound(newCars, newCompleted);
      if (!next) {
        const ids = newCars.map((c) => c.id).join(",");
        router.push(`/result?ids=${encodeURIComponent(ids)}`);
        return;
      }

      setCurrentRound(next);
    },
    [completedAttributes, router]
  );

  const handleNumericSwipe = useCallback(
    (direction: "more" | "less") => {
      if (!currentRound || currentRound.type !== "numeric") return;
      const filtered = applyNumericChoice(
        cars,
        currentRound.attribute,
        direction,
        currentRound.median
      );
      advance(filtered, currentRound.attribute);
    },
    [cars, currentRound, advance]
  );

  const handleCategoricalConfirm = useCallback(
    (selected: string[]) => {
      if (!currentRound || currentRound.type !== "categorical") return;
      const filtered = applyCategoricalChoice(
        cars,
        currentRound.attribute,
        selected
      );
      advance(filtered, currentRound.attribute);
    },
    [cars, currentRound, advance]
  );

  const handleSkip = useCallback(() => {
    if (!currentRound) return;
    // Skip without filtering — just mark attribute as done
    const newCompleted = [...completedAttributes, currentRound.attribute];

    setCompletedAttributes(newCompleted);
    setRoundNumber((r) => r + 1);
    setRoundKey((k) => k + 1);

    const next = getNextRound(cars, newCompleted);
    if (!next || cars.length <= 3) {
      const ids = cars.map((c) => c.id).join(",");
      router.push(`/result?ids=${encodeURIComponent(ids)}`);
      return;
    }
    setCurrentRound(next);
  }, [currentRound, cars, completedAttributes, router]);

  const modelBrands = useMemo(() => {
    const map: Record<string, string> = {};
    cars.forEach((c) => { if (!map[c.name]) map[c.name] = c.brand; });
    return map;
  }, [cars]);

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-6">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-white/40" />
          <p className="text-sm text-gray-500">Loading car models...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-6">
        <div className="text-center">
          <p className="mb-4 text-red-400">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg bg-[#1a7fd4] px-6 py-2 text-sm font-medium text-white hover:bg-[#1570bd]"
          >
            Retry
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center px-6 pt-12 pb-8">
      <div className="w-full max-w-sm">
        <ProgressBar
          remaining={cars.length}
          total={totalCars}
          round={roundNumber}
          totalRounds={0}
        />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center py-8" key={roundKey}>
        {currentRound?.type === "numeric" && (
          <SwipeCard
            label={currentRound.label}
            value={currentRound.median}
            unit={currentRound.unit}
            sampleModel={cars[Math.floor(cars.length / 2)]?.name}
            sampleBrand={cars[Math.floor(cars.length / 2)]?.brand}
            onSwipe={handleNumericSwipe}
            onSkip={handleSkip}
          />
        )}
        {currentRound?.type === "categorical" && (
          <CategoryPicker
            label={currentRound.label}
            options={currentRound.options}
            attribute={currentRound.attribute}
            showImages={currentRound.attribute === "name"}
            modelBrands={modelBrands}
            onConfirm={handleCategoricalConfirm}
            onSkip={handleSkip}
          />
        )}
      </div>
    </main>
  );
}
