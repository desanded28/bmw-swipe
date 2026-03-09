"use client";

import { useRef, useState, useCallback } from "react";
import { NormalizedTrim } from "@/lib/types";
import CarImage from "@/components/CarImage";

interface ResultCardProps {
  car: NormalizedTrim;
  onChoice: (choice: "yes" | "no") => void;
}

export default function ResultCard({ car, onChoice }: ResultCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [animClass, setAnimClass] = useState("animate-card-enter");
  const startX = useRef(0);
  const threshold = 80;

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (animClass === "swipe-left" || animClass === "swipe-right") return;
      setIsDragging(true);
      startX.current = e.clientX;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [animClass]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return;
      setDragX(e.clientX - startX.current);
    },
    [isDragging]
  );

  const handlePointerUp = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);

    if (Math.abs(dragX) > threshold) {
      const choice = dragX > 0 ? "yes" : "no";
      setAnimClass(choice === "yes" ? "swipe-right" : "swipe-left");
      setTimeout(() => onChoice(choice), 300);
    } else {
      setDragX(0);
    }
  }, [isDragging, dragX, onChoice]);

  const triggerChoice = (choice: "yes" | "no") => {
    setAnimClass(choice === "yes" ? "swipe-right" : "swipe-left");
    setTimeout(() => onChoice(choice), 300);
  };

  const rotation = isDragging ? dragX * 0.04 : 0;

  const specs = [
    { label: "Power", value: car.powerPs ? `${car.powerPs} hp` : "N/A" },
    { label: "Engine", value: car.engineCc ? `${car.engineCc.toLocaleString()} cc` : "N/A" },
    { label: "Torque", value: car.torqueNm ? `${car.torqueNm} Nm` : "N/A" },
    { label: "Drive", value: car.drive },
    { label: "Fuel", value: car.fuel },
    { label: "Doors", value: car.doors },
  ];

  return (
    <div className="flex flex-col items-center gap-5">
      <div
        ref={cardRef}
        className={`relative w-full max-w-sm cursor-grab select-none overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.04] ${animClass}`}
        style={{
          transform: isDragging
            ? `translateX(${dragX}px) rotate(${rotation}deg)`
            : undefined,
          touchAction: "none",
          transition: isDragging ? "none" : "transform 0.2s",
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* Swipe hints */}
        <div
          className="pointer-events-none absolute left-4 top-4 z-10 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-sm font-medium text-red-400 transition-opacity"
          style={{
            opacity:
              isDragging && dragX < -20
                ? Math.min(1, Math.abs(dragX) / threshold)
                : 0,
          }}
        >
          NOPE
        </div>
        <div
          className="pointer-events-none absolute right-4 top-4 z-10 rounded-md border border-green-500/30 bg-green-500/10 px-3 py-1.5 text-sm font-medium text-green-400 transition-opacity"
          style={{
            opacity:
              isDragging && dragX > 20
                ? Math.min(1, dragX / threshold)
                : 0,
          }}
        >
          PICK
        </div>

        {/* Car image */}
        <div className="h-48 overflow-hidden">
          <CarImage modelName={car.name} />
        </div>

        {/* Car info */}
        <div className="p-5">
          <h2 className="text-xl font-semibold tracking-tight text-white">
            BMW {car.name}
          </h2>
          <p className="mb-4 text-sm text-gray-400">
            {car.year} {car.trim && `· ${car.trim}`}
          </p>

          <div className="grid grid-cols-3 gap-2">
            {specs.map((spec) => (
              <div
                key={spec.label}
                className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2"
              >
                <div className="text-[10px] text-gray-500">{spec.label}</div>
                <div className="text-xs font-medium text-gray-200">
                  {spec.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Icon buttons */}
      <div className="flex items-center gap-6">
        <button
          onClick={() => triggerChoice("no")}
          className="flex h-14 w-14 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-gray-400 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20"
          aria-label="Not this one"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-6 w-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
        <button
          onClick={() => triggerChoice("yes")}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-[#1a7fd4] text-white hover:bg-[#1570bd]"
          aria-label="This one"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-6 w-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
        </button>
      </div>
    </div>
  );
}
